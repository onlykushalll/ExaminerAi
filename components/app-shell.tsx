"use client";

import Link from "next/link";
import { Library, Menu, ScanText, X } from "lucide-react";
import { ReactNode, useEffect, useState } from "react";

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
  const [sidebarOpen, setSidebarOpen] = useState(false);

  // Close sidebar on route change (mobile)
  useEffect(() => {
    setSidebarOpen(false);
  }, [currentPath]);

  // Close sidebar on Escape key
  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === "Escape") setSidebarOpen(false);
    };
    window.addEventListener("keydown", handleEsc);
    return () => window.removeEventListener("keydown", handleEsc);
  }, []);

  // Lock body scroll when sidebar is open (mobile)
  useEffect(() => {
    if (sidebarOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [sidebarOpen]);

  return (
    <div className="min-h-screen">
      <div className="mx-auto flex max-w-[1400px] gap-4 px-3 py-3 sm:px-4 sm:py-4 lg:px-6">
        {/* ── Desktop Sidebar (shifted lefter — reduced gap + padding) ── */}
        <aside
          className={cn(
            "sticky top-4 hidden h-[calc(100vh-2rem)] w-64 shrink-0 flex-col rounded-[2rem] border border-white/60 bg-ink px-5 py-7 text-white shadow-soft lg:flex"
          )}
        >
          <div>
            <div className="inline-flex rounded-full bg-white/10 px-3 py-1 text-xs uppercase tracking-[0.2em] text-white/70">
              Examiner.ai
            </div>
            <h1 className="mt-4 text-xl font-semibold leading-tight">
              A simple home for your exam papers.
            </h1>
            <p className="mt-3 text-sm leading-6 text-white/70">
              Upload PDFs and move into a clean test flow without extra screens.
            </p>
          </div>
          <nav className="mt-8 space-y-2">
            {navItems.map((item) => {
              const Icon = item.icon;
              const active = currentPath === item.href;

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    "flex items-center gap-3 rounded-2xl px-4 py-3 text-sm transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-400",
                    active ? "bg-white text-ink" : "text-white/70 hover:bg-white/10 hover:text-white"
                  )}
                >
                  <Icon className="h-4 w-4 shrink-0" />
                  {item.label}
                </Link>
              );
            })}
          </nav>

          <div className="mt-auto pt-8">
            <p className="text-xs text-white/40">
              v3.1 · AI-powered
            </p>
          </div>
        </aside>

        {/* ── Mobile sidebar overlay ── */}
        {sidebarOpen && (
          <div
            className="fixed inset-0 z-50 lg:hidden"
            style={{ background: "rgba(15, 23, 42, 0.5)" }}
            onClick={() => setSidebarOpen(false)}
            aria-hidden="true"
          />
        )}

        <aside
          className={cn(
            "fixed left-0 top-0 z-50 h-full w-72 shrink-0 flex-col rounded-r-[2rem] bg-ink px-6 py-8 text-white shadow-soft transition-transform duration-300 ease-out lg:hidden",
            sidebarOpen ? "translate-x-0" : "-translate-x-full"
          )}
        >
          <div className="flex items-center justify-between">
            <div className="inline-flex rounded-full bg-white/10 px-3 py-1 text-xs uppercase tracking-[0.2em] text-white/70">
              Examiner.ai
            </div>
            <button
              type="button"
              onClick={() => setSidebarOpen(false)}
              className="rounded-full p-2 text-white/70 hover:bg-white/10 hover:text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-400"
              aria-label="Close sidebar"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          <h1 className="mt-4 text-xl font-semibold leading-tight">
            A simple home for your exam papers.
          </h1>
          <p className="mt-3 text-sm leading-6 text-white/70">
            Upload PDFs and move into a clean test flow without extra screens.
          </p>

          <nav className="mt-8 space-y-2">
            {navItems.map((item) => {
              const Icon = item.icon;
              const active = currentPath === item.href;

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    "flex items-center gap-3 rounded-2xl px-4 py-3 text-sm transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-400",
                    active ? "bg-white text-ink" : "text-white/70 hover:bg-white/10 hover:text-white"
                  )}
                >
                  <Icon className="h-4 w-4 shrink-0" />
                  {item.label}
                </Link>
              );
            })}
          </nav>
        </aside>

        {/* ── Main content area ── */}
        <div className="min-w-0 flex-1">
          {/* Mobile header with hamburger toggle */}
          <header className="card-surface sticky top-4 z-20 mb-4 flex items-center justify-between px-4 py-3 lg:hidden">
            <button
              type="button"
              onClick={() => setSidebarOpen(true)}
              className="rounded-full p-2 text-ink hover:bg-slate-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-500"
              aria-label="Open sidebar"
            >
              <Menu className="h-5 w-5" />
            </button>
            <Link href="/" className="text-base font-semibold">
              Examiner.ai
            </Link>
            <div className="w-9" />
          </header>

          {children}
        </div>
      </div>
    </div>
  );
}
