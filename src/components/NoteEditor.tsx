"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

import { BottomSheet, SheetAction } from "@/components/BottomSheet";
import { FolderPicker } from "@/components/FolderPicker";
import { MarkdownView } from "@/components/MarkdownView";
import {
  BoldIcon,
  ChecklistIcon,
  CloseIcon,
  CodeIcon,
  DownloadIcon,
  HeadingIcon,
  ItalicIcon,
  LinkIcon,
  ListIcon,
  MoreIcon,
  MoveIcon,
  PdfIcon,
  PinIcon,
  QuoteIcon,
  TrashIcon,
} from "@/components/NoteIcons";
import {
  type EditorState,
  continueList,
  insertCodeBlock,
  insertLink,
  toggleLinePrefix,
  wrapSelection,
} from "@/lib/markdownEditor";
import { downloadMarkdown, printNotesAsPdf } from "@/lib/notePdf";
import { folderPath, noteTitle, slugifyFileName } from "@/lib/notes";
import type { Note, NoteFolder } from "@/types";

type NotePatch = Partial<Pick<Note, "title" | "content" | "folderId" | "pinned">>;

type NoteEditorProps = {
  note: Note;
  folders: NoteFolder[];
  isSaving: boolean;
  onChange: (patch: NotePatch) => void;
  onClose: () => void;
  onDelete: () => void;
};

export function NoteEditor({
  note,
  folders,
  isSaving,
  onChange,
  onClose,
  onDelete,
}: NoteEditorProps) {
  const [mounted, setMounted] = useState(false);
  const [mode, setMode] = useState<"write" | "preview">("write");
  const [menuOpen, setMenuOpen] = useState(false);
  const [moveOpen, setMoveOpen] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [keyboardInset, setKeyboardInset] = useState(0);

  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const titleRef = useRef<HTMLInputElement>(null);
  // Posição do cursor a restaurar depois que o React repintar o textarea.
  const pendingSelection = useRef<[number, number] | null>(null);

  useEffect(() => setMounted(true), []);

  // Nota recém-criada abre com o cursor no título e o teclado já em cima.
  useEffect(() => {
    if (!note.title && !note.content) titleRef.current?.focus();
    // Só na abertura: refocar a cada tecla digitada seria um pesadelo.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [note.id]);

  // A barra de formatação precisa ficar acima do teclado virtual. Nem 100dvh
  // nem env(safe-area) enxergam o teclado; só a visualViewport enxerga.
  useEffect(() => {
    const viewport = window.visualViewport;
    if (!viewport) return;
    function update() {
      const view = window.visualViewport;
      if (!view) return;
      setKeyboardInset(Math.max(0, window.innerHeight - view.height - view.offsetTop));
    }
    viewport.addEventListener("resize", update);
    viewport.addEventListener("scroll", update);
    update();
    return () => {
      viewport.removeEventListener("resize", update);
      viewport.removeEventListener("scroll", update);
    };
  }, []);

  useLayoutEffect(() => {
    const selection = pendingSelection.current;
    const element = textareaRef.current;
    if (!selection || !element) return;
    pendingSelection.current = null;
    element.focus();
    element.setSelectionRange(selection[0], selection[1]);
  });

  function apply(transform: (state: EditorState) => EditorState | null) {
    const element = textareaRef.current;
    if (!element) return;
    const result = transform({
      text: element.value,
      start: element.selectionStart,
      end: element.selectionEnd,
    });
    if (!result) return;
    pendingSelection.current = [result.start, result.end];
    onChange({ content: result.text });
  }

  function handleKeyDown(event: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key !== "Enter" || event.shiftKey) return;
    const element = event.currentTarget;
    const result = continueList({
      text: element.value,
      start: element.selectionStart,
      end: element.selectionEnd,
    });
    if (!result) return;
    event.preventDefault();
    pendingSelection.current = [result.start, result.end];
    onChange({ content: result.text });
  }

  const path = folderPath(folders, note.folderId);
  const pathLabel = path.length > 0 ? path.map((f) => f.name).join(" / ") : "Notas";
  const title = noteTitle(note);
  const words = note.content.trim() ? note.content.trim().split(/\s+/).length : 0;

  function exportPdf() {
    printNotesAsPdf([{ title, content: note.content, path: pathLabel }], slugifyFileName(title));
  }

  if (!mounted) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[60] flex flex-col bg-background"
      style={{ paddingBottom: keyboardInset }}
    >
      <header className="pt-safe flex shrink-0 items-center gap-1 border-b border-border px-2 py-2">
        <button
          type="button"
          onClick={onClose}
          className="flex h-11 w-11 items-center justify-center rounded-full text-muted transition-colors hover:bg-muted-bg hover:text-foreground"
          aria-label="Fechar nota"
        >
          <CloseIcon size={22} />
        </button>

        <div className="min-w-0 flex-1 px-1">
          <p className="truncate text-xs text-muted">{pathLabel}</p>
          <p className="text-xs font-medium text-muted">
            {isSaving ? "Salvando…" : "Salvo"}
            {words > 0 && ` · ${words} palavra${words === 1 ? "" : "s"}`}
          </p>
        </div>

        <div className="flex shrink-0 rounded-full bg-muted-bg p-0.5">
          <button
            type="button"
            onClick={() => setMode("write")}
            className={`min-h-9 rounded-full px-3 text-sm font-medium transition-colors ${
              mode === "write" ? "bg-card text-foreground shadow-[var(--shadow)]" : "text-muted"
            }`}
          >
            Escrever
          </button>
          <button
            type="button"
            onClick={() => setMode("preview")}
            className={`min-h-9 rounded-full px-3 text-sm font-medium transition-colors ${
              mode === "preview" ? "bg-card text-foreground shadow-[var(--shadow)]" : "text-muted"
            }`}
          >
            Ver
          </button>
        </div>

        <button
          type="button"
          onClick={() => setMenuOpen(true)}
          className="flex h-11 w-11 items-center justify-center rounded-full text-muted transition-colors hover:bg-muted-bg hover:text-foreground"
          aria-label="Ações da nota"
        >
          <MoreIcon size={22} />
        </button>
      </header>

      <div className="flex min-h-0 flex-1 flex-col">
        <input
          ref={titleRef}
          value={note.title}
          onChange={(event) => onChange({ title: event.target.value })}
          placeholder="Título da nota"
          maxLength={200}
          className="shrink-0 border-none bg-transparent px-4 pt-4 pb-2 text-xl font-semibold tracking-tight outline-none placeholder:text-muted/60"
        />

        {mode === "write" ? (
          <textarea
            ref={textareaRef}
            value={note.content}
            onChange={(event) => onChange({ content: event.target.value })}
            onKeyDown={handleKeyDown}
            placeholder={"Escreva em markdown…\n\n# Título\n- [ ] tarefa\n**negrito**"}
            spellCheck
            className="min-h-0 flex-1 resize-none border-none bg-transparent px-4 pb-4 text-base leading-relaxed outline-none placeholder:text-muted/50"
          />
        ) : (
          <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-8">
            <MarkdownView content={note.content} emptyMessage="Escreva algo para ver aqui." />
          </div>
        )}
      </div>

      {mode === "write" && (
        <div className="shrink-0 border-t border-border bg-card">
          {/* Barra rolável: cabe em telas estreitas sem espremer os botões. */}
          <div className="flex gap-1 overflow-x-auto px-2 py-1.5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            <ToolButton label="Título" onClick={() => apply((s) => toggleLinePrefix(s, "## "))}>
              <HeadingIcon size={19} />
            </ToolButton>
            <ToolButton label="Negrito" onClick={() => apply((s) => wrapSelection(s, "**", "negrito"))}>
              <BoldIcon size={19} />
            </ToolButton>
            <ToolButton label="Itálico" onClick={() => apply((s) => wrapSelection(s, "*", "itálico"))}>
              <ItalicIcon size={19} />
            </ToolButton>
            <ToolButton label="Lista" onClick={() => apply((s) => toggleLinePrefix(s, "- "))}>
              <ListIcon size={19} />
            </ToolButton>
            <ToolButton
              label="Checklist"
              onClick={() => apply((s) => toggleLinePrefix(s, "- [ ] "))}
            >
              <ChecklistIcon size={19} />
            </ToolButton>
            <ToolButton label="Citação" onClick={() => apply((s) => toggleLinePrefix(s, "> "))}>
              <QuoteIcon size={19} />
            </ToolButton>
            <ToolButton label="Código" onClick={() => apply(insertCodeBlock)}>
              <CodeIcon size={19} />
            </ToolButton>
            <ToolButton label="Link" onClick={() => apply((s) => insertLink(s))}>
              <LinkIcon size={19} />
            </ToolButton>
          </div>
          {keyboardInset === 0 && <div className="pb-safe" />}
        </div>
      )}

      <BottomSheet open={menuOpen} onClose={() => setMenuOpen(false)} title={title}>
        <div className="flex flex-col gap-0.5">
          <SheetAction
            icon={<PinIcon size={19} />}
            label={note.pinned ? "Desafixar" : "Fixar no topo"}
            onClick={() => {
              onChange({ pinned: !note.pinned });
              setMenuOpen(false);
            }}
          />
          <SheetAction
            icon={<MoveIcon size={19} />}
            label="Mover para outra pasta"
            hint={pathLabel}
            onClick={() => {
              setMenuOpen(false);
              setMoveOpen(true);
            }}
          />
          <SheetAction
            icon={<PdfIcon size={19} />}
            label="Exportar em PDF"
            hint="Abre a impressão do navegador"
            onClick={() => {
              setMenuOpen(false);
              exportPdf();
            }}
          />
          <SheetAction
            icon={<DownloadIcon size={19} />}
            label="Baixar em .md"
            onClick={() => {
              setMenuOpen(false);
              downloadMarkdown(title, note.content);
            }}
          />
          <SheetAction
            icon={<TrashIcon size={19} />}
            label="Apagar nota"
            danger
            onClick={() => {
              setMenuOpen(false);
              setConfirmDelete(true);
            }}
          />
        </div>
      </BottomSheet>

      <FolderPicker
        open={moveOpen}
        folders={folders}
        selectedId={note.folderId}
        onSelect={(folderId) => onChange({ folderId })}
        onClose={() => setMoveOpen(false)}
      />

      <BottomSheet
        open={confirmDelete}
        onClose={() => setConfirmDelete(false)}
        title="Apagar esta nota?"
        description="A nota some para sempre — não dá para desfazer."
      >
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => setConfirmDelete(false)}
            className="min-h-12 flex-1 rounded-xl bg-muted-bg font-medium text-foreground"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={() => {
              setConfirmDelete(false);
              onDelete();
            }}
            className="min-h-12 flex-1 rounded-xl bg-danger font-medium text-white"
          >
            Apagar
          </button>
        </div>
      </BottomSheet>
    </div>,
    document.body
  );
}

type ToolButtonProps = {
  label: string;
  onClick: () => void;
  children: React.ReactNode;
};

function ToolButton({ label, onClick, children }: ToolButtonProps) {
  return (
    <button
      type="button"
      // onMouseDown/onTouchStart com preventDefault mantém o foco no textarea:
      // sem isso o teclado do celular fecha a cada toque na barra.
      onMouseDown={(event) => event.preventDefault()}
      onClick={onClick}
      aria-label={label}
      title={label}
      className="flex h-11 min-w-11 shrink-0 items-center justify-center rounded-xl text-muted transition-colors hover:bg-muted-bg hover:text-foreground active:scale-95 active:bg-accent-muted active:text-accent"
    >
      {children}
    </button>
  );
}
