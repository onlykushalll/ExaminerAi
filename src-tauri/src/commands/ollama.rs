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
