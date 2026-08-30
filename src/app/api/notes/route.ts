import { NextRequest, NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";
import {
  MAX_CONTENT_LENGTH,
  MAX_TITLE_LENGTH,
  assertOwnedFolder,
  badRequest,
  cleanText,
  currentUserId,
  serializeFolder,
  serializeNote,
  unauthorized,
} from "@/lib/notes-server";

// GET /api/notes — arvore de pastas + todas as notas do usuario.
//
// Devolve o conteudo completo de propósito: um acervo pessoal de notas é
// pequeno, e ter tudo em memória deixa a navegação e a busca instantâneas no
// celular, sem uma requisição por toque.
export async function GET() {
  const userId = await currentUserId();
  if (!userId) return unauthorized();

  const [folders, notes] = await Promise.all([
    prisma.noteFolder.findMany({
      where: { userId },
      orderBy: [{ order: "asc" }, { createdAt: "asc" }],
    }),
    prisma.note.findMany({
      where: { userId },
      orderBy: [{ pinned: "desc" }, { updatedAt: "desc" }],
    }),
  ]);

  return NextResponse.json({
    folders: folders.map(serializeFolder),
    notes: notes.map(serializeNote),
  });
}

// POST /api/notes — cria uma nota.
export async function POST(req: NextRequest) {
  const userId = await currentUserId();
  if (!userId) return unauthorized();

  const body = await req.json().catch(() => null);
  if (!body || typeof body !== "object") return badRequest("Corpo inválido");

  const parent = await assertOwnedFolder(userId, (body as { folderId?: unknown }).folderId);
  if (!parent.ok) return badRequest("Pasta inexistente");

  const note = await prisma.note.create({
    data: {
      title: cleanText((body as { title?: unknown }).title, MAX_TITLE_LENGTH),
      content: cleanText((body as { content?: unknown }).content, MAX_CONTENT_LENGTH),
      folderId: parent.folderId,
      userId,
    },
  });

  return NextResponse.json(serializeNote(note), { status: 201 });
}
