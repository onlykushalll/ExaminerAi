import { resolveEvaluationInput, evaluateAnswerLocally } from "@/lib/answer-evaluation";
import { extractedPaperReview } from "@/lib/mock-data";
import {
  AnswerSubmissionRequest,
  AnswerSubmissionResponse,
  EvaluationRequest,
  EvaluationResponse,
  FileUploadRequest,
  FileUploadResponse,
  PaperAnalysisRequest,
  PaperAnalysisResponse,
  TestCreationRequest,
  TestCreationResponse
} from "@/lib/api-types";

function makeId(prefix: string) {
  return `${prefix}_${Math.random().toString(36).slice(2, 10)}`;
}

function nowIso() {
  return new Date().toISOString();
}

export function buildMockUploadResponse(body: FileUploadRequest): FileUploadResponse {
  return {
    uploadBatchId: makeId("upload"),
    files: body.files.map((file) => ({
      documentId: makeId("doc"),
      kind: file.kind,
      fileName: file.fileName,
      sizeBytes: file.sizeBytes,
      mimeType: file.mimeType,
      status: "uploaded",
      uploadedAt: nowIso()
    })),
    nextStep: "/"
  };
}

export function buildMockAnalysisResponse(_: PaperAnalysisRequest): PaperAnalysisResponse {
  return {
    analysisId: makeId("analysis"),
    status: "completed",
    extractedPaper: extractedPaperReview,
    warnings: ["Section C title was inferred from layout spacing rather than explicit heading text."]
  };
}

export function buildMockTestCreationResponse(_: TestCreationRequest): TestCreationResponse {
  return {
    testId: makeId("test"),
    status: "active",
    paper: extractedPaperReview,
    startedAt: nowIso()
  };
}

export function buildMockSubmissionResponse(body: AnswerSubmissionRequest): AnswerSubmissionResponse {
  return {
    submissionId: makeId("submission"),
    testId: body.testId,
    submittedAt: body.submittedAt ?? nowIso(),
    answerCount: body.answers.length,
    status: "submitted",
    nextStep: "/my-papers"
  };
}

export function buildMockEvaluationResponse(body: EvaluationRequest): EvaluationResponse {
  const evaluations = (body.submittedAnswers ?? []).map((answer) => evaluateAnswerLocally(resolveEvaluationInput(answer)));
  const totalScore = evaluations.reduce((sum, evaluation) => sum + evaluation.marksAwarded, 0);
  const totalMarks = evaluations.reduce((sum, evaluation) => sum + evaluation.totalMarks, 0);

  return {
    evaluationId: makeId("evaluation"),
    submissionId: body.submissionId,
    status: "completed",
    evaluationMode: body.evaluationMode ?? "answer-key",
    sourceLabel: "Mock answer key",
    totalScore,
    totalMarks,
    evaluations,
    completedAt: nowIso()
  };
}
