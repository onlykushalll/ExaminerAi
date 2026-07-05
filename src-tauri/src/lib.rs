mod commands;

use commands::ollama::{
  ollama_generate,
  ollama_health,
  ollama_list_models,
  ollama_pull_model,
  start_ollama_sidecar,
  stop_ollama_sidecar,
  ensure_glm_ocr_model,
  get_ollama_setup_status
};
use tauri::Manager;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
  tauri::Builder::default()
    .plugin(tauri_plugin_shell::init())
    .plugin(tauri_plugin_store::Builder::default().build())
    .setup(|app| {
      if cfg!(debug_assertions) {
        app.handle().plugin(
          tauri_plugin_log::Builder::default()
            .level(log::LevelFilter::Info)
            .build(),
        )?;
      }
      
      // Start Ollama sidecar on app launch (non-blocking)
      let app_handle = app.handle().clone();
      tauri::async_runtime::spawn(async move {
        match start_ollama_sidecar(app_handle.clone()).await {
          Ok(true) => {
            println!("[setup] Ollama sidecar started successfully");
            // Auto-download GLM-OCR if missing
            let _ = ensure_glm_ocr_model(app_handle, None).await;
          }
          Ok(false) => println!("[setup] Ollama not available"),
          Err(e) => println!("[setup] Ollama sidecar error: {}", e),
        }
      });
      Ok(())
    })
    .on_window_event(|_window, event| {
      // Stop Ollama sidecar when the main window closes
      if let tauri::WindowEvent::Destroyed = event {
        let _ = stop_ollama_sidecar();
      }
    })
    .invoke_handler(tauri::generate_handler![
      ollama_generate,
      ollama_health,
      ollama_list_models,
      ollama_pull_model,
      start_ollama_sidecar,
      stop_ollama_sidecar,
      ensure_glm_ocr_model,
      get_ollama_setup_status
    ])
    .run(tauri::generate_context!())
    .expect("error while running tauri application");
}
