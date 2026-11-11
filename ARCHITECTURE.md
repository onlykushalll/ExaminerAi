# Examiner.AI — Technical Architecture & Due Diligence Specification

## 1. Execution Layers

Examiner.AI pairs a purely client-side SPA/desktop bundle (`src/`) with a Rust/Tauri v2 host (`src-tauri/`) so scanned exam papers can be parsed either fully locally via Ollama `glm-ocr:latest` or via resilient cloud LLM inference fallback.

| Layer | Modules | Responsibility |
|---|---|---|
| Presentation & Test Engine | `src/pages/*`, `src/components/test-experience.tsx` | Exam upload, timed workspace, palette navigation, Dino waiting mini-game, CBSE step scorecard |
| Document Extraction | `src/lib/extractor/pdf-extractor.ts`, `ocr_extractor.ts`, `text-extractor.ts` | PDF text layer extraction, canvas rasterization via `pdf.worker.min.mjs`, Ollama GLM-OCR & Tesseract fallback |
| Deterministic Structuring | `src/lib/extractor/local/*` (`detector.ts`, `parser.ts`, `marks-extractor.ts`, `cleaner.ts`, `confidence.ts`) | Structural cleanup, section segmentation, `OR` branch linkage, confidence scoring |
| LLM Failover Router | `src/lib/extractor/groq-client.ts` | Groq (`llama-3.3-70b-versatile` -> `llama-3.1-8b-instant`) -> OpenRouter multi-model chain |
| Native Desktop Shell | `src-tauri/src/lib.rs`, `src-tauri/src/commands/ollama.rs` | Tauri IPC commands, local Ollama health & model orchestration, secure store plugin |

## 2. Security & Key Handling

- Bring-Your-Own-Key (BYOK) via environment variables (`.env` / `VITE_*`) or in-app `SettingsPage` local storage.
- Exam PDFs stay on-device in local storage (`result-storage.ts`); no backend multi-tenant database collects student PII.
