import "server-only";

import { ExtractedAnswer, ExtractedQuestion } from "@/lib/api-types";
import { getOpenAIModel } from "@/lib/env";
import { getOpenAIClient } from "@/lib/openai/client";
import { buildAnswerGenerationPrompt } from "@/lib/openai/prompt-builders";

type GenerateAnswersParams = {
  title: string;
  subject: string;
  className: string;
  totalMarks: string;
  duration: string;
  normalizedText: string;
  questions: ExtractedQuestion[];
};

export async function generateAnswersWithOpenAI({
  title,
  subject,
  className,
  totalMarks,
  duration,
  normalizedText,
  questions
}: GenerateAnswersParams): Promise<ExtractedAnswer[]> {
  const client = getOpenAIClient();
  const prompt = buildAnswerGenerationPrompt({
    title,
    subject,
    className,
    totalMarks,
    duration,
    normalizedText,
    questions
  });

  const response = await client.responses.create({
    model: getOpenAIModel("answer-generation"),
    input: prompt
  });

  const outputText = response.output_text?.trim();

  if (!outputText) {
    throw new Error("OpenAI answer generation returned an empty response.");
  }

  let parsed: { answers?: Array<{ question?: string; answer?: string; confidence?: string }> };

  try {
    parsed = JSON.parse(outputText) as { answers?: Array<{ question?: string; answer?: string; confidence?: string }> };
  } catch {
    throw new Error("OpenAI answer generation returned invalid JSON.");
  }

  return sanitizeGeneratedAnswers(parsed.answers ?? [], questions);
}

function sanitizeGeneratedAnswers(
  answers: Array<{ question?: string; answer?: string; confidence?: string }>,
  questions: ExtractedQuestion[]
) {
  const questionNumbers = new Map(questions.map((question) => [normalizeQuestionNumber(question.number), question.number]));

  return answers
    .filter((item) => item.question && item.answer && questionNumbers.has(normalizeQuestionNumber(item.question)))
    .map((item) => ({
      question: questionNumbers.get(normalizeQuestionNumber(item.question!))!,
      answer: item.answer!.trim(),
      confidence: normalizeConfidence(item.confidence)
    }));
}

function normalizeConfidence(value?: string) {
  const normalized = value?.trim().toLowerCase();
  return normalized === "correct" ? "correct" : "not verified";
}

function normalizeQuestionNumber(value: string) {
  const trimmed = value.trim().toLowerCase().replace(/^q(?:uestion)?\s*/i, "");
  const match = trimmed.match(/^(\d+)(?:\(([a-z])\))?$/);

  if (!match) {
    return trimmed;
  }

  return match[2] ? `${match[1]}(${match[2]})` : match[1];
}
