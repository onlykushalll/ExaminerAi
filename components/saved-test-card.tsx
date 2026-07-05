'use client';

import { useRouter } from "next/navigation";
import { SavedTest } from "@/lib/types";
import { Tag } from "@/components/tag";

export function SavedTestCard({ test }: { test: SavedTest }) {
  const router = useRouter();

  const handleOpen = () => {
    const rawPaper = localStorage.getItem(`examiner-ai-paper-${test.id}`);
    if (rawPaper) {
      localStorage.setItem('examiner-ai-current-paper', rawPaper);
      router.push('/test');
    } else {
      // Fallback if paper payload is missing
      router.push('/');
    }
  };

  return (
    <div className="card-surface rounded-[2rem] p-6 flex flex-col justify-between h-full">
      <div>
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-sm text-slate-500">{test.subject}</p>
            <h3 className="mt-2 text-xl font-semibold text-ink">{test.title}</h3>
          </div>
          <Tag tone={test.status === "Evaluated" ? "teal" : test.status === "Completed" ? "accent" : "default"}>
            {test.status}
          </Tag>
        </div>
        <div className="mt-6">
          <div className="mb-2 flex items-center justify-between text-sm text-slate-500">
            <span>Progress</span>
            <span>{test.progress}%</span>
          </div>
          <div className="h-2 rounded-full bg-slate-100">
            <div className="h-2 rounded-full bg-ink" style={{ width: `${test.progress}%` }} />
          </div>
        </div>
        <div className="mt-6 flex items-center justify-between text-sm text-slate-500">
          <span>Updated {test.updatedAt}</span>
          <span>{test.score ? `Score ${test.score}%` : "Not evaluated"}</span>
        </div>
      </div>
      <div className="mt-6">
        <button
          onClick={handleOpen}
          className="w-full text-center inline-flex justify-center rounded-full bg-ink px-4 py-3 text-sm font-semibold text-white transition hover:bg-slate-800 cursor-pointer"
          style={{ color: '#ffffff' }}
        >
          Open paper
        </button>
      </div>
    </div>
  );
}
