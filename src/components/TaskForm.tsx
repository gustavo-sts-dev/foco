"use client";

import { FormEvent, useState } from "react";
import { MobileTextInput, MobileStepper } from "./MobileInputs";

type TaskFormProps = {
  onAdd: (title: string, minutes: number) => void;
};

const DURATIONS = [15, 25, 45, 60];

export function TaskForm({ onAdd }: TaskFormProps) {
  const [title, setTitle] = useState("");
  const [minutes, setMinutes] = useState(25);
  const [expanded, setExpanded] = useState(false);
  const [isCustom, setIsCustom] = useState(false);

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const trimmed = title.trim();
    if (!trimmed) return;
    onAdd(trimmed, minutes);
    setTitle("");
    setMinutes(25);
    setExpanded(false);
    setIsCustom(false);
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="rounded-[var(--radius-lg)] bg-card p-4 shadow-[var(--shadow)]"
    >
      <div className="flex gap-2">
        <MobileTextInput
          value={title}
          onChange={setTitle}
          onFocus={() => setExpanded(true)}
          placeholder="O que você vai fazer?"
          maxLength={120}
        />
        <button
          type="submit"
          disabled={!title.trim()}
          className="flex h-11 min-w-11 items-center justify-center rounded-[var(--radius)] bg-accent px-4 font-medium text-white transition-colors hover:bg-accent-hover disabled:opacity-40"
          aria-label="Adicionar tarefa"
        >
          <PlusIcon />
        </button>
      </div>

      {expanded && (
        <div className="mt-3 flex flex-wrap gap-2 items-center">
          <span className="w-full text-xs font-medium text-muted">Estimativa</span>
          {DURATIONS.map((d) => (
            <button
              key={d}
              type="button"
              onClick={() => {
                setMinutes(d);
                setIsCustom(false);
              }}
              className={`min-h-9 rounded-full px-3 text-sm font-medium transition-colors ${
                minutes === d && !isCustom
                  ? "bg-accent text-white"
                  : "bg-muted-bg text-muted hover:text-foreground"
              }`}
            >
              {d} min
            </button>
          ))}
          <button
            type="button"
            onClick={() => setIsCustom(true)}
            className={`min-h-9 rounded-full px-3 text-sm font-medium transition-colors ${
              isCustom
                ? "bg-accent text-white"
                : "bg-muted-bg text-muted hover:text-foreground"
            }`}
          >
            Personalizado
          </button>
          
          {isCustom && (
            <div className="mt-2 w-full">
              <MobileStepper
                value={minutes}
                onChange={setMinutes}
                min={1}
                max={240}
                step={5}
              />
            </div>
          )}
        </div>
      )}
    </form>
  );
}

function PlusIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden="true">
      <path
        d="M10 4v12M4 10h12"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
    </svg>
  );
}
