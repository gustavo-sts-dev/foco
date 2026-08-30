import { describe, expect, it } from "vitest";

import type { Note, NoteFolder } from "@/types";
import {
  MAX_FOLDER_DEPTH,
  MAX_SUBFOLDERS,
  canCreateSubfolder,
  childFolders,
  descendantFolderIds,
  folderDepth,
  folderPath,
  matchesQuery,
  noteTitle,
  notePreview,
  notesInFolder,
  slugifyFileName,
  sortNotes,
  subfolderBlock,
} from "@/lib/notes";

function folder(id: string, parentId: string | null = null, name = id): NoteFolder {
  return {
    id,
    name,
    parentId,
    order: 0,
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
  };
}

function note(overrides: Partial<Note> = {}): Note {
  return {
    id: "n1",
    title: "",
    content: "",
    folderId: null,
    pinned: false,
    order: 0,
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
}

describe("limite de subpastas", () => {
  it("permite criar enquanto houver menos de MAX_SUBFOLDERS filhas", () => {
    const folders = [folder("pai"), folder("a", "pai"), folder("b", "pai")];
    expect(canCreateSubfolder(folders, "pai")).toBe(true);
  });

  it("bloqueia a quarta subpasta da mesma pasta", () => {
    const folders = [
      folder("pai"),
      folder("a", "pai"),
      folder("b", "pai"),
      folder("c", "pai"),
    ];
    expect(childFolders(folders, "pai")).toHaveLength(MAX_SUBFOLDERS);
    expect(canCreateSubfolder(folders, "pai")).toBe(false);
    expect(subfolderBlock(folders, "pai")).toBe("limit");
  });

  it("conta o limite por pasta, nao no total", () => {
    const folders = [
      folder("pai"),
      folder("a", "pai"),
      folder("b", "pai"),
      folder("c", "pai"),
      folder("outro"),
    ];
    expect(canCreateSubfolder(folders, "outro")).toBe(true);
  });

  it("aplica o mesmo limite na raiz", () => {
    const folders = [folder("a"), folder("b"), folder("c")];
    expect(canCreateSubfolder(folders, null)).toBe(false);
  });

  it("bloqueia por profundidade quando a arvore fica funda demais", () => {
    const folders: NoteFolder[] = [];
    let parent: string | null = null;
    for (let level = 0; level < MAX_FOLDER_DEPTH; level++) {
      const id = "n" + level;
      folders.push(folder(id, parent));
      parent = id;
    }
    expect(folderDepth(folders, parent)).toBe(MAX_FOLDER_DEPTH);
    expect(subfolderBlock(folders, parent)).toBe("depth");
  });
});

describe("navegacao na arvore", () => {
  it("monta a trilha da raiz ate a pasta", () => {
    const folders = [folder("a"), folder("b", "a"), folder("c", "b")];
    expect(folderPath(folders, "c").map((f) => f.id)).toEqual(["a", "b", "c"]);
  });

  it("devolve trilha vazia na raiz", () => {
    expect(folderPath([folder("a")], null)).toEqual([]);
  });

  it("nao entra em laco infinito com ciclo nos dados", () => {
    const folders = [folder("a", "b"), folder("b", "a")];
    expect(folderPath(folders, "a").length).toBeLessThanOrEqual(2);
  });

  it("lista a pasta e todos os descendentes", () => {
    const folders = [
      folder("raiz"),
      folder("f1", "raiz"),
      folder("f2", "raiz"),
      folder("neto", "f1"),
      folder("fora"),
    ];
    expect(descendantFolderIds(folders, "raiz").sort()).toEqual(
      ["f1", "f2", "neto", "raiz"].sort()
    );
  });

  it("separa notas por pasta, tratando null como raiz", () => {
    const notes = [
      note({ id: "1", folderId: null }),
      note({ id: "2", folderId: "f1" }),
    ];
    expect(notesInFolder(notes, null).map((n) => n.id)).toEqual(["1"]);
    expect(notesInFolder(notes, "f1").map((n) => n.id)).toEqual(["2"]);
  });
});

describe("ordenacao de notas", () => {
  it("coloca fixadas primeiro e depois as mais recentes", () => {
    const notes = [
      note({ id: "velha", updatedAt: "2026-01-01T00:00:00.000Z" }),
      note({ id: "nova", updatedAt: "2026-05-01T00:00:00.000Z" }),
      note({ id: "fixada", pinned: true, updatedAt: "2020-01-01T00:00:00.000Z" }),
    ];
    expect(sortNotes(notes).map((n) => n.id)).toEqual(["fixada", "nova", "velha"]);
  });
});

describe("titulo e previa", () => {
  it("usa o titulo explicito quando existe", () => {
    expect(noteTitle(note({ title: "Reuniao", content: "# Outro" }))).toBe("Reuniao");
  });

  it("deriva o titulo da primeira linha do conteudo", () => {
    expect(noteTitle(note({ content: "# Plano da semana\n\ndetalhes" }))).toBe(
      "Plano da semana"
    );
  });

  it("cai para o rotulo padrao quando nao ha nada", () => {
    expect(noteTitle(note())).toBe("Sem título");
  });

  it("nao repete o titulo derivado dentro da previa", () => {
    const preview = notePreview(note({ content: "# Plano\n\ncorpo da nota" }));
    expect(preview).toBe("corpo da nota");
  });

  it("trunca previas longas", () => {
    const preview = notePreview(note({ title: "t", content: "a".repeat(200) }), 20);
    expect(preview.endsWith("…")).toBe(true);
    expect(preview.length).toBeLessThanOrEqual(21);
  });
});

describe("busca", () => {
  it("ignora acentos e caixa", () => {
    expect(matchesQuery(note({ title: "Reunião de Produção" }), "producao")).toBe(true);
    expect(matchesQuery(note({ content: "AÇÃO rápida" }), "acao")).toBe(true);
  });

  it("busca tambem no corpo", () => {
    expect(matchesQuery(note({ content: "comprar leite" }), "leite")).toBe(true);
  });

  it("com busca vazia mantem tudo", () => {
    expect(matchesQuery(note(), "  ")).toBe(true);
  });

  it("nao casa termo ausente", () => {
    expect(matchesQuery(note({ title: "abc" }), "xyz")).toBe(false);
  });
});

describe("slugifyFileName", () => {
  it("gera nome de arquivo seguro", () => {
    expect(slugifyFileName("Reunião: plano 2026!")).toBe("reuniao-plano-2026");
  });

  it("tem fallback quando o nome nao sobra nada", () => {
    expect(slugifyFileName("###")).toBe("nota");
  });
});
