"use client";

import Link from "next/link";
import { Library, ScanText, ChevronLeft, ChevronRight } from "lucide-react";
import { ReactNode, useState, useEffect } from "react";

import { cn } from "@/lib/utils";

const navItems = [
  { href: "/", label: "PDF Parser", icon: ScanText },
  { href: "/my-papers", label: "My Papers", icon: Library }
];

type AppShellProps = {
  children: ReactNode;
  currentPath: string;
};

export function AppShell({ children, currentPath }: AppShellProps) {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    const val = localStorage.getItem("examiner-ai-sidebar-collapsed");
    if (val === "true") {
      setIsCollapsed(true);
    }
    setMounted(true);
  }, []);

  const toggleCollapse = () => {
    setIsCollapsed((prev) => {
      const next = !prev;
      localStorage.setItem("examiner-ai-sidebar-collapsed", String(next));
      return next;
    });
  };

  return (
    <div className="min-h-screen">
      {/* Full width container shifting sidebar to the far left */}
      <div className="flex w-full max-w-none gap-6 px-6 py-4">
        <aside
          className={cn(
            "sticky top-4 hidden h-[calc(100vh-2rem)] shrink-0 flex-col rounded-[2rem] border border-white/60 bg-ink py-8 text-white shadow-soft lg:flex transition-all duration-300 justify-between",
            isCollapsed ? "w-20 px-3" : "w-72 px-6"
          )}
        >
          <div className="flex flex-col">
            <div className="flex items-center justify-between">
              {!isCollapsed && (
                <div className="inline-flex rounded-full bg-white/10 px-3 py-1 text-xs uppercase tracking-[0.2em] text-white/70">
                  Examiner.ai
                </div>
              )}
              {isCollapsed && (
                <div className="mx-auto rounded-full bg-white/10 p-1 text-[10px] font-bold uppercase tracking-wider text-white/80">
                  Ex
                </div>
              )}
            </div>

            {!isCollapsed && (
              <div className="mt-4">
                <h1 className="text-xl font-semibold">A simple home for your exam papers.</h1>
                <p className="mt-2 text-xs leading-5 text-white/70">
                  Upload PDFs and move into a clean test flow without extra screens.
                </p>
              </div>
            )}

            <nav className="mt-10 space-y-2">
              {navItems.map((item) => {
                const Icon = item.icon;
                const active = currentPath === item.href;

                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    title={isCollapsed ? item.label : undefined}
                    className={cn(
                      "flex items-center gap-3 rounded-2xl py-3 transition",
                      isCollapsed ? "justify-center px-0" : "px-4",
                      active
                        ? "bg-white text-[#0f172a] font-semibold"
                        : "text-white/72 hover:bg-white/10 hover:text-white"
                    )}
                  >
                    <Icon className="h-5 w-5 shrink-0" />
                    {!isCollapsed && <span className="text-sm">{item.label}</span>}
                  </Link>
                );
              })}
            </nav>
          </div>

          {/* Collapse toggle button at the bottom of the sidebar */}
          <button
            onClick={toggleCollapse}
            className="flex items-center justify-center gap-2 rounded-xl py-2 text-white/60 hover:bg-white/10 hover:text-white transition w-full mt-auto"
          >
            {isCollapsed ? (
              <ChevronRight className="h-5 w-5" />
            ) : (
              <div className="flex items-center gap-2">
                <ChevronLeft className="h-4 w-4" />
                <span className="text-xs font-medium">Collapse Sidebar</span>
              </div>
            )}
          </button>
        </aside>

        <div className="w-full">
          <header className="card-surface sticky top-4 z-20 mb-6 flex items-center justify-between px-5 py-4 lg:hidden">
            <Link href="/" className="text-lg font-semibold">
              Examiner.ai
            </Link>
            <div className="flex gap-2 overflow-x-auto">
              {navItems.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    "rounded-full px-3 py-2 text-xs",
                    currentPath === item.href ? "bg-ink text-white" : "bg-slate-100 text-slate-600"
                  )}
                >
                  {item.label}
                </Link>
              ))}
            </div>
          </header>
          {children}
        </div>
      </div>
    </div>
  );
}
