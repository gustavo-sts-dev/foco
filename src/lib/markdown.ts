// Renderizador de Markdown proprio, sem dependencias.
//
// Por que nao react-markdown: o modulo de notas precisa gerar HTML tanto para a
// tela quanto para o container de impressao (exportacao em PDF), e o bundle de
// um PWA mobile paga caro por ~100KB de parser. O subconjunto abaixo cobre o que
// se escreve numa nota (titulos, listas, checklists, citacoes, codigo, tabelas).
//
// SEGURANCA: todo texto do usuario passa por escapeHtml ANTES de qualquer
// transformacao, e nenhuma regra reinjeta o texto cru. HTML escrito dentro da
// nota aparece como texto literal, nunca e executado.

const NUL = "\u0000";

export function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

// Só http(s), mailto e tel viram href. Qualquer outra coisa (javascript:,
// data:, vbscript:) perde o link e vira texto. Caminhos relativos e âncoras
// também passam, por serem inofensivos.
function safeUrl(url: string): string | null {
  const trimmed = url.trim();
  if (!trimmed) return null;
  if (/^(https?:\/\/|mailto:|tel:|#|\/|\.\/|\.\.\/)/i.test(trimmed)) return trimmed;
  // "www.exemplo.com" sem protocolo
  if (/^www\./i.test(trimmed)) return "https://" + trimmed;
  // Sem esquema e sem barra: trata como caminho relativo se não houver ":"
  if (!trimmed.includes(":")) return trimmed;
  return null;
}

/** Guarda HTML já pronto atrás de um marcador, para as regras seguintes não o reprocessarem. */
class Stash {
  private items: string[] = [];

  put(html: string): string {
    this.items.push(html);
    return NUL + (this.items.length - 1) + NUL;
  }

  restore(text: string): string {
    let out = text;
    // Um item guardado pode conter o marcador de outro (link com código dentro),
    // por isso repete até estabilizar.
    for (let pass = 0; pass < 10 && out.includes(NUL); pass++) {
      out = out.replace(
        new RegExp(NUL + "(\\d+)" + NUL, "g"),
        (match, index) => this.items[Number(index)] ?? match
      );
    }
    return out;
  }
}

function renderInline(raw: string): string {
  const stash = new Stash();
  let text = escapeHtml(raw);

  // 1. Código inline primeiro: nada dentro dele é formatado.
  text = text.replace(/`([^`\n]+)`/g, (_m, code: string) => stash.put("<code>" + code + "</code>"));

  // 2. Imagens antes de links (a sintaxe só difere pelo "!").
  text = text.replace(
    /!\[([^\]]*)\]\(([^)\s]+)(?:\s+&quot;([^&]*)&quot;)?\)/g,
    (match: string, alt: string, url: string, title?: string) => {
      const href = safeUrl(url);
      if (!href) return match;
      const titleAttr = title ? ' title="' + title + '"' : "";
      return stash.put('<img src="' + href + '" alt="' + alt + '"' + titleAttr + ' loading="lazy" />');
    }
  );

  // 3. Links.
  text = text.replace(
    /\[([^\]]*)\]\(([^)\s]+)(?:\s+&quot;([^&]*)&quot;)?\)/g,
    (match: string, label: string, url: string, title?: string) => {
      const href = safeUrl(url);
      if (!href) return match;
      const titleAttr = title ? ' title="' + title + '"' : "";
      const rel = /^https?:/i.test(href) ? ' target="_blank" rel="noopener noreferrer"' : "";
      return stash.put('<a href="' + href + '"' + titleAttr + rel + ">" + label + "</a>");
    }
  );

  // 4. Ênfases. Negrito antes de itálico para "***x***" fechar na ordem certa.
  text = text.replace(/\*\*(?=\S)([\s\S]*?\S)\*\*/g, (_m, inner: string) =>
    stash.put("<strong>" + inner + "</strong>")
  );
  text = text.replace(/__(?=\S)([\s\S]*?\S)__/g, (_m, inner: string) =>
    stash.put("<strong>" + inner + "</strong>")
  );
  text = text.replace(/~~(?=\S)([\s\S]*?\S)~~/g, (_m, inner: string) =>
    stash.put("<del>" + inner + "</del>")
  );
  text = text.replace(/==(?=\S)([\s\S]*?\S)==/g, (_m, inner: string) =>
    stash.put("<mark>" + inner + "</mark>")
  );
  text = text.replace(/\*(?=\S)([^*\n]*?\S|\S)\*/g, (_m, inner: string) =>
    stash.put("<em>" + inner + "</em>")
  );
  // "_" só marca itálico fora de palavras, senão quebraria nome_de_variavel.
  // Sem lookbehind de propósito: iOS Safari antigo não suporta.
  text = text.replace(
    /(^|[^A-Za-z0-9_])_(?=\S)([^_\n]*?\S|\S)_(?![A-Za-z0-9])/g,
    (_m, before: string, inner: string) => before + stash.put("<em>" + inner + "</em>")
  );

  // 5. URLs soltas viram link (os links explícitos já viraram marcadores).
  text = text.replace(
    /(^|[\s(])((?:https?:\/\/|www\.)[^\s<]+[^\s<.,:;!?"')\]}])/g,
    (match: string, before: string, url: string) => {
      const href = safeUrl(url);
      if (!href) return match;
      return (
        before +
        stash.put('<a href="' + href + '" target="_blank" rel="noopener noreferrer">' + url + "</a>")
      );
    }
  );

  return stash.restore(text);
}

type RawListItem = {
  indent: number;
  ordered: boolean;
  /** null quando não é checklist */
  checked: boolean | null;
  lines: string[];
  level: number;
};

const ITEM_RE = /^(\s*)([-*+]|\d+[.)])\s+(.*)$/;
const HEADING_RE = /^(#{1,6})\s+(.*?)\s*#*\s*$/;
const HR_RE = /^ {0,3}([-*_])\s*(?:\1\s*){2,}$/;
const FENCE_RE = /^\s*(`{3,}|~{3,})\s*([A-Za-z0-9+#_-]*)\s*$/;
const BACKTICK_CLOSE_RE = /^\s*`{3,}\s*$/;
const TILDE_CLOSE_RE = /^\s*~{3,}\s*$/;
const QUOTE_RE = /^\s{0,3}>\s?(.*)$/;
const TABLE_DIVIDER_RE = /^\s*\|?(?:\s*:?-{1,}:?\s*\|)+\s*:?-{1,}:?\s*\|?\s*$/;

function isBlockStart(line: string): boolean {
  return (
    HEADING_RE.test(line) ||
    HR_RE.test(line) ||
    FENCE_RE.test(line) ||
    QUOTE_RE.test(line) ||
    ITEM_RE.test(line)
  );
}

function splitTableRow(line: string): string[] {
  return line
    .replace(/^\s*\|/, "")
    .replace(/\|\s*$/, "")
    .split("|")
    .map((cell) => cell.trim());
}

// Normaliza a indentação bruta em níveis 0,1,2... sempre crescendo de 1 em 1.
// Sem isso, "- a / ····- b / ··- c" (recuos 0, 4, 2) geraria uma árvore
// impossível de fechar e a recursão poderia não avançar.
function assignLevels(items: RawListItem[]): void {
  const stack: number[] = [];
  for (const item of items) {
    while (stack.length > 0 && item.indent < stack[stack.length - 1]) stack.pop();
    if (stack.length === 0 || item.indent > stack[stack.length - 1]) stack.push(item.indent);
    item.level = stack.length - 1;
  }
}

function renderListLevel(
  items: RawListItem[],
  start: number,
  level: number
): { html: string; next: number } {
  const ordered = items[start].ordered;
  const isTaskList = items[start].checked !== null;
  const parts: string[] = [];
  let i = start;

  while (i < items.length && items[i].level === level && items[i].ordered === ordered) {
    const item = items[i];
    i++;

    let children = "";
    while (i < items.length && items[i].level > level) {
      const nested = renderListLevel(items, i, items[i].level);
      children += nested.html;
      i = nested.next;
    }

    const body = renderInline(item.lines.join("\n").trim()).replace(/\n/g, "<br />");

    if (item.checked !== null) {
      const state = item.checked ? " checked" : "";
      const cls = item.checked ? "md-task md-task-done" : "md-task";
      parts.push(
        '<li class="' +
          cls +
          '"><input type="checkbox" disabled' +
          state +
          " /><span>" +
          body +
          "</span>" +
          children +
          "</li>"
      );
    } else {
      parts.push("<li>" + body + children + "</li>");
    }
  }

  const tag = ordered ? "ol" : "ul";
  const attr = isTaskList ? ' class="md-task-list"' : "";
  return { html: "<" + tag + attr + ">" + parts.join("") + "</" + tag + ">", next: i };
}

function renderBlocks(lines: string[]): string {
  const out: string[] = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];

    // Linha vazia
    if (!line.trim()) {
      i++;
      continue;
    }

    // Bloco de código cercado
    const fence = line.match(FENCE_RE);
    if (fence) {
      const closeRe = fence[1][0] === "~" ? TILDE_CLOSE_RE : BACKTICK_CLOSE_RE;
      const lang = fence[2];
      const body: string[] = [];
      i++;
      while (i < lines.length && !closeRe.test(lines[i])) {
        body.push(lines[i]);
        i++;
      }
      i++; // consome a cerca final (ou passa do fim, se o bloco não fechou)
      const langAttr = lang ? ' class="language-' + escapeHtml(lang) + '"' : "";
      out.push("<pre><code" + langAttr + ">" + escapeHtml(body.join("\n")) + "</code></pre>");
      continue;
    }

    // Linha horizontal (antes da lista: "---" também casaria como item "-")
    if (HR_RE.test(line)) {
      out.push("<hr />");
      i++;
      continue;
    }

    // Título
    const heading = line.match(HEADING_RE);
    if (heading) {
      const depth = heading[1].length;
      out.push("<h" + depth + ">" + renderInline(heading[2]) + "</h" + depth + ">");
      i++;
      continue;
    }

    // Citação
    if (QUOTE_RE.test(line)) {
      const body: string[] = [];
      while (i < lines.length && lines[i].trim()) {
        const match = lines[i].match(QUOTE_RE);
        // Continuação preguiçosa: linha solta dentro da citação
        body.push(match ? match[1] : lines[i]);
        i++;
      }
      out.push("<blockquote>" + renderBlocks(body) + "</blockquote>");
      continue;
    }

    // Tabela: cabeçalho seguido de linha divisória
    if (line.includes("|") && i + 1 < lines.length && TABLE_DIVIDER_RE.test(lines[i + 1])) {
      const header = splitTableRow(line);
      const aligns = splitTableRow(lines[i + 1]).map((cell) => {
        const left = cell.startsWith(":");
        const right = cell.endsWith(":");
        if (left && right) return "center";
        if (right) return "right";
        if (left) return "left";
        return "";
      });
      i += 2;
      const rows: string[][] = [];
      while (i < lines.length && lines[i].trim() && lines[i].includes("|")) {
        rows.push(splitTableRow(lines[i]));
        i++;
      }
      const align = (index: number) =>
        aligns[index] ? ' style="text-align:' + aligns[index] + '"' : "";
      const head = header
        .map((cell, index) => "<th" + align(index) + ">" + renderInline(cell) + "</th>")
        .join("");
      const body = rows
        .map(
          (row) =>
            "<tr>" +
            header
              .map(
                (_c, index) => "<td" + align(index) + ">" + renderInline(row[index] ?? "") + "</td>"
              )
              .join("") +
            "</tr>"
        )
        .join("");
      out.push(
        '<div class="md-table-wrap"><table><thead><tr>' +
          head +
          "</tr></thead><tbody>" +
          body +
          "</tbody></table></div>"
      );
      continue;
    }

    // Listas (com aninhamento e checklists)
    if (ITEM_RE.test(line)) {
      const items: RawListItem[] = [];
      while (i < lines.length) {
        const match = lines[i].match(ITEM_RE);
        if (match) {
          const content = match[3];
          const task = content.match(/^\[([ xX])\]\s*(.*)$/);
          items.push({
            indent: match[1].replace(/\t/g, "    ").length,
            ordered: /\d/.test(match[2]),
            checked: task ? task[1].toLowerCase() === "x" : null,
            lines: [task ? task[2] : content],
            level: 0,
          });
          i++;
          continue;
        }
        // Continuação do item anterior: linha indentada e não vazia
        if (items.length > 0 && lines[i].trim() && /^\s{2,}/.test(lines[i])) {
          items[items.length - 1].lines.push(lines[i].trim());
          i++;
          continue;
        }
        // Linha vazia só encerra a lista se a próxima não for outro item
        if (!lines[i].trim() && i + 1 < lines.length && ITEM_RE.test(lines[i + 1])) {
          i++;
          continue;
        }
        break;
      }
      assignLevels(items);
      let index = 0;
      while (index < items.length) {
        const rendered = renderListLevel(items, index, items[index].level);
        out.push(rendered.html);
        index = rendered.next;
      }
      continue;
    }

    // Parágrafo: junta linhas até uma linha vazia ou o início de outro bloco.
    const paragraph: string[] = [];
    while (i < lines.length && lines[i].trim() && !isBlockStart(lines[i])) {
      paragraph.push(lines[i].trim());
      i++;
    }
    if (paragraph.length > 0) {
      // Quebra simples vira <br />: numa nota, Enter costuma significar nova
      // linha mesmo, e não continuação do parágrafo (como manda o CommonMark).
      out.push("<p>" + renderInline(paragraph.join("\n")).replace(/\n/g, "<br />") + "</p>");
    } else {
      // Trava contra laço infinito: nenhuma regra consumiu esta linha.
      out.push("<p>" + renderInline(lines[i]) + "</p>");
      i++;
    }
  }

  return out.join("");
}

/** Converte markdown em HTML seguro (todo o texto do usuário é escapado). */
export function renderMarkdown(markdown: string): string {
  if (!markdown || !markdown.trim()) return "";
  const lines = markdown.replace(/\r\n?/g, "\n").split("\n");
  return renderBlocks(lines);
}

/** Texto puro, para prévias na lista e para busca. */
export function markdownToPlainText(markdown: string): string {
  return markdown
    .replace(/\r\n?/g, "\n")
    .replace(/```[\s\S]*?(?:```|$)/g, " ")
    .replace(/`([^`]*)`/g, "$1")
    .replace(/!\[([^\]]*)\]\([^)]*\)/g, "$1")
    .replace(/\[([^\]]*)\]\([^)]*\)/g, "$1")
    .replace(/^\s{0,3}>\s?/gm, "")
    .replace(/^\s*([-*_])\s*(?:\1\s*){2,}$/gm, " ")
    .replace(/^\s*(?:[-*+]|\d+[.)])\s+(?:\[[ xX]\]\s*)?/gm, "")
    .replace(/^\s*#{1,6}\s+/gm, "")
    .replace(/(\*\*|__|~~|==|\*|_)/g, "")
    .replace(/\|/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}
