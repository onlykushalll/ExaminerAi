import { ExtractedPaperReview, ExtractionLabel, MockResult } from "@/lib/types";

export type UploadFileKind = "question-paper" | "answer-key" | "supporting-pdf";
export type UploadStatus = "uploaded" | "pending";
export type AnalysisStatus = "queued" | "processing" | "completed";
export type TestStatus = "draft" | "active" | "submitted" | "evaluated";
export type ExtractionMethod = "pdf-parse" | "ocr" | "hybrid" | "text";
export type DocumentType = "text" | "scanned" | "mixed";
export type QuestionType = "mcq" | "subjective" | "assertion_reason" | "case_study";
export type ExtractionConfidence = "high" | "medium" | "low";
export type EvaluationMode = "answer-key" | "ai-generated-answers" | "manual-answer-key" | "manual-review";
export type SingleAnswerEvaluationMode = "reference" | "manual-input" | "ai-generated-answer" | "ai-assist";
export type EvaluationConfidence = "low" | "medium" | "high";

export interface ExtractedSubpart {
  id: string;
  label: string;
  text: string;
  marks: number | null;
  marksSource: ExtractionLabel;
  type: QuestionType;
  confidence: ExtractionConfidence;
  options: string[];
}

export interface ExtractedQuestion {
  id: string;
  number: string;
  text: string;
  questionText: string;
  type: QuestionType;
  marks: number | null;
  marksSource: ExtractionLabel;
  section: string;
  subparts: ExtractedSubpart[];
  options: string[];
  confidence: ExtractionConfidence;
}

export interface ExtractedSection {
  name: string;
  questions: ExtractedQuestion[];
}

export interface ExtractedAnswer {
  question: string;
  answer: string;
  confidence: string;
}

export interface QuestionExtractionResponse {
  fileName: string;
  extractionMethod: ExtractionMethod;
  documentType: DocumentType;
  lowConfidence: boolean;
  title: string;
  titleSource: ExtractionLabel;
  subject: string;
  subjectSource: ExtractionLabel;
  className: string;
  classNameSource: ExtractionLabel;
  totalMarks: string;
  totalMarksSource: ExtractionLabel;
  duration: string;
  durationSource: ExtractionLabel;
  rawText: string;
  normalizedText: string;
  lines: string[];
  sections: ExtractedSection[];
  sectionNames: string[];
  questions: ExtractedQuestion[];
  answers: ExtractedAnswer[];
  warnings: string[];
  pageImages?: string[];
}

export interface UploadFileInput {
  kind: UploadFileKind;
  fileName: string;
  sizeBytes: number;
  mimeType: string;
}

export interface UploadFileResult {
  documentId: string;
  kind: UploadFileKind;
  fileName: string;
  sizeBytes: number;
  mimeType: string;
  status: UploadStatus;
  uploadedAt: string;
}

export interface FileUploadRequest {
  files: UploadFileInput[];
}

export interface FileUploadResponse {
  uploadBatchId: string;
  files: UploadFileResult[];
  nextStep: "/";
}

export interface PaperAnalysisRequest {
  uploadBatchId: string;
  documentIds: string[];
  rawPaperText?: string;
  rawAnswerKeyText?: string;
  supportingText?: string;
}

export interface PaperAnalysisResponse {
  analysisId: string;
  status: AnalysisStatus;
  extractedPaper: ExtractedPaperReview;
  warnings: string[];
}

export interface TestCreationRequest {
  analysisId: string;
  title?: string;
}

export interface TestCreationResponse {
  testId: string;
  status: TestStatus;
  paper: ExtractedPaperReview;
  startedAt: string;
}

export interface SubmittedAnswerInput {
  questionId: string;
  questionNumber?: string;
  questionType?: QuestionType;
  questionText?: string;
  answer: string;
  markedForReview?: boolean;
  expectedAnswer?: string;
  totalMarks?: number;
}

export interface AnswerSubmissionRequest {
  testId: string;
  submittedAt?: string;
  answers: SubmittedAnswerInput[];
}

export interface AnswerSubmissionResponse {
  submissionId: string;
  testId: string;
  submittedAt: string;
  answerCount: number;
  status: "submitted";
  nextStep: "/my-papers";
}

export interface EvaluationRequest {
  submissionId: string;
  analysisId?: string;
  evaluationMode?: EvaluationMode;
  paper?: QuestionExtractionResponse;
  submittedAnswers?: SubmittedAnswerInput[];
}

export interface ManualReviewItem {
  questionId: string;
  questionNumber?: string;
  questionText?: string;
  studentAnswer: string;
  maxMarks: number;
  referenceAnswer: string;
  feedback: string;
  keyPoints: string[];
  missingPoints: string[];
}

export interface AnswerEvaluationItem {
  questionId: string;
  questionNumber?: string;
  questionText?: string;
  totalMarks?: number;
  maxMarks: number;
  marksAwarded: number;
  scorePercentage?: number;
  strengths?: string[];
  feedback: string;
  improvements?: string[];
  mistakes?: string[];
  confidence?: EvaluationConfidence;
  reason?: string;
  matchedPoints?: string[];
  missingPoints?: string[];
  refinedAnswer?: string;
}

export interface EvaluationResponse {
  evaluationId: string;
  submissionId: string;
  status: "completed";
  evaluationMode: EvaluationMode;
  sourceLabel: string;
  totalScore: number;
  totalMarks: number;
  evaluations: AnswerEvaluationItem[];
  manualReviewItems?: ManualReviewItem[];
  completedAt: string;
}

export interface SavedExamResult {
  savedAt: string;
  paper: QuestionExtractionResponse;
  evaluation: EvaluationResponse;
  submittedAnswers: SubmittedAnswerInput[];
  answeredCount: number;
  totalQuestions: number;
}

export interface EvaluateAnswerRequest {
  question: string;
  answer: string;
  reference?: string;
  max_marks?: number;
  mode?: SingleAnswerEvaluationMode;
}

export interface EvaluateAnswerResponse {
  marks_awarded: number;
  max_marks: number;
  score_percentage: number;
  strengths: string[];
  feedback: string;
  missing_points: string[];
  mistakes: string[];
  improvement: string;
  confidence: EvaluationConfidence;
  reference_answer?: string;
  mode: SingleAnswerEvaluationMode;
}
