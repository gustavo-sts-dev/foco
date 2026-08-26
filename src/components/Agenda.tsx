"use client";

import { useState } from "react";
import type { Task } from "@/types";
import { TaskList } from "@/components/TaskList";
import { TaskForm } from "@/components/TaskForm";

type AgendaProps = {
  selectedDate: string;
  onChangeDate: (date: string) => void;
  tasks: Task[];
  onAddTask: (title: string, minutes: number, date: string) => void;
  onToggleTask: (id: string) => void;
  onDeleteTask: (id: string) => void;
  onCloneDay: (sourceDate: string, targetDate: string) => void;
  onReorderTasks: (activeId: string, overId: string) => void;
  onEditTask: (id: string, updates: Partial<Task>) => void;
  recentTaskNames?: string[];
};

export function Agenda({
  selectedDate,
  onChangeDate,
  tasks,
  onAddTask,
  onToggleTask,
  onDeleteTask,
  onCloneDay,
  onReorderTasks,
  onEditTask,
  recentTaskNames = [],
}: AgendaProps) {
  const [cloneDate, setCloneDate] = useState("");

  const pendingTasks = tasks.filter((t) => !t.completed);
  const completedTasks = tasks.filter((t) => t.completed);

  return (
    <section className="flex flex-col gap-6">
      <div className="flex flex-col gap-2 rounded-[var(--radius-lg)] bg-card p-4 shadow-[var(--shadow-md)]">
        <label htmlFor="agenda-date" className="text-sm font-semibold tracking-tight">
          Selecionar Dia
        </label>
        <input
          id="agenda-date"
          type="date"
          value={selectedDate}
          onChange={(e) => onChangeDate(e.target.value)}
          className="rounded-[var(--radius-md)] border border-border bg-background px-3 py-2 text-sm focus:border-accent focus:outline-none"
        />
      </div>

      <div className="flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold tracking-tight">Tarefas do Dia</h2>
          <span className="text-sm text-muted">
            {pendingTasks.length} pendente{pendingTasks.length !== 1 ? "s" : ""}
          </span>
        </div>

        <TaskForm 
          onAdd={(title, min) => onAddTask(title, min, selectedDate)} 
          recentTaskNames={recentTaskNames}
        />

        {/* Sem onStartFocus/onStartStopwatch: os timers rodam so nas tarefas de hoje */}
        <TaskList
          tasks={pendingTasks}
          onToggle={onToggleTask}
          onDelete={onDeleteTask}
          onReorder={onReorderTasks}
          onEdit={onEditTask}
          emptyMessage="Nenhuma tarefa para este dia."
        />

        {completedTasks.length > 0 && (
          <div className="mt-2">
            <p className="mb-3 text-sm font-medium text-muted">
              Concluídas ({completedTasks.length})
            </p>
            <TaskList
              tasks={completedTasks}
              onToggle={onToggleTask}
              onDelete={onDeleteTask}
              onReorder={onReorderTasks}
              onEdit={onEditTask}
              completed
            />
          </div>
        )}
      </div>

      <div className="mt-4 flex flex-col gap-3 rounded-[var(--radius-lg)] bg-card p-4 shadow-[var(--shadow-md)]">
        <h3 className="text-sm font-semibold tracking-tight">Clonar dia anterior</h3>
        <p className="text-xs text-muted">
          Puxa as tarefas de outra data para o dia atual ({selectedDate}), zerando o status de conclusão.
        </p>
        <div className="flex gap-2">
          <input
            type="date"
            value={cloneDate}
            onChange={(e) => setCloneDate(e.target.value)}
            className="flex-1 rounded-[var(--radius-md)] border border-border bg-background px-3 py-2 text-sm focus:border-accent focus:outline-none"
          />
          <button
            type="button"
            disabled={!cloneDate || cloneDate === selectedDate}
            onClick={() => {
              if (cloneDate) onCloneDay(cloneDate, selectedDate);
              setCloneDate("");
            }}
            className="rounded-[var(--radius-md)] bg-accent px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-accent-hover disabled:opacity-50"
          >
            Clonar
          </button>
        </div>
      </div>
    </section>
  );
}
