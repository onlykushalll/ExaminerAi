/**
 * ============================================================
 * lib/extractor/detector.ts — Pattern Detection Engine v2
 * Examiner AI — Question Extraction Engine
 * ============================================================
 *
 * Handles:
 *  • Line classification (question start, option, section, instruction, etc.)
 *  • Section detection
 *  • Question boundary detection with sequential filtering
 *  • MCQ option extraction (inline, multiline, mixed formats)
 *  • Assertion-Reason structure extraction
 *  • Inline question split detection (prevents merging)
 *  • Question type classification
 */

import type {
  OptionFormat,
  OptionExtractionResult,
  QuestionType,
  BoundaryCandidate,
  LineType,
  ClassifiedLine,
  SectionMarker,
} from '../types';

// ─────────────────────────────────────────────
// LINE CLASSIFICATION
// ─────────────────────────────────────────────

/**
 * Classify a single line into its structural type.
 */
export function classifyLine(line: string, lineIndex: number): ClassifiedLine {
  const trimmed = line.trim();

  if (trimmed.length === 0) {
    return { text: trimmed, type: 'blank', lineIndex };
  }

  // Solution header
  if (/^\s*solutions?\s*$/i.test(trimmed) ||
      /^\s*answer\s*(?:key|sheet)?\s*$/i.test(trimmed) ||
      /^\s*marking\s+scheme\s*$/i.test(trimmed)) {
    return { text: trimmed, type: 'solution_header', lineIndex };
  }

  // Section header
  const sectionMatch = trimmed.match(/^(?:section|part)\s*[-–:]?\s*([A-Za-z0-9]+)\s*$/i) ||
                        trimmed.match(/^(?:section|part)\s+([A-Za-z0-9]+)\b/i);
  if (sectionMatch) {
    return { text: trimmed, type: 'section_header', lineIndex, sectionName: sectionMatch[1].toUpperCase() };
  }

  // OR separator
  if (/^\s*OR\s*$/i.test(trimmed)) {
    return { text: trimmed, type: 'or_separator', lineIndex };
  }

  // Marks-only line like [1] or [2]
  if (/^\s*[\[(]\s*\d+\s*(?:marks?|m)?\s*[\])]\s*$/i.test(trimmed)) {
    return { text: trimmed, type: 'marks', lineIndex };
  }

  // Instruction line
  if (isInstructionContent(trimmed)) {
    return { text: trimmed, type: 'instruction', lineIndex };
  }

  // Question start: Q1. / 1. / 1) / (1)
  const qMatch = trimmed.match(/^(?:Q\.?\s*)?(\d{1,3})\s*[.):\s]\s+\S/i) ||
                  trimmed.match(/^\((\d{1,3})\)\s+\S/);
  if (qMatch) {
    const num = parseInt(qMatch[1]);
    if (num >= 1 && num <= 300) {
      return { text: trimmed, type: 'question_start', lineIndex, questionNum: num };
    }
  }

  // MCQ option: a) / (a) / A. / (A) etc.
  if (/^\(?[A-Da-d]\)?[.)]\s+\S/.test(trimmed) ||
      /^\(?[A-Da-d]\)?[.)]\s*\S/.test(trimmed)) {
    return { text: trimmed, type: 'option', lineIndex };
  }

  // Sub-part: a. / b. / c. / i. / ii. / iii.
  if (/^[a-c][.)]\s+\S/i.test(trimmed) ||
      /^(i{1,3}|iv|v|vi{0,3})[.)]\s+\S/i.test(trimmed)) {
    // Distinguish sub-parts from options:
    if (/^[a-d][.)]\s+.{3,}$/i.test(trimmed) && trimmed.length < 120) {
      return { text: trimmed, type: 'option', lineIndex };
    }
    return { text: trimmed, type: 'subpart', lineIndex };
  }

  // Noise: headers/footers that weren't caught by cleaner
  if (/^page\s+\d+/i.test(trimmed) ||
      /^[-–—=_.]{4,}$/.test(trimmed)) {
    return { text: trimmed, type: 'noise', lineIndex };
  }

  // Default: content/continuation
  return { text: trimmed, type: 'content', lineIndex };
}

function isInstructionContent(line: string): boolean {
  const patterns = [
    /this\s+question\s+paper\s+consists/i,
    /all\s+questions\s+are\s+compulsory/i,
    /internal\s+choice/i,
    /attempt\s+(?:only\s+)?one/i,
    /read\s+(?:the\s+)?(?:following\s+)?instructions/i,
    /marks\s+are\s+indicated/i,
    /use\s+(?:of\s+)?(?:log\s+table|calculator)/i,
    /expected\s+to\s+attempt/i,
    /^general\s+instructions/i,
  ];
  return patterns.some(p => p.test(line));
}

// ─────────────────────────────────────────────
// SECTION DETECTION
// ─────────────────────────────────────────────

/**
 * Find all section markers in the text.
 */
export function findSections(text: string): SectionMarker[] {
  const markers: SectionMarker[] = [];
  const lines = text.split('\n');
  let charPos = 0;

  for (let i = 0; i < lines.length; i++) {
    const trimmed = lines[i].trim();
    const match = trimmed.match(/^(?:section|part)\s*[-–:]?\s*([A-Za-z0-9]+(?:\s+[A-Za-z0-9]+)*)\s*$/i) ||
                  trimmed.match(/^(?:section|part)\s+([A-Za-z0-9]+(?:\s+[A-Za-z0-9]+)*)\b/i);
    if (match) {
      markers.push({
        name: `Section ${match[1].toUpperCase()}`,
        pos: charPos,
        lineIndex: i,
      });
    }
    charPos += lines[i].length + 1;
  }

  return markers;
}

/**
 * Get which section a position belongs to.
 */
export function getSectionForPosition(pos: number, sections: SectionMarker[]): string | undefined {
  let current: string | undefined;
  for (const s of sections) {
    if (s.pos <= pos) {
      current = s.name;
    } else {
      break;
    }
  }
  return current;
}

// ─────────────────────────────────────────────
// QUESTION BOUNDARY PATTERNS
// ─────────────────────────────────────────────

interface BoundaryPattern {
  name: string;
  regex: RegExp;
  weight: number;
  extractNum: (match: RegExpMatchArray) => number;
}

const BOUNDARY_PATTERNS: BoundaryPattern[] = [
  {
    name: 'Q-prefix',
    regex: /(?:^|\n)\s*Q\.?\s*(\d{1,3})\s*[.):\s]\s*/gm,
    weight: 10,
    extractNum: (m) => parseInt(m[1]),
  },
  {
    name: 'numbered-dot',
    regex: /(?:^|\n)\s*(\d{1,3})\.\s+(?=[A-Za-z("])/gm,
    weight: 8,
    extractNum: (m) => parseInt(m[1]),
  },
  {
    name: 'numbered-bracket',
    regex: /(?:^|\n)\s*(\d{1,3})\)\s+(?=[A-Za-z("])/gm,
    weight: 7,
    extractNum: (m) => parseInt(m[1]),
  },
  {
    name: 'paren-numbered',
    regex: /(?:^|\n)\s*\((\d{1,3})\)\s+(?=[A-Za-z"])/gm,
    weight: 6,
    extractNum: (m) => parseInt(m[1]),
  },
  {
    name: 'word-question',
    regex: /(?:^|\n)\s*Question\s+(?:No\.?\s*|Number\s*)?(\d{1,3})/gim,
    weight: 9,
    extractNum: (m) => parseInt(m[1]),
  },
];

/**
 * Find all candidate question boundaries.
 */
export function findBoundaryCandidates(text: string): BoundaryCandidate[] {
  const seen = new Map<number, BoundaryCandidate>();

  for (const pattern of BOUNDARY_PATTERNS) {
    const regex = new RegExp(pattern.regex.source, pattern.regex.flags);
    let match: RegExpMatchArray | null;

    while ((match = regex.exec(text)) !== null) {
      const num = pattern.extractNum(match);
      if (num < 1 || num > 300) continue;

      const rawPos = match.index!;
      const pos = rawPos + match[0].search(/\d/);

      const existing = seen.get(pos);
      if (!existing || existing.score < pattern.weight) {
        seen.set(pos, {
          pos: rawPos,
          num,
          matchText: match[0],
          score: pattern.weight,
          patternName: pattern.name,
        });
      }
    }
  }

  return Array.from(seen.values()).sort((a, b) => a.pos - b.pos);
}

/**
 * Filter boundary candidates to sequential question numbers.
 * Eliminates false positives like instruction numbers.
 */
export function filterSequentialBoundaries(
  candidates: BoundaryCandidate[],
  preambleEnd: number = 0
): BoundaryCandidate[] {
  if (candidates.length === 0) return [];

  // Filter out candidates in the preamble
  const postPreamble = candidates.filter(c => c.pos >= preambleEnd);

  if (postPreamble.length === 0) {
    return buildBestSequence(candidates);
  }

  return buildBestSequence(postPreamble);
}

function buildBestSequence(candidates: BoundaryCandidate[]): BoundaryCandidate[] {
  if (candidates.length === 0) return [];

  // Try starting from 1
  const seq1 = buildSequenceFrom(candidates, 1);

  // Try starting from the minimum number found
  const minNum = Math.min(...candidates.map(c => c.num));
  const seqMin = minNum !== 1 ? buildSequenceFrom(candidates, minNum) : [];

  return seq1.length >= seqMin.length ? seq1 : seqMin;
}

function buildSequenceFrom(candidates: BoundaryCandidate[], start: number): BoundaryCandidate[] {
  const result: BoundaryCandidate[] = [];
  let expected = start;
  let lastPos = -1;

  const sorted = [...candidates].sort((a, b) => a.pos - b.pos);

  for (const candidate of sorted) {
    if (candidate.pos <= lastPos) continue;

    if (candidate.num === expected) {
      result.push(candidate);
      lastPos = candidate.pos;
      expected++;
    } else if (candidate.num > expected && candidate.num <= expected + 5) {
      // Allow gaps
      result.push(candidate);
      lastPos = candidate.pos;
      expected = candidate.num + 1;
    }
  }

  return result;
}

// ─────────────────────────────────────────────
// OPTION DETECTION
// ─────────────────────────────────────────────

/**
 * Extract options from a question block.
 * Tries multiple strategies and returns the best match.
 */
interface OptionPattern {
  name: OptionFormat;
  labelRegex: RegExp;
  cleanRegex: RegExp;
  expectedSeq: string[];
}

const OPTION_PATTERNS: OptionPattern[] = [
  {
    name: 'alpha-paren',
    labelRegex: /\(([A-Da-d])\)\s*/g,
    cleanRegex: /^\([A-Da-d]\)\s*/,
    expectedSeq: ['a', 'b', 'c', 'd'],
  },
  {
    name: 'alpha-bracket',
    labelRegex: /(?<![(\w])([A-Da-d])\)\s*/g,
    cleanRegex: /^[A-Da-d]\)\s*/,
    expectedSeq: ['a', 'b', 'c', 'd'],
  },
  {
    name: 'alpha-dot',
    labelRegex: /(?<!\w)([A-Da-d])\.\s*/g,
    cleanRegex: /^[A-Da-d]\.\s*/,
    expectedSeq: ['a', 'b', 'c', 'd'],
  },
  {
    name: 'numeric-paren',
    labelRegex: /\(([1-4])\)\s*/g,
    cleanRegex: /^\([1-4]\)\s*/,
    expectedSeq: ['1', '2', '3', '4'],
  },
  {
    name: 'numeric-bracket',
    labelRegex: /(?<!\d)([1-4])\)\s*/g,
    cleanRegex: /^[1-4]\)\s*/,
    expectedSeq: ['1', '2', '3', '4'],
  },
  {
    name: 'numeric-dot',
    labelRegex: /(?<!\d)([1-4])\.\s*/g,
    cleanRegex: /^[1-4]\.\s*/,
    expectedSeq: ['1', '2', '3', '4'],
  },
  {
    name: 'roman',
    labelRegex: /\(([iI]{1,3}|[iI][vV]|[vV]|[vV][iI]{0,3})\)\s*/g,
    cleanRegex: /^\((?:i{1,3}|iv|v|vi{0,3})\)\s*/i,
    expectedSeq: ['i', 'ii', 'iii', 'iv'],
  },
];

export function extractOptions(text: string): OptionExtractionResult | null {
  // Strategy 1: Multiline options (each on own line) — most reliable
  const multilineResult = tryExtractMultilineOptions(text);
  if (multilineResult && multilineResult.options.length >= 2) {
    return multilineResult;
  }

  // Strategy 2: Try each inline pattern in sequence
  for (const pattern of OPTION_PATTERNS) {
    const inlineResult = tryExtractInlineWithPattern(text, pattern);
    if (inlineResult && inlineResult.options.length >= 2) {
      return inlineResult;
    }
  }

  return null;
}

function tryExtractMultilineOptions(text: string): OptionExtractionResult | null {
  const lines = text.split('\n');
  const formats = [
    { regex: /^\(?([A-Da-d])\)?[.)]\s+(.+)$/, format: 'alpha-paren' as OptionFormat, expected: ['a', 'b', 'c', 'd'] },
    { regex: /^\(?([A-Da-d])\)?[.)]\s*(.+)$/, format: 'alpha-paren' as OptionFormat, expected: ['a', 'b', 'c', 'd'] },
    { regex: /^\(?([1-4])\)?[.)]\s+(.+)$/, format: 'numeric-paren' as OptionFormat, expected: ['1', '2', '3', '4'] },
    { regex: /^\(?([1-4])\)?[.)]\s*(.+)$/, format: 'numeric-paren' as OptionFormat, expected: ['1', '2', '3', '4'] },
    { regex: /^\(?([iI]{1,3}|[iI][vV]|[vV])\)?[.)]\s+(.+)$/, format: 'roman' as OptionFormat, expected: ['i', 'ii', 'iii', 'iv'] },
  ];

  for (const fmt of formats) {
    const optionLines: Array<{ lineIndex: number; content: string; label: string; charPos: number }> = [];
    let charPos = 0;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      const match = line.match(fmt.regex);

      if (match) {
        optionLines.push({
          lineIndex: i,
          label: match[1].toLowerCase(),
          content: match[2].trim(),
          charPos,
        });
      }
      charPos += lines[i].length + 1;
    }

    if (optionLines.length >= 2) {
      const labels = optionLines.map(o => o.label);
      if (areLabelsSequential(labels, fmt.expected) || (labels.length === 4 && labels.join('') === fmt.expected.join(''))) {
        const optionStartLineIndex = optionLines[0].lineIndex;
        const textBeforeOptions = lines.slice(0, optionStartLineIndex).join('\n');
        const optionsStart = textBeforeOptions.length > 0 ? textBeforeOptions.length + 1 : 0;

        return {
          options: optionLines.map(o => o.content),
          format: fmt.format,
          optionsStart,
        };
      }
    }
  }

  return null;
}

function tryExtractInlineWithPattern(
  text: string,
  pattern: OptionPattern
): OptionExtractionResult | null {
  const labelMatches: Array<{ pos: number; label: string }> = [];
  const regex = new RegExp(pattern.labelRegex.source, pattern.labelRegex.flags);
  let m: RegExpExecArray | null;

  while ((m = regex.exec(text)) !== null) {
    labelMatches.push({ pos: m.index, label: m[1].toLowerCase() });
  }

  if (labelMatches.length < 2) return null;

  const filtered = filterSequentialLabels(labelMatches, pattern.expectedSeq);
  if (filtered.length < 2) return null;

  return extractContentBetweenLabels(text, filtered, pattern.name, pattern.cleanRegex);
}

function filterSequentialLabels(
  matches: Array<{ pos: number; label: string }>,
  expectedSeq: string[]
): Array<{ pos: number; label: string }> {
  const result: Array<{ pos: number; label: string }> = [];
  let seqIdx = 0;

  for (const m of matches) {
    if (m.label === expectedSeq[seqIdx]) {
      result.push(m);
      seqIdx++;
      if (seqIdx >= expectedSeq.length) break;
    }
  }

  return result;
}

function areLabelsSequential(labels: string[], expected: string[]): boolean {
  const lower = labels.map(l => l.toLowerCase());
  if (lower.length < 2 || lower.length > expected.length) return false;

  const startIdx = expected.indexOf(lower[0]);
  if (startIdx === -1) return false;

  for (let i = 0; i < lower.length; i++) {
    if (lower[i] !== expected[startIdx + i]) return false;
  }

  return true;
}

function extractContentBetweenLabels(
  text: string,
  labels: Array<{ pos: number; label: string }>,
  format: OptionFormat,
  cleanRegex: RegExp
): OptionExtractionResult | null {
  const options: string[] = [];
  const optionsStart = labels[0].pos;

  for (let i = 0; i < labels.length; i++) {
    const start = labels[i].pos;
    const end = i + 1 < labels.length ? labels[i + 1].pos : text.length;

    let content = text.slice(start, end);
    content = content.replace(cleanRegex, '');
    content = content.replace(/\n/g, ' ').trim();
    content = content.replace(/\s*[\[(]\s*\d+\s*[\])]\s*$/, '').trim();

    if (content.length > 0) {
      options.push(content);
    }
  }

  if (options.length < 2) return null;
  return { options, format, optionsStart };
}

// ─────────────────────────────────────────────
// QUESTION TYPE DETECTION
// ─────────────────────────────────────────────

const ASSERTION_REASON_SIGNALS: RegExp[] = [
  /\bassertion\s*[\(:\s]/i,
  /\breason\s*[\(:\s]/i,
  /\bstatement[\s-](?:I|II|1|2)\b/i,
  /both\s+assertion\s+and\s+reason/i,
  /assertion\s+is\s+(?:true|false|correct|incorrect)/i,
  /\bA\s*is\s+true\b.*\bR\s+is/i,
  /Assertion\s*\(A\)/i,
  /Reason\s*\(R\)/i,
];

const CASE_STUDY_SIGNALS: RegExp[] = [
  /read\s+the\s+following\s+(?:text|passage|case|extract)/i,
  /read\s+the\s+following\s+and\s+answer/i,
  /case\s+study/i,
  /passage[\s-]based/i,
  /comprehension/i,
  /on\s+the\s+basis\s+of\s+(?:the\s+)?above/i,
];

const SUBJECTIVE_SIGNALS: RegExp[] = [
  /\bexplain\b/i,
  /\bdescribe\b/i,
  /\bdiscuss\b/i,
  /\banalyze\b/i,
  /\banalyse\b/i,
  /\bevaluate\b/i,
  /\bderive\b/i,
  /\bprove\b/i,
  /\bdraw\b.*diagram/i,
  /\bwrite\s+(?:a\s+)?(?:short\s+)?(?:note|answer|essay)/i,
  /\bdifferentiate\s+between\b/i,
  /\bcompare\s+and\s+contrast\b/i,
  /\bstate\s+(?:the|one|two|three)\b/i,
  /\bname\s+the\b/i,
  /\blist\s+(?:the|any|two|three)\b/i,
  /\bwhat\s+(?:is|are|would|will|do|does|happens?|happened)\b/i,
  /\bhow\s+(?:does|do|did|is|are|can|will)\b/i,
  /\bwhy\s+(?:is|are|do|does|did)\b/i,
  /\bgive\s+(?:reason|example)/i,
];

export function detectQuestionType(
  questionText: string,
  hasOptions: boolean,
  optionCount: number,
  sectionLabel?: string
): QuestionType {
  // Case study check first (including Section header keyword heuristics)
  if (CASE_STUDY_SIGNALS.some(p => p.test(questionText))) return 'case_study';
  if (sectionLabel?.toUpperCase().includes('CASE')) return 'case_study';

  // Assertion-Reason check
  const arCount = ASSERTION_REASON_SIGNALS.filter(p => p.test(questionText)).length;
  if (arCount >= 2) return 'assertion_reason';

  // MCQ with options
  if (hasOptions && optionCount >= 2 && optionCount <= 5) return 'mcq';

  // Subjective signals
  if (SUBJECTIVE_SIGNALS.some(p => p.test(questionText))) return 'subjective';

  // Long text without options -> subjective
  if (questionText.split(' ').length > 30 && !hasOptions) return 'subjective';

  return hasOptions ? 'mcq' : 'subjective';
}

// ─────────────────────────────────────────────
// ASSERTION-REASON EXTRACTION
// ─────────────────────────────────────────────

export interface AssertionReasonParts {
  assertion: string;
  reason: string;
  arOptions: string[];
}

export function extractAssertionReason(text: string): AssertionReasonParts | null {
  // Format 1: Assertion (A): ... Reason (R): ...
  const format1 = text.match(
    /Assertion\s*(?:\(A\))?\s*[:(]\s*([\s\S]+?)\s*Reason\s*(?:\(R\))?\s*[:(]\s*([\s\S]+?)(?=(?:\([A-Da-d]\)|\n\s*[A-Da-d][.)]\s|$))/i
  );

  if (format1) {
    return {
      assertion: format1[1].replace(/\s+/g, ' ').trim(),
      reason: format1[2].replace(/\s+/g, ' ').trim(),
      arOptions: getStandardAROptions(),
    };
  }

  // Format 2: A: ... R: ...
  const format2 = text.match(/\bA\s*:\s*([\s\S]+?)\s*R\s*:\s*([\s\S]+?)(?=\([A-Da-d]\)|$)/);
  if (format2) {
    return {
      assertion: format2[1].replace(/\s+/g, ' ').trim(),
      reason: format2[2].replace(/\s+/g, ' ').trim(),
      arOptions: getStandardAROptions(),
    };
  }

  return null;
}

function getStandardAROptions(): string[] {
  return [
    'Both A and R are true and R is the correct explanation of A.',
    'Both A and R are true but R is not the correct explanation of A.',
    'A is true but R is false.',
    'A is false but R is true.',
  ];
}

// ─────────────────────────────────────────────
// INLINE QUESTION SPLIT DETECTION
// ─────────────────────────────────────────────

/**
 * Detect if a text block contains multiple merged questions.
 * Returns split positions if found.
 */
export function findInlineQuestionSplits(
  text: string,
  blockStartNumber: number
): number[] {
  const splitPositions: number[] = [];

  for (let nextNum = blockStartNumber + 1; nextNum <= blockStartNumber + 20; nextNum++) {
    const patterns = [
      new RegExp(`(?:\\n|\\s{2,})${nextNum}\\.\\s+(?=[A-Z("])`, 'g'),
      new RegExp(`(?:\\n|\\s{2,})${nextNum}\\)\\s+(?=[A-Za-z("])`, 'g'),
      new RegExp(`(?:\\n|\\s{2,})Q\\.?\\s*${nextNum}[.):]?\\s+`, 'gi'),
    ];

    for (const pattern of patterns) {
      const rx = new RegExp(pattern.source, pattern.flags);
      let m: RegExpExecArray | null;
      while ((m = rx.exec(text)) !== null) {
        if (!splitPositions.includes(m.index)) {
          splitPositions.push(m.index);
        }
      }
    }
  }

  return splitPositions.sort((a, b) => a - b);
}

/**
 * Check if a block has duplicate option sets (indicating merged questions).
 * Returns the split position of the second question, or -1 if not found.
 */
export function detectDuplicateOptionSets(text: string): number {
  const aMatches: number[] = [];
  const regex = /\([Aa]\)\s/g;
  let m: RegExpExecArray | null;

  while ((m = regex.exec(text)) !== null) {
    aMatches.push(m.index);
  }

  if (aMatches.length >= 2) {
    const secondA = aMatches[1];
    const before = text.slice(0, secondA);

    const lastNewline = before.lastIndexOf('\n');
    if (lastNewline > before.length * 0.3) {
      const lineAfter = before.slice(lastNewline + 1).trim();
      if (/^\d+[.)]\s/.test(lineAfter) || /^[A-Z]/.test(lineAfter)) {
        return lastNewline;
      }
    }
  }

  return -1;
}

// ─────────────────────────────────────────────
// SUB-PART DETECTION
// ─────────────────────────────────────────────

/**
 * Detect sub-parts within a question block (a., b., c., i., ii., etc.)
 */
export function extractSubParts(text: string): string[] {
  const parts: string[] = [];

  const lines = text.split('\n');
  for (const line of lines) {
    const trimmed = line.trim();
    const match = trimmed.match(/^([a-c]|i{1,3}|iv|v|vi{0,3})[.)]\s+(.+)$/i);
    if (match) {
      parts.push(match[0]);
    }
  }

  return parts;
}

/**
 * Detect if a block contains an OR alternative
 */
export function hasORAlternative(text: string): boolean {
  return /^\s*OR\s*$/im.test(text);
}
