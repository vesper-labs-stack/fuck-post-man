//! HTTP engine: all outbound network traffic lives here so the webview never
//! issues requests directly (no CORS, no mixed-content restrictions).

use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::time::{Duration, Instant};

use reqwest::header::{HeaderMap, HeaderName, HeaderValue, CONTENT_TYPE};
use reqwest::{Client, Method};
use tauri::Emitter;

/// Request payload sent from the frontend. Field names are snake_case on both
/// sides of the IPC boundary so the JSON contract stays strictly aligned.
#[derive(Debug, Clone, Deserialize)]
pub struct HttpRequestPayload {
    pub method: String,
    pub url: String,
    #[serde(default)]
    pub headers: HashMap<String, String>,
    #[serde(default)]
    pub params: HashMap<String, String>,
    pub body_type: String,
    #[serde(default)]
    pub body: Option<String>,
    #[serde(default)]
    pub timeout_ms: Option<u64>,
}

/// Response payload returned to the frontend.
#[derive(Debug, Clone, Serialize)]
pub struct HttpResponsePayload {
    pub status_code: u16,
    pub status_text: String,
    pub headers: HashMap<String, String>,
    pub body: String,
    pub time_elapsed_ms: u128,
    pub size_bytes: usize,
}

const DEFAULT_TIMEOUT_MS: u64 = 30_000;
const CONNECT_TIMEOUT_MS: u64 = 15_000;

/// Execute an HTTP request and return a fully-materialized response.
///
/// Timing spans from just before `send()` until the entire response body has
/// been received, so `time_elapsed_ms` reflects the real round-trip cost.
/// SSE responses are additionally pushed to the frontend chunk by chunk via
/// `http-stream://{stream_id}/meta` and `http-stream://{stream_id}/chunk`.
#[tauri::command]
pub async fn execute_request(
    app: tauri::AppHandle,
    payload: HttpRequestPayload,
    stream_id: Option<String>,
) -> Result<HttpResponsePayload, String> {
    let timeout = Duration::from_millis(payload.timeout_ms.unwrap_or(DEFAULT_TIMEOUT_MS));

    // Per-read timeout instead of a total deadline: an SSE stream may stay
    // open far longer than any fixed timeout while still delivering chunks.
    let client = Client::builder()
        .read_timeout(timeout)
        .connect_timeout(Duration::from_millis(CONNECT_TIMEOUT_MS))
        .gzip(true)
        .brotli(true)
        .deflate(true)
        .redirect(reqwest::redirect::Policy::limited(10))
        .build()
        .map_err(|e| format!("构建 HTTP 客户端失败: {}", error_chain(&e)))?;

    let method = Method::from_bytes(payload.method.trim().to_uppercase().as_bytes())
        .map_err(|_| format!("不支持的 HTTP 方法: {}", payload.method))?;

    // Vault placeholders are resolved here, in Rust, so plaintext secrets
    // never travel back to the webview or into persisted history.
    let url = crate::vault::resolve_secrets(payload.url.trim())?;
    if url.is_empty() {
        return Err("请求 URL 不能为空".to_string());
    }
    let mut headers = HashMap::new();
    for (key, value) in &payload.headers {
        headers.insert(key.clone(), crate::vault::resolve_secrets(value)?);
    }
    let mut params = HashMap::new();
    for (key, value) in &payload.params {
        params.insert(key.clone(), crate::vault::resolve_secrets(value)?);
    }
    let body = match &payload.body {
        Some(raw) => Some(crate::vault::resolve_secrets(raw)?),
        None => None,
    };
    let resolved = HttpRequestPayload {
        method: payload.method.clone(),
        url,
        headers,
        params,
        body_type: payload.body_type.clone(),
        body,
        timeout_ms: payload.timeout_ms,
    };

    let mut request = client.request(method, &resolved.url);

    if !resolved.params.is_empty() {
        request = request.query(&resolved.params);
    }

    let mut header_map = HeaderMap::new();
    for (key, value) in &resolved.headers {
        let key = key.trim();
        if key.is_empty() {
            continue;
        }
        let name = HeaderName::from_bytes(key.as_bytes())
            .map_err(|_| format!("非法的请求头名称: {key}"))?;
        let value = HeaderValue::from_str(value)
            .map_err(|_| format!("非法的请求头值: {key}"))?;
        header_map.insert(name, value);
    }

    request = attach_body(request, &resolved, header_map)?;

    let start = Instant::now();
    let mut response = request.send().await.map_err(map_reqwest_error)?;
    let status = response.status();
    let response_headers = response.headers().clone();

    let mut headers_out: HashMap<String, String> = HashMap::new();
    for (name, value) in response_headers.iter() {
        let value = value.to_str().unwrap_or("").to_string();
        headers_out
            .entry(name.as_str().to_string())
            .and_modify(|existing: &mut String| {
                existing.push_str(", ");
                existing.push_str(&value);
            })
            .or_insert(value);
    }

    let is_sse = headers_out
        .get("content-type")
        .map(|v| v.to_lowercase().contains("text/event-stream"))
        .unwrap_or(false);

    let (body, size_bytes) = if is_sse {
        stream_body(&app, stream_id.as_deref(), status, &headers_out, &mut response).await?
    } else {
        let bytes = response.bytes().await.map_err(map_reqwest_error)?;
        (String::from_utf8_lossy(&bytes).to_string(), bytes.len())
    };
    let elapsed = start.elapsed().as_millis();

    Ok(HttpResponsePayload {
        status_code: status.as_u16(),
        status_text: status.canonical_reason().unwrap_or("").to_string(),
        headers: headers_out,
        body,
        time_elapsed_ms: elapsed,
        size_bytes,
    })
}

#[derive(Clone, Serialize)]
struct StreamMeta {
    status_code: u16,
    status_text: String,
    headers: HashMap<String, String>,
}

#[derive(Clone, Serialize)]
struct StreamChunk {
    text: String,
}

/// Consume an SSE response chunk by chunk, pushing each piece to the frontend
/// as a Tauri event while accumulating the full body for the final payload.
async fn stream_body(
    app: &tauri::AppHandle,
    stream_id: Option<&str>,
    status: reqwest::StatusCode,
    headers: &HashMap<String, String>,
    response: &mut reqwest::Response,
) -> Result<(String, usize), String> {
    if let Some(id) = stream_id {
        let _ = app.emit(
            &format!("http-stream://{id}/meta"),
            StreamMeta {
                status_code: status.as_u16(),
                status_text: status.canonical_reason().unwrap_or("").to_string(),
                headers: headers.clone(),
            },
        );
    }

    let mut text = String::new();
    let mut size = 0usize;
    let mut pending: Vec<u8> = Vec::new();
    loop {
        match response.chunk().await {
            Ok(Some(bytes)) => {
                size += bytes.len();
                pending.extend_from_slice(&bytes);
                let piece = drain_utf8(&mut pending);
                if !piece.is_empty() {
                    text.push_str(&piece);
                    if let Some(id) = stream_id {
                        let _ = app.emit(
                            &format!("http-stream://{id}/chunk"),
                            StreamChunk { text: piece },
                        );
                    }
                }
            }
            Ok(None) => break,
            Err(e) => return Err(map_reqwest_error(e)),
        }
    }
    if !pending.is_empty() {
        let piece = String::from_utf8_lossy(&pending).to_string();
        text.push_str(&piece);
        if let Some(id) = stream_id {
            let _ = app.emit(
                &format!("http-stream://{id}/chunk"),
                StreamChunk { text: piece },
            );
        }
    }
    Ok((text, size))
}

/// Decode as much valid UTF-8 as possible from `buf`, leaving an incomplete
/// trailing multi-byte sequence in place for the next chunk.
fn drain_utf8(buf: &mut Vec<u8>) -> String {
    match std::str::from_utf8(buf) {
        Ok(s) => {
            let out = s.to_string();
            buf.clear();
            out
        }
        Err(e) if e.error_len().is_none() => {
            let valid = e.valid_up_to();
            let out = std::str::from_utf8(&buf[..valid]).unwrap().to_string();
            buf.drain(..valid);
            out
        }
        Err(_) => {
            let out = String::from_utf8_lossy(buf).to_string();
            buf.clear();
            out
        }
    }
}

/// Attach the request body according to `body_type`, injecting a sensible
/// Content-Type only when the caller has not supplied one explicitly.
pub(crate) fn attach_body(
    request: reqwest::RequestBuilder,
    payload: &HttpRequestPayload,
    mut headers: HeaderMap,
) -> Result<reqwest::RequestBuilder, String> {
    let body_type = payload.body_type.trim().to_lowercase();
    let raw = payload.body.clone().unwrap_or_default();

    match body_type.as_str() {
        "none" | "" => Ok(request.headers(headers)),
        "json" => {
            headers
                .entry(CONTENT_TYPE)
                .or_insert(HeaderValue::from_static("application/json"));
            Ok(request.headers(headers).body(raw))
        }
        "raw" => {
            headers
                .entry(CONTENT_TYPE)
                .or_insert(HeaderValue::from_static("text/plain"));
            Ok(request.headers(headers).body(raw))
        }
        "x-www-form-urlencoded" => {
            headers
                .entry(CONTENT_TYPE)
                .or_insert(HeaderValue::from_static(
                    "application/x-www-form-urlencoded",
                ));
            Ok(request.headers(headers).body(raw))
        }
        "form-data" => {
            // The frontend serializes multipart fields as a JSON object string.
            let fields: HashMap<String, String> = serde_json::from_str(&raw)
                .map_err(|e| format!("form-data 需要 JSON 对象字符串: {e}"))?;
            let mut form = reqwest::multipart::Form::new();
            for (key, value) in fields {
                form = form.text(key, value);
            }
            // Let reqwest set the multipart boundary Content-Type itself.
            headers.remove(CONTENT_TYPE);
            Ok(request.headers(headers).multipart(form))
        }
        other => Err(format!("不支持的 body 类型: {other}")),
    }
}

/// Turn a reqwest error into a readable, actionable Chinese message.
fn map_reqwest_error(error: reqwest::Error) -> String {
    let detail = error_chain(&error);
    if error.is_timeout() {
        format!("请求超时: {detail}")
    } else if error.is_connect() {
        format!("连接失败（DNS 解析失败 / 断网 / 连接被拒绝）: {detail}")
    } else if error.is_decode() {
        format!("响应解码失败: {detail}")
    } else if error.is_redirect() {
        format!("重定向错误: {detail}")
    } else if error.is_body() {
        format!("请求体错误: {detail}")
    } else if error.is_request() {
        format!("请求构建失败（URL 非法等）: {detail}")
    } else {
        format!("请求失败: {detail}")
    }
}

/// Flatten an error and its source chain into a single line for diagnostics.
fn error_chain(error: &dyn std::error::Error) -> String {
    let mut message = error.to_string();
    let mut source = error.source();
    while let Some(err) = source {
        message.push_str(": ");
        message.push_str(&err.to_string());
        source = err.source();
    }
    message
}