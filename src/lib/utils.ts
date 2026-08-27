import type { AppData, Task } from "@/types";

export function getTodayKey(date: Date = new Date()): string {
  // NÃO troque por `date.toISOString().slice(0, 10)`: toISOString() converte
  // para UTC, então das 21h à meia-noite no horário do Brasil (UTC-3) ele
  // devolve o dia seguinte. Precisamos do dia como o usuário o vê, por isso
  // usamos os componentes locais (getFullYear/getMonth/getDate).
  const year = String(date.getFullYear()).padStart(4, "0");
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

// Dia a que a tarefa pertence. Tarefas legadas podem não ter `date`; nesse caso
// derivamos do createdAt, que é um instante UTC — converter com getTodayKey dá o
// dia local, e não a fatia crua da string ISO (que traria o bug de fuso de volta).
export function getTaskDate(task: Pick<Task, "date" | "createdAt">): string {
  return task.date || getTodayKey(new Date(task.createdAt));
}

export function formatMinutes(total: number): string {
  const hours = Math.floor(total / 60);
  const mins = total % 60;
  if (hours === 0) return `${mins}min`;
  if (mins === 0) return `${hours}h`;
  return `${hours}h ${mins}min`;
}

export function formatTimer(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

export function createId(): string {
  return crypto.randomUUID();
}

export function resetDailyStats(
  data: AppData,
  today: string = getTodayKey()
): AppData {
  if (data.lastActiveDate === today) return data;

  const previousDailyMinutes = data.dailyMinutes ?? {};
  const dailyMinutes =
    data.focusMinutesToday > 0
      ? { ...previousDailyMinutes, [data.lastActiveDate]: data.focusMinutesToday }
      : { ...previousDailyMinutes };

  return {
    ...data,
    focusMinutesToday: 0,
    lastActiveDate: today,
    dailyMinutes,
  };
}

export function getGreeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return "Bom dia";
  if (hour < 18) return "Boa tarde";
  return "Boa noite";
}

export function formatDate(): string {
  return new Intl.DateTimeFormat("pt-BR", {
    weekday: "long",
    day: "numeric",
    month: "long",
  }).format(new Date());
}
