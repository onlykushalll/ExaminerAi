/**
 * ============================================================
 * lib/extractor/marks-extractor.ts — Marks Extraction & Inference
 * Examiner AI — Question Extraction Engine
 * ============================================================
 */

// ─────────────────────────────────────────────
// PATTERN-BASED EXTRACTION
// ─────────────────────────────────────────────

const MARKS_PATTERNS: Array<{ regex: RegExp; extract: (m: RegExpMatchArray) => number }> = [
  // [1 Mark] [2 Marks] [1M] [2M]
  {
    regex: /[\[(]\s*(\d+(?:\.\d+)?)\s*(?:marks?|m|M|pts?|points?)\s*[\])]/i,
    extract: (m) => parseFloat(m[1]),
  },
  // Trailing [3] or (3) at end of question text
  {
    regex: /\[(\d+)\]\s*$/,
    extract: (m) => parseInt(m[1]),
  },
  // "2 marks" at end of line
  {
    regex: /(\d+(?:\.\d+)?)\s*(?:marks?|m|M)\s*$/i,
    extract: (m) => parseFloat(m[1]),
  },
  // "worth 3 marks" / "carries 3 marks"
  {
    regex: /(?:worth|carries|carry)\s+(\d+)\s+marks?/i,
    extract: (m) => parseInt(m[1]),
  },
  // Standalone marks in brackets in middle of text: [1]
  {
    regex: /\[(\d{1,2})\]/,
    extract: (m) => parseInt(m[1]),
  },
  // Marks in parentheses with context: (1 mark)
  {
    regex: /\((\d{1,2})\s*marks?\)/i,
    extract: (m) => parseInt(m[1]),
  },
];

/**
 * Extract marks from question text.
 * Returns undefined if no marks pattern is found.
 */
export function extractMarksFromText(text: string): number | undefined {
  for (const { regex, extract } of MARKS_PATTERNS) {
    const match = text.match(regex);
    if (match) {
      const val = extract(match);
      if (val >= 0.5 && val <= 20) return val;
    }
  }
  return undefined;
}

// ─────────────────────────────────────────────
// MARKS INFERENCE
// ─────────────────────────────────────────────

interface InferenceHint {
  section?: string;
  questionType?: string;
  questionLength?: number;
  hasSubParts?: boolean;
  subPartCount?: number;
  hasOR?: boolean;
}

/**
 * Infer marks when explicit marks are not found.
 * Uses section context, CBSE board patterns, question type, and length heuristics.
 */
export function inferMarks(hint: InferenceHint): number {
  const { section, questionType, questionLength = 0, hasSubParts, subPartCount = 0 } = hint;

  // CBSE section rules (highest priority)
  if (section) {
    const sectionUpper = section.toUpperCase();
    if (sectionUpper.includes('SECTION A') || sectionUpper.includes('PART A')) {
      if (questionType === 'mcq' || questionType === 'assertion_reason') return 1;
      return 1;
    }
    if (sectionUpper.includes('SECTION B') || sectionUpper.includes('PART B')) return 3;
    if (sectionUpper.includes('SECTION C') || sectionUpper.includes('PART C')) return 5;
    if (sectionUpper.includes('SECTION D') || sectionUpper.includes('PART D')) return 5;
  }

  // By question type
  if (questionType === 'mcq' || questionType === 'assertion_reason') return 1;

  // By length / sub-parts
  if (hasSubParts && subPartCount >= 3) return 5;
  if (hasSubParts && subPartCount >= 2) return 3;

  if (questionLength > 300) return 5;
  if (questionLength > 150) return 3;
  if (questionLength > 50) return 2;

  return 1;
}

/**
 * Remove marks notation from text.
 */
export function stripMarksFromText(text: string): string {
  return text
    .replace(/\s*[\[(]\s*\d+\s*(?:marks?|m|M|pts?|points?)?\s*[\])]\s*$/, '')
    .replace(/\s*[\[(]\s*\d+\s*(?:marks?|m|M|pts?|points?)\s*[\])]\s*/gi, ' ')
    .replace(/\s{2,}/g, ' ')
    .trim();
}
