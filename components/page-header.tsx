import { ReactNode } from "react";

type PageHeaderProps = {
  eyebrow: string;
  title: string;
  description: string;
  action?: ReactNode;
};

export function PageHeader({ eyebrow, title, description, action }: PageHeaderProps) {
  return (
    <div className="mb-8 flex flex-col gap-5 rounded-[2rem] bg-hero-grid p-1">
      <div className="card-surface flex flex-col gap-4 rounded-[1.85rem] px-6 py-7 sm:px-8">
        <div className="flex flex-col gap-5 md:flex-row md:items-end md:justify-between">
          <div className="max-w-2xl">
            <p className="text-xs font-medium uppercase tracking-[0.24em] text-slate-500">{eyebrow}</p>
            <h2 className="mt-3 text-3xl font-semibold tracking-tight text-balance text-ink sm:text-4xl">
              {title}
            </h2>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-600 sm:text-base">{description}</p>
          </div>
          {action}
        </div>
      </div>
    </div>
  );
}
