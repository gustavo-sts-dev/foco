"use client";

import { useEffect, useRef } from "react";

import { EditorState } from "@codemirror/state";
import { EditorView } from "@codemirror/view";

import { noteEditorExtensions } from "@/lib/livePreview";

type LiveMarkdownEditorProps = {
  value: string;
  onChange: (value: string) => void;
  /** Trocar esta chave monta um editor novo (histórico limpo) — uma por nota. */
  docKey: string;
  placeholder: string;
  autoFocus?: boolean;
  /** Fica apontando para o EditorView vivo, para a barra de formatação usar. */
  viewRef?: { current: EditorView | null };
};

export function LiveMarkdownEditor({
  value,
  onChange,
  docKey,
  placeholder,
  autoFocus = false,
  viewRef,
}: LiveMarkdownEditorProps) {
  const host = useRef<HTMLDivElement>(null);
  const view = useRef<EditorView | null>(null);

  // O editor é montado uma vez por nota; ler value e onChange por ref evita
  // recriá-lo (e perder o cursor e o histórico) a cada tecla digitada.
  const latestChange = useRef(onChange);
  latestChange.current = onChange;
  const latestValue = useRef(value);
  latestValue.current = value;

  useEffect(() => {
    const parent = host.current;
    if (!parent) return;

    const instance = new EditorView({
      state: EditorState.create({
        doc: latestValue.current,
        extensions: [
          ...noteEditorExtensions(placeholder),
          EditorView.updateListener.of((update) => {
            if (update.docChanged) latestChange.current(update.state.doc.toString());
          }),
        ],
      }),
      parent,
    });

    view.current = instance;
    if (viewRef) viewRef.current = instance;
    if (autoFocus) instance.focus();

    return () => {
      instance.destroy();
      view.current = null;
      if (viewRef) viewRef.current = null;
    };
    // placeholder, autoFocus e viewRef são lidos só na montagem de propósito:
    // entram nas deps e o editor seria remontado no meio da digitação.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [docKey]);

  // Texto que mudou fora do editor (outra aba, desfazer externo) entra aqui.
  // Quando a mudança veio da própria digitação os dois já são iguais e nada
  // acontece — é o que impede o cursor de pular para o fim a cada letra.
  useEffect(() => {
    const instance = view.current;
    if (!instance) return;
    const current = instance.state.doc.toString();
    if (current === value) return;
    instance.dispatch({
      changes: { from: 0, to: current.length, insert: value },
    });
  }, [value]);

  return <div ref={host} className="min-h-0 flex-1 overflow-hidden" />;
}
