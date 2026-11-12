//! Local secure vault: secret values live only in OS credential storage
//! (Windows Credential Manager / macOS Keychain), never in app cache files.

use std::collections::HashMap;

use keyring::Entry;

const SERVICE: &str = "fuckpostman-vault";

fn entry(name: &str) -> Result<Entry, String> {
    Entry::new(SERVICE, name).map_err(|e| format!("无法访问系统安全存储: {e}"))
}

/// Store (or overwrite) a secret under its name in OS secure storage.
#[tauri::command]
pub fn vault_set(name: String, value: String) -> Result<(), String> {
    let name = name.trim();
    if name.is_empty() {
        return Err("机密变量名不能为空".to_string());
    }
    entry(name)?
        .set_password(&value)
        .map_err(|e| format!("写入系统安全存储失败: {e}"))
}

/// Read a secret back. `None` means the name is not stored.
#[tauri::command]
pub fn vault_get(name: String) -> Result<Option<String>, String> {
    match entry(name.trim())?.get_password() {
        Ok(value) => Ok(Some(value)),
        Err(keyring::Error::NoEntry) => Ok(None),
        Err(e) => Err(format!("读取系统安全存储失败: {e}")),
    }
}

/// Remove a secret; deleting an unknown name is a no-op.
#[tauri::command]
pub fn vault_delete(name: String) -> Result<(), String> {
    match entry(name.trim())?.delete_credential() {
        Ok(()) | Err(keyring::Error::NoEntry) => Ok(()),
        Err(e) => Err(format!("删除系统安全存储失败: {e}")),
    }
}

/// Report which of the given names currently exist in OS secure storage.
#[tauri::command]
pub fn vault_status(names: Vec<String>) -> HashMap<String, bool> {
    names
        .into_iter()
        .map(|name| {
            let present = entry(&name)
                .ok()
                .map(|e| e.get_password().is_ok())
                .unwrap_or(false);
            (name, present)
        })
        .collect()
}

/// Replace every `{{vault.NAME}}` placeholder with its stored value.
/// Missing secrets fail loudly so a request never goes out with a placeholder.
pub fn resolve_secrets(text: &str) -> Result<String, String> {
    if !text.contains("vault.") {
        return Ok(text.to_string());
    }
    let mut out = String::with_capacity(text.len());
    let mut rest = text;
    while let Some(start) = rest.find("{{") {
        out.push_str(&rest[..start]);
        let after_open = &rest[start + 2..];
        let Some(end) = after_open.find("}}") else {
            out.push_str(&rest[start..]);
            return Ok(out);
        };
        let inner = after_open[..end].trim();
        if let Some(name) = inner.strip_prefix("vault.") {
            let name = name.trim();
            if name.is_empty() {
                return Err("机密变量占位符缺少名称，应为 {{vault.名称}}".to_string());
            }
            let value = vault_get(name.to_string())?.ok_or_else(|| {
                format!("系统安全存储中不存在机密变量: {name}，请先在 Secrets 面板保存")
            })?;
            out.push_str(&value);
        } else {
            out.push_str(&rest[start..start + 2 + end + 2]);
        }
        rest = &after_open[end + 2..];
    }
    out.push_str(rest);
    Ok(out)
}

/// Mask secret values inside an export document, replacing them with
/// `{{vault.NAME}}` placeholders. Operates on decoded JSON string leaves so
/// short secrets cannot corrupt the document structure; falls back to raw
/// text replacement for non-JSON input.
#[tauri::command]
pub fn sanitize_export(contents: String, names: Vec<String>) -> Result<String, String> {
    let mut replacements: Vec<(String, String)> = Vec::new();
    for name in names {
        if let Some(value) = vault_get(name.clone())? {
            if !value.is_empty() {
                replacements.push((value, format!("{{{{vault.{name}}}}}")));
            }
        }
    }
    if replacements.is_empty() {
        return Ok(contents);
    }
    if let Ok(mut doc) = serde_json::from_str::<serde_json::Value>(&contents) {
        mask_json(&mut doc, &replacements);
        if let Ok(masked) = serde_json::to_string_pretty(&doc) {
            return Ok(masked);
        }
    }
    let mut out = contents;
    for (value, placeholder) in &replacements {
        out = out.replace(value.as_str(), placeholder);
    }
    Ok(out)
}

fn mask_json(node: &mut serde_json::Value, replacements: &[(String, String)]) {
    match node {
        serde_json::Value::String(s) => {
            for (value, placeholder) in replacements {
                if s.contains(value.as_str()) {
                    *s = s.replace(value.as_str(), placeholder);
                }
            }
        }
        serde_json::Value::Array(items) => {
            for item in items {
                mask_json(item, replacements);
            }
        }
        serde_json::Value::Object(map) => {
            for value in map.values_mut() {
                mask_json(value, replacements);
            }
        }
        _ => {}
    }
}