import { Clock3, FileCheck2, GraduationCap, ListChecks } from "lucide-react";
import { ReactNode } from "react";

import { extractedExam } from "@/lib/mock-data";
import { Tag } from "@/components/tag";

export function ExamStructurePanel() {
  return (
    <div className="grid gap-4 lg:grid-cols-[1.2fr_0.8fr]">
      <div className="rounded-[1.75rem] bg-slate-50 p-5">
        <div className="grid gap-4 sm:grid-cols-2">
          <InfoItem icon={<GraduationCap className="h-4 w-4" />} label="Grade" value={extractedExam.grade} />
          <InfoItem icon={<Clock3 className="h-4 w-4" />} label="Duration" value={`${extractedExam.durationMinutes} mins`} />
          <InfoItem icon={<FileCheck2 className="h-4 w-4" />} label="Total Marks" value={`${extractedExam.totalMarks}`} />
          <InfoItem icon={<ListChecks className="h-4 w-4" />} label="Sections" value={`${extractedExam.sections.length}`} />
        </div>
      </div>
      <div className="rounded-[1.75rem] bg-ink p-5 text-white">
        <p className="text-sm uppercase tracking-[0.2em] text-white/55">Detected board</p>
        <p className="mt-3 text-2xl font-semibold">{extractedExam.board}</p>
        <div className="mt-4 flex flex-wrap gap-2">
          <Tag tone="accent">PDF parsed</Tag>
          <Tag tone="teal">Schema ready</Tag>
        </div>
      </div>
    </div>
  );
}

function InfoItem({
  icon,
  label,
  value
}: {
  icon: ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4">
      <div className="flex items-center gap-2 text-sm text-slate-500">
        {icon}
        {label}
      </div>
      <p className="mt-3 text-xl font-semibold text-ink">{value}</p>
    </div>
  );
}
