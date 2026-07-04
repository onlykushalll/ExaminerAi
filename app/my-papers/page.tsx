'use client';

import { useEffect, useState } from "react";
import Link from "next/link";
import { AppShell } from "@/components/app-shell";
import { PageHeader } from "@/components/page-header";
import { SavedTestCard } from "@/components/saved-test-card";
import type { SavedTest } from "@/lib/types";

export default function MyPapersPage() {
  const [papers, setPapers] = useState<SavedTest[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const raw = localStorage.getItem('examiner-ai-saved-papers');
    if (raw) {
      try {
        setPapers(JSON.parse(raw));
      } catch {
        setPapers([]);
      }
    } else {
      setPapers([]);
    }
    setLoading(false);
  }, []);

  return (
    <AppShell currentPath="/my-papers">
      <PageHeader
        eyebrow="My Papers"
        title="All saved tests in one place."
        description="Open your saved papers, check their status, and keep the library simple."
      />
      
      {loading ? (
        <div className="flex justify-center py-12">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-slate-200 border-t-accent" />
        </div>
      ) : papers.length === 0 ? (
        <div className="card-surface rounded-[2rem] p-12 text-center max-w-xl mx-auto mt-8">
          <div className="text-4xl mb-4">📚</div>
          <h3 className="text-lg font-semibold text-ink">No saved papers found</h3>
          <p className="mt-2 text-sm text-slate-500">
            You haven&apos;t uploaded or practiced any papers yet.
          </p>
          <div className="mt-6">
            <Link href="/" className="inline-flex rounded-full bg-ink px-6 py-3 text-sm font-medium text-white transition hover:bg-slate-800">
              Go to PDF Parser
            </Link>
          </div>
        </div>
      ) : (
        <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
          {papers.map((test) => (
            <SavedTestCard key={test.id} test={test} />
          ))}
        </div>
      )}
    </AppShell>
  );
}
