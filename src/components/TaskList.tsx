"use client";

import { useState } from "react";
import type { Task } from "@/types";
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
  activeTaskId: string | null;
  onToggle: (id: string) => void;
  onDelete: (id: string) => void;
  onSelect: (id: string | null) => void;
  onReorder?: (activeId: string, overId: string) => void;
  onEdit?: (id: string, updates: Partial<Task>) => void;
  completed?: boolean;
  emptyMessage?: string;
};

export function TaskList({
  tasks,
  activeTaskId,
  onToggle,
  onDelete,
  onSelect,
  onReorder,
  onEdit,
  completed = false,
  emptyMessage,
}: TaskListProps) {
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
              isActive={activeTaskId === task.id}
              completed={completed}
              onToggle={() => onToggle(task.id)}
              onDelete={() => onDelete(task.id)}
              onSelect={() => onSelect(activeTaskId === task.id ? null : task.id)}
              onEdit={
                onEdit
                  ? (updates) => onEdit(task.id, updates)
                  : undefined
              }
            />
          ))}
        </ul>
      </SortableContext>
    </DndContext>
  );
}

type SortableTaskItemProps = {
  task: Task;
  isActive: boolean;
  completed: boolean;
  onToggle: () => void;
  onDelete: () => void;
  onSelect: () => void;
  onEdit?: (updates: Partial<Task>) => void;
};

function SortableTaskItem({
  task,
  isActive,
  completed,
  onToggle,
  onDelete,
  onSelect,
  onEdit,
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

  const [isEditing, setIsEditing] = useState(false);
  const [editTitle, setEditTitle] = useState(task.title);
  const [editMinutes, setEditMinutes] = useState(task.minutes.toString());

  function handleSave() {
    if (onEdit) {
      onEdit({
        title: editTitle.trim() || task.title,
        minutes: parseInt(editMinutes) || task.minutes,
      });
    }
    setIsEditing(false);
  }

  return (
    <li
      ref={setNodeRef}
      style={style}
      className={`group flex items-center gap-3 rounded-[var(--radius-lg)] bg-card p-3 shadow-[var(--shadow)] transition-all ${
        isActive ? "ring-2 ring-accent" : ""
      } ${completed ? "opacity-60" : ""} ${isDragging ? "opacity-50 ring-2 ring-accent" : ""}`}
    >
      {!completed && (
        <button
          type="button"
          className="cursor-grab touch-none p-1 text-muted hover:text-foreground active:cursor-grabbing"
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
        className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full border-2 transition-colors ${
          task.completed
            ? "border-success bg-success text-white"
            : "border-border hover:border-accent"
        }`}
        aria-label={task.completed ? "Desmarcar tarefa" : "Concluir tarefa"}
      >
        {task.completed && <CheckIcon />}
      </button>

      {isEditing ? (
        <div className="flex flex-1 items-center gap-2">
          <input
            type="text"
            value={editTitle}
            onChange={(e) => setEditTitle(e.target.value)}
            className="flex-1 rounded border border-border bg-background px-2 py-1 text-sm focus:border-accent focus:outline-none"
            autoFocus
          />
          <input
            type="number"
            value={editMinutes}
            onChange={(e) => setEditMinutes(e.target.value)}
            className="w-16 rounded border border-border bg-background px-2 py-1 text-sm focus:border-accent focus:outline-none"
            min="1"
          />
          <button
            type="button"
            onClick={handleSave}
            className="rounded bg-accent px-2 py-1 text-xs font-medium text-white hover:bg-accent-hover"
          >
            Salvar
          </button>
          <button
            type="button"
            onClick={() => {
              setIsEditing(false);
              setEditTitle(task.title);
              setEditMinutes(task.minutes.toString());
            }}
            className="rounded bg-muted-bg px-2 py-1 text-xs font-medium text-muted hover:text-foreground"
          >
            Cancelar
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={onSelect}
          className="min-w-0 flex-1 text-left"
        >
          <p
            className={`truncate font-medium ${
              task.completed ? "line-through text-muted" : ""
            }`}
          >
            {task.title}
          </p>
          <p className="mt-0.5 text-xs text-muted">{task.minutes} min</p>
        </button>
      )}

      {!isEditing && !completed && (
        <button
          type="button"
          onClick={onSelect}
          className={`shrink-0 rounded-full px-3 py-1.5 text-xs font-medium transition-colors ${
            isActive
              ? "bg-accent text-white"
              : "bg-accent-muted text-accent opacity-0 group-hover:opacity-100 max-sm:opacity-100"
          }`}
        >
          {isActive ? "Focando" : "Focar"}
        </button>
      )}

      {!isEditing && onEdit && (
        <button
          type="button"
          onClick={() => setIsEditing(true)}
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[var(--radius)] text-muted opacity-0 transition-all hover:bg-muted-bg hover:text-foreground group-hover:opacity-100 max-sm:opacity-100"
          aria-label="Editar tarefa"
        >
          <EditIcon />
        </button>
      )}

      {!isEditing && (
        <button
          type="button"
          onClick={onDelete}
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[var(--radius)] text-muted opacity-0 transition-all hover:bg-danger-muted hover:text-danger group-hover:opacity-100 max-sm:opacity-100"
          aria-label="Excluir tarefa"
        >
          <TrashIcon />
        </button>
      )}
    </li>
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
