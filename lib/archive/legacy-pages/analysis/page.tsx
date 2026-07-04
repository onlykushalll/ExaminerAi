import Link from "next/link";
import { CheckCircle2, LoaderCircle, ScanSearch, Sparkles } from "lucide-react";

import { AppShell } from "@/components/app-shell";
import { ExamStructurePanel } from "@/components/exam-structure-panel";
import { PageHeader } from "@/components/page-header";
import { SectionCard } from "@/components/section-card";
import { extractedExam } from "@/lib/mock-data";

const steps = [
  { icon: ScanSearch, label: "OCR + layout detection", status: "Completed" },
  { icon: LoaderCircle, label: "Question segmentation", status: "Completed" },
  { icon: Sparkles, label: "Schema normalization", status: "Completed" },
  { icon: CheckCircle2, label: "Answer-key linkage", status: "Completed" }
];

export default function AnalysisPage() {
  return (
    <AppShell currentPath="/analysis">
      <PageHeader
        eyebrow="Step 2"
        title="Paper analysis is complete and ready for review."
        description={`The parser identified ${extractedExam.sections.length} sections, ${extractedExam.totalMarks} total marks, and a ${extractedExam.durationMinutes}-minute duration from the uploaded paper.`}
        action={
          <Link href="/paper-review" className="inline-flex rounded-full bg-ink px-5 py-3 text-sm text-white">
            Review paper
          </Link>
        }
      />

      <div className="grid gap-6 xl:grid-cols-[0.9fr_1.1fr]">
        <SectionCard title="Analysis pipeline" description="Static mock state until extraction jobs are wired in.">
          <div className="space-y-4">
            {steps.map((step) => {
              const Icon = step.icon;
              return (
                <div key={step.label} className="flex items-center gap-4 rounded-2xl border border-slate-200 bg-slate-50 p-4">
                  <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white text-accent">
                    <Icon className="h-5 w-5" />
                  </div>
                  <div>
                    <p className="text-sm text-slate-500">{step.status}</p>
                    <p className="text-base font-medium text-ink">{step.label}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </SectionCard>

        <SectionCard title="Detected exam structure" description="Summary generated from the extracted JSON model.">
          <ExamStructurePanel />
        </SectionCard>
      </div>
    </AppShell>
  );
}
