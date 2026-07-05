import { cn } from "@/lib/utils";

type StatCardProps = {
  label: string;
  value: string;
  caption: string;
  tone?: "default" | "accent" | "teal";
};

export function StatCard({ label, value, caption, tone = "default" }: StatCardProps) {
  return (
    <div
      className={cn(
        "rounded-3xl border p-5",
        tone === "accent" && "border-orange-200 bg-orange-50",
        tone === "teal" && "border-teal-200 bg-teal-50",
        tone === "default" && "border-slate-200 bg-white"
      )}
    >
      <p className="text-sm text-slate-500">{label}</p>
      <p className="mt-3 text-3xl font-semibold text-ink">{value}</p>
      <p className="mt-2 text-sm text-slate-500">{caption}</p>
    </div>
  );
}
