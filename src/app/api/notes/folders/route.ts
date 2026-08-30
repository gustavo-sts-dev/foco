import { NextRequest, NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";
import { subfolderBlock, subfolderBlockMessage } from "@/lib/notes";
import {
  MAX_FOLDER_NAME_LENGTH,
  assertOwnedFolder,
  badRequest,
  cleanText,
  currentUserId,
  loadFolders,
  serializeFolder,
  unauthorized,
} from "@/lib/notes-server";

// POST /api/notes/folders — cria uma pasta.
//
// O limite de subpastas é decidido aqui, não na UI: a tela apenas antecipa o
// bloqueio, mas quem garante a regra é o servidor (duas abas abertas, requisição
// repetida por conexão instável, etc.).
export async function POST(req: NextRequest) {
  const userId = await currentUserId();
  if (!userId) return unauthorized();

  const body = await req.json().catch(() => null);
  if (!body || typeof body !== "object") return badRequest("Corpo inválido");

  const name = cleanText((body as { name?: unknown }).name, MAX_FOLDER_NAME_LENGTH).trim();
  if (!name) return badRequest("Nome da pasta é obrigatório");

  const parent = await assertOwnedFolder(userId, (body as { parentId?: unknown }).parentId);
  if (!parent.ok) return badRequest("Pasta pai inexistente");

  const folders = await loadFolders(userId);
  const block = subfolderBlock(folders, parent.folderId);
  if (block) return badRequest(subfolderBlockMessage(block) as string, 409);

  const siblings = folders.filter((f) => f.parentId === parent.folderId);
  const folder = await prisma.noteFolder.create({
    data: {
      name,
      parentId: parent.folderId,
      order: siblings.length,
      userId,
    },
  });

  return NextResponse.json(serializeFolder(folder), { status: 201 });
}
