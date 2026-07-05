import Link from "next/link";
import { FileCheck2, ListTree, ScanText, Timer } from "lucide-react";

import { AppShell } from "@/components/app-shell";
import { ExamJsonViewer } from "@/components/exam-json-viewer";
import { PageHeader } from "@/components/page-header";
import { SectionCard } from "@/components/section-card";
import { Tag } from "@/components/tag";
import { extractedPaperReview } from "@/lib/mock-data";
import { ExtractionLabel } from "@/lib/types";

const summaryItems = [
  {
    label: "Title",
    value: extractedPaperReview.title,
    source: extractedPaperReview.titleLabel,
    icon: ScanText
  },
  {
    label: "Subject",
    value: extractedPaperReview.subject,
    source: extractedPaperReview.subjectLabel,
    icon: FileCheck2
  },
  {
    label: "Class",
    value: extractedPaperReview.className,
    source: extractedPaperReview.classLabel,
    icon: ListTree
  },
  {
    label: "Duration",
    value: `${extractedPaperReview.durationMinutes} mins`,
    source: extractedPaperReview.durationLabel,
    icon: Timer
  }
];

export default function PaperReviewPage() {
  return (
    <AppShell currentPath="/paper-review">
      <PageHeader
        eyebrow="Step 3"
        title="Review the extracted paper before starting the mock test."
        description="This screen is driven by a realistic mock extracted paper JSON. It highlights what was directly detected from the paper and what the parser inferred."
        action={
          <Link href="/test" className="inline-flex rounded-full bg-ink px-5 py-3 text-sm text-white">
            Start Test
          </Link>
        }
      />

      <div className="grid gap-6 xl:grid-cols-[1.15fr_0.85fr]">
        <div className="space-y-6">
          <SectionCard title="Paper summary" description="High-level paper metadata with extraction-source labels.">
            <div className="grid gap-4 md:grid-cols-2">
              {summaryItems.map((item) => {
                const Icon = item.icon;
                return (
                  <div key={item.label} className="rounded-[1.5rem] border border-slate-200 bg-slate-50 p-5">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-white text-accent">
                        <Icon className="h-5 w-5" />
                      </div>
                      <SourceTag source={item.source} />
                    </div>
                    <p className="mt-4 text-sm text-slate-500">{item.label}</p>
                    <p className="mt-2 text-xl font-semibold text-ink">{item.value}</p>
                  </div>
                );
              })}
            </div>

            <div className="mt-5 flex flex-wrap gap-2">
              <span className="rounded-full bg-teal-100 px-3 py-2 text-sm text-teal-700">Detected = found directly in the paper</span>
              <span className="rounded-full bg-amber-100 px-3 py-2 text-sm text-amber-700">Inferred = estimated from layout or context</span>
            </div>

            <div className="mt-5 grid gap-4 md:grid-cols-3">
              <MetaCard
                label="Total marks"
                value={`${extractedPaperReview.totalMarks}`}
                source={extractedPaperReview.totalMarksLabel}
              />
              <MetaCard label="Sections" value={`${extractedPaperReview.sections.length}`} source="detected" />
              <MetaCard label="Question list" value={`${extractedPaperReview.questions.length}`} source="detected" />
            </div>

            <div className="mt-5 rounded-[1.5rem] border border-slate-200 bg-white p-5">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="text-sm text-slate-500">Answer key source</p>
                  <p className="mt-2 text-lg font-semibold text-ink">{extractedPaperReview.answerKeySource}</p>
                </div>
                <SourceTag source={extractedPaperReview.answerKeySourceLabel} />
              </div>
            </div>
          </SectionCard>

          <SectionCard title="Sections" description="Review section grouping before turning the paper into a timed mock test.">
            <div className="space-y-4">
              {extractedPaperReview.sections.map((section) => (
                <div key={section.id} className="rounded-[1.5rem] border border-slate-200 bg-slate-50 p-5">
                  <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="text-lg font-semibold text-ink">{section.title}</h3>
                        <SourceTag source={section.sourceLabel} />
                      </div>
                      <p className="mt-2 text-sm text-slate-500">
                        {section.questionCount} questions - {section.marks} marks
                      </p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {section.instructions.map((instruction) => (
                        <Tag key={instruction}>{instruction}</Tag>
                      ))}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </SectionCard>

          <SectionCard title="Question list" description="Question-level extraction preview with detected vs inferred labels.">
            <div className="space-y-4">
              {extractedPaperReview.questions.map((question) => (
                <div key={question.id} className="rounded-[1.5rem] border border-slate-200 bg-white p-5">
                  <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                    <div className="max-w-3xl">
                      <div className="flex flex-wrap items-center gap-2">
                        <Tag tone="accent">Q{question.number}</Tag>
                        <Tag>{question.type.toUpperCase()}</Tag>
                        <Tag tone="teal">{question.marks} marks</Tag>
                        <SourceTag source={question.sourceLabel} />
                      </div>
                      <p className="mt-4 text-base font-medium leading-7 text-ink">{question.prompt}</p>
                      {question.options?.length ? (
                        <div className="mt-4 grid gap-2 sm:grid-cols-2">
                          {question.options.map((option) => (
                            <div key={option} className="rounded-2xl bg-slate-50 px-4 py-3 text-sm text-slate-600">
                              {option}
                            </div>
                          ))}
                        </div>
                      ) : null}
                    </div>
                    <div className="min-w-56 rounded-2xl bg-slate-50 px-4 py-3 text-sm text-slate-600">
                      <p className="font-medium text-ink">Answer key source</p>
                      <p className="mt-1">{question.answerKeySource}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </SectionCard>
        </div>

        <div className="space-y-6">
          <SectionCard title="Start when ready" description="Once the paper looks correct, generate the timed test experience.">
            <div className="rounded-[1.5rem] bg-gradient-to-br from-orange-50 via-white to-slate-50 p-5">
              <p className="text-sm text-slate-500">Paper ready for test generation</p>
              <p className="mt-2 text-3xl font-semibold text-ink">{extractedPaperReview.questions.length} extracted questions</p>
              <p className="mt-3 text-sm leading-6 text-slate-600">
                Title, subject, class, marks, duration, sections, and answer key source have all been mapped into the review model.
              </p>
              <Link href="/test" className="mt-5 inline-flex rounded-full bg-ink px-5 py-3 text-sm text-white">
                Start Test
              </Link>
            </div>
          </SectionCard>

          <SectionCard title="Extracted paper JSON" description="Sample contract payload for extraction, review, and test generation.">
            <ExamJsonViewer />
          </SectionCard>
        </div>
      </div>
    </AppShell>
  );
}

function SourceTag({ source }: { source: ExtractionLabel }) {
  return (
    <span
      className={`inline-flex rounded-full px-3 py-1 text-xs font-medium ${
        source === "detected" ? "bg-teal-100 text-teal-700" : "bg-amber-100 text-amber-700"
      }`}
    >
      {source === "detected" ? "Detected" : "Inferred"}
    </span>
  );
}

function MetaCard({
  label,
  value,
  source
}: {
  label: string;
  value: string;
  source: ExtractionLabel;
}) {
  return (
    <div className="rounded-[1.5rem] border border-slate-200 bg-slate-50 p-5">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm text-slate-500">{label}</p>
        <SourceTag source={source} />
      </div>
      <p className="mt-3 text-2xl font-semibold text-ink">{value}</p>
    </div>
  );
}
