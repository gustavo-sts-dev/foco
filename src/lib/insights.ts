import type { Task } from "@/types";

export function remainingPlannedMinutes(tasks: Task[]): number {
  return tasks
    .filter((task) => !task.completed)
    .reduce((total, task) => {
      const remaining = task.minutes - (task.focusedMinutes ?? 0);
      return total + Math.max(0, remaining);
    }, 0);
}

export const MIN_ESTIMATE_SAMPLE = 5;

export function estimateAccuracy(
  tasks: Task[]
): { ratio: number; sample: number } | null {
  // Tarefas pendentes ainda vão acumular tempo, então não representam uma
  // estimativa "fechada" — só tarefas concluídas entram na amostra.
  const qualifying = tasks.filter(
    (task) =>
      task.completed && task.minutes > 0 && (task.focusedMinutes ?? 0) > 0
  );

  if (qualifying.length < MIN_ESTIMATE_SAMPLE) return null;

  const totalMinutes = qualifying.reduce((sum, task) => sum + task.minutes, 0);
  const totalFocused = qualifying.reduce(
    (sum, task) => sum + (task.focusedMinutes ?? 0),
    0
  );

  return { ratio: totalFocused / totalMinutes, sample: qualifying.length };
}

export function describeEstimateAccuracy(
  accuracy: { ratio: number; sample: number } | null
): string | null {
  if (accuracy === null) return null;

  const { ratio } = accuracy;

  if (ratio >= 0.9 && ratio <= 1.1) {
    return "Suas estimativas estão batendo com a realidade";
  }

  if (ratio > 1.1) {
    const pct = Math.round((ratio - 1) * 100);
    return `Você leva ~${pct}% mais tempo do que planeja`;
  }

  const pct = Math.round((1 - ratio) * 100);
  return `Você leva ~${pct}% menos tempo do que planeja`;
}

const MS_PER_DAY = 24 * 60 * 60 * 1000;

// Constrói a data em UTC a partir de "YYYY-MM-DD" para que a aritmética de dias
// não sofra deslocamento por fuso horário nem por horário de verão.
function parseDateUTC(dateKey: string): number {
  return new Date(`${dateKey}T00:00:00Z`).getTime();
}

function toDateKey(timestamp: number): string {
  return new Date(timestamp).toISOString().slice(0, 10);
}

export function shiftDate(date: string, deltaDays: number): string {
  return toDateKey(parseDateUTC(date) + deltaDays * MS_PER_DAY);
}

export function focusStreak(
  dailyMinutes: Record<string, number>,
  today: string
): number {
  const hasFocus = (dateKey: string) => (dailyMinutes[dateKey] ?? 0) > 0;

  const yesterday = shiftDate(today, -1);

  // Se nem hoje nem ontem tiverem foco, o streak está quebrado.
  if (!hasFocus(today) && !hasFocus(yesterday)) return 0;

  // Se hoje ainda não teve foco (o dia não terminou) mas ontem teve, a
  // contagem começa a partir de ontem sem quebrar o streak.
  const start = hasFocus(today) ? today : yesterday;

  let streak = 0;
  let cursor = start;
  while (hasFocus(cursor)) {
    streak += 1;
    cursor = shiftDate(cursor, -1);
  }

  return streak;
}
