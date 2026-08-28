"use client";

import { useState } from "react";
import type { DayBucket } from "@/lib/insights";
import { formatMinutes } from "@/lib/utils";

type Props = {
  days: DayBucket[];
  today: string;
};

// Meio-dia local, sem "Z": o parse fica no fuso do usuário (não UTC) e o
// meio-dia evita qualquer virada de dia por horário de verão.
function toLocalDate(date: string): Date {
  return new Date(`${date}T12:00:00`);
}

function weekdayAbbrev(date: string): string {
  return new Intl.DateTimeFormat("pt-BR", { weekday: "short" })
    .format(toLocalDate(date))
    .replace(".", "");
}

function dayNumber(date: string): number {
  return toLocalDate(date).getDate();
}

function fullDateLabel(date: string): string {
  return new Intl.DateTimeFormat("pt-BR", {
    weekday: "long",
    day: "numeric",
    month: "long",
  }).format(toLocalDate(date));
}

export function WeekCalendar({ days, today }: Props) {
  const [selectedDate, setSelectedDate] = useState(today);

  const maxFocusedMinutes = Math.max(0, ...days.map((d) => d.focusedMinutes));
  const selected =
    days.find((d) => d.date === selectedDate) ?? days[days.length - 1];

  return (
    <div>
      <div className="flex gap-1">
        {days.map((day) => {
          const isSelected = day.date === selectedDate;
          const isToday = day.date === today;
          const width =
            maxFocusedMinutes === 0
              ? 0
              : (day.focusedMinutes / maxFocusedMinutes) * 100;

          return (
            <button
              key={day.date}
              type="button"
              aria-pressed={isSelected}
              onClick={() => setSelectedDate(day.date)}
              className={`min-w-0 flex-1 rounded-[var(--radius)] py-2 text-center transition-colors ${
                isSelected
                  ? "bg-accent text-white"
                  : "text-foreground hover:bg-muted-bg"
              }`}
            >
              <div className="text-[10px] uppercase tracking-wide">
                {isToday ? "hoje" : weekdayAbbrev(day.date)}
              </div>
              <div className="text-sm font-semibold tabular-nums">
                {dayNumber(day.date)}
              </div>
              {/* Dentro da célula selecionada o fundo já é accent, então a barra
                  precisa virar branca para continuar visível */}
              <div
                className={`mt-1.5 h-1 w-full overflow-hidden rounded-full ${
                  isSelected ? "bg-white/30" : "bg-border"
                }`}
              >
                <div
                  className={`h-full rounded-full ${
                    isSelected ? "bg-white" : "bg-accent"
                  }`}
                  style={{ width: `${width}%` }}
                />
              </div>
            </button>
          );
        })}
      </div>

      <div className="mt-4">
        <div className="mb-2 flex items-baseline justify-between gap-2">
          <span className="text-sm font-medium">
            {fullDateLabel(selected.date)}
          </span>
          <span className="shrink-0 text-xs tabular-nums text-muted">
            {formatMinutes(selected.focusedMinutes)}
          </span>
        </div>

        {selected.tasks.length === 0 ? (
          <p className="text-sm text-muted">Nenhuma tarefa neste dia.</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {selected.tasks.map((task) => {
              const focusedMinutes = task.focusedMinutes ?? 0;

              return (
                <li key={task.id} className="flex items-center gap-2">
                  <span
                    aria-hidden="true"
                    className={`flex h-4 w-4 shrink-0 items-center justify-center rounded-full border-2 ${
                      task.completed
                        ? "border-success bg-success text-white"
                        : "border-border"
                    }`}
                  >
                    {task.completed && <CheckIcon />}
                  </span>
                  <span className="min-w-0 flex-1 truncate text-sm">
                    {task.title}
                  </span>
                  <span className="shrink-0 text-xs tabular-nums text-muted">
                    {focusedMinutes > 0
                      ? `${focusedMinutes}/${task.minutes} min`
                      : `${task.minutes} min`}
                  </span>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}

function CheckIcon() {
  return (
    <svg width="10" height="10" viewBox="0 0 12 12" fill="none" aria-hidden="true">
      <path
        d="M2 6l3 3 5-5"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
