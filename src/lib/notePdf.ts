"use client";

import { escapeHtml, renderMarkdown } from "@/lib/markdown";
import { slugifyFileName } from "@/lib/notes";

/**
 * Exportação em PDF pela impressão do navegador.
 *
 * Por que não uma biblioteca (jsPDF/html2canvas): elas geram uma imagem da
 * página — texto não selecionável, sem quebra de página decente e pesada no
 * celular. O caminho da impressão produz PDF de texto real, respeita o
 * markdown já estilizado e existe nativamente em Android (Chrome > Salvar como
 * PDF) e iOS (Safari > Compartilhar > Imprimir > Salvar em Arquivos).
 *
 * O container é montado escondido no DOM; a regra `@media print` do
 * globals.css esconde o app e mostra só ele.
 */

const PRINT_ROOT_ID = "note-print-root";

export type PrintableNote = {
  title: string;
  content: string;
  /** Trilha de pastas mostrada abaixo do título. */
  path?: string;
};

function section(note: PrintableNote): string {
  const path = note.path
    ? '<p class="print-path">' + escapeHtml(note.path) + "</p>"
    : "";
  return (
    '<article class="print-note">' +
    "<h1>" +
    escapeHtml(note.title) +
    "</h1>" +
    path +
    '<div class="markdown-body">' +
    renderMarkdown(note.content) +
    "</div>" +
    "</article>"
  );
}

/** Abre o diálogo de impressão com as notas informadas. */
export function printNotesAsPdf(notes: PrintableNote[], documentName: string): void {
  if (typeof window === "undefined" || notes.length === 0) return;

  document.getElementById(PRINT_ROOT_ID)?.remove();

  const root = document.createElement("div");
  root.id = PRINT_ROOT_ID;
  root.innerHTML = notes.map(section).join("");
  document.body.appendChild(root);

  // O navegador usa o título do documento como nome sugerido do arquivo.
  const previousTitle = document.title;
  document.title = documentName;

  let done = false;
  const cleanup = () => {
    if (done) return;
    done = true;
    document.title = previousTitle;
    root.remove();
    window.removeEventListener("afterprint", cleanup);
  };

  window.addEventListener("afterprint", cleanup);

  // requestAnimationFrame garante que o container já foi pintado antes do
  // diálogo abrir; sem isso o Safari às vezes imprime a página em branco.
  window.requestAnimationFrame(() => {
    try {
      window.print();
    } finally {
      // Safari e alguns WebViews não disparam `afterprint`. O container é
      // invisível na tela, então esperar um pouco não atrapalha nada.
      window.setTimeout(cleanup, 1000);
    }
  });
}

/** Alternativa de exportação: baixa a nota em .md (texto puro, sem perdas). */
export function downloadMarkdown(name: string, content: string): void {
  if (typeof window === "undefined") return;
  const blob = new Blob([content], { type: "text/markdown;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = slugifyFileName(name) + ".md";
  document.body.appendChild(link);
  link.click();
  link.remove();
  // Revoga só depois do clique ser processado, senão o download é cancelado.
  window.setTimeout(() => URL.revokeObjectURL(url), 5000);
}
