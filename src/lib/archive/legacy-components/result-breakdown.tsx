import { ReactNode } from "react";

import { mockResult } from "@/lib/mock-data";
import { cn } from "@/lib/utils";

export function ResultBreakdown() {
  return (
    <div className="space-y-6">
      <div className="grid gap-6 xl:grid-cols-[0.8fr_1.2fr]">
        <div className="rounded-[2rem] border border-slate-200 bg-ink p-6 text-white">
          <p className="text-sm uppercase tracking-[0.2em] text-white/50">Total score</p>
          <div className="mt-6 flex h-48 w-48 items-center justify-center rounded-full border border-white/10 bg-white/5">
            <div className="text-center">
              <p className="text-5xl font-semibold">{mockResult.percentage}%</p>
              <p className="mt-2 text-sm text-white/60">
                {mockResult.totalScore} / {mockResult.totalMarks}
              </p>
            </div>
          </div>
          <p className="mt-6 text-sm leading-7 text-white/75">{mockResult.summary}</p>
        </div>

        <div className="grid gap-4 sm:grid-cols-3">
          <StatCard label="Score" value={`${mockResult.totalScore}/${mockResult.totalMarks}`} />
          <StatCard label="Percentage" value={`${mockResult.percentage}%`} tone="teal" />
          <StatCard
            label="Review recommended"
            value={`${mockResult.questionResults.filter((item) => item.reviewRecommended === "Recommended").length}`}
            tone="accent"
          />
        </div>
      </div>

      <div className="rounded-[2rem] border border-slate-200 bg-white p-6">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h3 className="text-xl font-semibold text-ink">Section-wise performance</h3>
            <p className="mt-1 text-sm text-slate-500">Marks and feedback by section.</p>
          </div>
        </div>
        <div className="mt-6 grid gap-4 md:grid-cols-3">
          {mockResult.sectionPerformance.map((section) => (
            <div key={section.sectionId} className="rounded-[1.5rem] border border-slate-200 bg-slate-50 p-5">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-lg font-semibold text-ink">{section.title}</p>
                  <p className="mt-1 text-sm text-slate-500">
                    {section.score}/{section.totalMarks} marks
                  </p>
                </div>
                <span className="rounded-full bg-teal-100 px-3 py-1 text-xs font-medium text-teal-700">
                  {section.percentage}%
                </span>
              </div>
              <p className="mt-4 text-sm leading-7 text-slate-600">{section.feedback}</p>
            </div>
          ))}
        </div>
      </div>

      <div className="rounded-[2rem] border border-slate-200 bg-white p-6">
        <h3 className="text-xl font-semibold text-ink">Question-wise grading</h3>
        <p className="mt-1 text-sm text-slate-500">Quick evaluation summary before opening detailed review.</p>
        <div className="mt-6 space-y-4">
          {mockResult.questionResults.map((question) => (
            <div key={question.id} className="rounded-[1.5rem] border border-slate-200 bg-slate-50 p-5">
              <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                <div className="max-w-3xl">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge tone={getGradingTone(question.grading)}>Q{question.number} {question.grading}</Badge>
                    <Badge tone="neutral">{question.type.toUpperCase()}</Badge>
                    <Badge tone={getConfidenceTone(question.confidence)}>{question.confidence} confidence</Badge>
                    <Badge tone={getRecommendationTone(question.reviewRecommended)}>
                      Review {question.reviewRecommended.toLowerCase()}
                    </Badge>
                  </div>
                  <p className="mt-4 text-base font-medium leading-7 text-ink">{question.prompt}</p>
                </div>
                <div className="rounded-2xl bg-white px-4 py-3 text-sm text-slate-600">
                  <p className="text-xs uppercase tracking-[0.2em] text-slate-400">Marks awarded</p>
                  <p className="mt-2 text-lg font-semibold text-ink">
                    {question.marksAwarded}/{question.totalMarks}
                  </p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function StatCard({
  label,
  value,
  tone = "default"
}: {
  label: string;
  value: string;
  tone?: "default" | "teal" | "accent";
}) {
  return (
    <div
      className={cn(
        "rounded-[1.75rem] border p-5",
        tone === "default" && "border-slate-200 bg-white",
        tone === "teal" && "border-teal-200 bg-teal-50",
        tone === "accent" && "border-orange-200 bg-orange-50"
      )}
    >
      <p className="text-sm text-slate-500">{label}</p>
      <p className="mt-3 text-3xl font-semibold text-ink">{value}</p>
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
