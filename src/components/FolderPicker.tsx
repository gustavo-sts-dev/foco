"use client";

import { BottomSheet } from "@/components/BottomSheet";
import { CheckIcon, FolderIcon, NoteIcon } from "@/components/NoteIcons";
import { childFolders } from "@/lib/notes";
import type { NoteFolder } from "@/types";

type FolderPickerProps = {
  open: boolean;
  folders: NoteFolder[];
  selectedId: string | null;
  onSelect: (folderId: string | null) => void;
  onClose: () => void;
  title?: string;
  /** Pastas que não podem ser escolhidas (ex.: a própria pasta sendo movida). */
  disabledIds?: string[];
};

type Row = { folder: NoteFolder; depth: number };

/** Achata a árvore mantendo a ordem de leitura, para virar uma lista tocável. */
function flatten(folders: NoteFolder[], parentId: string | null, depth: number): Row[] {
  return childFolders(folders, parentId).flatMap((folder) => [
    { folder, depth },
    ...flatten(folders, folder.id, depth + 1),
  ]);
}

export function FolderPicker({
  open,
  folders,
  selectedId,
  onSelect,
  onClose,
  title = "Mover para",
  disabledIds = [],
}: FolderPickerProps) {
  const rows = flatten(folders, null, 0);

  function row(
    key: string,
    label: string,
    depth: number,
    id: string | null,
    icon: React.ReactNode
  ) {
    const selected = selectedId === id;
    const disabled = id !== null && disabledIds.includes(id);
    return (
      <button
        key={key}
        type="button"
        disabled={disabled}
        onClick={() => {
          onSelect(id);
          onClose();
        }}
        className={`flex min-h-12 w-full items-center gap-2.5 rounded-xl px-3 text-left text-[15px] transition-colors disabled:opacity-35 ${
          selected ? "bg-accent-muted text-accent" : "hover:bg-muted-bg"
        }`}
        style={{ paddingLeft: 12 + depth * 18 }}
      >
        <span className={selected ? "text-accent" : "text-muted"}>{icon}</span>
        <span className="flex-1 truncate">{label}</span>
        {selected && <CheckIcon size={18} />}
      </button>
    );
  }

  return (
    <BottomSheet open={open} onClose={onClose} title={title}>
      <div className="flex flex-col gap-0.5">
        {row("root", "Notas (raiz)", 0, null, <NoteIcon size={18} />)}
        {rows.map(({ folder, depth }) =>
          row(folder.id, folder.name, depth + 1, folder.id, <FolderIcon size={18} />)
        )}
      </div>
    </BottomSheet>
  );
}
