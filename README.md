# 🎯 Examiner.AI

> **Transform any CBSE/Board exam paper PDF or Scanned Image into a timed, interactive practice test with Board-style AI grading and step-by-step suggestions.**

Examiner.AI is a highly optimized, client-first Next.js web application designed to help students practice and evaluate their performance on exam papers. It uses local **GLM-OCR** to process scanned/handwritten documents offline, parses structural sections via **Groq (Llama 3.3 70B)**, and executes a rigorous dual-pass CBSE-aligned grading engine to evaluate student submissions.

---

## ✨ Features

- **📂 Dual Slot Uploader**: Upload Question Papers (required) and Answer Keys (optional) in PDF, text, markdown, or image formats.
- **👁️ Local GLM-OCR Engine**: Scanned or image-only documents are automatically processed page-by-page client-side using a locally hosted Ollama instance running `glm-ocr` (with Tesseract.js client-side fallback).
- **🤖 Layout-Scramble Immune Parser**: Powered by Groq's Llama 3.3 70B, the extractor intelligently stiches together scrambled multi-column text, multi-part questions, and internal choice (`OR`) questions across sections (Section A, B, C, etc.).
- **🧩 Embedded Answer Key Mapping**: Automatically scans, extracts, and maps solutions found appended in the same document, using them for evaluation rather than generating mock keys.
- **⏱️ Timed Test Experience**: Attempt full papers with a pausing stopwatch, custom section palettes, and question bookmarking.
- **💯 Dual-Pass CBSE Evaluation**: Students receive step-by-step scoring, strength breakdowns, pinpointed mistakes, and a custom **AI Refined Answer** suggestion aligning to board marks values.
- **🗃️ Client-Side Storage**: No database or login required. Your tests, papers, and detailed scorecard results are preserved locally in your browser's `localStorage` (supports up to 8 full papers).
- **🎨 Warm Editorial Visuals**: Built using a premium editorial theme combining Alabaster (`#faf9f6`), Amber, and deep Ink typography. Features a collapsible, fully responsive sidebar.

---

## 🛠️ Technology Stack

- **Framework**: Next.js 15 (App Router)
- **Language**: TypeScript 5 + React 19
- **Styling**: Tailwind CSS v4 + Custom CSS tokens
- **PDF Extraction**: `pdfjs-dist` (Loaded dynamically with local offline worker fallback)
- **OCR Engine**: Local Ollama (`glm-ocr:latest`) + Tesseract.js (fallback)
- **AI Core**: Groq SDK (`llama-3.3-70b-versatile`)
- **Icons**: Lucide React

---

## 🚀 Getting Started

### 1. Prerequisites

* **Node.js**: Ensure you have Node.js 18+ installed.
* **Ollama (Optional - for high-quality OCR)**:
  Download and install Ollama, then pull the GLM-OCR model:
  ```bash
  ollama run glm-ocr:latest
  ```

### 2. Environment Setup

Create a `.env` file in the root directory:

```env
# Groq API Key (Required for AI parsing & grading)
GROQ_API_KEY=gsk_your_actual_groq_api_key_here

# Optional: Override local Ollama endpoint (Defaults to http://localhost:11434)
NEXT_PUBLIC_OLLAMA_URL=http://localhost:11434
```

### 3. Installation & Run

```bash
# Install dependencies
npm install

# Run the local development server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser to view the application.

### 4. Production Build

To build and compile the static production version:
```bash
npm run build
npm run start
```

---

## 📂 Project Structure

```
├── app/
│   ├── api/                   # API Routes (Question extraction & CBSE grading)
│   ├── my-papers/             # Saved tests and scorecards page
│   ├── processing/            # Progress loader stage page
│   ├── results/               # Detailed scorecard review routes
│   └── test/                  # Timed test execution page
├── components/                # Shared layout & reusable UI components
├── lib/
│   ├── extractor/
│   │   ├── local/             # Offline regex fallback parser modules
│   │   ├── groq-client.ts     # Main Groq extraction client & system prompts
│   │   ├── ocr_extractor.ts   # Local Ollama / Tesseract image scanner
│   │   ├── pdf-extractor.ts   # Dynamic client-side PDF parser
│   │   └── text-extractor.ts  # Fallback routing chain
│   ├── api-types.ts           # Unified repository types
│   ├── result-storage.ts      # LocalStorage CRUD methods
│   └── result-summary.ts      # Scorecard math calculation builder
└── public/
    └── pdf.worker.min.mjs     # Bundled local offline PDF worker
```

---

## 🤝 Contributing

Contributions are welcome! Please open an issue or submit a pull request if you find a bug or have a suggestion to improve the extraction pipeline.

## 📄 License

This project is licensed under the MIT License.
