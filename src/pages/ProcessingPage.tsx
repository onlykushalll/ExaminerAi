import { Link } from "react-router-dom";
import { Brain, FileSearch2, Sparkles } from "lucide-react";

import { AppShell } from "@/components/app-shell";
import { PageHeader } from "@/components/page-header";
import { SectionCard } from "@/components/section-card";

const items = [
  { title: "Matching answers to key", icon: FileSearch2 },
  { title: "Running rubric-based Board review", icon: Brain },
  { title: "Generating strengths and gaps", icon: Sparkles }
];

export default function ProcessingPage() {
  return (
    <AppShell currentPath="/results">
      <PageHeader
        eyebrow="Step 5"
        title="Processing submission"
        description="Use this route as the transition state while answer evaluation, rubric scoring, and result synthesis run in the background."
        action={
          <Link to="/results" className="inline-flex rounded-full bg-ink px-5 py-3 text-sm text-white" style={{ color: '#ffffff' }}>
            View results
          </Link>
        }
      />
      <SectionCard title="Evaluation status" description="Replace static rows with job status polling or realtime subscription updates.">
        <div className="space-y-4">
          {items.map((item) => {
            const Icon = item.icon;
            return (
              <div key={item.title} className="flex items-center gap-4 rounded-[1.75rem] border border-slate-200 bg-slate-50 p-5">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white text-accent">
                  <Icon className="h-5 w-5 animate-pulse" />
                </div>
                <div>
                  <p className="text-sm text-slate-500">In progress</p>
                  <p className="text-base font-medium text-ink">{item.title}</p>
                </div>
              </div>
            );
          })}
        </div>
      </SectionCard>
    </AppShell>
  );
}
