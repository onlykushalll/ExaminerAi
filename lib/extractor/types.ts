/**
 * ============================================================
 * lib/extractor/types.ts — Complete Type System
 * Examiner AI — Question Extraction Engine v2
 * ============================================================
 */

// ─────────────────────────────────────────────
// QUESTION TYPES
// ─────────────────────────────────────────────

export type QuestionType = 'mcq' | 'subjective' | 'assertion_reason' | 'case_study';

export type OptionFormat =
  | 'alpha-paren'      // (A) (B) (C) (D)
  | 'alpha-dot'        // A. B. C. D.
  | 'alpha-bracket'    // A) B) C) D)
  | 'numeric-paren'    // (1) (2) (3) (4)
  | 'numeric-dot'      // 1. 2. 3. 4.
  | 'numeric-bracket'  // 1) 2) 3) 4)
  | 'roman'            // (i) (ii) (iii) (iv)
  | 'unknown';

// ─────────────────────────────────────────────
// OUTPUT STRUCTURES
// ─────────────────────────────────────────────

export interface ExtractedQuestion {
  id: string;
  question: string;
  type: QuestionType;
  options?: string[];
  marks?: number;
  confidence: number;
  section?: string;
  expectedAnswer?: string;
  metadata?: {
    number?: number;
    splitMethod?: string;
    optionFormat?: OptionFormat;
    rawLength?: number;
    hasAssertion?: boolean;
    hasReason?: boolean;
    subParts?: string[];
    hasOR?: boolean;
    rawOptions?: string[];
    inferredMarks?: boolean;
    inferredOptions?: boolean;
  };
}

export interface ExtractionResult {
  questions: ExtractedQuestion[];
  total: number;
  warnings: string[];
}

// ─────────────────────────────────────────────
// INTERNAL PIPELINE TYPES
// ─────────────────────────────────────────────

export interface QuestionBlock {
  raw: string;
  questionNumber?: number;
  startPos: number;
  splitMethod: 'boundary' | 'inline' | 'fallback';
  section?: string;
}

export interface BoundaryCandidate {
  pos: number;
  num: number;
  matchText: string;
  score: number;
  patternName: string;
}

export interface OptionExtractionResult {
  options: string[];
  format: OptionFormat;
  optionsStart: number;
}

export type LineType =
  | 'question_start'
  | 'option'
  | 'subpart'
  | 'section_header'
  | 'instruction'
  | 'continuation'
  | 'marks'
  | 'or_separator'
  | 'blank'
  | 'noise'
  | 'solution_header'
  | 'content';

export interface ClassifiedLine {
  text: string;
  type: LineType;
  lineIndex: number;
  questionNum?: number;
  sectionName?: string;
}

export interface SectionMarker {
  name: string;
  pos: number;
  lineIndex: number;
}

// ─────────────────────────────────────────────
// PDF EXTRACTION
// ─────────────────────────────────────────────

export interface PDFTextItem {
  str: string;
  x: number;
  y: number;
  width: number;
  height: number;
  fontName?: string;
}

export interface PDFPage {
  pageNumber: number;
  text: string;
  lines: string[];
  rawItems: PDFTextItem[];
}

export interface PDFExtractionResult {
  text: string;
  pages: PDFPage[];
  pageCount: number;
  confidence?: number;
  warnings: string[];
}

// ─────────────────────────────────────────────
// TEXT EXTRACTOR
// ─────────────────────────────────────────────

export type InputFileType = 'pdf' | 'image' | 'text' | 'unknown';

export interface TextExtractionOptions {
  preserveLayout?: boolean;
  ocrLanguage?: string;
  onProgress?: (pct: number, msg: string) => void;
}

export interface TextExtractionResult {
  text: string;
  fileType: InputFileType;
  pageCount?: number;
  warnings: string[];
}
