/**
 * ============================================================
 * lib/extractor/cleaner.ts — Text Cleaning & Normalization v2
 * Examiner AI — Question Extraction Engine
 * ============================================================
 */

// ─────────────────────────────────────────────
// ENCODING FIXES
// ─────────────────────────────────────────────

const ENCODING_REPLACEMENTS: Array<[RegExp, string]> = [
  [/ﬁ/g, 'fi'], [/ﬂ/g, 'fl'], [/ﬀ/g, 'ff'], [/ﬃ/g, 'ffi'], [/ﬄ/g, 'ffl'],
  [/[\u2018\u2019]/g, "'"], [/[\u201C\u201D]/g, '"'],
  [/[\u2013\u2014]/g, '-'],
  [/\u00A0/g, ' '], [/\u200B/g, ''], [/\uFFFD/g, ''],
  [/[•◦▪▸►]/g, '-'],
  [/\u2026/g, '...'],
  [/©\s*\d{4}/g, ''],
  [/→/g, '->'],
  [/⟶/g, '-->'],
  [/≡/g, '≡'],
];

// ─────────────────────────────────────────────
// NOISE PATTERNS (lines to remove entirely)
// ─────────────────────────────────────────────

const NOISE_LINE_PATTERNS: RegExp[] = [
  /^[-–—\s]*\d+[-–—\s]*$/,
  /^page\s+\d+\s*(of\s*\d+)?$/i,
  /^(roll\s*no|roll\s*number|exam\s*roll|registration\s*no)[.\s:]/i,
  /^(confidential|do\s*not\s*write|for\s*official\s*use)/i,
  /^[=\-_~.]{4,}$/,
  /copyright|all rights reserved|printed by|published by/i,
  /^.{0,2}$/,
];

// ─────────────────────────────────────────────
// HEADER / FOOTER PATTERNS (remove but don't flag)
// ─────────────────────────────────────────────

const HEADER_FOOTER_PATTERNS: RegExp[] = [
  /^(time\s*allowed|maximum\s*marks|total\s*marks|full\s*marks)\s*[:—]/i,
  /^(class|subject|date|set|code|series)\s*[:\-]\s*\S/i,
  /^class\s+[xivXIV]+\s+session/i,
  /^sample\s+question\s+paper/i,
  /^subject\s*[-:]\s*science/i,
  /^general\s+instructions\s*:?\s*$/i,
];

// ─────────────────────────────────────────────
// SOLUTION SECTION DETECTION
// ─────────────────────────────────────────────

const SOLUTION_HEADER_PATTERNS: RegExp[] = [
  /^\s*solutions?\s*$/i,
  /^\s*answer\s*(?:key|sheet)?\s*$/i,
  /^\s*answers?\s*$/i,
  /^\s*marking\s+scheme\s*$/i,
  /^\s*value\s+points?\s*$/i,
];

/**
 * Find the position where the solutions/answer key section begins.
 * Returns -1 if no solution section is found.
 */
export function findSolutionSectionStart(text: string): number {
  const lines = text.split('\n');
  for (let i = 0; i < lines.length; i++) {
    const trimmed = lines[i].trim();
    if (SOLUTION_HEADER_PATTERNS.some(p => p.test(trimmed))) {
      // Compute character position
      let pos = 0;
      for (let j = 0; j < i; j++) {
        pos += lines[j].length + 1; // +1 for \n
      }
      return pos;
    }
  }
  return -1;
}

/**
 * Remove the solutions/answer section from the end of the text.
 */
export function removeSolutionSection(text: string): { text: string; removed: boolean } {
  const pos = findSolutionSectionStart(text);
  if (pos > 0) {
    return { text: text.slice(0, pos).trim(), removed: true };
  }
  return { text, removed: false };
}

// ─────────────────────────────────────────────
// INSTRUCTION BLOCK DETECTION
// ─────────────────────────────────────────────

const INSTRUCTION_SIGNALS: RegExp[] = [
  /this\s+question\s+paper\s+consists/i,
  /all\s+questions\s+are\s+compulsory/i,
  /internal\s+choice/i,
  /attempt\s+(?:only\s+)?one/i,
  /read\s+(?:the\s+)?(?:following\s+)?instructions/i,
  /section\s+[A-Z]\s+(?:is|contains|consists|has)/i,
  /marks\s+are\s+indicated/i,
  /use\s+(?:of\s+)?(?:log\s+table|calculator)/i,
  /draw\s+neat\s+(?:and\s+)?labelled/i,
  /expected\s+to\s+attempt/i,
];

/**
 * Check if a line is part of an instruction block.
 */
export function isInstructionLine(line: string): boolean {
  const trimmed = line.trim();
  if (trimmed.length === 0) return false;
  return INSTRUCTION_SIGNALS.some(p => p.test(trimmed));
}

/**
 * Find where the preamble (title + instructions) ends and actual questions begin.
 * Returns the character position where questions start.
 *
 * Strategy:
 *  1. Look for the first "Section X" header -> questions start there
 *  2. If no section header, look for the first numbered question after instructions
 */
export function findPreambleEnd(text: string): number {
  const lines = text.split('\n');

  // Strategy 1: Find first Section header
  for (let i = 0; i < lines.length; i++) {
    const trimmed = lines[i].trim();
    if (/^section\s+[A-Za-z]\s*$/i.test(trimmed) ||
        /^section\s*[-–:]\s*[A-Za-z]\s*$/i.test(trimmed) ||
        /^section\s+[A-Za-z]\s*[-–:]/i.test(trimmed)) {
      let pos = 0;
      for (let j = 0; j < i; j++) pos += lines[j].length + 1;
      return pos;
    }
  }

  // Strategy 2: Find the end of instruction block
  let lastInstructionLine = -1;
  for (let i = 0; i < Math.min(lines.length, 30); i++) {
    const trimmed = lines[i].trim();
    if (isInstructionLine(trimmed) || HEADER_FOOTER_PATTERNS.some(p => p.test(trimmed))) {
      lastInstructionLine = i;
    }
  }

  if (lastInstructionLine >= 0) {
    let pos = 0;
    for (let j = 0; j <= lastInstructionLine; j++) pos += lines[j].length + 1;
    return pos;
  }

  return 0;
}

// ─────────────────────────────────────────────
// MAIN CLEANING PIPELINE
// ─────────────────────────────────────────────

export interface CleanerOutput {
  text: string;
  lines: string[];
  stats: {
    originalLines: number;
    removedLines: number;
    mergedLines: number;
    solutionRemoved: boolean;
    preambleEnd: number;
  };
  warnings: string[];
}

export function cleanExtractedText(rawText: string): CleanerOutput {
  const warnings: string[] = [];

  if (!rawText || rawText.trim().length === 0) {
    return {
      text: '',
      lines: [],
      stats: { originalLines: 0, removedLines: 0, mergedLines: 0, solutionRemoved: false, preambleEnd: 0 },
      warnings: ['Input text is empty.'],
    };
  }

  let text = rawText;

  // Step 1: Fix encoding
  text = fixEncoding(text);

  // Step 2: Normalize line endings
  text = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n');

  // Step 3: Remove solution section
  const solResult = removeSolutionSection(text);
  text = solResult.text;
  if (solResult.removed) {
    warnings.push('Solution/answer key section detected and removed.');
  }

  // Step 4: Fix hyphenated line breaks
  text = text.replace(/(\w)-\n(\w)/g, '$1$2');

  // Step 5: Split into lines
  const originalLines = text.split('\n');
  const stats = {
    originalLines: originalLines.length,
    removedLines: 0,
    mergedLines: 0,
    solutionRemoved: solResult.removed,
    preambleEnd: 0,
  };

  // Step 6: Per-line normalize
  const normalizedLines = originalLines.map(normalizeLineInternal);

  // Step 7: Remove noise lines (but preserve blank lines for structure)
  const cleanLines = normalizedLines.filter(line => {
    const isNoise = isNoiseLine(line);
    if (isNoise) stats.removedLines++;
    return !isNoise;
  });

  // Step 8: Merge broken sentence continuations
  const { lines: mergedLines, mergeCount } = mergeBrokenSentences(cleanLines);
  stats.mergedLines = mergeCount;

  // Step 9: Collapse excessive blank lines
  const collapsedLines = collapseBlankLines(mergedLines, 2);

  // Step 10: Final text
  const finalText = collapsedLines.join('\n').trim();

  // Step 11: Find preamble end
  stats.preambleEnd = findPreambleEnd(finalText);

  if (finalText.length < 20) {
    warnings.push('Very little text after cleaning. Input may be corrupted or image-based.');
  }

  return {
    text: finalText,
    lines: collapsedLines.filter(l => l.trim().length > 0),
    stats,
    warnings,
  };
}

// ─────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────

function fixEncoding(text: string): string {
  let out = text;
  for (const [pattern, replacement] of ENCODING_REPLACEMENTS) {
    out = out.replace(pattern, replacement);
  }
  return out;
}

function normalizeLineInternal(line: string): string {
  return line
    .replace(/\t/g, ' ')
    .replace(/[ ]{2,}/g, ' ')
    .trim();
}

export function isNoiseLine(line: string): boolean {
  const trimmed = line.trim();
  if (trimmed.length === 0) return false;
  return NOISE_LINE_PATTERNS.some(p => p.test(trimmed));
}

function mergeBrokenSentences(lines: string[]): { lines: string[]; mergeCount: number } {
  if (lines.length === 0) return { lines: [], mergeCount: 0 };

  const result: string[] = [lines[0]];
  let mergeCount = 0;

  for (let i = 1; i < lines.length; i++) {
    const current = result[result.length - 1];
    const next = lines[i];

    if (
      current.trim().length > 0 &&
      next.trim().length > 0 &&
      shouldMergeLines(current, next)
    ) {
      result[result.length - 1] = current + ' ' + next.trim();
      mergeCount++;
    } else {
      result.push(next);
    }
  }

  return { lines: result, mergeCount };
}

function shouldMergeLines(current: string, next: string): boolean {
  const cur = current.trim();
  const nxt = next.trim();

  // Terminal punctuation -> sentence is complete
  if (/[.?!:;)\]"']$/.test(cur)) return false;

  // Next line looks like a question start
  if (/^(?:Q\.?\s*)?\d+\s*[.)]\s+\S/i.test(nxt)) return false;

  // Next line is an MCQ option
  if (/^\(?[A-Da-d]\)?[.)]\s+\S/.test(nxt)) return false;

  // Next line is a section header
  if (/^(SECTION|PART|UNIT)\s+[A-Z0-9]+/i.test(nxt)) return false;

  // Next line is an OR separator
  if (/^\s*OR\s*$/i.test(nxt)) return false;

  // Next line is a sub-part like a. b. c.
  if (/^[a-c][.)]\s+/i.test(nxt)) return false;
  if (/^(i{1,3}|iv|v|vi{0,3})[.)]\s+/i.test(nxt)) return false;

  // Next line starts with lowercase -> continuation
  if (/^[a-z]/.test(nxt)) return true;

  // Current is short and doesn't end in punctuation -> wrapped
  if (cur.length < 55) return true;

  return false;
}

function collapseBlankLines(lines: string[], maxConsecutive: number): string[] {
  const result: string[] = [];
  let consecutiveBlanks = 0;

  for (const line of lines) {
    if (line.trim().length === 0) {
      consecutiveBlanks++;
      if (consecutiveBlanks <= maxConsecutive) result.push(line);
    } else {
      consecutiveBlanks = 0;
      result.push(line);
    }
  }

  return result;
}

/**
 * Clean a single question block text:
 * - Remove leading question number
 * - Remove trailing marks notation
 * - Normalize whitespace
 */
export function cleanQuestionText(
  text: string,
  optionStartIndex?: number
): string {
  let questionPart = optionStartIndex !== undefined && optionStartIndex > 0
    ? text.slice(0, optionStartIndex)
    : text;

  // Remove leading Q number prefix (Q1., 1., (1), etc.)
  questionPart = questionPart
    .replace(/^[\s]*(?:Q\.?\s*)?\d+\s*[.):\s]+/, '')
    .trim();

  // Remove trailing marks indicators
  questionPart = questionPart
    .replace(/\s*[\[(]\s*\d+\s*(?:marks?|m|M)?\s*[\])]\s*$/, '')
    .trim();

  // Collapse internal whitespace
  questionPart = questionPart
    .replace(/[ \t]{2,}/g, ' ')
    .replace(/\n{3,}/g, '\n\n');

  return questionPart.trim();
}
