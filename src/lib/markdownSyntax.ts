// Linguagem markdown do editor (parser Lezer + integração com o CodeMirror).
//
// Por que montar a Language na mão em vez de usar @codemirror/lang-markdown:
// aquele pacote importa @codemirror/lang-html estaticamente, que por sua vez
// arrasta lang-javascript e lang-css (~500KB de gramáticas) só para colorir
// HTML dentro da nota. Aqui montamos a Language direto sobre o @lezer/markdown
// e pagamos apenas pelo parser de markdown.
//
// O dialeto é exatamente o que o renderMarkdown de markdown.ts entende: GFM
// (tabelas, checklists, riscado, autolink) mais o realce "==texto==". Duas
// gramáticas diferentes para a mesma nota fariam o editor e o PDF divergirem.

import { Language, defineLanguageFacet, languageDataProp } from "@codemirror/language";
import { tags as t } from "@lezer/highlight";
import { GFM, type MarkdownConfig, parser as baseParser } from "@lezer/markdown";

const HighlightDelimiter = { resolve: "Highlight", mark: "HighlightMark" };

const PUNCTUATION = /[!"#$%&'()*+,\-./:;<=>?@[\\\]^_`{|}~]/;

/**
 * `==texto==` -> <mark>. Copia a lógica de abertura/fechamento do
 * Strikethrough do GFM (espaço e pontuação ao redor decidem se o delimitador
 * abre, fecha ou os dois), só trocando "~~" por "==".
 */
const Highlight: MarkdownConfig = {
  defineNodes: [
    { name: "Highlight", style: { "Highlight/...": t.special(t.emphasis) } },
    { name: "HighlightMark", style: t.processingInstruction },
  ],
  parseInline: [
    {
      name: "Highlight",
      after: "Emphasis",
      parse(cx, next, pos) {
        // 61 = "=". Só "==" delimita; "===" é sublinhado de título Setext.
        if (next !== 61 || cx.char(pos + 1) !== 61 || cx.char(pos + 2) === 61) return -1;
        const before = cx.slice(pos - 1, pos);
        const after = cx.slice(pos + 2, pos + 3);
        const spaceBefore = /\s|^$/.test(before);
        const spaceAfter = /\s|^$/.test(after);
        const punctBefore = PUNCTUATION.test(before);
        const punctAfter = PUNCTUATION.test(after);
        return cx.addDelimiter(
          HighlightDelimiter,
          pos,
          pos + 2,
          !spaceAfter && (!punctAfter || spaceBefore || punctBefore),
          !spaceBefore && (!punctBefore || spaceAfter || punctAfter)
        );
      },
    },
  ],
};

const languageData = defineLanguageFacet({
  commentTokens: { block: { open: "<!--", close: "-->" } },
});

const noteParser = baseParser.configure([
  GFM,
  Highlight,
  { props: [languageDataProp.add({ Document: languageData })] },
]);

export const noteMarkdownLanguage = new Language(languageData, noteParser, [], "markdown");
