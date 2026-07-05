"use client";

import Link from "next/link";
import { ArrowLeft, BarChart3, ClipboardList, TriangleAlert } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { ReactNode } from "react";

import { AppShell } from "@/components/app-shell";
import { PageHeader } from "@/components/page-header";
import { SavedExamResult } from "@/lib/api-types";
import { getLatestExamResult } from "@/lib/result-storage";
import { buildResultSummary, ResultTab } from "@/lib/result-summary";

export function ResultsScreen() {
  const [result, setResult] = useState<SavedExamResult | null>(null);
  const [activeTab, setActiveTab] = useState<ResultTab>("summary");

  useEffect(() => {
    setResult(getLatestExamResult());
  }, []);

  const summary = useMemo(() => (result ? buildResultSummary(result) : null), [result]);

  return (
    <AppShell currentPath="/">
      <PageHeader
        eyebrow="Results"
        title="Exam result"
        description="A full review of the latest evaluated paper, including section-wise performance and question-level feedback."
        action={
          <Link href="/" className="inline-flex items-center gap-2 rounded-full bg-ink px-5 py-3 text-sm text-white" style={{ color: '#ffffff' }}>
            <ArrowLeft className="h-4 w-4" />
            Back to home
          </Link>
        }
      />

      {!result || !summary ? (
        <div className="rounded-[2rem] border border-slate-200 bg-white p-8">
          <p className="text-lg font-medium text-ink">No saved result found.</p>
          <p className="mt-2 text-sm leading-6 text-slate-600">
            Submit a test first and we will show the complete result summary here.
          </p>
        </div>
      ) : (
        <div className="space-y-6">
          <div className="grid gap-4 md:grid-cols-4">
            <ResultStat label="Total Marks" value={`${summary.totalMarksObtained}/${summary.totalMaxMarks}`} />
            <ResultStat label="Percentage" value={`${summary.percentage}%`} />
            <ResultStat label="Grade" value={summary.grade} />
            <ResultStat label="Answered" value={`${result.answeredCount}/${result.totalQuestions}`} />
          </div>

          <div className="rounded-[2rem] border border-slate-200 bg-white p-5">
            <div className="flex flex-wrap gap-3">
              <TabButton label="Summary" active={activeTab === "summary"} onClick={() => setActiveTab("summary")} />
              <TabButton
                label="Full Review"
                active={activeTab === "full-review"}
                onClick={() => setActiveTab("full-review")}
              />
              <TabButton
                label="Mistakes Only"
                active={activeTab === "mistakes"}
                onClick={() => setActiveTab("mistakes")}
              />
            </div>
          </div>

          {activeTab === "summary" ? (
            <div className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
              <div className="space-y-6">
                <Panel
                  title="Section-wise performance"
                  icon={<BarChart3 className="h-4 w-4" />}
                  description="Marks grouped by extracted section."
                >
                  <div className="space-y-4">
                    {summary.sectionPerformance.map((section) => (
                      <div key={section.section} className="rounded-[1.5rem] border border-slate-200 bg-slate-50 p-4">
                        <div className="flex flex-wrap items-center justify-between gap-3">
                          <div>
                            <p className="font-medium text-ink">{section.section}</p>
                            <p className="mt-1 text-sm text-slate-500">{section.questionCount} question(s)</p>
                          </div>
                          <div className="text-right">
                            <p className="font-medium text-ink">
                              {section.marksObtained}/{section.maxMarks}
                            </p>
                            <p className="mt-1 text-sm text-slate-500">{section.percentage}%</p>
                          </div>
                        </div>
                        <div className="mt-4 h-2 rounded-full bg-white">
                          <div className="h-2 rounded-full bg-ink" style={{ width: `${section.percentage}%` }} />
                        </div>
                      </div>
                    ))}
                  </div>
                </Panel>

                <Panel
                  title="Question-wise marks"
                  icon={<ClipboardList className="h-4 w-4" />}
                  description="A compact overview of marks across all questions."
                >
                  <div className="space-y-3">
                    {summary.questionDetails.map((detail) => (
                      <div key={detail.questionId} className="flex flex-wrap items-center justify-between rounded-[1.5rem] bg-slate-50 p-4">
                        <div>
                          <p className="font-medium text-ink">Question {detail.questionNumber}</p>
                          <p className="mt-1 text-sm text-slate-500">{detail.section}</p>
                        </div>
                        <div className="flex flex-wrap gap-2">
                          <span className="rounded-full bg-white px-4 py-2 text-sm font-medium text-ink">
                            {detail.marksAwarded}/{detail.maxMarks}
                          </span>
                          <span className="rounded-full bg-white px-4 py-2 text-sm font-medium text-slate-700">
                            {detail.scorePercentage}%
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </Panel>
              </div>

              <div className="space-y-6">
                <Panel
                  title="Strengths"
                  icon={<BarChart3 className="h-4 w-4" />}
                  description="Topics and ideas that were answered well."
                >
                  <InsightList items={summary.strengths} emptyLabel="No clear strengths were detected yet." />
                </Panel>

                <Panel
                  title="Weak areas"
                  icon={<TriangleAlert className="h-4 w-4" />}
                  description="Topics that were missed or weakly covered."
                >
                  <InsightList items={summary.weakAreas} emptyLabel="No major weak areas were flagged." />
                </Panel>
              </div>
            </div>
          ) : null}

          {activeTab === "full-review" ? (
            <div className="space-y-4">
              {summary.questionDetails.map((detail) => (
                <QuestionReviewCard key={detail.questionId} detail={detail} />
              ))}
            </div>
          ) : null}

          {activeTab === "mistakes" ? (
            <div className="space-y-4">
              {summary.questionDetails
                .filter((detail) => detail.missingPoints.length > 0 || detail.mistakes.length > 0)
                .map((detail) => (
                  <QuestionReviewCard key={detail.questionId} detail={detail} mistakesOnly />
                ))}
              {summary.questionDetails.every((detail) => detail.missingPoints.length === 0 && detail.mistakes.length === 0) ? (
                <div className="rounded-[2rem] border border-slate-200 bg-white p-8 text-sm text-slate-600">
                  No mistake-only items were found for this attempt.
                </div>
              ) : null}
            </div>
          ) : null}
        </div>
      )}
    </AppShell>
  );
}

function ResultStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-[1.75rem] border border-slate-200 bg-white p-5">
      <p className="text-sm text-slate-500">{label}</p>
      <p className="mt-3 text-3xl font-semibold text-ink">{value}</p>
    </div>
  );
}

function TabButton({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-full px-4 py-2 text-sm ${active ? "bg-ink text-white" : "bg-slate-100 text-slate-600"}`}
    >
      {label}
    </button>
  );
}

function Panel({
  title,
  description,
  icon,
  children
}: {
  title: string;
  description: string;
  icon: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="rounded-[2rem] border border-slate-200 bg-white p-6">
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-slate-100 text-slate-700">{icon}</div>
        <div>
          <h2 className="text-lg font-semibold text-ink">{title}</h2>
          <p className="mt-1 text-sm text-slate-500">{description}</p>
        </div>
      </div>
      <div className="mt-6">{children}</div>
    </div>
  );
}

function InsightList({ items, emptyLabel }: { items: string[]; emptyLabel: string }) {
  if (items.length === 0) {
    return <p className="text-sm leading-6 text-slate-600">{emptyLabel}</p>;
  }

  return (
    <ul className="space-y-3">
      {items.map((item) => (
        <li key={item} className="rounded-[1.5rem] bg-slate-50 px-4 py-3 text-sm leading-6 text-slate-700">
          {item}
        </li>
      ))}
    </ul>
  );
}

function QuestionReviewCard({
  detail,
  mistakesOnly = false
}: {
  detail: ReturnType<typeof buildResultSummary>["questionDetails"][number];
  mistakesOnly?: boolean;
}) {
  return (
    <div className="rounded-[2rem] border border-slate-200 bg-white p-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-sm font-medium text-ink">Question {detail.questionNumber}</p>
          <p className="mt-1 text-sm text-slate-500">{detail.section}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <span className="rounded-full bg-slate-100 px-4 py-2 text-sm font-medium text-ink">
            {detail.marksAwarded}/{detail.maxMarks}
          </span>
          <span className="rounded-full bg-slate-100 px-4 py-2 text-sm font-medium text-slate-700">
            {detail.scorePercentage}%
          </span>
        </div>
      </div>

      <div className="mt-5 space-y-4">
        {!mistakesOnly ? (
          <>
            <ReviewBlock title="Question" content={detail.questionText || "Question text unavailable."} />
            <ReviewBlock title="Student answer" content={detail.studentAnswer || "No answer provided."} />
            <ReviewBlock title="Correct answer" content={detail.correctAnswer || "No reference answer available."} />
          </>
        ) : null}

        <ReviewBlock title="Feedback" content={detail.feedback} />

        {detail.refinedAnswer ? (
          <ReviewBlock title="AI Refined Answer (Suggested Solution)" content={detail.refinedAnswer} />
        ) : null}

        {detail.strengths.length > 0 && !mistakesOnly ? <ListBlock title="Strengths" items={detail.strengths} /> : null}
        {detail.missingPoints.length > 0 ? <ListBlock title="Weak areas" items={detail.missingPoints} /> : null}
        {detail.mistakes.length > 0 ? <ListBlock title="Mistakes" items={detail.mistakes} /> : null}
        {detail.improvements.length > 0 ? <ListBlock title="Improvement tips" items={detail.improvements} /> : null}
      </div>
    </div>
  );
}

function ReviewBlock({ title, content }: { title: string; content: string }) {
  return (
    <div className="rounded-[1.5rem] bg-slate-50 p-4">
      <p className="text-sm font-medium text-ink">{title}</p>
      <p className="mt-2 whitespace-pre-line text-sm leading-6 text-slate-600">{content}</p>
    </div>
  );
}

function ListBlock({ title, items }: { title: string; items: string[] }) {
  return (
    <div className="rounded-[1.5rem] bg-slate-50 p-4">
      <p className="text-sm font-medium text-ink">{title}</p>
      <ul className="mt-2 list-disc pl-5 text-sm leading-6 text-slate-600">
        {items.map((item) => (
          <li key={`${title}-${item}`}>{item}</li>
        ))}
      </ul>
    </div>
  );
}
