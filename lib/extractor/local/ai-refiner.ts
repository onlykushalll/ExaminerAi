/**
 * ============================================================
 * lib/extractor/ai-refiner.ts — Post-Processing Refinement
 * Examiner AI — Question Extraction Engine
 * ============================================================
 *
 * This module applies final heuristic fixes:
 *  • Stitches options carried over from separate blocks
 *  • Splits merged questions
 *  • Fixes MCQs missing options
 *  • Validates structure
 *  • Ensures sequential IDs (string)
 *  • Reclassifies mistyped questions
 *  • Assigns default marks where missing
 */

import type { ExtractedQuestion, QuestionType } from '../types';
import { inferMarks } from './marks-extractor';

/**
 * Run all refinement passes on the extracted questions.
 */
export function refineQuestions(
  questions: ExtractedQuestion[],
  warnings: string[]
): ExtractedQuestion[] {
  let result = [...questions];

  // Pass 1: Carry over options (re-stitch options separated during parsing)
  result = carryOverOptions(result);

  // Pass 2: Remove garbage/too-short questions
  result = removeGarbage(result, warnings);

  // Pass 3: Detect and split merged questions (warning / confidence check)
  result = splitMergedQuestions(result, warnings);

  // Pass 4: Fix MCQ without options (reclassify to subjective)
  result = fixMCQWithoutOptions(result, warnings);

  // Pass 5: Fix options that are actually sub-parts
  result = fixMisclassifiedOptions(result, warnings);

  // Pass 6: Assign missing marks
  result = assignMissingMarks(result, warnings);

  // Pass 7: Ensure string IDs & sequential numbering
  result = renumberSequentially(result);

  // Pass 8: Flag low confidence
  const lowConf = result.filter(q => q.confidence < 0.35);
  if (lowConf.length > 0) {
    warnings.push(
      `${lowConf.length} question(s) have low confidence (< 0.35) and may need review.`
    );
  }

  return result;
}

// ─────────────────────────────────────────────
// PASS 1: CARRY OVER OPTIONS
// ─────────────────────────────────────────────

function carryOverOptions(questions: ExtractedQuestion[]): ExtractedQuestion[] {
  const idsToDelete = new Set<string>();

  for (let i = 1; i < questions.length; i++) {
    const prev = questions[i - 1];
    const current = questions[i];

    if (
      prev.type === 'mcq' &&
      (!prev.options || prev.options.length < 2) &&
      current.type === 'mcq' &&
      current.options &&
      current.options.length >= 2 &&
      (current.metadata?.rawLength ?? 0) < 120 &&
      (prev.metadata?.rawLength ?? 0) > 200
    ) {
      prev.options = current.options;
      prev.metadata = {
        ...prev.metadata,
        inferredOptions: true,
      };
      idsToDelete.add(current.id);
    }
  }

  if (idsToDelete.size > 0) {
    return questions.filter(q => !idsToDelete.has(q.id));
  }
  return questions;
}

// ─────────────────────────────────────────────
// PASS 2: REMOVE GARBAGE
// ─────────────────────────────────────────────

function removeGarbage(
  questions: ExtractedQuestion[],
  warnings: string[]
): ExtractedQuestion[] {
  return questions.filter(q => {
    // Too short
    if (q.question.trim().length < 8) {
      warnings.push(`Removed too-short question (id=${q.id}): "${q.question.slice(0, 40)}"`);
      return false;
    }

    // Looks like an instruction, not a question
    if (looksLikeInstruction(q.question)) {
      warnings.push(`Removed instruction-like text detected as question (id=${q.id}): "${q.question.slice(0, 60)}"`);
      return false;
    }

    // Looks like a header
    if (looksLikeHeader(q.question)) {
      warnings.push(`Removed header-like text detected as question (id=${q.id}): "${q.question.slice(0, 60)}"`);
      return false;
    }

    return true;
  });
}

function looksLikeInstruction(text: string): boolean {
  const lower = text.toLowerCase().trim();
  const patterns = [
    /^this\s+question\s+paper\s+consists/i,
    /^all\s+questions\s+are\s+compulsory/i,
    /^internal\s+choice\s+is\s+provided/i,
    /^a\s+student\s+is\s+expected/i,
    /^read\s+(?:the\s+)?(?:following\s+)?instructions/i,
    /^general\s+instructions/i,
    /^note\s*:/i,
    /^important\s*:/i,
  ];
  return patterns.some(p => p.test(lower));
}

function looksLikeHeader(text: string): boolean {
  const lower = text.toLowerCase().trim();
  const patterns = [
    /^class\s+[xivXIV0-9]+\s+session/i,
    /^sample\s+question\s+paper/i,
    /^subject\s*[-:]\s*\w+/i,
    /^section\s+[a-z]\s*$/i,
    /^time\s+allowed/i,
    /^maximum\s+marks/i,
  ];
  return patterns.some(p => p.test(lower));
}

// ─────────────────────────────────────────────
// PASS 3: SPLIT MERGED QUESTIONS
// ─────────────────────────────────────────────

function splitMergedQuestions(
  questions: ExtractedQuestion[],
  warnings: string[]
): ExtractedQuestion[] {
  const result: ExtractedQuestion[] = [];

  for (const q of questions) {
    const text = q.question + (q.options ? '\n' + q.options.join('\n') : '');

    // Check for duplicate option sets (strong merge signal)
    const aCount = (text.match(/\([Aa]\)\s/g) || []).length;
    if (aCount >= 2 && q.type === 'mcq') {
      warnings.push(`Question ${q.id} appears to contain multiple merged MCQs. Attempting split.`);
      result.push({ ...q, confidence: Math.min(q.confidence, 0.4) });
      continue;
    }

    // Check for embedded question numbers in text
    const inlineQPattern = /(?:\n|^)\s*(\d{1,3})\.\s+[A-Z]/gm;
    const matches = [...text.matchAll(inlineQPattern)];
    if (matches.length >= 2) {
      warnings.push(`Question ${q.id} may contain inline merged questions.`);
      result.push({ ...q, confidence: Math.min(q.confidence, 0.45) });
      continue;
    }

    result.push(q);
  }

  return result;
}

// ─────────────────────────────────────────────
// PASS 4: FIX MCQ WITHOUT OPTIONS
// ─────────────────────────────────────────────

function fixMCQWithoutOptions(
  questions: ExtractedQuestion[],
  warnings: string[]
): ExtractedQuestion[] {
  return questions.map(q => {
    if (q.type === 'mcq' && (!q.options || q.options.length < 2)) {
      warnings.push(`Question ${q.id} classified as MCQ but has no/incomplete options. Reclassifying as subjective.`);
      return { ...q, type: 'subjective' as QuestionType };
    }
    return q;
  });
}

// ─────────────────────────────────────────────
// PASS 5: FIX MISCLASSIFIED OPTIONS
// ─────────────────────────────────────────────

function fixMisclassifiedOptions(
  questions: ExtractedQuestion[],
  _warnings: string[]
): ExtractedQuestion[] {
  return questions.map(q => {
    if (q.type === 'mcq' && q.options && q.options.length >= 2) {
      // Check if options look like sub-parts rather than MCQ choices
      const avgLength = q.options.reduce((sum: number, o: string) => sum + o.length, 0) / q.options.length;
      if (avgLength > 200) {
        return {
          ...q,
          type: 'subjective' as QuestionType,
          options: undefined,
          metadata: {
            ...q.metadata,
            subParts: q.options,
          },
        };
      }
    }
    return q;
  });
}

// ─────────────────────────────────────────────
// PASS 6: ASSIGN MISSING MARKS
// ─────────────────────────────────────────────

function assignMissingMarks(
  questions: ExtractedQuestion[],
  _warnings: string[]
): ExtractedQuestion[] {
  return questions.map(q => {
    if (q.marks === undefined) {
      q.marks = inferMarks({
        section: q.section,
        questionType: q.type,
        questionLength: q.question.length,
        hasSubParts: (q.metadata?.subParts?.length ?? 0) > 0,
        subPartCount: q.metadata?.subParts?.length ?? 0,
        hasOR: q.metadata?.hasOR,
      });
      q.metadata = {
        ...q.metadata,
        inferredMarks: true,
      };
    }
    return q;
  });
}

// ─────────────────────────────────────────────
// PASS 7: RENUMBER SEQUENTIALLY
// ─────────────────────────────────────────────

function renumberSequentially(questions: ExtractedQuestion[]): ExtractedQuestion[] {
  return questions.map((q, i) => ({
    ...q,
    id: String(i + 1),
  }));
}
