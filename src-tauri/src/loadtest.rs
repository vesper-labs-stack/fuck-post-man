//! Load-test engine: a bounded concurrent pool of async HTTP requests driven by
//! `tokio::task::JoinSet` + `tokio::sync::Semaphore`, reusing one global
//! `reqwest::Client`. Progress and performance metrics are pushed to the
//! frontend over Tauri events while the run is in flight.

use std::collections::HashMap;
use std::sync::atomic::{AtomicBool, AtomicU64, Ordering};
use std::sync::{Arc, OnceLock};
use std::time::{Duration, Instant};

use reqwest::header::{HeaderMap, HeaderName, HeaderValue};
use reqwest::{Client, Method};
use serde::{Deserialize, Serialize};
use tauri::Emitter;
use tokio::sync::Semaphore;
use tokio::task::JoinSet;

use crate::http::HttpRequestPayload;

const PROGRESS_EVENT: &str = "load-test://progress";
const TICK_MS: u64 = 300;
const MAX_CONCURRENCY: u32 = 200;

/// Only one load test may run at a time; `STOP` is the cooperative cancel flag.
static RUNNING: AtomicBool = AtomicBool::new(false);
static STOP: AtomicBool = AtomicBool::new(false);
static CLIENT: OnceLock<Result<Client, String>> = OnceLock::new();

/// Parameters accepted from the frontend. `url`/`method`/`concurrency`/
/// `total_requests` are required; the rest mirror an ordinary request so the
/// active tab can be replayed verbatim (headers, query, body, vault secrets).
#[derive(Debug, Clone, Deserialize)]
pub struct LoadTestConfig {
    pub url: String,
    pub method: String,
    pub concurrency: u32,
    pub total_requests: u64,
    #[serde(default)]
    pub headers: HashMap<String, String>,
    #[serde(default)]
    pub params: HashMap<String, String>,
    #[serde(default)]
    pub body_type: String,
    #[serde(default)]
    pub body: Option<String>,
}

/// Live snapshot pushed every `TICK_MS` while the run is in flight.
#[derive(Debug, Clone, Serialize)]
struct LoadTestProgress {
    completed: u64,
    total: u64,
    success: u64,
    failed: u64,
    avg_ms: f64,
    qps: f64,
    elapsed_ms: u64,
    running: bool,
}

/// Final summary returned to the frontend when the command resolves.
#[derive(Debug, Clone, Serialize)]
pub struct LoadTestReport {
    total: u64,
    completed: u64,
    success: u64,
    failed: u64,
    success_rate: f64,
    avg_ms: f64,
    min_ms: u64,
    max_ms: u64,
    elapsed_ms: u64,
    qps: f64,
    stopped: bool,
}

/// Shared counters updated by every worker with relaxed atomics.
struct Stats {
    completed: AtomicU64,
    success: AtomicU64,
    failed: AtomicU64,
    latency_sum_ms: AtomicU64,
    latency_min_ms: AtomicU64,
    latency_max_ms: AtomicU64,
}

impl Stats {
    fn new() -> Self {
        Self {
            completed: AtomicU64::new(0),
            success: AtomicU64::new(0),
            failed: AtomicU64::new(0),
            latency_sum_ms: AtomicU64::new(0),
            latency_min_ms: AtomicU64::new(u64::MAX),
            latency_max_ms: AtomicU64::new(0),
        }
    }

    fn record(&self, ok: bool, ms: u64) {
        self.completed.fetch_add(1, Ordering::Relaxed);
        if ok {
            self.success.fetch_add(1, Ordering::Relaxed);
        } else {
            self.failed.fetch_add(1, Ordering::Relaxed);
        }
        self.latency_sum_ms.fetch_add(ms, Ordering::Relaxed);
        self.latency_min_ms.fetch_min(ms, Ordering::Relaxed);
        self.latency_max_ms.fetch_max(ms, Ordering::Relaxed);
    }
}

fn global_client() -> Result<Client, String> {
    CLIENT
        .get_or_init(|| {
            Client::builder()
                .pool_max_idle_per_host(256)
                .connect_timeout(Duration::from_secs(10))
                .timeout(Duration::from_secs(30))
                .gzip(true)
                .brotli(true)
                .deflate(true)
                .redirect(reqwest::redirect::Policy::limited(10))
                .build()
                .map_err(|e| format!("构建压测 HTTP 客户端失败: {e}"))
        })
        .clone()
}

/// Begin a load test. Rejects if one is already running.
#[tauri::command]
pub async fn start_load_test(
    app: tauri::AppHandle,
    config: LoadTestConfig,
) -> Result<LoadTestReport, String> {
    if RUNNING.swap(true, Ordering::SeqCst) {
        return Err("已有压测正在运行，请先停止".to_string());
    }
    STOP.store(false, Ordering::SeqCst);
    let result = run(&app, config).await;
    RUNNING.store(false, Ordering::SeqCst);
    result
}

/// Signal the running load test to stop spawning; in-flight requests drain.
#[tauri::command]
pub fn stop_load_test() {
    STOP.store(true, Ordering::SeqCst);
}

async fn run(app: &tauri::AppHandle, config: LoadTestConfig) -> Result<LoadTestReport, String> {
    let concurrency = config.concurrency.clamp(1, MAX_CONCURRENCY) as usize;
    let total = config.total_requests;
    if total == 0 {
        return Err("总请求数必须大于 0".to_string());
    }

    let method = Method::from_bytes(config.method.trim().to_uppercase().as_bytes())
        .map_err(|_| format!("不支持的 HTTP 方法: {}", config.method))?;

    // Resolve vault secrets in Rust so plaintext never round-trips the webview.
    let url = crate::vault::resolve_secrets(config.url.trim())?;
    if url.is_empty() {
        return Err("请求 URL 不能为空".to_string());
    }
    let mut headers = HashMap::new();
    for (key, value) in &config.headers {
        headers.insert(key.clone(), crate::vault::resolve_secrets(value)?);
    }
    let mut params = HashMap::new();
    for (key, value) in &config.params {
        params.insert(key.clone(), crate::vault::resolve_secrets(value)?);
    }
    let body = match &config.body {
        Some(raw) => Some(crate::vault::resolve_secrets(raw)?),
        None => None,
    };
    let template = Arc::new(HttpRequestPayload {
        method: config.method.clone(),
        url,
        headers,
        params,
        body_type: config.body_type.clone(),
        body,
        timeout_ms: None,
    });

    let mut header_map = HeaderMap::new();
    for (key, value) in &template.headers {
        let key = key.trim();
        if key.is_empty() {
            continue;
        }
        let name =
            HeaderName::from_bytes(key.as_bytes()).map_err(|_| format!("非法的请求头名称: {key}"))?;
        let value = HeaderValue::from_str(value).map_err(|_| format!("非法的请求头值: {key}"))?;
        header_map.insert(name, value);
    }
    let header_map = Arc::new(header_map);

    let client = global_client()?;
    let stats = Arc::new(Stats::new());
    let sem = Arc::new(Semaphore::new(concurrency));
    let mut set: JoinSet<()> = JoinSet::new();

    let start = Instant::now();
    let mut ticker = tokio::time::interval(Duration::from_millis(TICK_MS));
    ticker.set_missed_tick_behavior(tokio::time::MissedTickBehavior::Skip);
    let mut last_tick = Instant::now();
    let mut last_completed = 0u64;
    let mut spawned = 0u64;

    loop {
        let stop_seen = STOP.load(Ordering::SeqCst);
        let can_spawn = spawned < total && !stop_seen;
        let has_inflight = !set.is_empty();
        if !can_spawn && !has_inflight {
            break;
        }

        tokio::select! {
            // Acquire a permit *before* spawning so at most `concurrency`
            // requests are ever in flight (backpressure on the pool).
            permit = sem.clone().acquire_owned(), if can_spawn => {
                let Ok(permit) = permit else { break };
                spawned += 1;
                let client = client.clone();
                let method = method.clone();
                let template = template.clone();
                let header_map = header_map.clone();
                let stats = stats.clone();
                set.spawn(async move {
                    let _permit = permit;
                    let mut req = client.request(method, template.url.as_str());
                    if !template.params.is_empty() {
                        req = req.query(&template.params);
                    }
                    let req = match crate::http::attach_body(req, &template, (*header_map).clone()) {
                        Ok(r) => r,
                        Err(_) => {
                            stats.record(false, 0);
                            return;
                        }
                    };
                    let t = Instant::now();
                    let ok = match req.send().await {
                        Ok(resp) => {
                            let ok = resp.status().is_success();
                            let _ = resp.bytes().await;
                            ok
                        }
                        Err(_) => false,
                    };
                    stats.record(ok, t.elapsed().as_millis() as u64);
                });
            }
            _ = ticker.tick() => {
                let now = Instant::now();
                let completed = stats.completed.load(Ordering::Relaxed);
                let dt = now.duration_since(last_tick).as_secs_f64();
                let qps = if dt > 0.0 {
                    (completed - last_completed) as f64 / dt
                } else {
                    0.0
                };
                last_completed = completed;
                last_tick = now;
                emit_progress(app, &stats, total, qps, start.elapsed().as_millis() as u64, true);
            }
            joined = set.join_next(), if has_inflight => {
                if joined.is_none() {
                    continue;
                }
            }
        }
    }

    let stopped = STOP.load(Ordering::SeqCst);
    let elapsed_ms = start.elapsed().as_millis() as u64;
    let completed = stats.completed.load(Ordering::Relaxed);
    let success = stats.success.load(Ordering::Relaxed);
    let failed = stats.failed.load(Ordering::Relaxed);
    let sum = stats.latency_sum_ms.load(Ordering::Relaxed);
    let min = stats.latency_min_ms.load(Ordering::Relaxed);
    let max = stats.latency_max_ms.load(Ordering::Relaxed);
    let avg_ms = if completed > 0 {
        sum as f64 / completed as f64
    } else {
        0.0
    };
    let min_ms = if completed > 0 && min != u64::MAX { min } else { 0 };
    let success_rate = if completed > 0 {
        success as f64 / completed as f64 * 100.0
    } else {
        0.0
    };
    let secs = elapsed_ms as f64 / 1000.0;
    let qps = if secs > 0.0 { completed as f64 / secs } else { 0.0 };

    emit_progress(app, &stats, total, qps, elapsed_ms, false);

    Ok(LoadTestReport {
        total,
        completed,
        success,
        failed,
        success_rate,
        avg_ms,
        min_ms,
        max_ms: max,
        elapsed_ms,
        qps,
        stopped,
    })
}

fn emit_progress(
    app: &tauri::AppHandle,
    stats: &Stats,
    total: u64,
    qps: f64,
    elapsed_ms: u64,
    running: bool,
) {
    let completed = stats.completed.load(Ordering::Relaxed);
    let success = stats.success.load(Ordering::Relaxed);
    let failed = stats.failed.load(Ordering::Relaxed);
    let sum = stats.latency_sum_ms.load(Ordering::Relaxed);
    let avg_ms = if completed > 0 {
        sum as f64 / completed as f64
    } else {
        0.0
    };
    let _ = app.emit(
        PROGRESS_EVENT,
        LoadTestProgress {
            completed,
            total,
            success,
            failed,
            avg_ms,
            qps,
            elapsed_ms,
            running,
        },
    );
}