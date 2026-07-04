/**
 * ============================================================
 * lib/extractor/pdf-extractor.ts — PDF Text Extraction
 * Examiner AI — Question Extraction Engine
 * ============================================================
 *
 * CRITICAL NEXT.JS RULES:
 *  - NO top-level imports of pdfjs-dist
 *  - ALL pdfjs imports are dynamic (inside async functions)
 *  - NO SSR usage — this module is client-side ONLY
 *  - Worker is loaded from CDN to avoid webpack bundling issues
 *
 * TEXT EXTRACTION STRATEGY:
 *  Instead of naively concatenating text items, we reconstruct
 *  line structure using Y-position clustering. This gives us:
 *  - Correct reading order
 *  - Preserved line breaks
 *  - Better column handling
 */

import type { PDFExtractionResult, PDFPage, PDFTextItem } from './types';

// ─────────────────────────────────────────────
// CONSTANTS
// ─────────────────────────────────────────────

/** Threshold (in PDF units) to consider two items on the same line */
const SAME_LINE_Y_THRESHOLD = 2.0;

/** Threshold to detect a paragraph break vs normal line break */
const PARAGRAPH_Y_THRESHOLD = 14.0;

/** Maximum width ratio for detecting multi-column layout */
const COLUMN_SPLIT_RATIO = 0.55;

// ─────────────────────────────────────────────
// MAIN EXTRACTION FUNCTION
// ─────────────────────────────────────────────

/**
 * Extract text from a PDF file using pdfjs-dist.
 *
 * This is designed to be called CLIENT-SIDE ONLY in Next.js.
 * Use inside a 'use client' component or event handler.
 *
 * @param fileOrBuffer  File object (from <input type="file">) or ArrayBuffer
 */
export async function extractTextFromPDF(
  fileOrBuffer: File | ArrayBuffer
): Promise<PDFExtractionResult> {
  const warnings: string[] = [];

  // ── Convert File → ArrayBuffer ──────────────────────────────────
  let arrayBuffer: ArrayBuffer;
  if (fileOrBuffer instanceof File) {
    arrayBuffer = await fileOrBuffer.arrayBuffer();
  } else {
    arrayBuffer = fileOrBuffer;
  }

  // ── Dynamic import — NEVER at top level in Next.js ────────────
  let pdfjsLib: typeof import('pdfjs-dist');
  try {
    pdfjsLib = await import('pdfjs-dist');
  } catch {
    throw new Error(
      'pdfjs-dist is not installed. Run: npm install pdfjs-dist'
    );
  }

  // ── Set worker source (CDN — avoids webpack/SSR issues) ────────
  // We use a versioned CDN URL matching the installed pdfjs-dist version
  const pdfVersion = pdfjsLib.version;

  // Try unpkg CDN first, fallback to cdnjs
  pdfjsLib.GlobalWorkerOptions.workerSrc = `/pdf.worker.min.mjs`;

  // ── Load PDF document ──────────────────────────────────────────
  let pdfDocument;
  try {
    const loadingTask = pdfjsLib.getDocument({
      data: new Uint8Array(arrayBuffer),
      // Disable standard fonts fetching to speed up client-side loading
      disableFontFace: false,
      // Disable range requests for in-memory buffer
      disableRange: true,
      disableStream: true,
    });

    pdfDocument = await loadingTask.promise;
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    throw new Error(`Failed to load PDF: ${msg}`);
  }

  const pageCount = pdfDocument.numPages;
  const pages: PDFPage[] = [];
  const pageTexts: string[] = [];

  // ── Extract text page by page ──────────────────────────────────
  for (let pageNum = 1; pageNum <= pageCount; pageNum++) {
    try {
      const page = await pdfDocument.getPage(pageNum);
      const textContent = await page.getTextContent();

      // Convert pdfjs items to our internal format
      const rawItems: PDFTextItem[] = textContent.items
        .filter((item): item is import('pdfjs-dist/types/src/display/api').TextItem =>
          'str' in item && typeof (item as any).str === 'string'
        )
        .map(item => {
          const typedItem = item as any;
          return {
            str: typedItem.str,
            x: typedItem.transform?.[4] ?? 0,
            y: typedItem.transform?.[5] ?? 0,
            width: typedItem.width ?? 0,
            height: typedItem.height ?? typedItem.transform?.[3] ?? 10,
            fontName: typedItem.fontName,
          };
        })
        .filter(item => item.str.trim().length > 0);

      // Reconstruct line structure
      const { lines, text: pageText } = reconstructPageText(rawItems, page);

      pages.push({
        pageNumber: pageNum,
        text: pageText,
        lines,
        rawItems,
      });

      pageTexts.push(pageText);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      warnings.push(`Page ${pageNum} extraction failed: ${msg}`);
      pages.push({
        pageNumber: pageNum,
        text: '',
        lines: [],
        rawItems: [],
      });
      pageTexts.push('');
    }
  }

  // ── Combine all pages ─────────────────────────────────────────
  // Use form-feed as page separator (compatible with cleaner.ts)
  const fullText = pageTexts.join('\n\n');

  if (fullText.trim().length === 0) {
    warnings.push('No text extracted. The PDF may be image-based. OCR may be needed.');
  }

  return {
    text: fullText,
    pages,
    pageCount,
    warnings,
  };
}

// ─────────────────────────────────────────────
// LINE RECONSTRUCTION
// ─────────────────────────────────────────────

interface ReconstructedPage {
  lines: string[];
  text: string;
}

/**
 * Reconstruct proper line structure from raw PDF text items.
 *
 * PDF text items have X,Y coordinates. We:
 * 1. Sort by Y (descending, since PDF Y grows upward)
 * 2. Group items by Y position (±threshold = same line)
 * 3. Sort items within each line by X (left to right)
 * 4. Join items, adding spaces where appropriate
 * 5. Detect multi-column layout and handle it
 */
function reconstructPageText(
  items: PDFTextItem[],
  page: any // PDFPageProxy
): ReconstructedPage {
  if (items.length === 0) return { lines: [], text: '' };

  // ── Group by Y position ────────────────────────────────────────
  const lineGroups = groupByYPosition(items, SAME_LINE_Y_THRESHOLD);

  // ── Sort lines top-to-bottom (PDF Y is inverted, so sort descending) ──
  lineGroups.sort((a, b) => b.y - a.y);

  // ── Check for multi-column layout ─────────────────────────────
  const pageWidth = page.view?.[2] ?? 600; // default width
  const isMultiColumn = detectMultiColumn(lineGroups, pageWidth);

  let reconstructedLines: string[];

  if (isMultiColumn) {
    reconstructedLines = reconstructMultiColumnLines(lineGroups, pageWidth);
  } else {
    reconstructedLines = lineGroups.map(group => {
      // Sort items in line by X (left to right)
      group.items.sort((a, b) => a.x - b.x);
      return joinLineItems(group.items);
    });
  }

  // ── Add blank lines for paragraph breaks ──────────────────────
  const linesWithBreaks: string[] = [];
  for (let i = 0; i < lineGroups.length; i++) {
    linesWithBreaks.push(reconstructedLines[i]);

    if (i + 1 < lineGroups.length) {
      const gap = lineGroups[i].y - lineGroups[i + 1].y;
      if (gap > PARAGRAPH_Y_THRESHOLD) {
        linesWithBreaks.push(''); // blank line for paragraph break
      }
    }
  }

  const text = linesWithBreaks.join('\n');
  return { lines: reconstructedLines, text };
}

interface LineGroup {
  y: number;       // representative Y position
  items: PDFTextItem[];
}

function groupByYPosition(items: PDFTextItem[], threshold: number): LineGroup[] {
  const groups: LineGroup[] = [];

  for (const item of items) {
    // Find an existing group within threshold
    const group = groups.find(g => Math.abs(g.y - item.y) <= threshold);

    if (group) {
      group.items.push(item);
    } else {
      groups.push({ y: item.y, items: [item] });
    }
  }

  return groups;
}

/**
 * Join PDF text items in a single line, adding spaces where needed.
 */
function joinLineItems(items: PDFTextItem[]): string {
  if (items.length === 0) return '';
  if (items.length === 1) return items[0].str;

  let result = items[0].str;

  for (let i = 1; i < items.length; i++) {
    const prev = items[i - 1];
    const curr = items[i];

    // Calculate expected X based on previous item's end
    const prevEnd = prev.x + prev.width;
    const gap = curr.x - prevEnd;

    // If gap > ~1 space width, add a space
    if (gap > 2 && !result.endsWith(' ') && !curr.str.startsWith(' ')) {
      result += ' ';
    }

    result += curr.str;
  }

  return result;
}

/**
 * Detect if a page has a multi-column layout.
 * Heuristic: if many lines have content only in the left or right half,
 * and there are enough items in both halves, it's probably multi-column.
 */
function detectMultiColumn(groups: LineGroup[], pageWidth: number): boolean {
  const midpoint = pageWidth * COLUMN_SPLIT_RATIO;
  let leftOnly = 0;
  let rightOnly = 0;
  let both = 0;

  for (const group of groups) {
    const hasLeft = group.items.some(item => item.x < midpoint);
    const hasRight = group.items.some(item => item.x >= midpoint);

    if (hasLeft && hasRight) both++;
    else if (hasLeft) leftOnly++;
    else if (hasRight) rightOnly++;
  }

  // Multi-column if both left-only and right-only columns have significant content
  // and there's little mixed content
  return leftOnly > 5 && rightOnly > 5 && both < (leftOnly + rightOnly) * 0.3;
}

/**
 * Reconstruct multi-column text in reading order (left col first, then right).
 */
function reconstructMultiColumnLines(
  groups: LineGroup[],
  pageWidth: number
): string[] {
  const midpoint = pageWidth * COLUMN_SPLIT_RATIO;

  // Separate left and right columns
  const leftLines: string[] = [];
  const rightLines: string[] = [];

  for (const group of groups) {
    const leftItems = group.items.filter(item => item.x < midpoint);
    const rightItems = group.items.filter(item => item.x >= midpoint);

    if (leftItems.length > 0) {
      leftItems.sort((a, b) => a.x - b.x);
      leftLines.push(joinLineItems(leftItems));
    }
    if (rightItems.length > 0) {
      rightItems.sort((a, b) => a.x - b.x);
      rightLines.push(joinLineItems(rightItems));
    }
  }

  // Return left column first, then right (reading order)
  return [...leftLines, ...rightLines];
}

// ─────────────────────────────────────────────
// UTILITY EXPORTS
// ─────────────────────────────────────────────

/**
 * Quick check: does a file look like a PDF?
 */
export function isPDFFile(file: File): boolean {
  return (
    file.type === 'application/pdf' ||
    file.name.toLowerCase().endsWith('.pdf')
  );
}

/**
 * Check if extracted PDF text looks image-based (no real text).
 */
export function isImageBasedPDF(text: string): boolean {
  const wordCount = text.trim().split(/\s+/).length;
  return wordCount < 20;
}

/**
 * Get a quick character count estimate for loading progress.
 */
export async function getPDFPageCount(file: File): Promise<number> {
  const buffer = await file.arrayBuffer();
  const pdfjsLib = await import('pdfjs-dist');
  const version = pdfjsLib.version;
  pdfjsLib.GlobalWorkerOptions.workerSrc = `/pdf.worker.min.mjs`;

  const doc = await pdfjsLib.getDocument({ data: new Uint8Array(buffer) }).promise;
  return doc.numPages;
}
