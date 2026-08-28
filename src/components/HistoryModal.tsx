"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { FocusRankChart } from "./FocusRankChart";
import { WeekCalendar } from "./WeekCalendar";
import {
  describeEstimateAccuracy,
  estimateAccuracy,
  lastSevenDays,
  shiftDate,
} from "@/lib/insights";
import { getTaskDate, getTodayKey } from "@/lib/utils";
import type { Task } from "@/types";

type Props = {
  isOpen: boolean;
  onClose: () => void;
  tasks: Task[];
};

export function HistoryModal({ isOpen, onClose, tasks }: Props) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!isOpen || !mounted) return null;

  const todayKey = getTodayKey();
  const weekBuckets = lastSevenDays(tasks, todayKey);

  // Aggregate tasks from the last 7 days
  const cutoffDate = shiftDate(todayKey, -6);

  const recentTasks = tasks.filter((t) => {
    return getTaskDate(t) >= cutoffDate;
  });

  const aggregated = recentTasks.reduce((acc, task) => {
    const title = task.title.trim();
    const key = title.toLowerCase();
    if (!acc[key]) {
      acc[key] = {
        id: key,
        title: title, // keep original casing of the first encountered
        focusedMinutes: 0,
      };
    }
    acc[key].focusedMinutes += task.focusedMinutes ?? 0;
    return acc;
  }, {} as Record<string, { id: string; title: string; focusedMinutes: number }>);

  const chartData = Object.values(aggregated) as Task[];

  const accuracyMessage = describeEstimateAccuracy(
    estimateAccuracy(recentTasks)
  );

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-0">
      <div
        className="fixed inset-0 bg-background/80 backdrop-blur-sm"
        onClick={onClose}
      />
      
      <div className="relative w-full max-w-lg max-h-[85dvh] overflow-y-auto rounded-[var(--radius-lg)] bg-card shadow-lg animate-in fade-in zoom-in-95 p-4 sm:p-6">
        <div className="mb-4 flex items-center justify-between">
          <div>
            <h2 className="text-xl font-semibold tracking-tight">Histórico (Últimos 7 dias)</h2>
            <p className="text-sm text-muted">Tempo total focado por tarefa</p>
            {accuracyMessage && (
              <p className="mt-1 text-xs text-muted">{accuracyMessage}</p>
            )}
          </div>
          <button
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-full bg-muted-bg text-muted transition-colors hover:bg-muted hover:text-foreground"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        <WeekCalendar days={weekBuckets} today={todayKey} />

        <div className="mt-4 border-t border-border pt-4">
          {chartData.length > 0 ? (
            <FocusRankChart tasks={chartData} hideContainer />
          ) : (
            <div className="py-8 text-center text-sm text-muted">
              Nenhuma tarefa focada nos últimos 7 dias.
            </div>
          )}
        </div>
      </div>
    </div>,
    document.body
  );
}
