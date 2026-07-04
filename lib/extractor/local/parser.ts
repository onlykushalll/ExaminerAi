/**
 * ============================================================
 * lib/extractor/parser.ts — Core Question Parsing Engine v2
 * Examiner AI — Question Extraction Engine
 * ============================================================
 *
 * Multi-pass pipeline:
 *  Pass 1: Clean text, remove solutions, detect preamble
 *  Pass 2: Detect sections
 *  Pass 3: Find question boundaries (post-preamble)
 *  Pass 4: Split text into blocks
 *  Pass 5: Expand merged blocks
 *  Pass 6: Process each block into structured question
 *  Pass 7: AI refinement (post-processing)
 */

import type {
  ExtractedQuestion,
  ExtractionResult,
  QuestionBlock,
  BoundaryCandidate,
  SectionMarker,
} from '../types';

import { cleanExtractedText, cleanQuestionText } from './cleaner';

import {
  findBoundaryCandidates,
  filterSequentialBoundaries,
  findSections,
  getSectionForPosition,
  extractOptions,
  detectQuestionType,
  extractAssertionReason,
  findInlineQuestionSplits,
  detectDuplicateOptionSets,
  extractSubParts,
  hasORAlternative,
} from './detector';

import { extractMarksFromText, stripMarksFromText } from './marks-extractor';
import { computeConfidence } from './confidence';
import { refineQuestions } from './ai-refiner';

// ─────────────────────────────────────────────
// MAIN ENTRY POINT
// ─────────────────────────────────────────────

export function parseQuestions(rawText: string): ExtractionResult {
  const warnings: string[] = [];

  // ── Pass 1: Clean & normalize text ────────────────────────────
  const cleanResult = cleanExtractedText(rawText);
  warnings.push(...cleanResult.warnings);

  const cleanedText = cleanResult.text;
  const preambleEnd = cleanResult.stats.preambleEnd;

  if (cleanedText.length < 10) {
    warnings.push('Text too short to parse after cleaning.');
    return { questions: [], total: 0, warnings };
  }

  // ── Pass 2: Detect sections ────────────────────────────────────
  const sections = findSections(cleanedText);

  if (sections.length > 0) {
    warnings.push(`Detected ${sections.length} section(s): ${sections.map(s => s.name).join(', ')}`);
  }

  // ── Pass 3: Find question boundaries ──────────────────────────
  const allCandidates = findBoundaryCandidates(cleanedText);

  if (allCandidates.length === 0) {
    warnings.push('No question boundaries detected. Trying fallback splitting.');
    return fallbackParse(cleanedText, warnings);
  }

  // Filter to sequential, post-preamble boundaries
  let boundaries = filterSequentialBoundaries(allCandidates, preambleEnd);

  if (boundaries.length === 0) {
    warnings.push('Sequential filtering removed all candidates. Using post-preamble candidates.');
    boundaries = allCandidates.filter(c => c.pos >= preambleEnd);
    if (boundaries.length === 0) {
      boundaries = allCandidates.slice(0, 100);
    }
  }

  // ── Pass 4: Split text at boundaries ──────────────────────────
  const rawBlocks = splitTextAtBoundaries(cleanedText, boundaries, sections);

  // ── Pass 5: Expand merged blocks ──────────────────────────────
  const blocks = expandMergedBlocks(rawBlocks, warnings);

  // ── Pass 6: Process each block ────────────────────────────────
  const questions = blocks
    .map((block, index) => processBlock(block, index + 1))
    .filter((q): q is ExtractedQuestion => q !== null);

  // ── Pass 7: AI refinement ─────────────────────────────────────
  const refined = refineQuestions(questions, warnings);

  return {
    questions: refined,
    total: refined.length,
    warnings: deduplicateWarnings(warnings),
  };
}

// ─────────────────────────────────────────────
// PASS 4: SPLIT AT BOUNDARIES
// ─────────────────────────────────────────────

function splitTextAtBoundaries(
  text: string,
  boundaries: BoundaryCandidate[],
  sections: SectionMarker[]
): QuestionBlock[] {
  const blocks: QuestionBlock[] = [];

  for (let i = 0; i < boundaries.length; i++) {
    const start = boundaries[i].pos;
    const end = i + 1 < boundaries.length ? boundaries[i + 1].pos : text.length;

    const raw = text.slice(start, end).trim();
    if (raw.length < 5) continue;

    // Determine which section this belongs to
    const section = getSectionForPosition(start, sections);

    blocks.push({
      raw,
      questionNumber: boundaries[i].num,
      startPos: start,
      splitMethod: 'boundary',
      section,
    });
  }

  return blocks;
}

// ─────────────────────────────────────────────
// PASS 5: EXPAND MERGED BLOCKS
// ─────────────────────────────────────────────

function expandMergedBlocks(
  blocks: QuestionBlock[],
  warnings: string[]
): QuestionBlock[] {
  const result: QuestionBlock[] = [];

  for (const block of blocks) {
    const expanded = tryExpandBlock(block);

    if (expanded.length > 1) {
      warnings.push(
        `Block Q${block.questionNumber ?? '?'} was split into ${expanded.length} sub-questions (inline merge detected).`
      );
      result.push(...expanded);
    } else {
      result.push(block);
    }
  }

  return result;
}

function tryExpandBlock(block: QuestionBlock): QuestionBlock[] {
  const { raw, questionNumber } = block;

  // Short blocks can't contain multiples
  if (raw.length < 120) return [block];

  // Strategy A: Inline sequential numbers
  if (questionNumber !== undefined) {
    const splitPositions = findInlineQuestionSplits(raw, questionNumber);
    if (splitPositions.length > 0) {
      return splitBlockAtPositions(block, splitPositions, questionNumber);
    }
  }

  // Strategy B: Duplicate option sets
  const dupSplit = detectDuplicateOptionSets(raw);
  if (dupSplit > 0) {
    return splitBlockAtPositions(block, [dupSplit], questionNumber ?? 0);
  }

  return [block];
}

function splitBlockAtPositions(
  block: QuestionBlock,
  positions: number[],
  startNumber: number
): QuestionBlock[] {
  const result: QuestionBlock[] = [];
  const { raw, section } = block;
  let lastPos = 0;
  let currentNum = startNumber;

  for (const pos of positions) {
    if (pos <= lastPos || pos >= raw.length) continue;

    const slice = raw.slice(lastPos, pos).trim();
    if (slice.length > 5) {
      result.push({
        raw: slice,
        questionNumber: currentNum,
        startPos: block.startPos + lastPos,
        splitMethod: 'inline',
        section,
      });
      currentNum++;
    }
    lastPos = pos;
  }

  const last = raw.slice(lastPos).trim();
  if (last.length > 5) {
    result.push({
      raw: last,
      questionNumber: currentNum,
      startPos: block.startPos + lastPos,
      splitMethod: 'inline',
      section,
    });
  }

  return result.length > 1 ? result : [block];
}

// ─────────────────────────────────────────────
// PASS 6: PROCESS EACH BLOCK
// ─────────────────────────────────────────────

function processBlock(block: QuestionBlock, fallbackId: number): ExtractedQuestion | null {
  const { raw, questionNumber, splitMethod, section } = block;
  const text = raw.trim();

  if (text.length < 8) return null;

  // Skip section/part headers
  if (/^(?:section|part)\s+[A-Za-z0-9\s]+$/i.test(text)) return null;

  // ── Extract marks ──────────────────────────────────────────────
  const marks = extractMarksFromText(text);

  // ── Extract options ────────────────────────────────────────────
  const optResult = extractOptions(text);
  const hasOpts = optResult !== null && optResult.options.length >= 2;

  // ── Detect OR alternative ──────────────────────────────────────
  const hasOR = hasORAlternative(text);

  // ── Detect sub-parts ──────────────────────────────────────────
  const subParts = extractSubParts(text);

  // ── Detect type ────────────────────────────────────────────────
  const type = detectQuestionType(
    text,
    hasOpts,
    optResult?.options.length ?? 0,
    section
  );

  // ── Clean question text ────────────────────────────────────────
  let questionText = cleanQuestionText(
    text,
    hasOpts && optResult ? optResult.optionsStart : undefined
  );

  // Remove marks notation from question text
  questionText = stripMarksFromText(questionText);

  if (questionText.length < 5) return null;

  // ── Handle Assertion-Reason ────────────────────────────────────
  let finalOptions = optResult?.options;
  if (type === 'assertion_reason') {
    const arParts = extractAssertionReason(text);
    if (arParts) {
      questionText = `Assertion (A): ${arParts.assertion}\n\nReason (R): ${arParts.reason}`;
      finalOptions = optResult?.options ?? arParts.arOptions;
    }
  }

  // ── Compute confidence ─────────────────────────────────────────
  const marksExplicit = marks !== undefined;
  const confidence = computeConfidence({
    hasOptions: hasOpts,
    optionCount: optResult?.options.length ?? 0,
    questionLength: questionText.length,
    hasMarks: marksExplicit,
    marksExplicit,
    hasNumber: questionNumber !== undefined,
    type,
    hasSubParts: subParts.length > 0,
    splitMethod,
    sectionDetected: section !== undefined,
  });

  return {
    id: String(questionNumber ?? fallbackId),
    question: questionText,
    type,
    options: hasOpts ? finalOptions : undefined,
    marks,
    confidence,
    section,
    metadata: {
      number: questionNumber,
      splitMethod,
      optionFormat: optResult?.format,
      rawLength: text.length,
      hasAssertion: type === 'assertion_reason',
      hasReason: type === 'assertion_reason',
      subParts: subParts.length > 0 ? subParts : undefined,
      hasOR,
    },
  };
}

// ─────────────────────────────────────────────
// FALLBACK PARSER
// ─────────────────────────────────────────────

function fallbackParse(text: string, warnings: string[]): ExtractionResult {
  warnings.push('Using fallback parser — accuracy may be reduced.');
  const questions: ExtractedQuestion[] = [];

  const paragraphs = text.split(/\n{2,}/).filter(p => p.trim().length > 15);

  let id = 1;
  for (const para of paragraphs) {
    const trimmed = para.trim();

    if (/^(?:instruction|note|read|general|important|section|part|solution)/i.test(trimmed)) continue;

    const optResult = extractOptions(trimmed);
    const hasOpts = optResult !== null && optResult.options.length >= 2;
    const marks = extractMarksFromText(trimmed);
    const type = detectQuestionType(trimmed, hasOpts, optResult?.options.length ?? 0);
    let questionText = cleanQuestionText(trimmed, optResult?.optionsStart);
    questionText = stripMarksFromText(questionText);

    if (questionText.length >= 8) {
      questions.push({
        id: String(id++),
        question: questionText,
        type,
        options: hasOpts ? optResult!.options : undefined,
        marks,
        confidence: 0.3,
        metadata: {
          splitMethod: 'fallback',
          rawLength: trimmed.length,
        },
      });
    }
  }

  return {
    questions,
    total: questions.length,
    warnings,
  };
}

// ─────────────────────────────────────────────
// UTILITY
// ─────────────────────────────────────────────

function deduplicateWarnings(warnings: string[]): string[] {
  const seen = new Set<string>();
  return warnings.filter(w => {
    if (seen.has(w)) return false;
    seen.add(w);
    return true;
  });
}
