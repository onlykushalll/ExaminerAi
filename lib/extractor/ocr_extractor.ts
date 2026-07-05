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

/** Ollama API URL — configurable via env, defaults to localhost */
const OLLAMA_URL = process.env.NEXT_PUBLIC_OLLAMA_URL || "http://localhost:11434";
const OLLAMA_OCR_MODEL = process.env.NEXT_PUBLIC_OLLAMA_OCR_MODEL || "glm-ocr:latest";

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

  onProgress?.(30, `Sending to GLM-OCR (${OLLAMA_OCR_MODEL})...`);
  const response = await fetch(`${OLLAMA_URL}/api/generate`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: OLLAMA_OCR_MODEL,
      prompt: "Extract all text from this document clearly. Preserve question numbers, section headers, and mathematical notation exactly as printed.",
      images: [base64],
      stream: false,
    }),
  });

  if (!response.ok) {
    throw new Error(`Ollama GLM-OCR request failed: ${response.status} ${response.statusText}. Is Ollama running at ${OLLAMA_URL}?`);
  }

  const data = await response.json();
  onProgress?.(100, `OCR Extraction complete.`);
  return data.response || "";
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
    const response = await fetch(`${OLLAMA_URL}/api/generate`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: OLLAMA_OCR_MODEL,
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

function fileToBase64(file: File): Promise<string> {
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
