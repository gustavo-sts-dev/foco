import { NextRequest, NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";
import {
  MAX_CONTENT_LENGTH,
  MAX_TITLE_LENGTH,
  assertOwnedFolder,
  badRequest,
  cleanText,
  currentUserId,
  notFound,
  serializeNote,
  unauthorized,
} from "@/lib/notes-server";

type Context = { params: Promise<{ id: string }> };

// PATCH /api/notes/[id] — atualiza campos avulsos da nota.
// O editor chama isto a cada pausa na digitação, então só os campos enviados
// são tocados: um salvamento de conteúdo não sobrescreve título nem pasta.
export async function PATCH(req: NextRequest, { params }: Context) {
  const userId = await currentUserId();
  if (!userId) return unauthorized();

  const { id } = await params;
  const existing = await prisma.note.findFirst({ where: { id, userId }, select: { id: true } });
  if (!existing) return notFound();

  const body = await req.json().catch(() => null);
  if (!body || typeof body !== "object") return badRequest("Corpo inválido");

  const patch = body as {
    title?: unknown;
    content?: unknown;
    folderId?: unknown;
    pinned?: unknown;
  };
  const data: {
    title?: string;
    content?: string;
    folderId?: string | null;
    pinned?: boolean;
  } = {};

  if (patch.title !== undefined) data.title = cleanText(patch.title, MAX_TITLE_LENGTH);
  if (patch.content !== undefined) data.content = cleanText(patch.content, MAX_CONTENT_LENGTH);
  if (patch.pinned !== undefined) data.pinned = Boolean(patch.pinned);
  if (patch.folderId !== undefined) {
    const parent = await assertOwnedFolder(userId, patch.folderId);
    if (!parent.ok) return badRequest("Pasta inexistente");
    data.folderId = parent.folderId;
  }

  if (Object.keys(data).length === 0) return badRequest("Nada para atualizar");

  const note = await prisma.note.update({ where: { id }, data });
  return NextResponse.json(serializeNote(note));
}

// DELETE /api/notes/[id]
export async function DELETE(_req: NextRequest, { params }: Context) {
  const userId = await currentUserId();
  if (!userId) return unauthorized();

  const { id } = await params;
  // deleteMany filtra por userId no próprio comando: sem janela entre
  // checar o dono e apagar.
  const result = await prisma.note.deleteMany({ where: { id, userId } });
  if (result.count === 0) return notFound();

  return NextResponse.json({ ok: true });
}
