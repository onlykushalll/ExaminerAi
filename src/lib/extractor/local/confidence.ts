/**
 * ============================================================
 * lib/extractor/confidence.ts — Confidence Estimation Utility
 * Examiner AI — Question Extraction Engine
 * ============================================================
 */

import type { QuestionType } from '../types';

interface ConfidenceParams {
  hasOptions: boolean;
  optionCount: number;
  questionLength: number;
  hasMarks?: boolean;
  marksExplicit?: boolean;
  hasNumber: boolean;
  type: QuestionType;
  hasSubParts?: boolean;
  splitMethod?: string;
  sectionDetected?: boolean;
}

/**
 * Compute a confidence score for a question extraction.
 * Scores range from 0.0 (unconfident) to 1.0 (extremely confident).
 */
export function computeConfidence(params: ConfidenceParams): number {
  let score = 0.5; // base score

  const explicitMarks = params.hasMarks || params.marksExplicit;

  if (params.hasNumber) score += 0.15;
  if (explicitMarks) score += 0.10;
  if (params.sectionDetected) score += 0.05;

  if (params.questionLength > 10 && params.questionLength < 500) {
    score += 0.10;
  } else if (params.questionLength < 5) {
    score -= 0.30;
  } else if (params.questionLength > 1000) {
    score -= 0.20;
  }

  if (params.type === 'mcq') {
    if (params.hasOptions) {
      if (params.optionCount === 4) {
        score += 0.15;
      } else if (params.optionCount === 3) {
        score += 0.10;
      } else if (params.optionCount >= 2 && params.optionCount <= 5) {
        score += 0.05;
      }
    } else {
      score -= 0.25; // MCQ without options is highly suspicious
    }
  }

  if (params.type === 'assertion_reason') {
    score += 0.10;
  }

  if (params.type === 'case_study') {
    score += 0.05;
  }

  if (params.splitMethod === 'inline') {
    score -= 0.05;
  } else if (params.splitMethod === 'fallback') {
    score -= 0.10;
  }

  return Math.min(1.0, Math.max(0.0, Math.round(score * 100) / 100));
}
