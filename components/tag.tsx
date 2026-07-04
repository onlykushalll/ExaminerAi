import { ReactNode } from "react";

import { cn } from "@/lib/utils";

type TagProps = {
  children: ReactNode;
  tone?: "default" | "accent" | "teal";
};

export function Tag({ children, tone = "default" }: TagProps) {
  return (
    <span
      className={cn(
        "inline-flex rounded-full px-3 py-1 text-xs font-medium",
        tone === "default" && "bg-slate-100 text-slate-600",
        tone === "accent" && "bg-orange-100 text-orange-700",
        tone === "teal" && "bg-teal-100 text-teal-700"
      )}
    >
      {children}
    </span>
  );
}
