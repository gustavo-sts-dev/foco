import { NextRequest, NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";
import { descendantFolderIds, subfolderBlock, subfolderBlockMessage } from "@/lib/notes";
import {
  MAX_FOLDER_NAME_LENGTH,
  assertOwnedFolder,
  badRequest,
  cleanText,
  currentUserId,
  loadFolders,
  notFound,
  serializeFolder,
  unauthorized,
} from "@/lib/notes-server";

type Context = { params: Promise<{ id: string }> };

// PATCH /api/notes/folders/[id] — renomeia e/ou move a pasta.
export async function PATCH(req: NextRequest, { params }: Context) {
  const userId = await currentUserId();
  if (!userId) return unauthorized();

  const { id } = await params;
  const folders = await loadFolders(userId);
  const current = folders.find((f) => f.id === id);
  if (!current) return notFound();

  const body = await req.json().catch(() => null);
  if (!body || typeof body !== "object") return badRequest("Corpo inválido");

  const patch = body as { name?: unknown; parentId?: unknown };
  const data: { name?: string; parentId?: string | null } = {};

  if (patch.name !== undefined) {
    const name = cleanText(patch.name, MAX_FOLDER_NAME_LENGTH).trim();
    if (!name) return badRequest("Nome da pasta é obrigatório");
    data.name = name;
  }

  if (patch.parentId !== undefined) {
    const parent = await assertOwnedFolder(userId, patch.parentId);
    if (!parent.ok) return badRequest("Pasta pai inexistente");

    if (parent.folderId !== current.parentId) {
      // Mover uma pasta para dentro de si mesma (ou de uma filha) partiria a
      // árvore em um ciclo órfão, invisível na tela e impossível de apagar.
      if (parent.folderId && descendantFolderIds(folders, id).includes(parent.folderId)) {
        return badRequest("Não dá para mover uma pasta para dentro dela mesma", 409);
      }
      const block = subfolderBlock(folders, parent.folderId);
      if (block) return badRequest(subfolderBlockMessage(block) as string, 409);
      data.parentId = parent.folderId;
    }
  }

  if (Object.keys(data).length === 0) return badRequest("Nada para atualizar");

  const folder = await prisma.noteFolder.update({ where: { id }, data });
  return NextResponse.json(serializeFolder(folder));
}

// DELETE /api/notes/folders/[id] — apaga a pasta, as subpastas e as notas dentro.
export async function DELETE(_req: NextRequest, { params }: Context) {
  const userId = await currentUserId();
  if (!userId) return unauthorized();

  const { id } = await params;
  const folders = await loadFolders(userId);
  if (!folders.some((f) => f.id === id)) return notFound();

  // A cascata em cadeia é feita à mão porque o SQLite só honra ON DELETE
  // CASCADE com `PRAGMA foreign_keys = ON`, e isso depende da conexão. Apagar
  // explicitamente vale para qualquer configuração.
  const ids = descendantFolderIds(folders, id);
  await prisma.note.deleteMany({ where: { userId, folderId: { in: ids } } });
  await prisma.noteFolder.deleteMany({ where: { userId, id: { in: ids } } });

  return NextResponse.json({ ok: true, deletedFolderIds: ids });
}
