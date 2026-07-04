import extractedPaper from "@/data/extracted-paper.json";
import {
  ExamQuestion,
  ExtractedExam,
  ExtractedPaperReview,
  MockResult,
  RecentUpload,
  ResultMetric,
  SavedTest
} from "@/lib/types";

export const extractedExam: ExtractedExam = {
  examTitle: "Mid Term Assessment 2026",
  board: "CBSE Pattern",
  grade: "Class 10",
  durationMinutes: 90,
  totalMarks: 80,
  questionPaperFileName: "science-midterm-set-a.pdf",
  answerKeyFileName: "science-midterm-answer-key.pdf",
  instructions: [
    "All questions are compulsory.",
    "Attempt Section A before Section B.",
    "Use concise scientific terms wherever possible."
  ],
  sections: [
    {
      id: "section-a",
      title: "Section A",
      subject: "Physics",
      questionCount: 5,
      marksPerQuestion: 2,
      durationMinutes: 20,
      instructions: ["Choose the correct option.", "Each question carries 2 marks."]
    },
    {
      id: "section-b",
      title: "Section B",
      subject: "Chemistry",
      questionCount: 3,
      marksPerQuestion: 5,
      durationMinutes: 25,
      instructions: ["Answer in 3-4 lines.", "Show chemical notation clearly."]
    },
    {
      id: "section-c",
      title: "Section C",
      subject: "Biology",
      questionCount: 2,
      marksPerQuestion: 10,
      durationMinutes: 45,
      instructions: ["Long-form descriptive answers.", "Use labelled examples where relevant."]
    }
  ]
};

export const extractedExamJson = JSON.stringify(extractedExam, null, 2);
export const extractedPaperReview = extractedPaper as ExtractedPaperReview;
export const extractedPaperReviewJson = JSON.stringify(extractedPaperReview, null, 2);

export const mockQuestions: ExamQuestion[] = [
  {
    id: "q1",
    sectionId: "section-a",
    type: "mcq",
    prompt: "Which device is used to measure electric current in a circuit?",
    options: ["Voltmeter", "Ammeter", "Thermometer", "Barometer"],
    correctAnswer: "Ammeter",
    marks: 2,
    explanation: "An ammeter is connected in series to measure the current flowing through a circuit.",
    aiReview: "Correct concept identified. Answer was precise and aligned with the expected terminology.",
    studentAnswer: "Ammeter",
    awardedMarks: 2
  },
  {
    id: "q2",
    sectionId: "section-a",
    type: "mcq",
    prompt: "The SI unit of resistance is:",
    options: ["Volt", "Ohm", "Ampere", "Watt"],
    correctAnswer: "Ohm",
    marks: 2,
    explanation: "Electrical resistance is measured in ohms, represented by the omega symbol.",
    aiReview: "Correct final answer, but the student hesitated for 24 seconds before selection.",
    studentAnswer: "Ohm",
    awardedMarks: 2
  },
  {
    id: "q3",
    sectionId: "section-b",
    type: "short",
    prompt: "Explain why magnesium ribbon is cleaned before burning in air.",
    correctAnswer:
      "Magnesium ribbon is cleaned to remove the oxide layer so it burns easily and reacts directly with oxygen.",
    marks: 5,
    explanation:
      "Magnesium reacts with oxygen, but a magnesium oxide layer blocks direct burning unless removed first.",
    aiReview:
      "The submitted answer captured the oxide-layer reason but missed the impact on reaction speed.",
    studentAnswer: "To remove the magnesium oxide layer formed on the surface.",
    awardedMarks: 4
  },
  {
    id: "q4",
    sectionId: "section-b",
    type: "short",
    prompt: "Differentiate between saturated and unsaturated hydrocarbons.",
    correctAnswer:
      "Saturated hydrocarbons have only single covalent bonds, while unsaturated hydrocarbons contain double or triple bonds.",
    marks: 5,
    explanation:
      "The distinction depends on the bonding between carbon atoms and influences their chemical reactivity.",
    aiReview:
      "Answer mentioned bond types correctly but lacked one example for each category.",
    studentAnswer:
      "Saturated hydrocarbons have only single bonds. Unsaturated hydrocarbons have double or triple bonds.",
    awardedMarks: 4
  },
  {
    id: "q5",
    sectionId: "section-c",
    type: "long",
    prompt: "Describe the process of photosynthesis and state its importance.",
    correctAnswer:
      "Photosynthesis is the process by which green plants use sunlight, chlorophyll, carbon dioxide, and water to produce glucose and oxygen. It is essential because it provides food and releases oxygen into the atmosphere.",
    marks: 10,
    explanation:
      "A complete answer should cover the raw materials, role of chlorophyll, products formed, and ecological significance.",
    aiReview:
      "Response was conceptually strong but did not mention glucose explicitly, which reduced completeness.",
    studentAnswer:
      "Plants use sunlight, carbon dioxide, and water in the presence of chlorophyll to make food and oxygen. It is important because it supports life on Earth.",
    awardedMarks: 8
  }
];

export const resultMetrics: ResultMetric[] = [
  { label: "Overall Score", value: "20 / 24", tone: "positive" },
  { label: "Accuracy", value: "83%", tone: "positive" },
  { label: "Completion", value: "100%", tone: "positive" },
  { label: "AI Confidence", value: "0.92", tone: "warning" }
];

export const mockResult: MockResult = {
  totalScore: 20,
  totalMarks: 24,
  percentage: 83,
  summary:
    "Overall performance was strong. Objective questions were answered accurately, while descriptive answers showed good understanding but missed a few completeness points.",
  sectionPerformance: [
    {
      sectionId: "section-a",
      title: "Section A",
      score: 4,
      totalMarks: 4,
      percentage: 100,
      feedback: "Excellent performance in objective recall and concept recognition."
    },
    {
      sectionId: "section-b",
      title: "Section B",
      score: 8,
      totalMarks: 10,
      percentage: 80,
      feedback: "Mostly correct, but short answers needed slightly better detail and examples."
    },
    {
      sectionId: "section-c",
      title: "Section C",
      score: 8,
      totalMarks: 10,
      percentage: 80,
      feedback: "Strong conceptual answer with minor loss of marks for missing a key output."
    }
  ],
  questionResults: [
    {
      id: "q1",
      number: "1",
      sectionId: "section-a",
      prompt: "Which device is used to measure electric current in a circuit?",
      type: "mcq",
      expectedAnswer: "Ammeter",
      studentAnswer: "Ammeter",
      marksAwarded: 2,
      totalMarks: 2,
      reasons: ["Selected the correct scientific instrument.", "No ambiguity in the chosen answer."],
      confidence: "High",
      reviewRecommended: "Not needed",
      grading: "Correct"
    },
    {
      id: "q2",
      number: "2",
      sectionId: "section-a",
      prompt: "The SI unit of resistance is:",
      type: "mcq",
      expectedAnswer: "Ohm",
      studentAnswer: "Ohm",
      marksAwarded: 2,
      totalMarks: 2,
      reasons: ["Correct unit selected.", "Answer fully matched the answer key."],
      confidence: "High",
      reviewRecommended: "Not needed",
      grading: "Correct"
    },
    {
      id: "q3",
      number: "6",
      sectionId: "section-b",
      prompt: "Explain why magnesium ribbon is cleaned before burning in air.",
      type: "short",
      expectedAnswer:
        "Magnesium ribbon is cleaned to remove the oxide layer so it burns easily and reacts directly with oxygen.",
      studentAnswer: "To remove the magnesium oxide layer formed on the surface.",
      marksAwarded: 4,
      totalMarks: 5,
      reasons: [
        "Core concept about the oxide layer was correct.",
        "The answer did not clearly mention easier burning or improved reaction with oxygen."
      ],
      confidence: "Medium",
      reviewRecommended: "Optional",
      grading: "Partial"
    },
    {
      id: "q4",
      number: "7",
      sectionId: "section-b",
      prompt: "Differentiate between saturated and unsaturated hydrocarbons.",
      type: "short",
      expectedAnswer:
        "Saturated hydrocarbons have only single covalent bonds, while unsaturated hydrocarbons contain double or triple bonds.",
      studentAnswer:
        "Saturated hydrocarbons have only single bonds. Unsaturated hydrocarbons have double or triple bonds.",
      marksAwarded: 4,
      totalMarks: 5,
      reasons: [
        "Bond-type distinction was correct.",
        "One example for each category would have improved completeness."
      ],
      confidence: "Medium",
      reviewRecommended: "Recommended",
      grading: "Partial"
    },
    {
      id: "q5",
      number: "9",
      sectionId: "section-c",
      prompt: "Describe the process of photosynthesis and state its importance.",
      type: "long",
      expectedAnswer:
        "Photosynthesis is the process by which green plants use sunlight, chlorophyll, carbon dioxide, and water to produce glucose and oxygen. It is essential because it provides food and releases oxygen into the atmosphere.",
      studentAnswer:
        "Plants use sunlight, carbon dioxide, and water in the presence of chlorophyll to make food and oxygen. It is important because it supports life on Earth.",
      marksAwarded: 8,
      totalMarks: 10,
      reasons: [
        "The main process and importance were explained correctly.",
        "The answer used 'food' instead of explicitly stating glucose, which reduced precision."
      ],
      confidence: "Medium",
      reviewRecommended: "Recommended",
      grading: "Partial"
    }
  ]
};

export const savedTests: SavedTest[] = [
  {
    id: "st-1",
    title: "Science Mid Term Set A",
    subject: "Science",
    updatedAt: "20 Mar 2026",
    status: "Evaluated",
    progress: 100,
    score: 83
  },
  {
    id: "st-2",
    title: "Mathematics Practice Paper 3",
    subject: "Mathematics",
    updatedAt: "18 Mar 2026",
    status: "Draft",
    progress: 42
  },
  {
    id: "st-3",
    title: "English Grammar Drill",
    subject: "English",
    updatedAt: "15 Mar 2026",
    status: "Completed",
    progress: 100,
    score: 71
  }
];

export const recentUploads: RecentUpload[] = [
  {
    id: "upload-1",
    fileName: "science-preboard-2026.pdf",
    fileType: "Question Paper",
    uploadedAt: "21 Mar 2026, 10:20 AM",
    status: "Ready"
  },
  {
    id: "upload-2",
    fileName: "science-preboard-key.pdf",
    fileType: "Answer Key",
    uploadedAt: "20 Mar 2026, 06:15 PM",
    status: "Ready"
  },
  {
    id: "upload-3",
    fileName: "rubric-notes.pdf",
    fileType: "Supporting PDF",
    uploadedAt: "19 Mar 2026, 04:40 PM",
    status: "Pending Review"
  }
];

export const answerDistribution = [
  { label: "Correct", value: 2, color: "bg-teal" },
  { label: "Partial", value: 3, color: "bg-gold" },
  { label: "Incorrect", value: 0, color: "bg-slate-300" }
];
