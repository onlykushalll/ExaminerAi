/**
 * ============================================================
 * lib/extractor/text-extractor.ts — Unified Text Extraction
 * Examiner AI — Question Extraction Engine v3
 * ============================================================
 *
 * CHANGES FROM v2:
 * - Pass onProgress to extractTextWithGLMOCR for image files (was missing)
 * - Return pageImages from PDF extraction for diagram display
 * - Better fallback chain with clear warnings
 */

import type { TextExtractionResult, InputFileType, TextExtractionOptions } from './types';
import { extractTextFromPDF, isPDFFile, isImageBasedPDF } from './pdf-extractor';
import { extractTextWithGLMOCR, extractPageImagesFromPDF, fileToBase64 } from './ocr_extractor';

// ─────────────────────────────────────────────
// FILE TYPE DETECTION
// ─────────────────────────────────────────────

const MIME_TO_TYPE: Record<string, InputFileType> = {
  'application/pdf': 'pdf',
  'text/plain': 'text',
  'text/markdown': 'text',
  'image/jpeg': 'image',
  'image/png': 'image',
  'image/gif': 'image',
  'image/webp': 'image',
  'image/tiff': 'image',
  'image/bmp': 'image',
};

export function detectFileType(file: File): InputFileType {
  if (MIME_TO_TYPE[file.type]) return MIME_TO_TYPE[file.type];

  const ext = file.name.split('.').pop()?.toLowerCase() ?? '';
  const EXT_MAP: Record<string, InputFileType> = {
    pdf: 'pdf',
    txt: 'text',
    text: 'text',
    md: 'text',
    jpg: 'image',
    jpeg: 'image',
    png: 'image',
    gif: 'image',
    webp: 'image',
    tiff: 'image',
    tif: 'image',
    bmp: 'image',
  };

  return EXT_MAP[ext] ?? 'unknown';
}

// ─────────────────────────────────────────────
// MAIN EXTRACTION FUNCTION
// ─────────────────────────────────────────────

export async function extractTextFromFile(
  file: File,
  options: TextExtractionOptions = {}
): Promise<TextExtractionResult> {
  const warnings: string[] = [];
  const fileType = detectFileType(file);

  switch (fileType) {
    case 'pdf':
      return extractFromPDF(file, warnings, options);

    case 'text':
      return extractFromText(file, warnings);

    case 'image':
      return extractFromImage(file, warnings, options);

    default:
      warnings.push(`Unknown file type: "${file.name}". Attempting to read as text.`);
      return extractFromText(file, warnings);
  }
}

// ─────────────────────────────────────────────
// PDF EXTRACTION
// ─────────────────────────────────────────────

async function extractFromPDF(
  file: File,
  warnings: string[],
  options: TextExtractionOptions = {}
): Promise<TextExtractionResult> {
  try {
    const result = await extractTextFromPDF(file);
    warnings.push(...result.warnings);

    // Check if PDF appears image-based
    if (isImageBasedPDF(result.text)) {
      warnings.push(
        'This PDF appears to be image-based (scanned). ' +
        'Attempting local GLM-OCR extraction...'
      );
      try {
        const ocrText = await extractTextWithGLMOCR(file, options.onProgress);
        return {
          text: ocrText,
          fileType: 'pdf',
          pageCount: result.pageCount,
          warnings,
        };
      } catch (ocrErr: any) {
        warnings.push(`Local GLM-OCR not available (${ocrErr.message}). Extracting page images for Cloud Vision OCR...`);
        try {
          const pageImages = await extractPageImagesFromPDF(file, options.onProgress);
          return {
            text: '',
            pageImages,
            fileType: 'pdf',
            pageCount: result.pageCount,
            warnings,
          };
        } catch (imgErr: any) {
          warnings.push(`Failed to extract page images: ${imgErr.message}. Falling back to standard text extraction.`);
        }
      }
    }

    return {
      text: result.text,
      fileType: 'pdf',
      pageCount: result.pageCount,
      warnings,
    };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    warnings.push(`PDF extraction failed: ${msg}`);

    // Try reading as text as absolute last resort
    try {
      const text = await file.text();
      if (text.length > 100) {
        warnings.push('PDF extraction failed. Reading raw file bytes as text (last resort).');
        return { text, fileType: 'pdf', warnings };
      }
    } catch {
      // ignore
    }

    throw new Error(`Cannot extract text from PDF: ${msg}`);
  }
}

// ─────────────────────────────────────────────
// PLAIN TEXT EXTRACTION
// ─────────────────────────────────────────────

async function extractFromText(
  file: File,
  warnings: string[]
): Promise<TextExtractionResult> {
  try {
    const text = await file.text();

    if (text.trim().length === 0) {
      warnings.push('Text file appears to be empty.');
    }

    if (text.length > 500_000) {
      warnings.push('File is very large (> 500KB). Processing may be slow.');
    }

    return {
      text,
      fileType: 'text',
      warnings,
    };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    throw new Error(`Cannot read text file: ${msg}`);
  }
}

// ─────────────────────────────────────────────
// IMAGE EXTRACTION (OCR)
// ─────────────────────────────────────────────

async function extractFromImage(
  file: File,
  warnings: string[],
  options: TextExtractionOptions
): Promise<TextExtractionResult> {
  // Try local Ollama GLM-OCR first — pass onProgress for live feedback
  try {
    const ocrText = await extractTextWithGLMOCR(file, options.onProgress);
    if (ocrText.trim()) {
      return {
        text: ocrText,
        fileType: 'image',
        warnings,
      };
    }
  } catch (err: any) {
    warnings.push(`Local GLM-OCR not available (${err.message}). Capturing image for Cloud Vision OCR...`);
    try {
      const base64 = await fileToBase64(file);
      return {
        text: '',
        pageImages: [base64],
        fileType: 'image',
        warnings,
      };
    } catch (base64Err: any) {
      warnings.push(`Failed to convert image to base64: ${base64Err.message}`);
    }
  }

  // Check if tesseract.js is available
  try {
    const Tesseract = await import('tesseract.js');
    warnings.push('OCR processing started. This may take 10-30 seconds...');

    const lang = options.ocrLanguage ?? 'eng';

    const { data } = await (Tesseract as any).recognize(
      file,
      lang,
      {
        logger: (m: { status: string; progress: number }) => {
          if (m.status === 'recognizing text') {
            const pct = Math.round(m.progress * 100);
            options.onProgress?.(pct, `Tesseract OCR: ${pct}%`);
          }
        },
      }
    );

    if (data.confidence < 50) {
      warnings.push(
        `OCR confidence is low (${data.confidence}%). ` +
        'Results may be inaccurate. Try a higher resolution or clearer image.'
      );
    }

    return {
      text: data.text,
      fileType: 'image',
      warnings,
    };
  } catch (importErr) {
    warnings.push(
      'tesseract.js is not installed. Image OCR is not available. ' +
      'Install it with: npm install tesseract.js'
    );

    return {
      text: '',
      fileType: 'image',
      warnings: [
        ...warnings,
        'No text could be extracted from the image. Please upload a text-based PDF instead.',
      ],
    };
  }
}

// ─────────────────────────────────────────────
// FILE VALIDATION
// ─────────────────────────────────────────────

const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB
const SUPPORTED_TYPES: InputFileType[] = ['pdf', 'text', 'image'];

export interface ValidationResult {
  valid: boolean;
  error?: string;
  warnings?: string[];
}

export function validateFile(file: File): ValidationResult {
  const warnings: string[] = [];

  if (file.size === 0) {
    return { valid: false, error: 'File is empty.' };
  }

  if (file.size > MAX_FILE_SIZE) {
    return {
      valid: false,
      error: `File is too large (${(file.size / 1024 / 1024).toFixed(1)}MB). Maximum is 50MB.`,
    };
  }

  const fileType = detectFileType(file);
  if (fileType === 'unknown') {
    warnings.push(
      `Unsupported file type for "${file.name}". Will attempt to read as plain text.`
    );
  }

  if (fileType === 'image') {
    warnings.push(
      'Image files require OCR processing which may take additional time.'
    );
  }

  return { valid: true, warnings };
}
