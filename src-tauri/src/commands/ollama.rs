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
