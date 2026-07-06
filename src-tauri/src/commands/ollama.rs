use serde::{Deserialize, Serialize};

#[derive(Debug, Serialize, Deserialize)]
struct OllamaRequest {
    model: String,
    prompt: String,
    images: Vec<String>,
    stream: bool,
}

#[derive(Debug, Serialize, Deserialize)]
struct OllamaResponse {
    response: Option<String>,
}

#[tauri::command]
pub async fn ollama_generate(
    model: String,
    prompt: String,
    images: Vec<String>,
    url: Option<String>,
) -> Result<String, String> {
    let client = reqwest::Client::new();
    let base_url = url.unwrap_or_else(|| "http://localhost:11434".to_string());
    let endpoint = format!("{}/api/generate", base_url.trim_end_matches('/'));

    let request_body = OllamaRequest {
        model,
        prompt,
        images,
        stream: false,
    };

    let response = client
        .post(&endpoint)
        .json(&request_body)
        .send()
        .await
        .map_err(|e| format!("Network request failed: {}", e))?;

    if !response.status().is_success() {
        return Err(format!(
            "Ollama returned error status: {}",
            response.status()
        ));
    }

    let parsed: OllamaResponse = response
        .json()
        .await
        .map_err(|e| format!("Failed to parse response JSON: {}", e))?;

    parsed
        .response
        .ok_or_else(|| "No response field in Ollama output".to_string())
}

#[tauri::command]
pub async fn ollama_health(url: Option<String>) -> Result<bool, String> {
    let base_url = url.unwrap_or_else(|| "http://localhost:11434".to_string());
    let client = reqwest::Client::new();
    match client.get(format!("{}/api/tags", base_url.trim_end_matches('/')))
        .timeout(std::time::Duration::from_secs(2))
        .send()
        .await {
        Ok(resp) => Ok(resp.status().is_success()),
        Err(_) => Ok(false),
    }
}

#[tauri::command]
pub async fn ollama_list_models(url: Option<String>) -> Result<Vec<String>, String> {
    let base_url = url.unwrap_or_else(|| "http://localhost:11434".to_string());
    let client = reqwest::Client::new();
    let resp = client.get(format!("{}/api/tags", base_url.trim_end_matches('/')))
        .send()
        .await
        .map_err(|e| e.to_string())?;
    let body: serde_json::Value = resp.json().await.map_err(|e| e.to_string())?;
    let models = body["models"].as_array()
        .map(|arr| arr.iter()
            .filter_map(|m| m["name"].as_str().map(|s| s.to_string()))
            .collect())
        .unwrap_or_default();
    Ok(models)
}

use tauri::{Emitter, AppHandle};

#[tauri::command]
pub async fn ollama_pull_model(
    app: AppHandle,
    model: String,
    url: Option<String>,
) -> Result<(), String> {
    let base_url = url.unwrap_or_else(|| "http://localhost:11434".to_string());
    let endpoint = format!("{}/api/pull", base_url.trim_end_matches('/'));

    let client = reqwest::Client::new();
    let response = client
        .post(&endpoint)
        .json(&serde_json::json!({ "name": model, "stream": true }))
        .send()
        .await
        .map_err(|e| format!("Pull request failed: {}", e))?;

    if !response.status().is_success() {
        return Err(format!("Ollama returned error: {}", response.status()));
    }

    // Stream the response and emit progress events
    use futures_util::StreamExt;
    let mut stream = response.bytes_stream();
    let mut buffer = String::new();

    while let Some(chunk_result) = stream.next().await {
        let chunk = chunk_result.map_err(|e| e.to_string())?;
        buffer.push_str(&String::from_utf8_lossy(&chunk));

        let lines: Vec<&str> = buffer.split('\n').collect();
        if lines.len() > 1 {
            let last_line = lines.last().unwrap().to_string();
            for line in &lines[..lines.len() - 1] {
                if line.trim().is_empty() { continue; }
                if let Ok(data) = serde_json::from_str::<serde_json::Value>(line) {
                    if let (Some(total), Some(completed)) = (
                        data["total"].as_u64(),
                        data["completed"].as_u64(),
                    ) {
                        if total > 0 {
                            let pct = ((completed as f64 / total as f64) * 100.0) as u8;
                            let _ = app.emit("ollama-pull-progress", pct);
                        }
                    }
                    if data["status"].as_str() == Some("success") {
                        let _ = app.emit("ollama-pull-progress", 100u8);
                    }
                }
            }
            buffer = last_line;
        }
    }

    Ok(())
}

use tauri_plugin_shell::ShellExt;
use tauri_plugin_shell::process::{CommandChild, CommandEvent};
use std::sync::Mutex;
use std::time::{Duration, Instant};
use tokio::time::sleep;

// Global to hold the running Ollama process so we can kill it on app exit
static OLLAMA_PROCESS: Mutex<Option<CommandChild>> = Mutex::new(None);

/// Start the bundled Ollama sidecar in the background.
/// Called on app launch. If Ollama is already running externally, skips spawning.
#[tauri::command]
pub async fn start_ollama_sidecar(app: AppHandle) -> Result<bool, String> {
    // First check if Ollama is already running (user might have it installed system-wide)
    if ollama_health(None).await.unwrap_or(false) {
        println!("[ollama] Already running externally — skipping sidecar spawn");
        return Ok(true);
    }

    println!("[ollama] Starting bundled sidecar...");
    
    // Get the sidecar binary path
    let sidecar = app.shell().sidecar("ollama")
        .map_err(|e| format!("Failed to find ollama sidecar: {}", e))?;
    
    let (mut rx, child) = sidecar
        .args(["serve"])
        .spawn()
        .map_err(|e| format!("Failed to spawn ollama sidecar: {}", e))?;

    // Store the child process so we can kill it on exit
    {
        let mut proc = OLLAMA_PROCESS.lock().unwrap();
        *proc = Some(child);
    }

    // Spawn a task to read sidecar output (for debugging)
    tauri::async_runtime::spawn(async move {
        while let Some(event) = rx.recv().await {
            match event {
                CommandEvent::Stdout(line) => {
                    println!("[ollama-sidecar] {}", String::from_utf8_lossy(&line).trim());
                }
                CommandEvent::Stderr(line) => {
                    eprintln!("[ollama-sidecar stderr] {}", String::from_utf8_lossy(&line).trim());
                }
                CommandEvent::Terminated(payload) => {
                    println!("[ollama-sidecar terminated] Code: {:?}", payload.code);
                }
                _ => {}
            }
        }
    });

    // Wait for Ollama to be healthy (max 30 seconds)
    let start = Instant::now();
    while start.elapsed() < Duration::from_secs(30) {
        sleep(Duration::from_secs(1)).await;
        if ollama_health(None).await.unwrap_or(false) {
            println!("[ollama] Sidecar is healthy!");
            return Ok(true);
        }
    }

    Err("Ollama sidecar failed to start within 30 seconds".to_string())
}

/// Stop the Ollama sidecar (called on app exit)
#[tauri::command]
pub fn stop_ollama_sidecar() -> Result<(), String> {
    let mut proc = OLLAMA_PROCESS.lock().unwrap();
    if let Some(mut child) = proc.take() {
        println!("[ollama] Stopping sidecar...");
        child.kill().map_err(|e| format!("Failed to kill ollama: {}", e))?;
    }
    Ok(())
}

/// Check if GLM-OCR model is installed. If not, auto-download it.
/// Emits real progress events to the frontend.
#[tauri::command]
pub async fn ensure_glm_ocr_model(app: AppHandle, url: Option<String>) -> Result<bool, String> {
    let base_url = url.unwrap_or_else(|| "http://localhost:11434".to_string());
    
    // Check if model is already installed
    let models = ollama_list_models(Some(base_url.clone())).await.unwrap_or_default();
    if models.iter().any(|m| m.contains("glm-ocr")) {
        println!("[ollama] GLM-OCR already installed");
        let _ = app.emit("ollama-pull-progress", 100u8);
        return Ok(true);
    }

    println!("[ollama] GLM-OCR not found — auto-downloading...");
    let _ = app.emit("ollama-pull-status", "Downloading GLM-OCR model (1.4GB)...");
    
    // Call the existing pull function (already implemented)
    ollama_pull_model(app.clone(), "glm-ocr:latest".to_string(), Some(base_url)).await?;
    
    println!("[ollama] GLM-OCR download complete!");
    let _ = app.emit("ollama-pull-status", "GLM-OCR ready!");
    Ok(true)
}

/// Get the full setup status — used by the frontend on app launch
#[tauri::command]
pub async fn get_ollama_setup_status(url: Option<String>) -> Result<serde_json::Value, String> {
    let base_url = url.unwrap_or_else(|| "http://localhost:11434".to_string());
    let running = ollama_health(Some(base_url.clone())).await.unwrap_or(false);
    
    let models = if running {
        ollama_list_models(Some(base_url)).await.unwrap_or_default()
    } else {
        vec![]
    };

    let has_glm_ocr = models.iter().any(|m| m.contains("glm-ocr"));

    Ok(serde_json::json!({
        "running": running,
        "models": models,
        "has_glm_ocr": has_glm_ocr,
        "ready": running && has_glm_ocr
    }))
}
