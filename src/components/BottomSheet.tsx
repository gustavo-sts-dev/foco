"use client";

import { useEffect, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";

type BottomSheetProps = {
  open: boolean;
  onClose: () => void;
  title?: string;
  description?: string;
  children: ReactNode;
};

/**
 * Painel que sobe pelo rodapé no celular e vira caixa centralizada no desktop.
 * No celular, um menu colado no rodapé fica na zona do polegar — bem mais
 * confortável que um dropdown perto do topo da tela.
 */
export function BottomSheet({ open, onClose, title, description, children }: BottomSheetProps) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  useEffect(() => {
    if (!open) return;
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open || !mounted) return null;

  return createPortal(
    <div className="fixed inset-0 z-[70] flex items-end justify-center sm:items-center sm:p-4">
      <div
        className="absolute inset-0 bg-black/40 backdrop-blur-[2px]"
        onClick={onClose}
        aria-hidden="true"
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className="animate-sheet-up relative flex max-h-[85dvh] w-full max-w-lg flex-col overflow-y-auto rounded-t-2xl border border-border bg-card p-4 shadow-[var(--shadow-md)] sm:rounded-2xl"
      >
        <div className="mx-auto mb-3 h-1 w-10 shrink-0 rounded-full bg-border sm:hidden" />
        {title && <h3 className="text-base font-semibold tracking-tight">{title}</h3>}
        {description && <p className="mt-1 text-sm text-muted">{description}</p>}
        <div className={title || description ? "mt-3" : ""}>{children}</div>
        <div className="pb-safe" />
      </div>
    </div>,
    document.body
  );
}

type SheetActionProps = {
  icon: ReactNode;
  label: string;
  hint?: string;
  onClick: () => void;
  danger?: boolean;
  disabled?: boolean;
};

/** Linha de menu com alvo de toque de 48px. */
export function SheetAction({
  icon,
  label,
  hint,
  onClick,
  danger = false,
  disabled = false,
}: SheetActionProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`flex min-h-12 w-full items-center gap-3 rounded-xl px-3 text-left text-[15px] font-medium transition-colors active:scale-[0.99] disabled:opacity-40 ${
        danger ? "text-danger hover:bg-danger-muted" : "text-foreground hover:bg-muted-bg"
      }`}
    >
      <span className={danger ? "text-danger" : "text-muted"}>{icon}</span>
      <span className="flex-1">
        {label}
        {hint && <span className="block text-xs font-normal text-muted">{hint}</span>}
      </span>
    </button>
  );
}
