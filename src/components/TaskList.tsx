"use client";

import { useState } from "react";
import type { Task } from "@/types";
import { MobileTextInput, MobileStepper } from "./MobileInputs";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import {
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  useSortable,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

type TaskListProps = {
  tasks: Task[];
  /** Tarefa ligada ao timer pomodoro */
  focusTaskId?: string | null;
  /** Tarefa ligada ao cronometro livre */
  stopwatchTaskId?: string | null;
  onToggle: (id: string) => void;
  onDelete: (id: string) => void;
  /** Sem esta prop a lista nao mostra o botao "Focar" */
  onStartFocus?: (id: string) => void;
  /** Sem esta prop a lista nao mostra o botao "Cronometro" */
  onStartStopwatch?: (id: string) => void;
  onReorder?: (activeId: string, overId: string) => void;
  onEdit?: (id: string, updates: Partial<Task>) => void;
  completed?: boolean;
  emptyMessage?: string;
};

export function TaskList({
  tasks,
  focusTaskId = null,
  stopwatchTaskId = null,
  onToggle,
  onDelete,
  onStartFocus,
  onStartStopwatch,
  onReorder,
  onEdit,
  completed = false,
  emptyMessage,
}: TaskListProps) {
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [editMinutes, setEditMinutes] = useState(25);
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 5,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  if (tasks.length === 0 && emptyMessage) {
    return <p className="py-6 text-center text-sm text-muted">{emptyMessage}</p>;
  }

  if (tasks.length === 0) return null;

  function handleDragEnd(event: any) {
    const { active, over } = event;

    if (over && active.id !== over.id) {
      if (onReorder) {
        onReorder(active.id as string, over.id as string);
      }
    }
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragEnd={handleDragEnd}
    >
      <SortableContext
        items={tasks.map((t) => t.id)}
        strategy={verticalListSortingStrategy}
      >
        <ul className="flex flex-col gap-2">
          {tasks.map((task) => (
            <SortableTaskItem
              key={task.id}
              task={task}
              isFocusTask={focusTaskId === task.id}
              isStopwatchTask={stopwatchTaskId === task.id}
              completed={completed}
              onToggle={() => onToggle(task.id)}
              onDelete={() => onDelete(task.id)}
              onStartFocus={
                onStartFocus ? () => onStartFocus(task.id) : undefined
              }
              onStartStopwatch={
                onStartStopwatch ? () => onStartStopwatch(task.id) : undefined
              }
              onEditStart={
                onEdit
                  ? () => {
                      setEditingTask(task);
                      setEditTitle(task.title);
                      setEditMinutes(task.minutes);
                    }
                  : undefined
              }
            />
          ))}
        </ul>
      </SortableContext>

      {editingTask && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 px-4 backdrop-blur-sm">
          <div className="w-full max-w-sm rounded-[var(--radius-lg)] bg-card p-6 shadow-lg border border-border">
            <h3 className="mb-4 text-lg font-semibold">Editar Tarefa</h3>
            <div className="flex flex-col gap-4">
              <div>
                <label className="mb-2 block text-sm font-medium text-muted">Título</label>
                <MobileTextInput
                  value={editTitle}
                  onChange={setEditTitle}
                  placeholder="Nome da tarefa"
                  autoFocus={true}
                  maxLength={120}
                />
              </div>
              <div>
                <label className="mb-2 block text-sm font-medium text-muted">Duração (minutos)</label>
                <MobileStepper
                  value={editMinutes}
                  onChange={setEditMinutes}
                  min={1}
                  max={240}
                  step={5}
                />
              </div>
            </div>
            <div className="mt-6 flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setEditingTask(null)}
                className="rounded-full bg-muted-bg px-4 py-2 text-sm font-medium text-muted hover:text-foreground"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={() => {
                  if (onEdit) {
                    onEdit(editingTask.id, {
                      title: editTitle.trim() || editingTask.title,
                      minutes: editMinutes || editingTask.minutes,
                    });
                  }
                  setEditingTask(null);
                }}
                className="rounded-full bg-accent px-4 py-2 text-sm font-medium text-white hover:bg-accent-hover"
              >
                Salvar
              </button>
            </div>
          </div>
        </div>
      )}
    </DndContext>
  );
}

type SortableTaskItemProps = {
  task: Task;
  isFocusTask: boolean;
  isStopwatchTask: boolean;
  completed: boolean;
  onToggle: () => void;
  onDelete: () => void;
  onStartFocus?: () => void;
  onStartStopwatch?: () => void;
  onEditStart?: () => void;
};

function SortableTaskItem({
  task,
  isFocusTask,
  isStopwatchTask,
  completed,
  onToggle,
  onDelete,
  onStartFocus,
  onStartStopwatch,
  onEditStart,
}: SortableTaskItemProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: task.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 10 : undefined,
    position: isDragging ? ("relative" as const) : undefined,
  };

  const isRunningTask = isFocusTask || isStopwatchTask;
  const focusedMinutes = task.focusedMinutes ?? 0;

  return (
    <li
      ref={setNodeRef}
      style={style}
      className={`group flex flex-col gap-3 rounded-[var(--radius-lg)] bg-card p-4 shadow-[var(--shadow)] transition-all ${
        isRunningTask ? "ring-2 ring-accent" : ""
      } ${completed ? "opacity-60" : ""} ${isDragging ? "opacity-50 ring-2 ring-accent" : ""}`}
    >
      <div className="flex items-start gap-3">
        {!completed && (
          <button
            type="button"
            className="mt-0.5 cursor-grab touch-none p-1 text-muted hover:text-foreground active:cursor-grabbing"
            aria-label="Reordenar tarefa"
            {...attributes}
            {...listeners}
          >
            <DragIcon />
          </button>
        )}

        <button
          type="button"
          onClick={onToggle}
          className={`mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full border-2 transition-colors ${
            task.completed
              ? "border-success bg-success text-white"
              : "border-border hover:border-accent"
          }`}
          aria-label={task.completed ? "Desmarcar tarefa" : "Concluir tarefa"}
        >
          {task.completed && <CheckIcon />}
        </button>

        <p
          className={`min-w-0 flex-1 font-medium break-words leading-snug ${
            task.completed ? "line-through text-muted" : "text-foreground"
          }`}
        >
          {task.title}
        </p>

        <span
          className={`mt-0.5 shrink-0 rounded-md px-2 py-1 text-xs font-semibold ${
            focusedMinutes > task.minutes
              ? "bg-danger-muted text-danger"
              : "bg-muted-bg text-muted"
          }`}
          title={
            focusedMinutes > 0
              ? `${focusedMinutes} min focados de ${task.minutes} planejados`
              : undefined
          }
        >
          {focusedMinutes > 0 ? `${focusedMinutes}/${task.minutes} min` : `${task.minutes} min`}
        </span>
      </div>

      {/* Fora da coluna do texto: alinhada ao checkbox, ganha a largura que faltava */}
      <div
        className={`flex flex-wrap items-center justify-start gap-2 ${
          completed ? "" : "pl-9"
        }`}
      >
        {!completed && onStartFocus && (
          <TimerPill label="Focar" active={isFocusTask} onClick={onStartFocus} />
        )}

        {!completed && onStartStopwatch && (
          <TimerPill
            label="Cronômetro"
            active={isStopwatchTask}
            onClick={onStartStopwatch}
          />
        )}

        {onEditStart && (
          <button
            type="button"
            onClick={onEditStart}
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-muted opacity-0 transition-all hover:bg-muted-bg hover:text-foreground group-hover:opacity-100 max-sm:opacity-100"
            aria-label="Editar tarefa"
          >
            <EditIcon />
          </button>
        )}

        <button
          type="button"
          onClick={onDelete}
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-muted opacity-0 transition-all hover:bg-danger-muted hover:text-danger group-hover:opacity-100 max-sm:opacity-100"
          aria-label="Excluir tarefa"
        >
          <TrashIcon />
        </button>
      </div>
    </li>
  );
}

function TimerPill({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`rounded-full px-3 py-1.5 text-xs font-medium transition-colors ${
        active
          ? "bg-accent text-white"
          : "bg-accent-muted text-accent hover:bg-accent hover:text-white"
      }`}
    >
      {label}
    </button>
  );
}

function CheckIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden="true">
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

function TrashIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <path
        d="M3 4h10M6 4V3h4v1M5 4v8a1 1 0 001 1h4a1 1 0 001-1V4"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function EditIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <path
        d="M11 3a2.828 2.828 0 014 4L7 15H3v-4L11 3z"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function DragIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
      <circle cx="6" cy="4" r="1.5" />
      <circle cx="10" cy="4" r="1.5" />
      <circle cx="6" cy="8" r="1.5" />
      <circle cx="10" cy="8" r="1.5" />
      <circle cx="6" cy="12" r="1.5" />
      <circle cx="10" cy="12" r="1.5" />
    </svg>
  );
}
