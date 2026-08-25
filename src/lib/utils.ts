import type { AppData } from "@/types";

export function getTodayKey(): string {
  return new Date().toISOString().slice(0, 10);
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

export function resetDailyStats(data: AppData): AppData {
  const today = getTodayKey();
  if (data.lastActiveDate === today) return data;
  return {
    ...data,
    focusMinutesToday: 0,
    lastActiveDate: today,
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
