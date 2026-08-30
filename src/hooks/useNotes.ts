"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { descendantFolderIds } from "@/lib/notes";
import type { Note, NoteFolder, NotesData } from "@/types";

const EMPTY: NotesData = { folders: [], notes: [] };

/** Pausa na digitação antes de mandar a nota para o servidor. */
const SAVE_DEBOUNCE_MS = 700;

type NotePatch = Partial<Pick<Note, "title" | "content" | "folderId" | "pinned">>;

async function request<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    ...init,
    headers: init?.body ? { "Content-Type": "application/json" } : undefined,
  });
  if (!res.ok) {
    const payload = await res.json().catch(() => null);
    throw new Error((payload as { error?: string } | null)?.error ?? "Falha na conexão");
  }
  return (await res.json()) as T;
}

export function useNotes() {
  const [data, setData] = useState<NotesData>(EMPTY);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pendingSaves, setPendingSaves] = useState(0);

  // Alterações ainda não enviadas, agrupadas por nota. Digitar rápido gera uma
  // requisição só, com o último estado de cada campo.
  const queued = useRef(new Map<string, NotePatch>());
  const timers = useRef(new Map<string, ReturnType<typeof setTimeout>>());
  const alive = useRef(true);

  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);

  useEffect(() => {
    request<NotesData>("/api/notes")
      .then((json) => {
        setData({ folders: json.folders ?? [], notes: json.notes ?? [] });
      })
      .catch(() => setError("Não foi possível carregar as notas."))
      .finally(() => setLoaded(true));
  }, []);

  const flushNote = useCallback(async (id: string) => {
    const patch = queued.current.get(id);
    if (!patch) return;
    queued.current.delete(id);
    const timer = timers.current.get(id);
    if (timer) {
      clearTimeout(timer);
      timers.current.delete(id);
    }

    setPendingSaves((count) => count + 1);
    try {
      const saved = await request<Note>(`/api/notes/${id}`, {
        method: "PATCH",
        body: JSON.stringify(patch),
      });
      if (!alive.current) return;
      // Só o updatedAt vem de volta: o texto local pode já estar à frente do
      // que foi enviado, e sobrescrevê-lo apagaria as últimas letras digitadas.
      setData((prev) => ({
        ...prev,
        notes: prev.notes.map((n) => (n.id === id ? { ...n, updatedAt: saved.updatedAt } : n)),
      }));
      setError(null);
    } catch (err) {
      if (alive.current) setError(err instanceof Error ? err.message : "Falha ao salvar");
    } finally {
      if (alive.current) setPendingSaves((count) => count - 1);
    }
  }, []);

  /** Escreve na hora na tela e agenda o envio. */
  const updateNote = useCallback(
    (id: string, patch: NotePatch) => {
      setData((prev) => ({
        ...prev,
        notes: prev.notes.map((n) =>
          n.id === id ? { ...n, ...patch, updatedAt: new Date().toISOString() } : n
        ),
      }));

      queued.current.set(id, { ...(queued.current.get(id) ?? {}), ...patch });

      const existing = timers.current.get(id);
      if (existing) clearTimeout(existing);
      timers.current.set(
        id,
        setTimeout(() => {
          void flushNote(id);
        }, SAVE_DEBOUNCE_MS)
      );
    },
    [flushNote]
  );

  const flushAll = useCallback(() => {
    for (const id of Array.from(queued.current.keys())) void flushNote(id);
  }, [flushNote]);

  // Fechar o app no celular costuma ser "trocar de aba", não descarregar a
  // página: sem este gancho, a última frase digitada ficaria só na memória.
  useEffect(() => {
    function onHide() {
      if (document.visibilityState === "hidden") flushAll();
    }
    document.addEventListener("visibilitychange", onHide);
    window.addEventListener("pagehide", flushAll);
    return () => {
      document.removeEventListener("visibilitychange", onHide);
      window.removeEventListener("pagehide", flushAll);
      flushAll();
    };
  }, [flushAll]);

  const createNote = useCallback(
    async (folderId: string | null, seed?: { title?: string; content?: string }) => {
      try {
        const note = await request<Note>("/api/notes", {
          method: "POST",
          body: JSON.stringify({ folderId, ...seed }),
        });
        setData((prev) => ({ ...prev, notes: [note, ...prev.notes] }));
        setError(null);
        return note;
      } catch (err) {
        setError(err instanceof Error ? err.message : "Falha ao criar a nota");
        return null;
      }
    },
    []
  );

  const deleteNote = useCallback(async (id: string) => {
    // Cancela envios pendentes antes de apagar: um PATCH atrasado depois do
    // DELETE só geraria um 404 e um erro falso na tela.
    queued.current.delete(id);
    const timer = timers.current.get(id);
    if (timer) {
      clearTimeout(timer);
      timers.current.delete(id);
    }

    const snapshot = data.notes;
    setData((prev) => ({ ...prev, notes: prev.notes.filter((n) => n.id !== id) }));
    try {
      await request(`/api/notes/${id}`, { method: "DELETE" });
      setError(null);
    } catch (err) {
      setData((prev) => ({ ...prev, notes: snapshot }));
      setError(err instanceof Error ? err.message : "Falha ao apagar a nota");
    }
  }, [data.notes]);

  const createFolder = useCallback(async (name: string, parentId: string | null) => {
    try {
      const folder = await request<NoteFolder>("/api/notes/folders", {
        method: "POST",
        body: JSON.stringify({ name, parentId }),
      });
      setData((prev) => ({ ...prev, folders: [...prev.folders, folder] }));
      setError(null);
      return folder;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Falha ao criar a pasta");
      return null;
    }
  }, []);

  const renameFolder = useCallback(async (id: string, name: string) => {
    setData((prev) => ({
      ...prev,
      folders: prev.folders.map((f) => (f.id === id ? { ...f, name } : f)),
    }));
    try {
      await request<NoteFolder>(`/api/notes/folders/${id}`, {
        method: "PATCH",
        body: JSON.stringify({ name }),
      });
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Falha ao renomear a pasta");
    }
  }, []);

  const deleteFolder = useCallback(
    async (id: string) => {
      const removed = descendantFolderIds(data.folders, id);
      const snapshot = data;
      setData((prev) => ({
        folders: prev.folders.filter((f) => !removed.includes(f.id)),
        notes: prev.notes.filter((n) => !n.folderId || !removed.includes(n.folderId)),
      }));
      try {
        await request(`/api/notes/folders/${id}`, { method: "DELETE" });
        setError(null);
      } catch (err) {
        setData(snapshot);
        setError(err instanceof Error ? err.message : "Falha ao apagar a pasta");
      }
    },
    [data]
  );

  return {
    folders: data.folders,
    notes: data.notes,
    loaded,
    error,
    clearError: useCallback(() => setError(null), []),
    isSaving: pendingSaves > 0,
    updateNote,
    flushNote,
    flushAll,
    createNote,
    deleteNote,
    createFolder,
    renameFolder,
    deleteFolder,
  };
}
