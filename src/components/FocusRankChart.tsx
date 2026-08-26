"use client";

import type { Task } from "@/types";

type Props = {
  tasks: Task[];
  hideContainer?: boolean;
};

function formatDuration(minutes: number) {
  if (minutes < 60) return `${minutes}min`;
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return rest === 0 ? `${hours}h` : `${hours}h${rest}`;
}

export function FocusRankChart({ tasks, hideContainer = false }: Props) {
  const ranked = tasks
    .filter((t) => (t.focusedMinutes ?? 0) > 0)
    .sort((a, b) => (b.focusedMinutes ?? 0) - (a.focusedMinutes ?? 0))
    .slice(0, 8);

  if (ranked.length === 0) {
    return null;
  }

  const max = ranked[0].focusedMinutes ?? 0;

  const content = (
    <>
      {!hideContainer && (
        <div className="mb-4 flex items-center gap-2">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-accent" aria-hidden="true">
            <line x1="18" y1="20" x2="18" y2="10"/>
            <line x1="12" y1="20" x2="12" y2="4"/>
            <line x1="6" y1="20" x2="6" y2="14"/>
          </svg>
          <h3 className="text-sm font-semibold">Ranking de Foco</h3>
          <span className="ml-auto text-xs text-muted">minutos acumulados</span>
        </div>
      )}

      <ol className="space-y-3">
        {ranked.map((task, i) => {
          const minutes = task.focusedMinutes ?? 0;
          const isTop = i === 0;
          // Piso de 3% para que tarefas curtas continuem visíveis ao lado da maior
          const width = Math.max(3, (minutes / max) * 100);

          return (
            <li key={task.id}>
              <div className="mb-1.5 flex items-baseline gap-3">
                <span
                  className="min-w-0 flex-1 truncate text-sm"
                  title={task.title}
                >
                  {task.title}
                </span>
                <span
                  className={`shrink-0 text-xs tabular-nums ${
                    isTop ? "font-semibold text-accent" : "text-muted"
                  }`}
                >
                  {formatDuration(minutes)}
                </span>
              </div>
              <div className="h-2 w-full overflow-hidden rounded-full bg-border">
                <div
                  className="h-full rounded-full bg-accent"
                  style={{ width: `${width}%`, opacity: isTop ? 1 : 0.45 }}
                />
              </div>
            </li>
          );
        })}
      </ol>
    </>
  );

  if (hideContainer) {
    return <div className="w-full">{content}</div>;
  }

  return (
    <div className="rounded-[var(--radius-lg)] bg-card p-4 shadow-[var(--shadow)]">
      {content}
    </div>
  );
}
