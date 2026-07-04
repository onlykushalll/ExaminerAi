import { AnswerEvaluationItem, QuestionType, SubmittedAnswerInput } from "@/lib/api-types";
import { mockResult } from "@/lib/mock-data";

const STOP_WORDS = new Set([
  "a",
  "an",
  "and",
  "are",
  "as",
  "at",
  "be",
  "by",
  "for",
  "from",
  "has",
  "have",
  "in",
  "is",
  "it",
  "of",
  "on",
  "or",
  "that",
  "the",
  "their",
  "to",
  "was",
  "were",
  "with"
]);

type ResolvedEvaluationInput = {
  questionId: string;
  questionNumber?: string;
  questionType: QuestionType;
  questionText?: string;
  studentAnswer: string;
  expectedAnswer: string;
  totalMarks: number;
};

export function resolveEvaluationInput(input: SubmittedAnswerInput): ResolvedEvaluationInput {
  const mockQuestion = mockResult.questionResults.find((item) => item.id === input.questionId);
  const expectedAnswer = input.expectedAnswer?.trim() || mockQuestion?.expectedAnswer || "";
  const totalMarks = normalizeTotalMarks(input.totalMarks ?? mockQuestion?.totalMarks ?? null);
  const questionType = input.questionType ?? inferQuestionType(expectedAnswer);

  if (!expectedAnswer) {
    throw new Error(`expectedAnswer is required for question ${input.questionId}.`);
  }

  return {
    questionId: input.questionId,
    questionNumber: input.questionNumber ?? mockQuestion?.number,
    questionType,
    questionText: input.questionText,
    studentAnswer: input.answer.trim(),
    expectedAnswer,
    totalMarks
  };
}

export function buildUnavailableEvaluation(input: SubmittedAnswerInput): AnswerEvaluationItem {
  const mockQuestion = mockResult.questionResults.find((item) => item.id === input.questionId);
  const maxMarks = normalizeTotalMarks(input.totalMarks ?? mockQuestion?.totalMarks ?? null);

  return {
    questionId: input.questionId,
    questionNumber: input.questionNumber ?? mockQuestion?.number,
    questionText: input.questionText,
    totalMarks: 0,
    maxMarks,
    marksAwarded: 0,
    scorePercentage: 0,
    strengths: [],
    feedback: "No correct answer was available, so this response could not be evaluated.",
    improvements: ["Upload or detect an answer key for this question to enable scoring."],
    mistakes: ["No reference answer was available for scoring."],
    confidence: "low",
    reason: "Evaluation was skipped because no expected answer was available for comparison.",
    matchedPoints: [],
    missingPoints: []
  };
}

export function evaluateAnswerLocally(input: ResolvedEvaluationInput): AnswerEvaluationItem {
  if (input.questionType === "mcq") {
    return evaluateMcqAnswer(input);
  }

  return evaluateSubjectiveAnswer(input);
}

function evaluateMcqAnswer(input: ResolvedEvaluationInput): AnswerEvaluationItem {
  const normalizedStudent = normalizeMcqAnswer(input.studentAnswer);
  const normalizedExpected = normalizeMcqAnswer(input.expectedAnswer);
  const isMatch = normalizedStudent.length > 0 && normalizedStudent === normalizedExpected;

  return {
    questionId: input.questionId,
    questionNumber: input.questionNumber,
    questionText: input.questionText,
    totalMarks: input.totalMarks,
    maxMarks: input.totalMarks,
    marksAwarded: isMatch ? input.totalMarks : 0,
    scorePercentage: isMatch ? 100 : 0,
    strengths: isMatch ? ["Selected the correct option."] : [],
    feedback: isMatch ? "Your selected option matches the answer key." : "Your selected option does not match the answer key.",
    improvements: isMatch ? [] : [`Review the correct option: ${input.expectedAnswer.trim()}`],
    mistakes: isMatch ? [] : ["The selected option does not match the expected answer."],
    confidence: "high",
    reason: isMatch
      ? "The selected answer exactly matched the answer key."
      : "The selected answer did not match the answer key.",
    matchedPoints: isMatch ? [input.expectedAnswer.trim()] : [],
    missingPoints: isMatch ? [] : [input.expectedAnswer.trim()]
  };
}

function evaluateSubjectiveAnswer(input: ResolvedEvaluationInput): AnswerEvaluationItem {
  const expectedPoints = extractReferencePoints(input.expectedAnswer);
  const studentTokens = new Set(tokenize(input.studentAnswer));

  if (input.studentAnswer.length === 0) {
    return {
      questionId: input.questionId,
      questionNumber: input.questionNumber,
      questionText: input.questionText,
      totalMarks: input.totalMarks,
      maxMarks: input.totalMarks,
      marksAwarded: 0,
      scorePercentage: 0,
      strengths: [],
      feedback: "No answer was provided.",
      improvements: ["Attempt the question and include the key points from the answer key."],
      mistakes: ["No answer was provided."],
      confidence: "low",
      reason: "No answer was provided, so no marks could be awarded.",
      matchedPoints: [],
      missingPoints: expectedPoints
    };
  }

  const matchedPoints = expectedPoints.filter((point) => isPointMatched(point, studentTokens));
  const missingPoints = expectedPoints.filter((point) => !matchedPoints.includes(point));

  const ratio = expectedPoints.length === 0 ? 0 : matchedPoints.length / expectedPoints.length;
  const exactMatch = normalizeText(input.studentAnswer) === normalizeText(input.expectedAnswer);
  const marksAwarded = exactMatch
    ? input.totalMarks
    : Math.min(input.totalMarks, Math.round(input.totalMarks * ratio));

  return {
    questionId: input.questionId,
    questionNumber: input.questionNumber,
    questionText: input.questionText,
    totalMarks: input.totalMarks,
    maxMarks: input.totalMarks,
    marksAwarded,
    scorePercentage: Math.round((marksAwarded / input.totalMarks) * 100),
    strengths: matchedPoints.slice(0, 3),
    feedback: buildFeedback(marksAwarded, input.totalMarks, matchedPoints.length, expectedPoints.length),
    improvements: buildImprovements(missingPoints),
    mistakes: buildMistakes(missingPoints),
    confidence: deriveConfidence(matchedPoints.length, expectedPoints.length),
    reason: buildReason(marksAwarded, input.totalMarks, matchedPoints.length, expectedPoints.length),
    matchedPoints,
    missingPoints
  };
}

export function extractReferencePoints(answer: string) {
  const parts = answer
    .replace(/\r\n?/g, "\n")
    .split(/\n|[.;]|,(?=\s+[A-Z])|\band\b/gi)
    .map((part) => part.replace(/\s+/g, " ").trim())
    .filter((part) => part.length > 0);

  return parts.length > 0 ? parts : [answer.trim()];
}

function isPointMatched(point: string, studentTokens: Set<string>) {
  const keywords = tokenize(point);

  if (keywords.length === 0) {
    return false;
  }

  const matchedCount = keywords.filter((token) => studentTokens.has(token)).length;
  return matchedCount / keywords.length >= 0.5 || matchedCount >= 2;
}

function tokenize(text: string) {
  return normalizeText(text)
    .split(" ")
    .map((token) => token.trim())
    .filter((token) => token.length > 1 && !STOP_WORDS.has(token));
}

function normalizeText(text: string) {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeMcqAnswer(text: string) {
  const normalized = text.trim().toUpperCase();
  const directOption = normalized.match(/\b([A-D])\b/);
  if (directOption?.[1]) {
    return directOption[1];
  }

  return normalized.replace(/[^A-Z0-9]/g, "");
}

function inferQuestionType(expectedAnswer: string): QuestionType {
  if (/^\s*[\[(]?[A-D][\])]?[\s.:;-]*$/i.test(expectedAnswer.trim())) {
    return "mcq";
  }

  return "subjective";
}

function buildReason(marksAwarded: number, totalMarks: number, matchedCount: number, totalPoints: number) {
  if (marksAwarded === totalMarks) {
    return "The student answer matched all expected points, so full marks were awarded.";
  }

  if (marksAwarded === 0) {
    return "The student answer did not cover the expected answer closely enough to earn marks.";
  }

  return `The student answer matched ${matchedCount} of ${totalPoints} expected point(s), so partial marks were awarded.`;
}

function buildFeedback(marksAwarded: number, totalMarks: number, matchedCount: number, totalPoints: number) {
  if (marksAwarded === totalMarks) {
    return "Your answer covers the expected answer well and earns full marks.";
  }

  if (marksAwarded === 0) {
    return "Your answer does not align closely enough with the expected answer to earn marks.";
  }

  return `Your answer covers ${matchedCount} of ${totalPoints} expected point(s), so partial credit was awarded.`;
}

function buildImprovements(missingPoints: string[]) {
  if (missingPoints.length === 0) {
    return [];
  }

  return missingPoints.slice(0, 3).map((point) => `Add or clarify: ${point}`);
}

function buildMistakes(missingPoints: string[]) {
  if (missingPoints.length === 0) {
    return [];
  }

  return missingPoints.slice(0, 3).map((point) => `Missing or unclear point: ${point}`);
}

function deriveConfidence(matchedCount: number, totalPoints: number): "low" | "medium" | "high" {
  if (totalPoints === 0) {
    return "low";
  }

  const ratio = matchedCount / totalPoints;

  if (ratio >= 0.75) {
    return "high";
  }

  if (ratio >= 0.4) {
    return "medium";
  }

  return "low";
}

function normalizeTotalMarks(value: number | null | undefined) {
  if (typeof value === "number" && Number.isFinite(value) && value > 0) {
    return Math.max(1, Math.round(value));
  }

  return 1;
}
