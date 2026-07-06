# download-ollama.ps1 — downloads Ollama binary for Windows x64
$ErrorActionPreference = "Stop"
$url = "https://github.com/ollama/ollama/releases/latest/download/ollama-windows-amd64.zip"
$output = "src-tauri/binaries/ollama-windows-amd64.zip"
$extractPath = "src-tauri/binaries"

$ProgressPreference = 'SilentlyContinue'
Write-Host "Downloading Ollama for Windows (via curl)..."
New-Item -ItemType Directory -Force -Path $extractPath | Out-Null
curl.exe -L -o $output $url

Write-Host "Extracting..."
Expand-Archive -Path $output -DestinationPath $extractPath -Force
Remove-Item $output

# Rename to the name Tauri expects: <binary-name>-<target-triple>.exe
# Tauri sidecar convention: if externalBin is "binaries/ollama", 
# it looks for "binaries/ollama-x86_64-pc-windows-msvc.exe"
$source = "$extractPath\ollama.exe"
$dest = "$extractPath\ollama-x86_64-pc-windows-msvc.exe"
if (Test-Path $source) {
    Move-Item -Path $source -Destination $dest -Force
    Write-Host "Ollama binary saved to $dest"
} else {
    Write-Error "ollama.exe not found after extraction"
    exit 1
}
