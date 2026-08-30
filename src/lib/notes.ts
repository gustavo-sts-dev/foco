import type { Note, NoteFolder } from "@/types";
import { markdownToPlainText } from "@/lib/markdown";

/**
 * Quantas subpastas diretas cabem dentro de uma pasta.
 * Regra de produto: no celular, uma pasta com muitos filhos vira uma lista
 * infinita de toques. O limite vale por pasta, em qualquer profundidade, e é
 * validado no servidor (a UI só antecipa o bloqueio).
 */
export const MAX_SUBFOLDERS = 3;

/** Profundidade máxima da árvore. A raiz é o nível 0. */
export const MAX_FOLDER_DEPTH = 5;

export const UNTITLED_NOTE = "Sem título";

export function sortFolders(folders: NoteFolder[]): NoteFolder[] {
  return [...folders].sort(
    (a, b) => a.order - b.order || a.name.localeCompare(b.name, "pt-BR")
  );
}

/** Fixadas primeiro, depois as editadas mais recentemente. */
export function sortNotes(notes: Note[]): Note[] {
  return [...notes].sort((a, b) => {
    if (a.pinned !== b.pinned) return a.pinned ? -1 : 1;
    return b.updatedAt.localeCompare(a.updatedAt);
  });
}

export function childFolders(folders: NoteFolder[], parentId: string | null): NoteFolder[] {
  return sortFolders(folders.filter((f) => (f.parentId ?? null) === parentId));
}

export function notesInFolder(notes: Note[], folderId: string | null): Note[] {
  return sortNotes(notes.filter((n) => (n.folderId ?? null) === folderId));
}

/** Caminho da raiz até a pasta, para a trilha de navegação. */
export function folderPath(folders: NoteFolder[], folderId: string | null): NoteFolder[] {
  const byId = new Map(folders.map((f) => [f.id, f]));
  const path: NoteFolder[] = [];
  const seen = new Set<string>();
  let current = folderId ? byId.get(folderId) : undefined;
  // `seen` protege contra um ciclo vindo de dados corrompidos: sem ele o
  // loop nunca terminaria e travaria a aba inteira.
  while (current && !seen.has(current.id)) {
    seen.add(current.id);
    path.unshift(current);
    current = current.parentId ? byId.get(current.parentId) : undefined;
  }
  return path;
}

/** Nível da pasta na árvore (raiz = 0). */
export function folderDepth(folders: NoteFolder[], folderId: string | null): number {
  return folderPath(folders, folderId).length;
}

/** A própria pasta e tudo abaixo dela. Usado ao apagar e ao exportar. */
export function descendantFolderIds(folders: NoteFolder[], folderId: string): string[] {
  const result = [folderId];
  const queue = [folderId];
  while (queue.length > 0) {
    const current = queue.shift() as string;
    for (const folder of folders) {
      if ((folder.parentId ?? null) === current && !result.includes(folder.id)) {
        result.push(folder.id);
        queue.push(folder.id);
      }
    }
  }
  return result;
}

export type SubfolderBlock = "limit" | "depth" | null;

/** Por que criar uma subpasta aqui está bloqueado — ou null, se estiver livre. */
export function subfolderBlock(
  folders: NoteFolder[],
  parentId: string | null
): SubfolderBlock {
  if (childFolders(folders, parentId).length >= MAX_SUBFOLDERS) return "limit";
  if (folderDepth(folders, parentId) >= MAX_FOLDER_DEPTH) return "depth";
  return null;
}

export function canCreateSubfolder(folders: NoteFolder[], parentId: string | null): boolean {
  return subfolderBlock(folders, parentId) === null;
}

export function subfolderBlockMessage(block: SubfolderBlock): string | null {
  if (block === "limit") return `Limite de ${MAX_SUBFOLDERS} subpastas por pasta atingido.`;
  if (block === "depth") return `Profundidade máxima de ${MAX_FOLDER_DEPTH} níveis atingida.`;
  return null;
}

/** Título mostrado na lista: o campo, ou a primeira linha do conteúdo. */
export function noteTitle(note: Pick<Note, "title" | "content">): string {
  const explicit = note.title.trim();
  if (explicit) return explicit;
  // A limpeza tem de vir DEPOIS de isolar a linha: markdownToPlainText
  // colapsa quebras de linha, então rodá-lo no conteúdo inteiro devolveria
  // a nota toda como "primeira linha".
  const rawFirstLine = note.content.split("\n").find((line) => line.trim()) ?? "";
  const firstLine = markdownToPlainText(rawFirstLine);
  if (!firstLine) return UNTITLED_NOTE;
  return firstLine.length > 60 ? firstLine.slice(0, 60) + "…" : firstLine;
}

/** Trecho do corpo mostrado abaixo do título no cartão da nota. */
export function notePreview(note: Pick<Note, "title" | "content">, max = 90): string {
  let text = markdownToPlainText(note.content);
  // Quando o título vem da primeira linha, repeti-lo na prévia é ruído.
  if (!note.title.trim()) {
    const derived = noteTitle(note).replace(/…$/, "");
    if (text.startsWith(derived)) text = text.slice(derived.length).trim();
  }
  if (!text) return "";
  return text.length > max ? text.slice(0, max).trimEnd() + "…" : text;
}

/** Busca por título e corpo, ignorando acentos e caixa. */
export function matchesQuery(note: Pick<Note, "title" | "content">, query: string): boolean {
  const term = normalize(query);
  if (!term) return true;
  return normalize(note.title + " " + note.content).includes(term);
}

export function normalize(text: string): string {
  let out = "";
  for (const char of text.normalize("NFD")) {
    const code = char.charCodeAt(0);
    // Faixa U+0300..U+036F: acentos combinantes (til, cedilha, agudo...).
    if (code >= 0x300 && code <= 0x36f) continue;
    out += char;
  }
  return out.toLowerCase().trim();
}

/** Nome de arquivo seguro para o .md exportado. */
export function slugifyFileName(name: string): string {
  const slug = normalize(name)
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
  return slug || "nota";
}

export function formatNoteDate(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  const now = new Date();
  const sameDay =
    date.getFullYear() === now.getFullYear() &&
    date.getMonth() === now.getMonth() &&
    date.getDate() === now.getDate();
  if (sameDay) {
    return new Intl.DateTimeFormat("pt-BR", { hour: "2-digit", minute: "2-digit" }).format(date);
  }
  const sameYear = date.getFullYear() === now.getFullYear();
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "short",
    year: sameYear ? undefined : "numeric",
  }).format(date);
}
