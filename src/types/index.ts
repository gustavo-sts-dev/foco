export type Task = {
  id: string;
  title: string;
  minutes: number;
  completed: boolean;
  createdAt: string;
  date?: string; // YYYY-MM-DD
  focusedMinutes?: number; // accumulated focus time in minutes
};

export type TimerMode = "focus" | "break";

export type TabType = "foco" | "cronometro" | "agenda";

export type AppData = {
  tasks: Task[];
  focusMinutesToday: number;
  lastActiveDate: string;
  dailyMinutes: Record<string, number>;
};

export const FOCUS_DURATION = 25;
export const BREAK_DURATION = 5;
export const STORAGE_KEY = "timerday-data";
