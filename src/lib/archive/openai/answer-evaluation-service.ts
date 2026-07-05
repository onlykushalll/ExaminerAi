import "server-only";

import { AnswerEvaluationItem, EvaluationMode, EvaluationResponse, SubmittedAnswerInput } from "@/lib/api-types";
import {
  buildUnavailableEvaluation,
  evaluateAnswerLocally,
  extractReferencePoints,
  resolveEvaluationInput
} from "@/lib/answer-evaluation";
import { getOpenAIModel } from "@/lib/env";
import { getOpenAIClient } from "@/lib/openai/client";
import { buildAnswerEvaluationPrompt } from "@/lib/openai/prompt-builders";

type EvaluateAnswersParams = {
  evaluationId: string;
  submissionId: string;
  submittedAnswers: SubmittedAnswerInput[];
  evaluationMode?: EvaluationMode;
  sourceLabel?: string;
};

export async function evaluateAnswersWithOpenAI({
  evaluationId,
  submissionId,
  submittedAnswers,
  evaluationMode = "answer-key",
  sourceLabel = "Detected answer key"
}: EvaluateAnswersParams): Promise<EvaluationResponse> {
  const client = getOpenAIClient();
  const evaluations = await Promise.all(
    submittedAnswers.map(async (submittedAnswer) => {
      if (!submittedAnswer.expectedAnswer?.trim()) {
        return buildUnavailableEvaluation(submittedAnswer);
      }

      const resolved = resolveEvaluationInput(submittedAnswer);
      const prompt = buildAnswerEvaluationPrompt({
        questionText: resolved.questionText,
        expectedAnswer: resolved.expectedAnswer,
        studentAnswer: resolved.studentAnswer,
        totalMarks: resolved.totalMarks,
        rubric: buildRubric(resolved.expectedAnswer, resolved.totalMarks)
      });

      const response = await client.responses.create({
        model: getOpenAIModel("evaluation"),
        input: prompt
      });

      const outputText = response.output_text?.trim();

      if (!outputText) {
        throw new Error(`OpenAI evaluation returned an empty response for question ${resolved.questionId}.`);
      }

      try {
        const parsed = JSON.parse(outputText) as {
          marksAwarded?: number;
          marks_awarded?: number;
          maxMarks?: number;
          max_marks?: number;
          scorePercentage?: number;
          score_percentage?: number;
          strengths?: string[];
          feedback?: string;
          improvements?: string[];
          improvement?: string;
          mistakes?: string[];
          confidence?: "low" | "medium" | "high";
          reason?: string;
          matchedPoints?: string[];
          matched_points?: string[];
          missingPoints?: string[];
          missing_points?: string[];
        };
        const missingPoints = Array.isArray(parsed.missing_points)
          ? parsed.missing_points.filter((item) => typeof item === "string")
          : Array.isArray(parsed.missingPoints)
            ? parsed.missingPoints.filter((item) => typeof item === "string")
            : [];
        const improvementText =
          typeof parsed.improvement === "string" && parsed.improvement.trim().length > 0 ? parsed.improvement.trim() : "";

        return {
          questionId: resolved.questionId,
          questionNumber: resolved.questionNumber,
          questionText: resolved.questionText,
          totalMarks: resolved.totalMarks,
          maxMarks: Math.max(
            1,
            Math.min(resolved.totalMarks, Number(parsed.max_marks ?? parsed.maxMarks) || resolved.totalMarks)
          ),
          marksAwarded: Math.max(0, Math.min(resolved.totalMarks, Number(parsed.marks_awarded ?? parsed.marksAwarded) || 0)),
          scorePercentage: Math.max(
            0,
            Math.min(100, Number(parsed.score_percentage ?? parsed.scorePercentage) || 0)
          ),
          strengths: Array.isArray(parsed.strengths)
            ? parsed.strengths.filter((item) => typeof item === "string" && item.trim().length > 0)
            : [],
          feedback:
            typeof parsed.feedback === "string" && parsed.feedback.trim().length > 0
              ? parsed.feedback.trim()
              : "The answer was evaluated against the expected answer.",
          improvements: [
            ...missingPoints.map((item) => `Review or add: ${item}`),
            ...(improvementText ? [improvementText] : [])
          ],
          mistakes: Array.isArray(parsed.mistakes)
            ? parsed.mistakes.filter((item) => typeof item === "string" && item.trim().length > 0)
            : [],
          confidence:
            parsed.confidence === "low" || parsed.confidence === "medium" || parsed.confidence === "high"
              ? parsed.confidence
              : "medium",
          reason: typeof parsed.reason === "string" ? parsed.reason : typeof parsed.feedback === "string" ? parsed.feedback : "",
          matchedPoints: Array.isArray(parsed.matched_points)
            ? parsed.matched_points.filter((item) => typeof item === "string")
            : Array.isArray(parsed.matchedPoints)
              ? parsed.matchedPoints.filter((item) => typeof item === "string")
              : [],
          missingPoints
        } satisfies AnswerEvaluationItem;
      } catch {
        return evaluateAnswerLocally(resolved);
      }
    })
  );

  const totalScore = evaluations.reduce((sum, evaluation) => sum + evaluation.marksAwarded, 0);
  const totalMarks = evaluations.reduce((sum, evaluation) => sum + evaluation.totalMarks, 0);

  return {
    evaluationId,
    submissionId,
    status: "completed",
    evaluationMode,
    sourceLabel,
    totalScore,
    totalMarks,
    evaluations,
    completedAt: new Date().toISOString()
  };
}

function buildRubric(expectedAnswer: string, totalMarks: number) {
  const points = extractReferencePoints(expectedAnswer).slice(0, 6);

  if (points.length === 0) {
    return [
      {
        point: expectedAnswer.trim() || "Main expected answer point",
        marks: totalMarks
      }
    ];
  }

  const baseMarks = Math.floor(totalMarks / points.length);
  let remainder = totalMarks % points.length;

  return points.map((point) => {
    const marks = baseMarks + (remainder > 0 ? 1 : 0);
    remainder = Math.max(0, remainder - 1);

    return {
      point,
      marks: Math.max(1, marks)
    };
  });
}
