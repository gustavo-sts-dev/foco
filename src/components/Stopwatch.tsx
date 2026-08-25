"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { formatTimer } from "@/lib/utils";

export function Stopwatch() {
  const [seconds, setSeconds] = useState(0);
  const [running, setRunning] = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const clearTimer = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  }, []);

  const accumulatedRef = useRef<number>(0);
  const startTimeRef = useRef<number | null>(null);

  const resetTimer = useCallback(() => {
    clearTimer();
    setRunning(false);
    setSeconds(0);
    accumulatedRef.current = 0;
  }, [clearTimer]);

  useEffect(() => {
    if (!running) {
      accumulatedRef.current = seconds;
      startTimeRef.current = null;
      return;
    }

    startTimeRef.current = Date.now();

    intervalRef.current = setInterval(() => {
      if (!startTimeRef.current) return;
      const now = Date.now();
      const currentRunSeconds = Math.round((now - startTimeRef.current) / 1000);
      setSeconds(accumulatedRef.current + currentRunSeconds);
    }, 1000);

    return clearTimer;
  }, [running, clearTimer]); // explicitly removed seconds from deps so it doesn't reset the interval

  // A fixed circle without progress, just an infinite spin if running
  return (
    <section className="rounded-[var(--radius-lg)] bg-card p-6 shadow-[var(--shadow-md)] flex flex-col items-center">
      <h2 className="mb-6 text-lg font-semibold tracking-tight">Cronômetro Livre</h2>
      
      <div className="relative mt-4 flex items-center justify-center">
        {running && (
          <div className="absolute inset-0 m-auto h-[200px] w-[200px] rounded-full border-2 border-accent/20 animate-pulse-ring" />
        )}
        <svg
          width="200"
          height="200"
          viewBox="0 0 200 200"
          className={running ? "animate-spin-slow" : ""}
          aria-hidden="true"
        >
          <circle
            cx="100"
            cy="100"
            r="88"
            fill="none"
            stroke="var(--timer-track)"
            strokeWidth="8"
          />
          {running && (
            <circle
              cx="100"
              cy="100"
              r="88"
              fill="none"
              stroke="var(--timer-progress)"
              strokeWidth="8"
              strokeLinecap="round"
              strokeDasharray="138 553" // A quarter of the circumference roughly
              strokeDashoffset="0"
            />
          )}
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="font-mono text-4xl font-bold tabular-nums tracking-tight">
            {formatTimer(seconds)}
          </span>
          <span className="mt-1 text-xs text-muted">
            tempo decorrido
          </span>
        </div>
      </div>

      <div className="mt-8 flex gap-3">
        <button
          type="button"
          onClick={() => setRunning((r) => !r)}
          className="flex h-12 min-w-[120px] items-center justify-center rounded-full bg-accent px-6 font-semibold text-white transition-colors hover:bg-accent-hover"
        >
          {running ? "Pausar" : "Iniciar"}
        </button>
        <button
          type="button"
          onClick={resetTimer}
          className="flex h-12 min-w-[80px] items-center justify-center rounded-full bg-muted-bg px-4 font-medium text-muted transition-colors hover:text-foreground"
        >
          Zerar
        </button>
      </div>
    </section>
  );
}
