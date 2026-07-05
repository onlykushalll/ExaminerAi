import { ReactNode } from "react";

import { mockResult } from "@/lib/mock-data";
import { cn } from "@/lib/utils";

export function DetailedReviewTable() {
  return (
    <div className="space-y-4">
      {mockResult.questionResults.map((question) => (
        <div key={question.id} className="rounded-[1.75rem] border border-slate-200 bg-white p-5">
          <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
            <div className="max-w-3xl">
              <div className="flex flex-wrap items-center gap-2">
                <Badge tone={getGradingTone(question.grading)}>Q{question.number}</Badge>
                <Badge tone="neutral">{question.type.toUpperCase()}</Badge>
                <Badge tone={getConfidenceTone(question.confidence)}>{question.confidence} confidence</Badge>
                <Badge tone={getRecommendationTone(question.reviewRecommended)}>
                  Review {question.reviewRecommended.toLowerCase()}
                </Badge>
              </div>
              <h3 className="mt-4 text-lg font-semibold text-ink">{question.prompt}</h3>
            </div>
            <span
              className={cn(
                "inline-flex rounded-full px-3 py-2 text-sm font-medium",
                question.grading === "Correct" && "bg-teal-100 text-teal-700",
                question.grading === "Partial" && "bg-amber-100 text-amber-700",
                question.grading === "Incorrect" && "bg-slate-100 text-slate-700"
              )}
            >
              {question.grading} - {question.marksAwarded}/{question.totalMarks}
            </span>
          </div>

          <div className="mt-5 grid gap-4 xl:grid-cols-4">
            <ReviewBlock title="Expected answer" content={question.expectedAnswer} />
            <ReviewBlock title="Student answer" content={question.studentAnswer} />
            <ReviewBlock
              title="Marks awarded"
              content={`${question.marksAwarded}/${question.totalMarks}`}
              tone="highlight"
            />
            <ReviewBlock
              title="Confidence"
              content={`${question.confidence} confidence - Review ${question.reviewRecommended.toLowerCase()}`}
              tone="highlight"
            />
          </div>

          <div className="mt-4 rounded-[1.5rem] bg-slate-50 p-4">
            <p className="text-sm font-medium text-slate-500">Reasons</p>
            <div className="mt-3 space-y-2">
              {question.reasons.map((reason) => (
                <div key={reason} className="rounded-2xl bg-white px-4 py-3 text-sm leading-7 text-slate-700">
                  {reason}
                </div>
              ))}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

function ReviewBlock({
  title,
  content,
  tone = "default"
}: {
  title: string;
  content: string;
  tone?: "default" | "highlight";
}) {
  return (
    <div className={cn("rounded-2xl p-4", tone === "highlight" ? "bg-orange-50" : "bg-slate-50")}>
      <p className="text-sm font-medium text-slate-500">{title}</p>
      <p className="mt-3 text-sm leading-7 text-slate-700">{content}</p>
    </div>
  );
}

function Badge({
  children,
  tone
}: {
  children: ReactNode;
  tone: "success" | "warning" | "neutral" | "accent";
}) {
  return (
    <span
      className={cn(
        "rounded-full px-3 py-1 text-xs font-medium",
        tone === "success" && "bg-teal-100 text-teal-700",
        tone === "warning" && "bg-amber-100 text-amber-700",
        tone === "neutral" && "bg-slate-100 text-slate-600",
        tone === "accent" && "bg-orange-100 text-orange-700"
      )}
    >
      {children}
    </span>
  );
}

function getGradingTone(grading: string) {
  if (grading === "Correct") return "success";
  if (grading === "Partial") return "warning";
  return "neutral";
}

function getConfidenceTone(confidence: string) {
  if (confidence === "High") return "success";
  if (confidence === "Medium") return "warning";
  return "neutral";
}

function getRecommendationTone(label: string) {
  if (label === "Recommended") return "accent";
  if (label === "Optional") return "warning";
  return "neutral";
}
