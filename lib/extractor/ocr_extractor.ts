const getOllamaUrl = () => {
  const envUrl = typeof process !== 'undefined' && process.env ? process.env.NEXT_PUBLIC_OLLAMA_URL : undefined;
  const baseUrl = envUrl || "http://localhost:11434";
  return `${baseUrl.replace(/\/+$/, '')}/api/generate`;
};

export async function extractTextWithGLMOCR(
  file: File,
  onProgress?: (pct: number, msg: string) => void
): Promise<string> {
  const isPDF = file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf');

  if (isPDF) {
    const arrayBuffer = await file.arrayBuffer();
    
    // Dynamic import to prevent webpack SSR issues
    const pdfjsLib = await import('pdfjs-dist');
    const version = pdfjsLib.version;
    pdfjsLib.GlobalWorkerOptions.workerSrc = `/pdf.worker.min.mjs`;

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
      const response = await fetch(getOllamaUrl(), {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "glm-ocr:latest",
          prompt: "Extract all text from this page clearly.",
          images: [base64Data],
          stream: false,
        }),
      });

      if (response.ok) {
        const data = await response.json();
        pageTexts.push(data.response || "");
      } else {
        console.error(`[GLM-OCR] Page ${pageNum} failed with status: ${response.status}`);
      }
    }

    onProgress?.(100, `OCR Extraction complete.`);
    return pageTexts.join('\n\n');
  }

  // Image fallback
  onProgress?.(10, `Converting image to base64...`);
  const base64 = await fileToBase64(file);

  onProgress?.(30, `Sending to GLM-OCR...`);
  const response = await fetch(getOllamaUrl(), {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "glm-ocr:latest",
      prompt: "Extract all text from this document clearly.",
      images: [base64],
      stream: false,
    }),
  });

  const data = await response.json();
  onProgress?.(100, `OCR Extraction complete.`);
  return data.response || "";
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