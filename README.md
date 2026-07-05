# 🎯 Examiner.AI (v3.1)

> **Transform any CBSE/Board exam paper PDF or Scanned Image into a timed, interactive practice test with Board-style AI grading, diagram display, and real-time step-wise feedback.**

Examiner.AI is a highly optimized, client-first Next.js web application designed to help students practice and evaluate their performance on exam papers. It integrates a local **GLM-OCR** pipeline to parse scanned/handwritten documents, standardizes question extraction via **Groq & OpenRouter** multi-provider fallback chains, and runs a strict dual-pass CBSE-aligned evaluation engine to grade answers step-by-step.

---

## 🦖 Playable Chrome Dino Loading Screen & Meteorite Strike

To bridge the gap during OCR processing and AI question parsing, Examiner.AI features an embedded **playable Chrome Dino game** directly on the loading screen:
* **Interactive Gameplay**: Control the retro pixel dinosaur using the `Spacebar`, `ArrowUp`, or simple mouse clicks/touch taps to jump over incoming obstacles (cacti).
* **High-Score Persistence**: Tracks current session score and high score.
* **Animated Meteorite Strike**: When the server successfully finishes parsing the questions, obstacle spawning pauses, a fiery meteorite falls from the sky, collides with the Dino in a screen-shaking particle explosion, and shows a speech bubble: `"test ready, lol!"` before transitioning automatically to the exam panel.

---

## ✨ Features & Architecture

### 1. Unified Multi-Client Fallback Chain
* **Primary Client (Groq)**: Targets `llama-3.3-70b-versatile` as the main parsing and grading model (processing at 250+ tokens/second). Falls back to `llama-3.1-8b-instant` if rate limits are exceeded.
* **Secondary Client (OpenRouter)**: Automatically fallbacks if Groq keys are absent or rate-limited. The sequence queries:
  1. `nvidia/nemotron-3-ultra-550b-a55b:free`
  2. `openai/gpt-oss-120b:free`
  3. `nvidia/nemotron-3-super-120b-a12b:free`
* **Local Ollama CORS Proxy**: Requests to `glm-ocr` are routed through a server-side route `/api/ollama` to bypass browser-specific CORS loopback constraints.

### 2. 3-Pass layout Extraction Pipeline
* **Pass 1: Document Layout Detection**: Scans the document stream to separate headers, instructions, sections (Section A, Part I), questions, solutions, and choice boundaries (`OR` choices).
* **Pass 2: Question Extraction**: Extracts text strictly from question boundaries. Rejects equations, formulas, calculations, or conclusion texts, and maps specific marks notations.
* **Pass 3: Solution Matching**: Matches appended answer keys or solutions in the document to populate `expectedAnswer` fields. If no keys are found, answers are generated dynamically by the AI during grading.

### 3. Timed Practice Test Experience
* **Timer Auto-Pause**: Listens to `visibilitychange` to automatically pause the test stopwatch when the student switches browser tabs.
* **Autosave & Crash Recovery**: Periodically saves the draft state (answers, time remaining, bookmarks, and evaluations) to `localStorage`. If the browser crashes, the test restores automatically with the timer paused.
* **Leave Warnings**: Prevents accidental tab closures via a `beforeunload` interceptor warning.
* **Diagram Reference**: Displays expandable `<details>` panels containing rendered base64 PDF page references for diagram-based questions.

---

## 🛠️ Technology Stack

* **Frontend**: Next.js 15 (App Router), React 19, Tailwind CSS v4, Lucide React
* **PDF Rendering**: `pdfjs-dist` (loaded dynamically with local offline worker fallback)
* **OCR Engines**: Local Ollama (`glm-ocr:latest` for high-quality scanned documents) + `tesseract.js` (offline fallback)
* **Evaluation Core**: OpenAI SDK configured with unified Groq/OpenRouter fallback routing
* **Design Guidelines**: Swiss Minimal layout architecture, custom OKLCH color mappings, and 8pt responsive grids.

---

## 🚀 Getting Started

### 1. Prerequisites
* **Node.js**: Ensure you have Node.js 18+ installed.
* **Ollama (Required for scanned PDF/Image OCR)**:
  Download and install Ollama, then pull the GLM-OCR model:
  ```bash
  ollama run glm-ocr:latest
  ```

### 2. Environment Configuration
Create a `.env` file in the root directory:
```env
# Groq API Key (Required for primary AI parsing & grading)
GROQ_API_KEY=gsk_your_actual_groq_api_key_here

# OpenRouter API Key (Fallback client key)
OPENROUTER_API_KEY=your_openrouter_api_key_here

# Optional: Override local Ollama endpoint (Defaults to http://localhost:11434)
NEXT_PUBLIC_OLLAMA_URL=http://localhost:11434
NEXT_PUBLIC_OLLAMA_OCR_MODEL=glm-ocr:latest
```

### 3. Installation & Development Running
```bash
# Install dependencies
npm install

# Run the local development server (launches on Port 3001)
npm run dev
```
Open [http://localhost:3001](http://localhost:3001) to run the interface.

---

## 📂 Project Structure

```
├── app/
│   ├── api/                   # API Routes (OCR proxy, extraction, evaluation)
│   │   ├── evaluate/          # CBSE-grade answer scorer
│   │   ├── ollama/            # Server-side proxy for GLM-OCR
│   │   └── question-extraction/ # 3-pass extraction pipeline
│   ├── my-papers/             # Saved tests and scorecards page
│   ├── processing/            # Transition progress spinner
│   ├── results/               # Scorecard and detailed review page
│   ├── test/                  # Timed test execution workspace
│   ├── globals.css            # Base stylesheet and variables
│   └── layout.tsx             # Root page shell wrappers
├── components/                # Reusable UI component modules
│   ├── app-shell.tsx          # Collapsible sidebar, mobile drawer, layout wrapping
│   ├── dino-game.tsx          # Interactive Dino game with meteorite strike
│   ├── home-dashboard.tsx     # Files uploader drag/drop slots
│   └── test-experience.tsx    # Question carousel, bookmarking, and timer hooks
├── lib/
│   ├── extractor/
│   │   ├── groq-client.ts     # Unified fallback completions, prompts, and evaluators
│   │   ├── ocr_extractor.ts   # Local GLM-OCR and canvas converters
│   │   ├── text-extractor.ts  # OCR-Tesseract fallback Router
│   │   └── types.ts           # Pipeline schema interfaces
│   ├── result-storage.ts      # Browser localStorage persistence layer
│   └── result-summary.ts      # Scorecard math aggregates
├── PRODUCT.md                 # Product Register & design specs (Swiss Minimal)
├── DESIGN.md                  # Design Tokens & OKLCH color mappings
└── LICENSE                    # MIT license specification
```

---

## 📄 License & Copyright

Copyright © 2026 `onlykushalll`.  
Licensed under the [MIT License](LICENSE).
