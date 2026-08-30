"use client";

import { useMemo } from "react";

import { renderMarkdown } from "@/lib/markdown";

type MarkdownViewProps = {
  content: string;
  className?: string;
  emptyMessage?: string;
};

/**
 * O HTML vem de renderMarkdown, que escapa todo o texto do usuário antes de
 * qualquer transformação — nada escrito na nota vira marcação executável.
 * Ver os testes de segurança em markdown.test.ts.
 */
export function MarkdownView({ content, className = "", emptyMessage }: MarkdownViewProps) {
  const html = useMemo(() => renderMarkdown(content), [content]);

  if (!html) {
    return (
      <p className="py-8 text-center text-sm text-muted">
        {emptyMessage ?? "Esta nota ainda está vazia."}
      </p>
    );
  }

  return (
    <div
      className={`markdown-body ${className}`.trim()}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}
