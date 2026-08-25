export type Task = {
  id: string;
  title: string;
  completed: boolean;
  createdAt: number;
};

export type SessionType = "focus" | "break";

export type TimerState = {
  sessionType: SessionType;
  secondsLeft: number;
  isRunning: boolean;
  focusMinutesToday: number;
};

export const FOCUS_DURATION = 25 * 60;
export const BREAK_DURATION = 5 * 60;

export const SESSION_LABELS: Record<SessionType, string> = {
  focus: "Foco",
  break: "Pausa",
};
