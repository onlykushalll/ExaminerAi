import { SavedExamResult } from "@/lib/api-types";

export type ResultTab = "summary" | "full-review" | "mistakes";

export function buildResultSummary(result: SavedExamResult) {
  const totalMarksObtained = result.evaluation.evaluations.reduce((sum, item) => sum + item.marksAwarded, 0);
  const totalMaxMarks = result.evaluation.evaluations.reduce((sum, item) => sum + item.maxMarks, 0);
  const percentage = totalMaxMarks > 0 ? Math.round((totalMarksObtained / totalMaxMarks) * 100) : 0;
  const grade = getGrade(percentage);

  const questionDetails = result.evaluation.evaluations.map((evaluation, index) => {
    const paperQuestion = result.paper.questions.find((question) => question.id === evaluation.questionId) ?? result.paper.questions[index];
    const submittedAnswer =
      result.submittedAnswers.find((answer) => answer.questionId === evaluation.questionId)?.answer?.trim() ?? "";
    const referenceAnswer =
      result.submittedAnswers.find((answer) => answer.questionId === evaluation.questionId)?.expectedAnswer?.trim() ??
      result.paper.answers.find((answer) => normalizeQuestionNumber(answer.question) === normalizeQuestionNumber(evaluation.questionNumber ?? ""))?.answer ??
      "";
    const section = paperQuestion?.section?.trim() || "General";

    return {
      questionId: evaluation.questionId,
      questionNumber: evaluation.questionNumber || String(index + 1),
      questionText: evaluation.questionText || paperQuestion?.questionText || paperQuestion?.text || "",
      section,
      studentAnswer: submittedAnswer,
      correctAnswer: referenceAnswer,
      refinedAnswer: (evaluation as any).refinedAnswer || referenceAnswer || "",
      marksAwarded: evaluation.marksAwarded,
      maxMarks: evaluation.maxMarks,
      scorePercentage: evaluation.scorePercentage ?? (evaluation.maxMarks > 0 ? Math.round((evaluation.marksAwarded / evaluation.maxMarks) * 100) : 0),
      feedback: evaluation.feedback,
      strengths: evaluation.strengths ?? [],
      missingPoints: evaluation.missingPoints ?? [],
      mistakes: evaluation.mistakes ?? [],
      improvements: evaluation.improvements ?? []
    };
  });

  const sectionMap = new Map<string, { section: string; marksObtained: number; maxMarks: number; questionCount: number }>();
  for (const detail of questionDetails) {
    const current = sectionMap.get(detail.section) ?? {
      section: detail.section,
      marksObtained: 0,
      maxMarks: 0,
      questionCount: 0
    };
    current.marksObtained += detail.marksAwarded;
    current.maxMarks += detail.maxMarks;
    current.questionCount += 1;
    sectionMap.set(detail.section, current);
  }

  const sectionPerformance = [...sectionMap.values()].map((item) => ({
    ...item,
    percentage: item.maxMarks > 0 ? Math.round((item.marksObtained / item.maxMarks) * 100) : 0
  }));

  const strengths = collectTopItems(questionDetails.flatMap((detail) => detail.strengths));
  const weakAreas = collectTopItems([
    ...questionDetails.flatMap((detail) => detail.missingPoints),
    ...questionDetails.flatMap((detail) => detail.mistakes)
  ]);

  return {
    totalMarksObtained,
    totalMaxMarks,
    percentage,
    grade,
    sectionPerformance,
    questionDetails,
    strengths,
    weakAreas
  };
}

function collectTopItems(items: string[]) {
  const counts = new Map<string, number>();

  for (const item of items.filter(Boolean)) {
    counts.set(item, (counts.get(item) ?? 0) + 1);
  }

  return [...counts.entries()]
    .sort((left, right) => right[1] - left[1] || left[0].localeCompare(right[0]))
    .slice(0, 6)
    .map(([item]) => item);
}

function getGrade(percentage: number) {
  if (percentage >= 85) {
    return "A";
  }

  if (percentage >= 70) {
    return "B";
  }

  if (percentage >= 50) {
    return "C";
  }

  return "D";
}

function normalizeQuestionNumber(value: string) {
  return value.trim().toLowerCase().replace(/^q(?:uestion)?\s*/i, "");
}
