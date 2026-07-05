export type ExamSection = {
  id: string;
  title: string;
  subject: string;
  questionCount: number;
  marksPerQuestion: number;
  durationMinutes: number;
  instructions: string[];
};

export type ExamQuestion = {
  id: string;
  sectionId: string;
  type: "mcq" | "short" | "long";
  prompt: string;
  options?: string[];
  correctAnswer: string;
  marks: number;
  explanation: string;
  aiReview: string;
  studentAnswer?: string;
  awardedMarks?: number;
};

export type ExtractedExam = {
  examTitle: string;
  board: string;
  grade: string;
  durationMinutes: number;
  totalMarks: number;
  questionPaperFileName: string;
  answerKeyFileName?: string;
  sections: ExamSection[];
  instructions: string[];
};

export type ExtractionLabel = "detected" | "inferred";

export type ReviewQuestion = {
  id: string;
  number: string;
  sectionId: string;
  type: "mcq" | "short" | "long";
  prompt: string;
  marks: number;
  sourceLabel: ExtractionLabel;
  answerKeySource: string;
  options?: string[];
  answerPlaceholder?: string;
};

export type ReviewSection = {
  id: string;
  title: string;
  sourceLabel: ExtractionLabel;
  questionCount: number;
  marks: number;
  instructions: string[];
};

export type ExtractedPaperReview = {
  title: string;
  titleLabel: ExtractionLabel;
  subject: string;
  subjectLabel: ExtractionLabel;
  className: string;
  classLabel: ExtractionLabel;
  totalMarks: number;
  totalMarksLabel: ExtractionLabel;
  durationMinutes: number;
  durationLabel: ExtractionLabel;
  answerKeySource: string;
  answerKeySourceLabel: ExtractionLabel;
  sections: ReviewSection[];
  questions: ReviewQuestion[];
};

export type SavedTest = {
  id: string;
  title: string;
  subject: string;
  updatedAt: string;
  status: "Draft" | "Completed" | "Evaluated";
  progress: number;
  score?: number;
  fullResult?: any;
  paperData?: any;
};

export type RecentUpload = {
  id: string;
  fileName: string;
  fileType: "Question Paper" | "Answer Key" | "Supporting PDF";
  uploadedAt: string;
  status: "Ready" | "Pending Review";
};

export type ResultMetric = {
  label: string;
  value: string;
  tone: "neutral" | "positive" | "warning";
};

export type ConfidenceLabel = "High" | "Medium" | "Low";

export type ReviewRecommendation = "Recommended" | "Optional" | "Not needed";

export type SectionPerformance = {
  sectionId: string;
  title: string;
  score: number;
  totalMarks: number;
  percentage: number;
  feedback: string;
};

export type QuestionResult = {
  id: string;
  number: string;
  sectionId: string;
  prompt: string;
  type: "mcq" | "short" | "long";
  expectedAnswer: string;
  studentAnswer: string;
  marksAwarded: number;
  totalMarks: number;
  reasons: string[];
  confidence: ConfidenceLabel;
  reviewRecommended: ReviewRecommendation;
  grading: "Correct" | "Partial" | "Incorrect";
};

export type MockResult = {
  totalScore: number;
  totalMarks: number;
  percentage: number;
  summary: string;
  sectionPerformance: SectionPerformance[];
  questionResults: QuestionResult[];
};
