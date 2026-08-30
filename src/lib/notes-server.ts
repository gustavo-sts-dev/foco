import { NextResponse } from "next/server";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import type { Note, NoteFolder } from "@/types";

/** Tetos de tamanho. Barram payload absurdo antes de chegar ao banco. */
export const MAX_TITLE_LENGTH = 200;
export const MAX_FOLDER_NAME_LENGTH = 60;
export const MAX_CONTENT_LENGTH = 200_000;

export function unauthorized() {
  return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
}

export function notFound() {
  return NextResponse.json({ error: "Not found" }, { status: 404 });
}

export function badRequest(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status });
}

/** userId da sessão, ou null quando não há sessão válida. */
export async function currentUserId(): Promise<string | null> {
  const session = await auth();
  return session?.user?.id ?? null;
}

type DbFolder = {
  id: string;
  name: string;
  parentId: string | null;
  order: number;
  createdAt: Date;
  updatedAt: Date;
};

type DbNote = {
  id: string;
  title: string;
  content: string;
  folderId: string | null;
  pinned: boolean;
  order: number;
  createdAt: Date;
  updatedAt: Date;
};

// As datas viram string ISO aqui, e não no JSON.stringify implícito, para o
// tipo devolvido bater com NoteFolder/Note do cliente.
export function serializeFolder(folder: DbFolder): NoteFolder {
  return {
    id: folder.id,
    name: folder.name,
    parentId: folder.parentId,
    order: folder.order,
    createdAt: folder.createdAt.toISOString(),
    updatedAt: folder.updatedAt.toISOString(),
  };
}

export function serializeNote(note: DbNote): Note {
  return {
    id: note.id,
    title: note.title,
    content: note.content,
    folderId: note.folderId,
    pinned: note.pinned,
    order: note.order,
    createdAt: note.createdAt.toISOString(),
    updatedAt: note.updatedAt.toISOString(),
  };
}

/** Todas as pastas do usuário — a árvore é pequena e as regras precisam dela inteira. */
export async function loadFolders(userId: string): Promise<NoteFolder[]> {
  const folders = await prisma.noteFolder.findMany({
    where: { userId },
    orderBy: [{ order: "asc" }, { createdAt: "asc" }],
  });
  return folders.map(serializeFolder);
}

export function cleanText(value: unknown, max: number): string {
  if (typeof value !== "string") return "";
  return value.slice(0, max);
}

/** Valida que a pasta informada existe e é do usuário. */
export async function assertOwnedFolder(
  userId: string,
  folderId: unknown
): Promise<{ ok: true; folderId: string | null } | { ok: false }> {
  if (folderId === null || folderId === undefined) return { ok: true, folderId: null };
  if (typeof folderId !== "string") return { ok: false };
  const folder = await prisma.noteFolder.findFirst({
    where: { id: folderId, userId },
    select: { id: true },
  });
  return folder ? { ok: true, folderId } : { ok: false };
}
