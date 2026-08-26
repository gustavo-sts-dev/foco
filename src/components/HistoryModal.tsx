"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { FocusRankChart } from "./FocusRankChart";
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

  // Aggregate tasks from the last 7 days
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const sevenDaysAgo = new Date(today);
  sevenDaysAgo.setDate(today.getDate() - 7);
  const cutoffDate = sevenDaysAgo.toISOString().slice(0, 10);

  const recentTasks = tasks.filter((t) => {
    const taskDate = t.date || t.createdAt.slice(0, 10);
    return taskDate >= cutoffDate;
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

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-0">
      <div
        className="fixed inset-0 bg-background/80 backdrop-blur-sm"
        onClick={onClose}
      />
      
      <div className="relative w-full max-w-lg overflow-hidden rounded-[var(--radius-lg)] bg-card shadow-lg animate-in fade-in zoom-in-95 p-6">
        <div className="mb-4 flex items-center justify-between">
          <div>
            <h2 className="text-xl font-semibold tracking-tight">Histórico (Últimos 7 dias)</h2>
            <p className="text-sm text-muted">Tempo total focado por tarefa</p>
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

        <div>
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
