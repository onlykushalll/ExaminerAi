"use client";

import { FileText, Plus, Trash2 } from "lucide-react";
import { ChangeEvent, useEffect, useRef } from "react";

import { SectionCard } from "@/components/section-card";
import { cn } from "@/lib/utils";

export type UploadSlotId = "questionPaper" | "answerKey";

type UploadSlotConfig = {
  id: UploadSlotId;
  label: string;
  required: boolean;
};

export type SelectedFiles = Record<UploadSlotId, File | null>;

const uploadSlots: UploadSlotConfig[] = [
  { id: "questionPaper", label: "Question Paper", required: true },
  { id: "answerKey", label: "Answer Key", required: false }
];

type HomeDashboardProps = {
  files: SelectedFiles;
  onFileChange: (slotId: UploadSlotId, file: File | null) => void;
  onRemoveFile: (slotId: UploadSlotId) => void;
  onCreateTest: () => void;
  isSubmitting?: boolean;
  errorMessage?: string | null;
};

export function HomeDashboard({
  files,
  onFileChange,
  onRemoveFile,
  onCreateTest,
  isSubmitting = false,
  errorMessage = null
}: HomeDashboardProps) {
  const inputRefs = useRef<Record<UploadSlotId, HTMLInputElement | null>>({
    questionPaper: null,
    answerKey: null
  });

  const canCreateTest = Boolean(files.questionPaper);

  useEffect(() => {
    uploadSlots.forEach((slot) => {
      const input = inputRefs.current[slot.id];
      if (!files[slot.id] && input) {
        input.value = "";
      }
    });
  }, [files]);

  function handleInputChange(slotId: UploadSlotId, event: ChangeEvent<HTMLInputElement>) {
    onFileChange(slotId, event.target.files?.[0] ?? null);
  }

  return (
    <div className="grid gap-6">
      <SectionCard
        title="Upload Files"
        description="Select the required question paper and optional answer key to generate a test."
      >
        <div className="grid gap-4 md:grid-cols-2">
          {uploadSlots.map((slot) => {
            const file = files[slot.id];

            return (
              <div key={slot.id} className="rounded-[1.5rem] border border-slate-200 bg-slate-50 p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold text-ink">{slot.label}</p>
                    <p className="mt-1 text-xs text-slate-500">{slot.required ? "Required" : "Optional"}</p>
                  </div>
                  <span
                    className={cn(
                      "rounded-full px-2.5 py-1 text-xs font-medium",
                      file ? "bg-emerald-100 text-emerald-700" : "bg-slate-200 text-slate-600"
                    )}
                  >
                    {file ? "Selected" : "Empty"}
                  </span>
                </div>

                <div className="mt-4 flex min-h-28 flex-col justify-between rounded-[1.25rem] border border-dashed border-slate-300 bg-white p-4">
                  <div className="flex items-start gap-3">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-slate-100 text-slate-600">
                      <FileText className="h-4 w-4" />
                    </div>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-ink">
                        {file ? file.name : "No file selected"}
                      </p>
                      <p className="mt-1 text-xs text-slate-500">
                        {file ? `${(file.size / 1024 / 1024).toFixed(2)} MB` : "PDF, TXT, MD, Image"}
                      </p>
                    </div>
                  </div>

                  <div className="mt-4 flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => inputRefs.current[slot.id]?.click()}
                      className="inline-flex items-center rounded-full bg-ink px-3 py-2 text-xs font-medium text-white"
                    >
                      {file ? "Replace" : "Select file"}
                    </button>
                    {file ? (
                      <button
                        type="button"
                        onClick={() => onRemoveFile(slot.id)}
                        className="inline-flex items-center gap-1 rounded-full bg-slate-200 px-3 py-2 text-xs font-medium text-slate-700"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                        Remove
                      </button>
                    ) : null}
                  </div>
                </div>

                <input
                  ref={(node) => {
                    inputRefs.current[slot.id] = node;
                  }}
                  type="file"
                  accept=".pdf,application/pdf,.txt,text/plain,.md,text/markdown,image/*"
                  className="hidden"
                  onChange={(event) => handleInputChange(slot.id, event)}
                />
              </div>
            );
          })}
        </div>

        <div className="mt-6 flex flex-col gap-3 border-t border-slate-200 pt-6 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm text-slate-500">Create Test is enabled after selecting a Question Paper.</p>
            {errorMessage ? <p className="mt-2 text-sm text-red-600">{errorMessage}</p> : null}
          </div>
          <button
            type="button"
            onClick={onCreateTest}
            disabled={!canCreateTest || isSubmitting}
            className={cn(
              "inline-flex items-center justify-center gap-2 rounded-full px-5 py-3 text-sm font-medium transition",
              canCreateTest && !isSubmitting
                ? "bg-ink text-white"
                : "cursor-not-allowed bg-slate-200 text-slate-500"
            )}
          >
            <Plus className="h-4 w-4" />
            {isSubmitting ? "Extracting..." : "Create Test"}
          </button>
        </div>
      </SectionCard>
    </div>
  );
}
