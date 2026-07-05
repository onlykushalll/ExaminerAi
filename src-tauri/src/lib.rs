mod commands;

use commands::ollama::{ollama_generate, ollama_health, ollama_list_models};

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
  tauri::Builder::default()
    .setup(|app| {
      if cfg!(debug_assertions) {
        app.handle().plugin(
          tauri_plugin_log::Builder::default()
            .level(log::LevelFilter::Info)
            .build(),
        )?;
      }
      Ok(())
    })
    .invoke_handler(tauri::generate_handler![
      ollama_generate,
      ollama_health,
      ollama_list_models
    ])
    .run(tauri::generate_context!())
    .expect("error while running tauri application");
}
