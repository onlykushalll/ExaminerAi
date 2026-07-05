import { cn } from "@/lib/utils";

type QuestionPaletteProps = {
  currentQuestionId: string;
  questionIds: string[];
  answeredQuestionIds: string[];
  markedQuestionIds?: string[];
  onSelect: (questionId: string) => void;
};

export function QuestionPalette({
  currentQuestionId,
  questionIds,
  answeredQuestionIds,
  markedQuestionIds = [],
  onSelect
}: QuestionPaletteProps) {
  return (
    <div className="grid grid-cols-4 gap-2 sm:grid-cols-5">
      {questionIds.map((questionId, index) => {
        const isAnswered = answeredQuestionIds.includes(questionId);
        const isMarked = markedQuestionIds.includes(questionId);
        const isActive = currentQuestionId === questionId;

        return (
          <button
            key={questionId}
            type="button"
            onClick={() => onSelect(questionId)}
            className={cn(
              "rounded-2xl border px-3 py-3 text-sm font-medium transition",
              isActive && "border-ink bg-ink text-white",
              !isActive && isMarked && "border-amber-200 bg-amber-50 text-amber-700",
              !isActive && isAnswered && "border-teal-200 bg-teal-50 text-teal-700",
              !isActive && !isAnswered && !isMarked && "border-slate-200 bg-white text-slate-500"
            )}
          >
            Q{index + 1}
          </button>
        );
      })}
    </div>
  );
}
