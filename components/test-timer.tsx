"use client";

import { Play, Pause, TimerReset } from "lucide-react";

import { formatDuration } from "@/lib/utils";

type TestTimerProps = {
  timeRemaining: number;
  isRunning: boolean;
  hasStarted: boolean;
  canStart: boolean;
  hasDetectedDuration: boolean;
  durationMinutes: number;
  customDurationMinutes: number;
  onCustomDurationChange: (minutes: number) => void;
  onStart: () => void;
  onReset: () => void;
};

export function TestTimer({
  timeRemaining,
  isRunning,
  hasStarted,
  canStart,
  hasDetectedDuration,
  durationMinutes,
  customDurationMinutes,
  onCustomDurationChange,
  onStart,
  onReset
}: TestTimerProps) {
  return (
    <div className="rounded-[1.75rem] border border-orange-200 bg-orange-50/50 p-5 shadow-sm">
      <p className="text-sm font-medium text-orange-700">Time remaining</p>
      <p className="mt-2 text-4xl font-bold tracking-tight text-ink">{formatDuration(timeRemaining)}</p>
      <p className="mt-2 text-xs font-semibold uppercase tracking-wider text-slate-500">
        {hasDetectedDuration ? "AI Detected" : "Customly Durated"}
      </p>

      {!hasDetectedDuration ? (
        <div className="mt-4">
          <label className="block text-sm font-medium text-slate-700" htmlFor="custom-duration">
            Custom duration (minutes)
          </label>
          <input
            id="custom-duration"
            type="number"
            min={1}
            step={1}
            value={customDurationMinutes}
            onChange={(event) => onCustomDurationChange(Math.max(1, Number(event.target.value) || 1))}
            disabled={hasStarted}
            className="mt-2 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-ink outline-none disabled:cursor-not-allowed disabled:bg-slate-100"
          />
        </div>
      ) : null}

      <div className="mt-4 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={onStart}
          disabled={!canStart}
          className="inline-flex items-center gap-2 rounded-full bg-ink px-5 py-2.5 text-sm font-medium text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-300"
        >
          {isRunning ? (
            <>
              <Pause className="h-4 w-4" />
              Pause
            </>
          ) : hasStarted ? (
            <>
              <Play className="h-4 w-4" />
              Resume
            </>
          ) : (
            <>
              <Play className="h-4 w-4" />
              Start Test
            </>
          )}
        </button>
        <button
          type="button"
          onClick={onReset}
          className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-5 py-2.5 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
        >
          <TimerReset className="h-4 w-4" />
          Reset
        </button>
      </div>

      <p className="mt-3 text-xs text-slate-500">
        {!canStart ? "No questions detected" : isRunning ? "Timer is running" : hasStarted ? "Timer is paused" : "Timer is ready"}
      </p>
    </div>
  );
}
