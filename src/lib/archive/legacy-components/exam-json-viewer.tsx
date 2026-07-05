import { extractedPaperReviewJson } from "@/lib/mock-data";

export function ExamJsonViewer() {
  return (
    <pre className="max-h-[28rem] overflow-auto rounded-[1.75rem] bg-[#0b1120] p-5 text-sm leading-7 text-slate-100">
      <code>{extractedPaperReviewJson}</code>
    </pre>
  );
}
