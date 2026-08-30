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

export type TabType = "foco" | "cronometro" | "agenda" | "notas";

/** Pasta de notas. parentId nulo = pasta na raiz. */
export type NoteFolder = {
  id: string;
  name: string;
  parentId: string | null;
  order: number;
  createdAt: string;
  updatedAt: string;
};

/** Nota em markdown. folderId nulo = nota solta na raiz. */
export type Note = {
  id: string;
  title: string;
  content: string;
  folderId: string | null;
  pinned: boolean;
  order: number;
  createdAt: string;
  updatedAt: string;
};

export type NotesData = {
  folders: NoteFolder[];
  notes: Note[];
};

export type AppData = {
  tasks: Task[];
  focusMinutesToday: number;
  lastActiveDate: string;
  dailyMinutes: Record<string, number>;
};

export const FOCUS_DURATION = 25;
export const BREAK_DURATION = 5;
export const STORAGE_KEY = "timerday-data";
