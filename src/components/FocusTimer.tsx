"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { formatTimer } from "@/lib/utils";
import type { Task, TimerMode } from "@/types";
import { BREAK_DURATION, FOCUS_DURATION } from "@/types";

type FocusTimerProps = {
  activeTask: Task | null;
  onFocusComplete: (minutes: number) => void;
};

export function FocusTimer({ activeTask, onFocusComplete }: FocusTimerProps) {
  const currentFocusDuration = activeTask ? activeTask.minutes : FOCUS_DURATION;

  const [mode, setMode] = useState<TimerMode>("focus");
  const [secondsLeft, setSecondsLeft] = useState(currentFocusDuration * 60);
  const [running, setRunning] = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const totalSeconds = (mode === "focus" ? currentFocusDuration : BREAK_DURATION) * 60;
  const progress = 1 - secondsLeft / totalSeconds;

  const clearTimer = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  }, []);

  const resetTimer = useCallback(
    (newMode: TimerMode = "focus") => {
      clearTimer();
      setRunning(false);
      setMode(newMode);
      setSecondsLeft(
        (newMode === "focus" ? currentFocusDuration : BREAK_DURATION) * 60
      );
    },
    [clearTimer, currentFocusDuration]
  );

  const endTimeRef = useRef<number | null>(null);

  useEffect(() => {
    if (!running) {
      endTimeRef.current = null;
      return;
    }

    endTimeRef.current = Date.now() + secondsLeft * 1000;

    intervalRef.current = setInterval(() => {
      if (!endTimeRef.current) return;
      
      const now = Date.now();
      const remaining = Math.max(0, Math.round((endTimeRef.current - now) / 1000));
      
      setSecondsLeft(remaining);

      if (remaining <= 0) {
        clearTimer();
        setRunning(false);
      }
    }, 1000);

    return clearTimer;
  }, [running, clearTimer]); // explicitly removed secondsLeft from deps so it doesn't reset the interval

  useEffect(() => {
    if (secondsLeft !== 0 || running) return;

    if (mode === "focus") {
      onFocusComplete(currentFocusDuration);
      resetTimer("break");
    } else {
      resetTimer("focus");
    }
  }, [secondsLeft, running, mode, onFocusComplete, resetTimer]);

  useEffect(() => {
    resetTimer("focus");
  }, [activeTask?.id, resetTimer]);

  const circumference = 2 * Math.PI * 88;
  const strokeDashoffset = circumference * (1 - progress);

  return (
    <section className="rounded-[var(--radius-lg)] bg-card p-6 shadow-[var(--shadow-md)]">
      <div className="flex flex-col items-center">
        <div className="mb-1 flex gap-2">
          <ModePill
            label="Foco"
            active={mode === "focus"}
            onClick={() => resetTimer("focus")}
          />
          <ModePill
            label="Pausa"
            active={mode === "break"}
            onClick={() => resetTimer("break")}
          />
        </div>

        {activeTask && mode === "focus" && (
          <p className="mt-3 max-w-full truncate text-sm font-medium text-accent">
            {activeTask.title}
          </p>
        )}

        <div className="relative mt-4 flex items-center justify-center">
          {running && (
            <div className="absolute inset-0 m-auto h-[200px] w-[200px] rounded-full border-2 border-accent/20 animate-pulse-ring" />
          )}
          <svg
            width="200"
            height="200"
            viewBox="0 0 200 200"
            className="-rotate-90"
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
            <circle
              cx="100"
              cy="100"
              r="88"
              fill="none"
              stroke="var(--timer-progress)"
              strokeWidth="8"
              strokeLinecap="round"
              strokeDasharray={circumference}
              strokeDashoffset={strokeDashoffset}
              className="transition-[stroke-dashoffset] duration-1000 ease-linear"
            />
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className="font-mono text-4xl font-bold tabular-nums tracking-tight">
              {formatTimer(secondsLeft)}
            </span>
            <span className="mt-1 text-xs text-muted">
              {mode === "focus" ? `${currentFocusDuration} min` : `${BREAK_DURATION} min`}
            </span>
          </div>
        </div>

        <div className="mt-6 flex gap-3">
          <button
            type="button"
            onClick={() => setRunning((r) => !r)}
            className="flex h-12 min-w-[120px] items-center justify-center rounded-full bg-accent px-6 font-semibold text-white transition-colors hover:bg-accent-hover"
          >
            {running ? "Pausar" : "Iniciar"}
          </button>
          <button
            type="button"
            onClick={() => {
              const isPaused = !running && secondsLeft < totalSeconds;
              if (isPaused) {
                if (mode === "focus") {
                  const elapsedMinutes = Math.round((totalSeconds - secondsLeft) / 60);
                  if (elapsedMinutes > 0) {
                    onFocusComplete(elapsedMinutes);
                  }
                  resetTimer("break");
                } else {
                  resetTimer("focus");
                }
              } else {
                resetTimer(mode);
              }
            }}
            className="flex h-12 min-w-[80px] items-center justify-center rounded-full bg-muted-bg px-4 font-medium text-muted transition-colors hover:text-foreground"
          >
            {!running && secondsLeft < totalSeconds ? "Finalizar" : "Reset"}
          </button>
        </div>
      </div>
    </section>
  );
}

function ModePill({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-full px-4 py-1.5 text-sm font-medium transition-colors ${
        active
          ? "bg-accent-muted text-accent"
          : "text-muted hover:text-foreground"
      }`}
    >
      {label}
    </button>
  );
}
