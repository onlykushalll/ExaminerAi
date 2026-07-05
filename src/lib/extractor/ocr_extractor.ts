/**
 * ============================================================
 * lib/extractor/ocr_extractor.ts — GLM-OCR via Ollama
 * ============================================================
 *
 * CHANGES FROM v2:
 * - Made Ollama URL configurable via env var (OLLAMA_URL)
 * - Pass onProgress callback through for image OCR
 * - Better error handling with clear messages
 * - Configurable model name via env var (OLLAMA_OCR_MODEL)
 */

const getOllamaUrl = () => {
  if (typeof window !== 'undefined') {
    const saved = localStorage.getItem('OLLAMA_URL');
    if (saved) return saved;
  }
  return "http://localhost:11434";
};

const getOllamaModel = () => {
  if (typeof window !== 'undefined') {
    const saved = localStorage.getItem('OLLAMA_OCR_MODEL');
    if (saved) return saved;
  }
  return "glm-ocr:latest";
};

/** Dynamically route through local proxy to bypass CORS in browser */
const getOllamaEndpoint = () => {
  const isBrowser = typeof window !== 'undefined';
  return isBrowser ? "/api/ollama/api/generate" : `${getOllamaUrl()}/api/generate`;
};

/**
 * Extract text from a PDF or image file using local GLM-OCR via Ollama.
 *
 * For PDFs: renders each page to canvas → base64 → Ollama
 * For images: converts to base64 → Ollama
 */
export async function extractTextWithGLMOCR(
  file: File,
  onProgress?: (pct: number, msg: string) => void
): Promise<string> {
  const isPDF = file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf');

  if (isPDF) {
    return extractTextFromPDFWithGLMOCR(file, onProgress);
  }

  // Image fallback
  onProgress?.(10, `Converting image to base64...`);
  const base64 = await fileToBase64(file);

  onProgress?.(30, `Sending to GLM-OCR (${getOllamaModel()})...`);
  const isTauri = typeof window !== 'undefined' && (window as any).__TAURI__ !== undefined;

  if (isTauri) {
    try {
      const { invoke } = await import("@tauri-apps/api/core");
      const ocrResult = await invoke<string>("ollama_generate", {
        model: getOllamaModel(),
        prompt: "Extract all text from this document clearly. Preserve question numbers, section headers, and mathematical notation exactly as printed.",
        images: [base64],
        url: getOllamaUrl()
      });
      onProgress?.(100, `OCR Extraction complete.`);
      return ocrResult || "";
    } catch (err) {
      console.error(`[GLM-OCR] Image failed via Tauri invoke:`, err);
      throw new Error(`Ollama GLM-OCR failed: ${err instanceof Error ? err.message : String(err)}`);
    }
  } else {
    const response = await fetch(getOllamaEndpoint(), {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: getOllamaModel(),
        prompt: "Extract all text from this document clearly. Preserve question numbers, section headers, and mathematical notation exactly as printed.",
        images: [base64],
        stream: false,
      }),
    });

    if (!response.ok) {
      throw new Error(`Ollama GLM-OCR request failed: ${response.status} ${response.statusText}. Is Ollama running at ${getOllamaUrl()}?`);
    }

    const data = await response.json();
    onProgress?.(100, `OCR Extraction complete.`);
    return data.response || "";
  }
}

/**
 * Extract text from a PDF by rendering each page to canvas and running GLM-OCR.
 * Also returns page images for diagram display in the test UI.
 */
async function extractTextFromPDFWithGLMOCR(
  file: File,
  onProgress?: (pct: number, msg: string) => void
): Promise<string> {
  const arrayBuffer = await file.arrayBuffer();

  // Dynamic import to prevent webpack SSR issues
  const pdfjsLib = await import('pdfjs-dist');
  const version = pdfjsLib.version;
  pdfjsLib.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${version}/build/pdf.worker.min.mjs`;

  const pdf = await pdfjsLib.getDocument({ data: new Uint8Array(arrayBuffer) }).promise;
  const pageTexts: string[] = [];

  const isTauri = typeof window !== 'undefined' && (window as any).__TAURI__ !== undefined;

  for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
    const pct = Math.round(((pageNum - 1) / pdf.numPages) * 100);
    onProgress?.(pct, `Rendering page ${pageNum} of ${pdf.numPages}...`);

    const page = await pdf.getPage(pageNum);

    const canvas = document.createElement('canvas');
    const context = canvas.getContext('2d');
    if (!context) throw new Error('Failed to get 2D canvas context');

    const viewport = page.getViewport({ scale: 1.5 });
    canvas.width = viewport.width;
    canvas.height = viewport.height;

    await page.render({
      canvasContext: context,
      viewport: viewport
    }).promise;

    const base64Data = canvas.toDataURL('image/jpeg', 0.85).split(',')[1];

    onProgress?.(pct + 5, `Running GLM-OCR on page ${pageNum} of ${pdf.numPages}...`);

    if (isTauri) {
      try {
        const { invoke } = await import("@tauri-apps/api/core");
        const ocrResult = await invoke<string>("ollama_generate", {
          model: getOllamaModel(),
          prompt: "Extract all text from this page clearly. Preserve question numbers, section headers, and mathematical notation exactly as printed.",
          images: [base64Data],
          url: getOllamaUrl()
        });
        pageTexts.push(ocrResult || "");
      } catch (err) {
        console.error(`[GLM-OCR] Page ${pageNum} failed via Tauri invoke:`, err);
        pageTexts.push("");
      }
    } else {
      const response = await fetch(getOllamaEndpoint(), {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: getOllamaModel(),
          prompt: "Extract all text from this page clearly. Preserve question numbers, section headers, and mathematical notation exactly as printed.",
          images: [base64Data],
          stream: false,
        }),
      });

      if (response.ok) {
        const data = await response.json();
        pageTexts.push(data.response || "");
      } else {
        console.error(`[GLM-OCR] Page ${pageNum} failed with status: ${response.status}`);
        pageTexts.push(""); // Push empty so page numbering stays consistent
      }
    }
  }

  onProgress?.(100, `OCR Extraction complete.`);
  return pageTexts.join('\n\f\n'); // Use form-feed as page separator
}

/**
 * Extract page images from a PDF as base64 JPEGs.
 * Used for diagram display in the test UI.
 * Returns an array of base64 strings, one per page.
 */
export async function extractPageImagesFromPDF(
  file: File,
  onProgress?: (pct: number, msg: string) => void
): Promise<string[]> {
  const arrayBuffer = await file.arrayBuffer();

  const pdfjsLib = await import('pdfjs-dist');
  const version = pdfjsLib.version;
  pdfjsLib.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${version}/build/pdf.worker.min.mjs`;

  const pdf = await pdfjsLib.getDocument({ data: new Uint8Array(arrayBuffer) }).promise;
  const pageImages: string[] = [];

  for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
    const pct = Math.round((pageNum / pdf.numPages) * 100);
    onProgress?.(pct, `Capturing page image ${pageNum} of ${pdf.numPages}...`);

    const page = await pdf.getPage(pageNum);

    const canvas = document.createElement('canvas');
    const context = canvas.getContext('2d');
    if (!context) continue;

    const viewport = page.getViewport({ scale: 1.0 });
    canvas.width = viewport.width;
    canvas.height = viewport.height;

    await page.render({
      canvasContext: context,
      viewport: viewport
    }).promise;

    const base64 = canvas.toDataURL('image/jpeg', 0.7);
    pageImages.push(base64);
  }

  return pageImages;
}

export function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      resolve(result.split(",")[1]);
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}
