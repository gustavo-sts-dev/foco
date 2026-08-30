"use client";

import { useMemo, useState } from "react";

import { BottomSheet, SheetAction } from "@/components/BottomSheet";
import { NoteEditor } from "@/components/NoteEditor";
import {
  ChevronLeftIcon,
  ChevronRightIcon,
  CloseIcon,
  FolderIcon,
  FolderPlusIcon,
  MoreIcon,
  NoteIcon,
  PdfIcon,
  PencilIcon,
  PinIcon,
  PlusIcon,
  SearchIcon,
  TrashIcon,
} from "@/components/NoteIcons";
import { useNotes } from "@/hooks/useNotes";
import { printNotesAsPdf } from "@/lib/notePdf";
import {
  MAX_SUBFOLDERS,
  childFolders,
  descendantFolderIds,
  folderPath,
  formatNoteDate,
  matchesQuery,
  notePreview,
  noteTitle,
  notesInFolder,
  slugifyFileName,
  sortNotes,
  subfolderBlock,
  subfolderBlockMessage,
} from "@/lib/notes";
import type { Note, NoteFolder } from "@/types";

export function Notes() {
  const notes = useNotes();
  const [currentFolderId, setCurrentFolderId] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [searchOpen, setSearchOpen] = useState(false);
  const [openNoteId, setOpenNoteId] = useState<string | null>(null);
  const [newFolderOpen, setNewFolderOpen] = useState(false);
  const [newFolderName, setNewFolderName] = useState("");
  const [menuFolderId, setMenuFolderId] = useState<string | null>(null);
  const [renameId, setRenameId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const [confirmFolderId, setConfirmFolderId] = useState<string | null>(null);

  const path = folderPath(notes.folders, currentFolderId);
  // A pasta pode ter sumido (apagada em outra aba): volta para a raiz em vez
  // de deixar a tela presa num lugar que não existe mais.
  const safeFolderId = currentFolderId && path.length === 0 ? null : currentFolderId;

  const subfolders = childFolders(notes.folders, safeFolderId);
  const folderNotes = notesInFolder(notes.notes, safeFolderId);
  const block = subfolderBlock(notes.folders, safeFolderId);
  const blockMessage = subfolderBlockMessage(block);

  const searchResults = useMemo(() => {
    if (!query.trim()) return [];
    return sortNotes(notes.notes.filter((note) => matchesQuery(note, query)));
  }, [notes.notes, query]);

  const openNote = notes.notes.find((note) => note.id === openNoteId) ?? null;
  const searching = query.trim().length > 0;

  function countLabel(folderId: string) {
    const ids = descendantFolderIds(notes.folders, folderId);
    const noteCount = notes.notes.filter(
      (note) => note.folderId && ids.includes(note.folderId)
    ).length;
    const folderCount = childFolders(notes.folders, folderId).length;
    const parts = [`${noteCount} nota${noteCount === 1 ? "" : "s"}`];
    if (folderCount > 0) parts.push(`${folderCount}/${MAX_SUBFOLDERS} subpastas`);
    return parts.join(" · ");
  }

  function pathLabelOf(note: Note) {
    const trail = folderPath(notes.folders, note.folderId);
    return trail.length > 0 ? trail.map((f) => f.name).join(" / ") : "Notas";
  }

  async function handleCreateNote() {
    const created = await notes.createNote(safeFolderId);
    if (created) setOpenNoteId(created.id);
  }

  async function handleCreateFolder() {
    const name = newFolderName.trim();
    if (!name) return;
    const created = await notes.createFolder(name, safeFolderId);
    setNewFolderName("");
    setNewFolderOpen(false);
    if (created) setCurrentFolderId(created.id);
  }

  /** Exporta a pasta inteira (subpastas incluídas) num único PDF. */
  function exportFolder(folder: NoteFolder) {
    const ids = descendantFolderIds(notes.folders, folder.id);
    const inside = sortNotes(
      notes.notes.filter((note) => note.folderId && ids.includes(note.folderId))
    );
    if (inside.length === 0) return;
    printNotesAsPdf(
      inside.map((note) => ({
        title: noteTitle(note),
        content: note.content,
        path: pathLabelOf(note),
      })),
      slugifyFileName(folder.name)
    );
  }

  const menuFolder = notes.folders.find((f) => f.id === menuFolderId) ?? null;
  const confirmFolder = notes.folders.find((f) => f.id === confirmFolderId) ?? null;

  return (
    <section className="flex flex-col gap-4">
      {notes.error && (
        <div className="flex items-start justify-between gap-2 rounded-xl border border-danger/30 bg-danger-muted px-3 py-2 text-sm text-danger">
          <span>{notes.error}</span>
          <button type="button" onClick={notes.clearError} aria-label="Dispensar aviso">
            <CloseIcon size={16} />
          </button>
        </div>
      )}

      <div className="flex items-center gap-2">
        <h2 className="flex-1 text-lg font-semibold tracking-tight">Notas</h2>
        <button
          type="button"
          onClick={() => {
            setSearchOpen((open) => !open);
            if (searchOpen) setQuery("");
          }}
          className={`flex h-10 w-10 items-center justify-center rounded-full transition-colors ${
            searchOpen ? "bg-accent-muted text-accent" : "text-muted hover:bg-muted-bg"
          }`}
          aria-label="Buscar notas"
        >
          <SearchIcon size={19} />
        </button>
        <button
          type="button"
          onClick={() => setNewFolderOpen(true)}
          disabled={block !== null}
          title={blockMessage ?? "Nova pasta"}
          className="flex h-10 w-10 items-center justify-center rounded-full text-muted transition-colors hover:bg-muted-bg disabled:opacity-35"
          aria-label="Nova pasta"
        >
          <FolderPlusIcon size={19} />
        </button>
      </div>

      {searchOpen && (
        <input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Buscar em todas as notas…"
          autoFocus
          className="min-h-12 w-full rounded-xl border border-border bg-background px-4 text-base outline-none focus:border-accent"
        />
      )}

      {!searching && (
        <Breadcrumb
          path={path}
          onNavigate={setCurrentFolderId}
          onBack={() =>
            setCurrentFolderId(path.length > 1 ? path[path.length - 2].id : null)
          }
        />
      )}

      {!notes.loaded ? (
        <div className="flex justify-center py-12">
          <div className="h-7 w-7 animate-spin rounded-full border-2 border-border border-t-accent" />
        </div>
      ) : searching ? (
        <SearchResults
          results={searchResults}
          pathLabelOf={pathLabelOf}
          onOpen={setOpenNoteId}
        />
      ) : (
        <div className="flex flex-col gap-4">
          {subfolders.length > 0 && (
            <ul className="flex flex-col gap-2">
              {subfolders.map((folder) => (
                <li key={folder.id}>
                  <div className="flex items-center gap-1 rounded-xl bg-card shadow-[var(--shadow)]">
                    <button
                      type="button"
                      onClick={() => setCurrentFolderId(folder.id)}
                      className="flex min-h-14 flex-1 items-center gap-3 rounded-xl px-3 text-left transition-colors active:bg-muted-bg"
                    >
                      <span className="text-accent">
                        <FolderIcon size={20} />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate font-medium">{folder.name}</span>
                        <span className="block text-xs text-muted">{countLabel(folder.id)}</span>
                      </span>
                      <span className="text-muted">
                        <ChevronRightIcon size={18} />
                      </span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setMenuFolderId(folder.id)}
                      className="mr-1 flex h-11 w-9 items-center justify-center rounded-lg text-muted transition-colors hover:bg-muted-bg"
                      aria-label={`Ações da pasta ${folder.name}`}
                    >
                      <MoreIcon size={18} />
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}

          {blockMessage && subfolders.length > 0 && (
            <p className="text-xs text-muted">{blockMessage}</p>
          )}

          {folderNotes.length > 0 ? (
            <ul className="flex flex-col gap-2">
              {folderNotes.map((note) => (
                <li key={note.id}>
                  <NoteCard note={note} onOpen={() => setOpenNoteId(note.id)} />
                </li>
              ))}
            </ul>
          ) : (
            subfolders.length === 0 && <EmptyState onCreate={handleCreateNote} />
          )}
        </div>
      )}

      {/* Botão flutuante: alcance do polegar, acima da barra de abas. */}
      <button
        type="button"
        onClick={handleCreateNote}
        className="fixed bottom-20 right-4 z-40 mb-safe flex h-14 w-14 items-center justify-center rounded-full bg-accent text-white shadow-[var(--shadow-md)] transition-transform active:scale-95 sm:bottom-8"
        aria-label="Nova nota"
      >
        <PlusIcon size={26} />
      </button>

      {openNote && (
        <NoteEditor
          note={openNote}
          folders={notes.folders}
          isSaving={notes.isSaving}
          onChange={(patch) => notes.updateNote(openNote.id, patch)}
          onClose={() => {
            void notes.flushNote(openNote.id);
            setOpenNoteId(null);
          }}
          onDelete={() => {
            void notes.deleteNote(openNote.id);
            setOpenNoteId(null);
          }}
        />
      )}

      <BottomSheet
        open={newFolderOpen}
        onClose={() => setNewFolderOpen(false)}
        title="Nova pasta"
        description={
          path.length > 0 ? `Dentro de ${path[path.length - 1].name}` : "Na raiz das notas"
        }
      >
        <form
          onSubmit={(event) => {
            event.preventDefault();
            void handleCreateFolder();
          }}
          className="flex flex-col gap-3"
        >
          <input
            value={newFolderName}
            onChange={(event) => setNewFolderName(event.target.value)}
            placeholder="Nome da pasta"
            maxLength={60}
            autoFocus
            className="min-h-12 w-full rounded-xl border border-border bg-background px-4 text-base outline-none focus:border-accent"
          />
          <button
            type="submit"
            disabled={!newFolderName.trim()}
            className="min-h-12 rounded-xl bg-accent font-medium text-white transition-colors disabled:opacity-40"
          >
            Criar pasta
          </button>
        </form>
      </BottomSheet>

      <BottomSheet
        open={menuFolder !== null}
        onClose={() => setMenuFolderId(null)}
        title={menuFolder?.name}
      >
        <div className="flex flex-col gap-0.5">
          <SheetAction
            icon={<PencilIcon size={19} />}
            label="Renomear"
            onClick={() => {
              if (!menuFolder) return;
              setRenameValue(menuFolder.name);
              setRenameId(menuFolder.id);
              setMenuFolderId(null);
            }}
          />
          <SheetAction
            icon={<PdfIcon size={19} />}
            label="Exportar pasta em PDF"
            hint="Todas as notas, uma por página"
            onClick={() => {
              if (menuFolder) exportFolder(menuFolder);
              setMenuFolderId(null);
            }}
          />
          <SheetAction
            icon={<TrashIcon size={19} />}
            label="Apagar pasta"
            hint="Apaga subpastas e notas dentro dela"
            danger
            onClick={() => {
              setConfirmFolderId(menuFolderId);
              setMenuFolderId(null);
            }}
          />
        </div>
      </BottomSheet>

      <BottomSheet open={renameId !== null} onClose={() => setRenameId(null)} title="Renomear pasta">
        <form
          onSubmit={(event) => {
            event.preventDefault();
            const name = renameValue.trim();
            if (renameId && name) void notes.renameFolder(renameId, name);
            setRenameId(null);
          }}
          className="flex flex-col gap-3"
        >
          <input
            value={renameValue}
            onChange={(event) => setRenameValue(event.target.value)}
            maxLength={60}
            autoFocus
            className="min-h-12 w-full rounded-xl border border-border bg-background px-4 text-base outline-none focus:border-accent"
          />
          <button
            type="submit"
            disabled={!renameValue.trim()}
            className="min-h-12 rounded-xl bg-accent font-medium text-white disabled:opacity-40"
          >
            Salvar
          </button>
        </form>
      </BottomSheet>

      <BottomSheet
        open={confirmFolder !== null}
        onClose={() => setConfirmFolderId(null)}
        title={`Apagar "${confirmFolder?.name ?? ""}"?`}
        description="As subpastas e todas as notas dentro dela também são apagadas. Não dá para desfazer."
      >
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => setConfirmFolderId(null)}
            className="min-h-12 flex-1 rounded-xl bg-muted-bg font-medium"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={() => {
              if (!confirmFolder) return;
              // Sair de dentro da pasta antes de apagá-la, senão a tela ficaria
              // apontando para uma pasta inexistente.
              if (
                safeFolderId &&
                descendantFolderIds(notes.folders, confirmFolder.id).includes(safeFolderId)
              ) {
                setCurrentFolderId(confirmFolder.parentId);
              }
              void notes.deleteFolder(confirmFolder.id);
              setConfirmFolderId(null);
            }}
            className="min-h-12 flex-1 rounded-xl bg-danger font-medium text-white"
          >
            Apagar
          </button>
        </div>
      </BottomSheet>
    </section>
  );
}

function Breadcrumb({
  path,
  onNavigate,
  onBack,
}: {
  path: NoteFolder[];
  onNavigate: (id: string | null) => void;
  onBack: () => void;
}) {
  if (path.length === 0) return null;

  return (
    <div className="flex items-center gap-1">
      <button
        type="button"
        onClick={onBack}
        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-muted-bg text-muted transition-colors active:scale-95"
        aria-label="Voltar uma pasta"
      >
        <ChevronLeftIcon size={18} />
      </button>
      {/* Trilha rolável: caminhos longos não quebram o layout no celular. */}
      <div className="flex min-w-0 flex-1 items-center gap-1 overflow-x-auto text-sm [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        <button
          type="button"
          onClick={() => onNavigate(null)}
          className="shrink-0 rounded-full px-2 py-1 text-muted transition-colors active:bg-muted-bg"
        >
          Notas
        </button>
        {path.map((folder, index) => (
          <span key={folder.id} className="flex shrink-0 items-center gap-1">
            <span className="text-muted/50">/</span>
            <button
              type="button"
              onClick={() => onNavigate(folder.id)}
              className={`rounded-full px-2 py-1 transition-colors active:bg-muted-bg ${
                index === path.length - 1 ? "font-medium text-foreground" : "text-muted"
              }`}
            >
              {folder.name}
            </button>
          </span>
        ))}
      </div>
    </div>
  );
}

function NoteCard({ note, onOpen }: { note: Note; onOpen: () => void }) {
  const preview = notePreview(note);
  return (
    <button
      type="button"
      onClick={onOpen}
      className="flex w-full flex-col gap-1 rounded-xl bg-card px-3 py-3 text-left shadow-[var(--shadow)] transition-colors active:bg-muted-bg"
    >
      <span className="flex items-center gap-2">
        {note.pinned && (
          <span className="text-accent">
            <PinIcon size={14} />
          </span>
        )}
        <span className="min-w-0 flex-1 truncate font-medium">{noteTitle(note)}</span>
        <span className="shrink-0 text-xs text-muted">{formatNoteDate(note.updatedAt)}</span>
      </span>
      {preview && <span className="line-clamp-2 text-sm text-muted">{preview}</span>}
    </button>
  );
}

function SearchResults({
  results,
  pathLabelOf,
  onOpen,
}: {
  results: Note[];
  pathLabelOf: (note: Note) => string;
  onOpen: (id: string) => void;
}) {
  if (results.length === 0) {
    return <p className="py-10 text-center text-sm text-muted">Nenhuma nota encontrada.</p>;
  }

  return (
    <ul className="flex flex-col gap-2">
      {results.map((note) => (
        <li key={note.id} className="flex flex-col gap-0.5">
          <p className="px-1 text-[11px] uppercase tracking-wide text-muted">
            {pathLabelOf(note)}
          </p>
          <NoteCard note={note} onOpen={() => onOpen(note.id)} />
        </li>
      ))}
    </ul>
  );
}

function EmptyState({ onCreate }: { onCreate: () => void }) {
  return (
    <div className="flex flex-col items-center gap-3 py-12 text-center">
      <span className="text-muted/60">
        <NoteIcon size={36} />
      </span>
      <p className="text-sm text-muted">
        Nenhuma nota por aqui ainda.
        <br />
        Escreva em markdown e exporte em PDF quando quiser.
      </p>
      <button
        type="button"
        onClick={onCreate}
        className="min-h-11 rounded-full bg-accent px-5 text-sm font-medium text-white transition-colors active:scale-95"
      >
        Criar primeira nota
      </button>
    </div>
  );
}
