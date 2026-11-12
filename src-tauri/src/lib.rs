mod http;
mod loadtest;
mod vault;

pub use http::{HttpRequestPayload, HttpResponsePayload};

/// Native save dialog + file write, used for exporting runner reports.
/// Returns the chosen path, or None when the user cancels.
#[tauri::command]
fn save_text_file(default_name: String, contents: String) -> Result<Option<String>, String> {
    let Some(path) = rfd::FileDialog::new()
        .set_file_name(&default_name)
        .save_file()
    else {
        return Ok(None);
    };
    std::fs::write(&path, contents).map_err(|e| e.to_string())?;
    Ok(Some(path.display().to_string()))
}

/// Application entry point shared by desktop and mobile targets.
#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![
            http::execute_request,
            save_text_file,
            vault::vault_set,
            vault::vault_get,
            vault::vault_delete,
            vault::vault_status,
            vault::sanitize_export,
            loadtest::start_load_test,
            loadtest::stop_load_test
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}