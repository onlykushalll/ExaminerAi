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
            buffer = lines.last().unwrap().to_string();
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
        }
    }

    Ok(())
}
