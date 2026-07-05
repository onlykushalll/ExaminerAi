import "server-only";

import { ExtractedQuestion } from "@/lib/api-types";
import { ExtractedPaperReview, MockResult } from "@/lib/types";

type PaperExtractionPromptInput = {
  rawPaperText: string;
  rawAnswerKeyText?: string;
  supportingText?: string;
};

type AnswerEvaluationPromptInput = {
  questionText?: string;
  expectedAnswer: string;
  studentAnswer: string;
  totalMarks: number;
  rubric: Array<{
    point: string;
    marks: number;
  }>;
};

type AnswerGenerationPromptInput = {
  title: string;
  subject: string;
  className: string;
  totalMarks: string;
  duration: string;
  normalizedText: string;
  questions: ExtractedQuestion[];
};

export function buildPaperExtractionPrompt({
  rawPaperText,
  rawAnswerKeyText,
  supportingText
}: PaperExtractionPromptInput) {
  return [
    "You are an exam parser.",
    "",
    "Given raw text from a question paper, extract ALL questions.",
    "",
    "Rules:",
    "- Do NOT skip any question",
    "- Detect numbering patterns like:",
    "  1, 2, 3",
    "  1., 2., 3.",
    "  Q1, Q2",
    "  (a), (b)",
    "- Preserve full question text",
    "- If unsure, still include the question",
    "- Do NOT summarize",
    "",
    "Return JSON with:",
    "- question number",
    "- full text",
    "- marks if present",
    "- type (mcq, short, long)",
    "",
    "Ensure total questions match the paper.",
    "",
    "Return JSON only in this format:",
    JSON.stringify(
      {
        questions: [
          {
            number: "string",
            fullText: "string",
            marks: null,
            type: "mcq"
          }
        ],
        totalQuestions: 0
      },
      null,
      2
    ),
    "",
    "Raw question paper text:",
    rawPaperText,
    "",
    "Raw answer key text:",
    rawAnswerKeyText || "Not provided.",
    "",
    "Supporting text:",
    supportingText || "Not provided."
  ].join("\n");
}

export function buildAnswerEvaluationPrompt({
  questionText,
  expectedAnswer,
  studentAnswer,
  totalMarks,
  rubric
}: AnswerEvaluationPromptInput) {
  return [
    "You are an experienced exam evaluator for board-level exams.",
    "",
    "Evaluate the student's answer using standard board exam rubrics.",
    "",
    "Inputs:",
    `Question: ${questionText || "Not provided."}`,
    `Student Answer: ${studentAnswer}`,
    `Reference Answer: ${expectedAnswer}`,
    "",
    "Marking rubric:",
    ...rubric.map((item, index) => `${index + 1}. ${item.point} (${item.marks} marks)`),
    "",
    "Instructions:",
    `- Award marks out of ${totalMarks} following board exam standards`,
    "- Do not hallucinate",
    "- Extract key concepts from the reference answer",
    "- Compare the student answer point-by-point against the rubric",
    "- Award partial marks where a point is only partly covered",
    "- Use standard board-level evaluation criteria",
    "- Explain mistakes clearly",
    "- Suggest practical improvements",
    "- Keep the reasoning realistic and examiner-like",
    "",
    "Return JSON only:",
    JSON.stringify(
      {
        marks_awarded: 0,
        max_marks: totalMarks,
        score_percentage: 0,
        strengths: ["string"],
        missing_points: ["string"],
        mistakes: ["string"],
        feedback: "string",
        improvement: "string",
        confidence: "medium"
      },
      null,
      2
    )
  ].join("\n");
}

export function buildAnswerGenerationPrompt({
  title,
  subject,
  className,
  totalMarks,
  duration,
  normalizedText,
  questions
}: AnswerGenerationPromptInput) {
  return [
    "You are generating exam answer key entries only when no answer key was found in uploaded files.",
    "",
    "Rules:",
    "- Return one answer object for each question provided.",
    "- Write structured, clear, exam-style answers.",
    "- Do not use a hallucination tone.",
    "- Do not claim certainty when the answer is uncertain.",
    "- Set confidence to 'correct' only when the answer is straightforward and strongly supported by standard academic knowledge.",
    "- Otherwise set confidence to 'not verified'.",
    "- Return JSON only.",
    "",
    "Return this exact shape:",
    JSON.stringify(
      {
        answers: [
          {
            question: "1",
            answer: "string",
            confidence: "correct"
          }
        ]
      },
      null,
      2
    ),
    "",
    "Paper metadata:",
    `Title: ${title || "Not available"}`,
    `Subject: ${subject || "Not available"}`,
    `Class: ${className || "Not available"}`,
    `Total marks: ${totalMarks || "Not available"}`,
    `Duration: ${duration || "Not available"}`,
    "",
    "Questions:",
    JSON.stringify(questions, null, 2),
    "",
    "Normalized paper text:",
    normalizedText
  ].join("\n");
}

export function sanitizeExtractedPaper(input: ExtractedPaperReview): ExtractedPaperReview {
  return input;
}

export function sanitizeEvaluationResult(input: MockResult): MockResult {
  return input;
}
