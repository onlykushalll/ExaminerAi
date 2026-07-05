import { Link } from "react-router-dom";
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
          <Link to="/" className="inline-flex items-center gap-2 rounded-full bg-ink px-5 py-3 text-sm text-white" style={{ color: '#ffffff' }}>
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
  const pct = detail.scorePercentage;
  const borderColor = pct >= 80 
    ? 'border-emerald-200 bg-emerald-50/30' 
    : pct >= 40 
      ? 'border-amber-200 bg-amber-50/20' 
      : 'border-red-200 bg-red-50/20';

  return (
    <div className="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-4 border-b border-slate-100 pb-4 mb-4">
        <div>
          <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-slate-100 text-slate-800 text-xs font-semibold rounded-full mb-1">
            Question {detail.questionNumber}
          </span>
          <p className="text-sm font-semibold text-slate-500">{detail.section}</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="text-right">
            <span className="text-sm font-bold text-ink">Marks: {detail.marksAwarded} / {detail.maxMarks}</span>
            <div className="w-24 bg-slate-100 h-1.5 rounded-full overflow-hidden mt-1">
              <div className={`h-1.5 rounded-full ${pct >= 80 ? 'bg-emerald-500' : pct >= 40 ? 'bg-amber-500' : 'bg-red-500'}`} style={{ width: `${pct}%` }} />
            </div>
          </div>
          <span className={`px-3 py-1 text-xs font-bold rounded-full ${
            pct >= 80 ? 'bg-emerald-100 text-emerald-800' : pct >= 40 ? 'bg-amber-100 text-amber-800' : 'bg-red-100 text-red-800'
          }`}>
            {pct}%
          </span>
        </div>
      </div>

      <div className="space-y-4">
        {!mistakesOnly && (
          <div className="rounded-[1.5rem] bg-slate-50 p-4 border border-slate-100">
            <p className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-1">Question Prompt</p>
            <p className="text-sm font-medium text-ink leading-relaxed whitespace-pre-line">{detail.questionText || "Question text unavailable."}</p>
          </div>
        )}

        <div className={`rounded-[1.5rem] p-4 border ${borderColor}`}>
          <p className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-1">Student Answer</p>
          <p className="text-sm text-ink leading-relaxed whitespace-pre-line">{detail.studentAnswer || "No answer provided."}</p>
        </div>

        {detail.refinedAnswer && (
          <div className="rounded-[1.5rem] bg-amber-50/50 border border-amber-200/60 p-4">
            <p className="text-xs font-bold uppercase tracking-wider text-amber-700 mb-1">AI Refined Answer (Model Answer)</p>
            <p className="text-sm text-ink leading-relaxed whitespace-pre-line">{detail.refinedAnswer}</p>
          </div>
        )}

        <div className="grid gap-4 md:grid-cols-2">
          {detail.feedback && (
            <div className="rounded-[1.5rem] bg-slate-50 p-4 border border-slate-100 md:col-span-2">
              <p className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-1">Feedback</p>
              <p className="text-sm text-slate-700 leading-relaxed">{detail.feedback}</p>
            </div>
          )}

          {detail.strengths.length > 0 && !mistakesOnly && (
            <div className="rounded-[1.5rem] bg-emerald-50/20 border border-emerald-100 p-4">
              <p className="text-xs font-bold uppercase tracking-wider text-emerald-700 mb-2">Strengths</p>
              <ul className="list-disc pl-4 text-xs text-emerald-800 space-y-1">
                {detail.strengths.map((item, idx) => (
                  <li key={idx} className="leading-relaxed">{item}</li>
                ))}
              </ul>
            </div>
          )}

          {detail.missingPoints.length > 0 && (
            <div className="rounded-[1.5rem] bg-rose-50/20 border border-rose-100 p-4">
              <p className="text-xs font-bold uppercase tracking-wider text-rose-700 mb-2">Missing Points</p>
              <ul className="list-disc pl-4 text-xs text-rose-800 space-y-1">
                {detail.missingPoints.map((item, idx) => (
                  <li key={idx} className="leading-relaxed">{item}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
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
