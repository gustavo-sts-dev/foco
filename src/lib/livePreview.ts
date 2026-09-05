// Live Preview: uma visualização só, no padrão do Obsidian.
//
// A regra que define tudo aqui é uma só: **a linha onde está o cursor mostra o
// markdown cru; todas as outras aparecem formatadas.** Escrever "**oi**" mostra
// os asteriscos enquanto você digita e vira negrito assim que o cursor sai da
// linha — sem botão de alternar modo, sem duas telas.
//
// Blocos que ocupam várias linhas (código cercado, tabela, linha horizontal)
// seguem a mesma ideia com granularidade de bloco: enquanto o cursor está
// dentro deles a fonte aparece; fora, o bloco é substituído pelo HTML do
// renderMarkdown — o mesmo renderizador que gera o PDF, então o que se vê no
// editor é exatamente o que sai impresso.
//
// Marcador de lista e caixa de checklist são exceções deliberadas: ficam sempre
// renderizados (e clicáveis), como no Obsidian.

import { defaultKeymap, history, historyKeymap, indentLess, indentMore } from "@codemirror/commands";
import { syntaxTree } from "@codemirror/language";
import {
  EditorState,
  Prec,
  type Extension,
  type Range,
  type Text,
  StateEffect,
  StateField,
} from "@codemirror/state";
import {
  Decoration,
  type DecorationSet,
  EditorView,
  type KeyBinding,
  WidgetType,
  keymap,
  placeholder,
} from "@codemirror/view";
import type { SyntaxNode, SyntaxNodeRef } from "@lezer/common";

import { renderMarkdown, safeUrl } from "@/lib/markdown";
import {
  type EditorState as MarkdownState,
  continueBlock,
  deleteMarkupBackward,
  insertCodeBlock,
  insertLink,
  toggleLinePrefix,
  wrapSelection,
} from "@/lib/markdownEditor";
import { noteMarkdownLanguage } from "@/lib/markdownSyntax";

/* ------------------------------------------------------------------ *
 * Foco
 * ------------------------------------------------------------------ */

// Sem foco não existe "linha do cursor": a nota aparece inteira formatada.
// Sem isso, abrir uma nota mostraria a primeira linha crua sem motivo.
const setFocused = StateEffect.define<boolean>();

const focusField = StateField.define<boolean>({
  create: () => false,
  update(focused, tr) {
    for (const effect of tr.effects) if (effect.is(setFocused)) return effect.value;
    return focused;
  },
});

const focusTracker = EditorView.focusChangeEffect.of((_state, focusing) => setFocused.of(focusing));

/* ------------------------------------------------------------------ *
 * Widgets
 * ------------------------------------------------------------------ */

/** Bloco (código, tabela, linha horizontal) renderizado pelo renderMarkdown. */
class RenderedBlockWidget extends WidgetType {
  constructor(private readonly source: string) {
    super();
  }

  eq(other: RenderedBlockWidget) {
    return other.source === this.source;
  }

  toDOM(view: EditorView) {
    const wrap = document.createElement("div");
    wrap.className = "cm-md-rendered markdown-body";
    // renderMarkdown escapa todo o texto do usuário antes de formatar; ver os
    // testes de segurança em markdown.test.ts.
    wrap.innerHTML = renderMarkdown(this.source);
    wrap.addEventListener("mousedown", (event) => {
      // Link dentro do bloco abre normalmente; qualquer outro ponto coloca o
      // cursor no bloco, que é como se edita uma tabela no Obsidian.
      if ((event.target as HTMLElement | null)?.closest("a")) return;
      event.preventDefault();
      const pos = view.posAtDOM(wrap);
      view.dispatch({ selection: { anchor: pos } });
      view.focus();
    });
    return wrap;
  }

  ignoreEvent() {
    return true;
  }
}

/** Caixa de checklist de verdade, no lugar do "[ ]". */
class CheckboxWidget extends WidgetType {
  constructor(private readonly checked: boolean) {
    super();
  }

  eq(other: CheckboxWidget) {
    return other.checked === this.checked;
  }

  toDOM(view: EditorView) {
    const input = document.createElement("input");
    input.type = "checkbox";
    input.checked = this.checked;
    input.className = "cm-md-checkbox";
    input.setAttribute("aria-label", this.checked ? "Desmarcar tarefa" : "Marcar tarefa");
    // Sem isto o toque tira o foco do editor e o teclado do celular fecha.
    input.addEventListener("mousedown", (event) => event.preventDefault());
    input.addEventListener("click", (event) => {
      event.preventDefault();
      // posAtDOM em vez de guardar o offset: o texto acima pode ter mudado
      // desde que este widget foi criado.
      const pos = view.posAtDOM(input);
      const marker = view.state.doc.sliceString(pos, pos + 3);
      if (!/^\[[ xX]\]$/.test(marker)) return;
      view.dispatch({
        changes: { from: pos + 1, to: pos + 2, insert: this.checked ? " " : "x" },
      });
    });
    return input;
  }

  ignoreEvent() {
    return true;
  }
}

/** Bolinha no lugar do "-" das listas. */
class BulletWidget extends WidgetType {
  eq() {
    return true;
  }

  toDOM() {
    const span = document.createElement("span");
    span.className = "cm-md-bullet";
    span.textContent = "•";
    return span;
  }

  ignoreEvent() {
    return true;
  }
}

class ImageWidget extends WidgetType {
  constructor(
    private readonly src: string,
    private readonly alt: string
  ) {
    super();
  }

  eq(other: ImageWidget) {
    return other.src === this.src && other.alt === this.alt;
  }

  toDOM() {
    const img = document.createElement("img");
    img.className = "cm-md-image";
    img.src = this.src;
    img.alt = this.alt;
    img.loading = "lazy";
    return img;
  }

  ignoreEvent() {
    return true;
  }
}

/* ------------------------------------------------------------------ *
 * Decorações
 * ------------------------------------------------------------------ */

const HIDE = Decoration.replace({});
const BULLET = Decoration.replace({ widget: new BulletWidget() });

const lineCache = new Map<string, Decoration>();
function lineDeco(className: string): Decoration {
  let deco = lineCache.get(className);
  if (!deco) {
    deco = Decoration.line({ class: className });
    lineCache.set(className, deco);
  }
  return deco;
}

const markCache = new Map<string, Decoration>();
function markDeco(className: string): Decoration {
  let deco = markCache.get(className);
  if (!deco) {
    deco = Decoration.mark({ class: className });
    markCache.set(className, deco);
  }
  return deco;
}

function linkHref(node: SyntaxNode, doc: Text): string | null {
  const url = node.getChild("URL");
  return url ? safeUrl(doc.sliceString(url.from, url.to)) : null;
}

function linkMarks(node: SyntaxNode): SyntaxNode[] {
  const marks: SyntaxNode[] = [];
  for (let child = node.firstChild; child; child = child.nextSibling) {
    if (child.name === "LinkMark") marks.push(child);
  }
  return marks;
}

type Built = { decorations: DecorationSet; atomic: DecorationSet };

function build(state: EditorState): Built {
  const doc = state.doc;
  const decorations: Range<Decoration>[] = [];
  const atomic: Range<Decoration>[] = [];

  // Linhas tocadas pelo cursor ou pela seleção — as únicas que mostram a fonte.
  const activeLines = new Set<number>();
  if (state.field(focusField, false)) {
    for (const range of state.selection.ranges) {
      const first = doc.lineAt(range.from).number;
      const last = doc.lineAt(range.to).number;
      for (let n = first; n <= last; n++) activeLines.add(n);
    }
  }

  const isActive = (pos: number) => activeLines.has(doc.lineAt(pos).number);
  const spanActive = (from: number, to: number) => {
    const first = doc.lineAt(from).number;
    const last = doc.lineAt(to).number;
    for (let n = first; n <= last; n++) if (activeLines.has(n)) return true;
    return false;
  };

  /** Esconde o marcador e o espaço que o segue, sem passar do fim da linha. */
  const hideMarker = (from: number, to: number) => {
    const line = doc.lineAt(from);
    const end = to < line.to && doc.sliceString(to, to + 1) === " " ? to + 1 : to;
    decorations.push(HIDE.range(from, end));
    return end;
  };

  // Só blocos na raiz do documento viram widget. Dentro de uma citação ou de
  // um item de lista as linhas já carregam decoração de linha, e uma
  // substituição de bloco por cima delas quebraria o layout do CodeMirror.
  const replaceBlock = (node: SyntaxNodeRef): boolean => {
    if (node.node.parent?.name !== "Document") return false;
    const first = doc.lineAt(node.from);
    const last = doc.lineAt(node.to);
    decorations.push(
      Decoration.replace({
        widget: new RenderedBlockWidget(doc.sliceString(first.from, last.to)),
        block: true,
      }).range(first.from, last.to)
    );
    return true;
  };

  const decorateLines = (from: number, to: number, className: string) => {
    const first = doc.lineAt(from).number;
    const last = doc.lineAt(to).number;
    for (let n = first; n <= last; n++) decorations.push(lineDeco(className).range(doc.line(n).from));
  };

  syntaxTree(state).iterate({
    enter: (node): boolean | void => {
      const name = node.name;

      /* --- Títulos ------------------------------------------------- */
      if (/^(ATX|Setext)Heading[1-6]$/.test(name)) {
        decorations.push(lineDeco(`cm-md-h${name.slice(-1)}`).range(doc.lineAt(node.from).from));
        return;
      }

      if (name === "HeaderMark") {
        const parent = node.node.parent;
        if (!parent) return;
        if (parent.name.startsWith("Setext")) {
          // O "======" some junto com a quebra de linha que o precede, senão
          // sobraria uma linha vazia debaixo do título.
          if (!spanActive(parent.from, parent.to) && node.from > 0) {
            decorations.push(HIDE.range(node.from - 1, node.to));
          } else {
            decorations.push(markDeco("cm-md-syntax").range(node.from, node.to));
          }
          return;
        }
        if (isActive(node.from)) decorations.push(markDeco("cm-md-syntax").range(node.from, node.to));
        else hideMarker(node.from, node.to);
        return;
      }

      /* --- Ênfases ------------------------------------------------- */
      if (name === "StrongEmphasis" || name === "Emphasis" || name === "Strikethrough") {
        const cls = name === "StrongEmphasis" ? "strong" : name === "Emphasis" ? "em" : "strike";
        decorations.push(markDeco(`cm-md-${cls}`).range(node.from, node.to));
        return;
      }
      if (name === "Highlight") {
        decorations.push(markDeco("cm-md-highlight").range(node.from, node.to));
        return;
      }
      if (name === "EmphasisMark" || name === "StrikethroughMark" || name === "HighlightMark") {
        if (isActive(node.from)) decorations.push(markDeco("cm-md-syntax").range(node.from, node.to));
        else decorations.push(HIDE.range(node.from, node.to));
        return;
      }

      /* --- Código -------------------------------------------------- */
      if (name === "InlineCode") {
        decorations.push(markDeco("cm-md-code").range(node.from, node.to));
        return;
      }
      if (name === "CodeMark") {
        if (node.node.parent?.name !== "InlineCode") return;
        if (isActive(node.from)) decorations.push(markDeco("cm-md-syntax").range(node.from, node.to));
        else decorations.push(HIDE.range(node.from, node.to));
        return;
      }
      if (name === "FencedCode" || name === "CodeBlock") {
        if (spanActive(node.from, node.to) || !replaceBlock(node)) {
          decorateLines(node.from, node.to, "cm-md-code-source");
        }
        return false;
      }

      /* --- Blocos inteiros ----------------------------------------- */
      if (name === "HorizontalRule") {
        if (isActive(node.from) || !replaceBlock(node)) {
          decorateLines(node.from, node.to, "cm-md-rule-source");
        }
        return false;
      }
      if (name === "Table") {
        if (spanActive(node.from, node.to) || !replaceBlock(node)) {
          decorateLines(node.from, node.to, "cm-md-table-source");
          return;
        }
        return false;
      }
      if (name === "TableDelimiter") {
        decorations.push(markDeco("cm-md-syntax").range(node.from, node.to));
        return;
      }

      /* --- Citação -------------------------------------------------- */
      if (name === "Blockquote") {
        decorateLines(node.from, node.to, "cm-md-quote");
        return;
      }
      if (name === "QuoteMark") {
        if (isActive(node.from)) decorations.push(markDeco("cm-md-syntax").range(node.from, node.to));
        else hideMarker(node.from, node.to);
        return;
      }

      /* --- Listas e checklists -------------------------------------- */
      if (name === "ListMark") {
        // A bolinha e a caixa ficam sempre renderizadas, mesmo na linha do
        // cursor — é assim que o Obsidian se comporta, e é o que deixa a
        // checklist clicável enquanto se escreve nela.
        if (node.node.nextSibling?.name === "Task") {
          const end = hideMarker(node.from, node.to);
          atomic.push(HIDE.range(node.from, end));
          return;
        }
        if (/\d/.test(doc.sliceString(node.from, node.to))) {
          decorations.push(markDeco("cm-md-ordered-mark").range(node.from, node.to));
          return;
        }
        decorations.push(BULLET.range(node.from, node.to));
        atomic.push(HIDE.range(node.from, node.to));
        return;
      }
      if (name === "TaskMarker") {
        const checked = /x/i.test(doc.sliceString(node.from, node.to));
        const line = doc.lineAt(node.from);
        const end =
          node.to < line.to && doc.sliceString(node.to, node.to + 1) === " " ? node.to + 1 : node.to;
        decorations.push(
          Decoration.replace({ widget: new CheckboxWidget(checked) }).range(node.from, end)
        );
        atomic.push(HIDE.range(node.from, end));
        return false;
      }
      if (name === "Task") {
        const marker = node.node.getChild("TaskMarker");
        if (marker && /x/i.test(doc.sliceString(marker.from, marker.to)) && marker.to < node.to) {
          decorations.push(markDeco("cm-md-task-done").range(marker.to, node.to));
        }
        return;
      }

      /* --- Links e imagens ------------------------------------------ */
      if (name === "Image") {
        if (!isActive(node.from)) {
          const href = linkHref(node.node, doc);
          const marks = linkMarks(node.node);
          const alt =
            marks.length >= 2 && marks[1].from > marks[0].to
              ? doc.sliceString(marks[0].to, marks[1].from)
              : "";
          if (href) {
            decorations.push(
              Decoration.replace({ widget: new ImageWidget(href, alt) }).range(node.from, node.to)
            );
            atomic.push(HIDE.range(node.from, node.to));
            return false;
          }
        }
        return;
      }
      if (name === "Link") {
        if (isActive(node.from)) return;
        const marks = linkMarks(node.node);
        if (marks.length < 2 || marks[1].from <= marks[0].to) return;
        const href = linkHref(node.node, doc);
        decorations.push(
          Decoration.mark({
            class: "cm-md-link",
            attributes: href ? { "data-md-href": href } : undefined,
          }).range(marks[0].to, marks[1].from)
        );
        return;
      }
      if (name === "LinkMark" || name === "LinkTitle") {
        if (isActive(node.from)) decorations.push(markDeco("cm-md-syntax").range(node.from, node.to));
        else decorations.push(HIDE.range(node.from, node.to));
        return;
      }
      if (name === "URL") {
        const parent = node.node.parent?.name;
        if (parent === "Link" || parent === "Image") {
          if (isActive(node.from)) {
            decorations.push(markDeco("cm-md-syntax").range(node.from, node.to));
          } else {
            decorations.push(HIDE.range(node.from, node.to));
          }
          return;
        }
        // Autolink: a URL solta continua visível, só ganha cara de link.
        const href = safeUrl(doc.sliceString(node.from, node.to));
        decorations.push(
          Decoration.mark({
            class: "cm-md-link",
            attributes: href ? { "data-md-href": href } : undefined,
          }).range(node.from, node.to)
        );
        return;
      }
    },
  });

  return {
    decorations: Decoration.set(decorations, true),
    atomic: Decoration.set(atomic, true),
  };
}

const livePreviewField = StateField.define<Built>({
  create: (state) => build(state),
  // Recalcula em toda transação: a decoração depende do cursor, e a nota é
  // curta o bastante para uma varredura completa da árvore ser barata.
  update: (_value, tr) => build(tr.state),
  provide: (field) => [
    EditorView.decorations.from(field, (value) => value.decorations),
    EditorView.atomicRanges.of((view) => view.state.field(field).atomic),
  ],
});

/* ------------------------------------------------------------------ *
 * Interação
 * ------------------------------------------------------------------ */

function hrefAt(target: EventTarget | null): string | null {
  const element = (target as HTMLElement | null)?.closest?.("[data-md-href]");
  return element?.getAttribute("data-md-href") ?? null;
}

const linkHandlers = EditorView.domEventHandlers({
  // No mousedown o cursor ainda não se mexeu: barrar aqui evita que tocar num
  // link revele a fonte da linha antes de o clique abrir a página.
  mousedown(event) {
    if (!hrefAt(event.target)) return false;
    event.preventDefault();
    return true;
  },
  click(event) {
    const href = hrefAt(event.target);
    if (!href) return false;
    event.preventDefault();
    window.open(href, "_blank", "noopener,noreferrer");
    return true;
  },
});

/* ------------------------------------------------------------------ *
 * Comandos (barra de formatação e atalhos)
 * ------------------------------------------------------------------ */

/** Menor troca possível entre dois textos, para o histórico não engolir a nota inteira. */
function minimalChange(before: string, after: string) {
  let start = 0;
  const max = Math.min(before.length, after.length);
  while (start < max && before[start] === after[start]) start++;
  let endBefore = before.length;
  let endAfter = after.length;
  while (endBefore > start && endAfter > start && before[endBefore - 1] === after[endAfter - 1]) {
    endBefore--;
    endAfter--;
  }
  return { from: start, to: endBefore, insert: after.slice(start, endAfter) };
}

/**
 * Ponte entre as funções puras de markdownEditor.ts e o CodeMirror: lê o texto
 * e a seleção, aplica a transformação e devolve o resultado como uma edição só.
 */
export function applyMarkdownEdit(
  view: EditorView,
  transform: (state: MarkdownState) => MarkdownState | null
): boolean {
  const text = view.state.doc.toString();
  const selection = view.state.selection.main;
  const result = transform({ text, start: selection.from, end: selection.to });
  if (!result) return false;

  view.dispatch({
    changes: minimalChange(text, result.text),
    selection: { anchor: result.start, head: result.end },
    scrollIntoView: true,
    userEvent: "input",
  });
  return true;
}

export const markdownActions = {
  heading: (view: EditorView) => applyMarkdownEdit(view, (s) => toggleLinePrefix(s, "## ")),
  bold: (view: EditorView) => applyMarkdownEdit(view, (s) => wrapSelection(s, "**", "negrito")),
  italic: (view: EditorView) => applyMarkdownEdit(view, (s) => wrapSelection(s, "*", "itálico")),
  strike: (view: EditorView) => applyMarkdownEdit(view, (s) => wrapSelection(s, "~~", "riscado")),
  highlight: (view: EditorView) => applyMarkdownEdit(view, (s) => wrapSelection(s, "==", "destaque")),
  list: (view: EditorView) => applyMarkdownEdit(view, (s) => toggleLinePrefix(s, "- ")),
  checklist: (view: EditorView) => applyMarkdownEdit(view, (s) => toggleLinePrefix(s, "- [ ] ")),
  quote: (view: EditorView) => applyMarkdownEdit(view, (s) => toggleLinePrefix(s, "> ")),
  code: (view: EditorView) => applyMarkdownEdit(view, insertCodeBlock),
  link: (view: EditorView) => applyMarkdownEdit(view, (s) => insertLink(s)),
};

const noteKeymap: KeyBinding[] = [
  { key: "Enter", run: (view) => applyMarkdownEdit(view, continueBlock) },
  { key: "Backspace", run: (view) => applyMarkdownEdit(view, deleteMarkupBackward) },
  { key: "Tab", run: indentMore, shift: indentLess },
  { key: "Mod-b", run: markdownActions.bold },
  { key: "Mod-i", run: markdownActions.italic },
  { key: "Mod-k", run: markdownActions.link },
  { key: "Mod-Shift-h", run: markdownActions.highlight },
];

/* ------------------------------------------------------------------ *
 * Tema
 * ------------------------------------------------------------------ */

const editorTheme = EditorView.theme({
  "&": {
    height: "100%",
    color: "var(--foreground)",
    backgroundColor: "transparent",
    fontSize: "1rem",
  },
  "&.cm-focused": { outline: "none" },
  ".cm-scroller": {
    fontFamily: "inherit",
    lineHeight: "1.7",
    overflowY: "auto",
    overflowX: "hidden",
  },
  // A folga embaixo deixa a última linha subir acima do teclado do celular.
  ".cm-content": { padding: "0.25rem 0 8rem", caretColor: "var(--accent)" },
  ".cm-line": { padding: "0 1rem" },
  ".cm-cursor, .cm-dropCursor": { borderLeftColor: "var(--accent)", borderLeftWidth: "2px" },
  ".cm-selectionBackground, ::selection": { backgroundColor: "var(--accent-muted)" },
  ".cm-placeholder": { color: "var(--muted)", opacity: "0.7" },
});

/* ------------------------------------------------------------------ *
 * Montagem
 * ------------------------------------------------------------------ */

export function noteEditorExtensions(placeholderText: string): Extension[] {
  return [
    noteMarkdownLanguage,
    focusField,
    focusTracker,
    livePreviewField,
    linkHandlers,
    history(),
    EditorView.lineWrapping,
    EditorState.allowMultipleSelections.of(false),
    EditorView.contentAttributes.of({ spellcheck: "true", autocapitalize: "sentences" }),
    placeholder(placeholderText),
    editorTheme,
    // Precedência alta: Enter e Backspace do markdown vêm antes dos padrões.
    Prec.high(keymap.of(noteKeymap)),
    keymap.of([...historyKeymap, ...defaultKeymap]),
  ];
}
