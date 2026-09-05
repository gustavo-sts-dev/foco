// Operações da barra de formatação do editor.
//
// Tudo aqui é função pura sobre (texto, seleção) -> (texto, seleção). O
// componente só lê o textarea, chama estas funções e devolve o resultado —
// o que torna o comportamento testável sem DOM e mantém o cursor previsível,
// que é o detalhe que faz ou quebra a edição no celular.

export type EditorState = {
  text: string;
  start: number;
  end: number;
};

const ITEM_RE = /^(\s*)([-*+]\s+\[[ xX]\]\s+|[-*+]\s+|\d+[.)]\s+)(.*)$/;
const QUOTE_RE = /^(\s*)(>\s?)(.*)$/;
/** Marcação de bloco que o Backspace desfaz quando o cursor está logo depois dela. */
const MARKUP_RE = /^(\s*)([-*+] \[[ xX]\] |[-*+] |\d+[.)] |> )$/;

function lineBounds(text: string, start: number, end: number) {
  const from = text.lastIndexOf("\n", start - 1) + 1;
  const nextBreak = text.indexOf("\n", end);
  const to = nextBreak === -1 ? text.length : nextBreak;
  return { from, to };
}

/** Envolve a seleção com um marcador (**, *, `, ~~). Repetir desfaz. */
export function wrapSelection(
  state: EditorState,
  marker: string,
  placeholder: string
): EditorState {
  const { text, start, end } = state;
  const selected = text.slice(start, end);

  // Já envolvido por fora da seleção: "**|texto|**" -> tira os marcadores.
  const before = text.slice(Math.max(0, start - marker.length), start);
  const after = text.slice(end, end + marker.length);
  if (selected && before === marker && after === marker) {
    return {
      text: text.slice(0, start - marker.length) + selected + text.slice(end + marker.length),
      start: start - marker.length,
      end: end - marker.length,
    };
  }

  // Já envolvido por dentro da seleção: "|**texto**|" -> tira os marcadores.
  if (
    selected.length >= marker.length * 2 &&
    selected.startsWith(marker) &&
    selected.endsWith(marker)
  ) {
    const inner = selected.slice(marker.length, selected.length - marker.length);
    return { text: text.slice(0, start) + inner + text.slice(end), start, end: start + inner.length };
  }

  const body = selected || placeholder;
  return {
    text: text.slice(0, start) + marker + body + marker + text.slice(end),
    start: start + marker.length,
    end: start + marker.length + body.length,
  };
}

/** Liga/desliga um prefixo ("- ", "> ", "# ") em todas as linhas da seleção. */
export function toggleLinePrefix(state: EditorState, prefix: string): EditorState {
  const { text, start, end } = state;
  const { from, to } = lineBounds(text, start, end);
  const lines = text.slice(from, to).split("\n");

  // Um prefixo de título substitui outro em vez de empilhar "## # texto".
  const headingLike = /^#{1,6} $/.test(prefix);
  const strip = (line: string) =>
    headingLike ? line.replace(/^#{1,6} /, "") : line.slice(prefix.length);

  const allPrefixed = lines.every((line) =>
    headingLike ? line.startsWith(prefix) : line.startsWith(prefix)
  );

  const next = lines
    .map((line) => {
      if (allPrefixed) return strip(line);
      if (headingLike) return prefix + line.replace(/^#{1,6} /, "");
      return line.startsWith(prefix) ? line : prefix + stripOtherMarkers(line, prefix);
    })
    .join("\n");

  const delta = next.length - (to - from);
  return {
    text: text.slice(0, from) + next + text.slice(to),
    start,
    end: Math.max(start, end + delta),
  };
}

// Trocar de lista para checklist (ou o contrário) deve substituir o marcador,
// não empilhar "- - [ ] item".
function stripOtherMarkers(line: string, prefix: string): string {
  const listLike = /^([-*+] \[[ xX]\] |[-*+] |\d+[.)] )/;
  if (/^([-*+] \[[ xX]\] |[-*+] |\d+[.)] |> )/.test(prefix)) {
    return line.replace(listLike, "");
  }
  return line;
}

/** Insere um link, usando a seleção como rótulo quando houver. */
export function insertLink(state: EditorState, url = "https://"): EditorState {
  const { text, start, end } = state;
  const label = text.slice(start, end) || "texto";
  const snippet = "[" + label + "](" + url + ")";
  return {
    text: text.slice(0, start) + snippet + text.slice(end),
    // Deixa o cursor sobre a URL: é o que a pessoa vai colar em seguida.
    start: start + label.length + 3,
    end: start + label.length + 3 + url.length,
  };
}

/** Insere um bloco de código cercado ao redor da seleção. */
export function insertCodeBlock(state: EditorState): EditorState {
  const { text, start, end } = state;
  const selected = text.slice(start, end) || "código";
  const prefix = start > 0 && text[start - 1] !== "\n" ? "\n" : "";
  const snippet = prefix + "```\n" + selected + "\n```\n";
  return {
    text: text.slice(0, start) + snippet + text.slice(end),
    start: start + prefix.length + 4,
    end: start + prefix.length + 4 + selected.length,
  };
}

/**
 * Enter dentro de uma lista continua a lista. Enter num item vazio sai dela.
 * Devolve null quando a tecla não deve ser interceptada.
 */
export function continueList(state: EditorState): EditorState | null {
  const { text, start, end } = state;
  if (start !== end) return null;

  const lineStart = text.lastIndexOf("\n", start - 1) + 1;
  const line = text.slice(lineStart, start);
  const match = line.match(ITEM_RE);
  if (!match) return null;

  const [, indent, marker, content] = match;

  // Item vazio: a pessoa quis encerrar a lista.
  if (!content.trim()) {
    return {
      text: text.slice(0, lineStart) + text.slice(start),
      start: lineStart,
      end: lineStart,
    };
  }

  let nextMarker = marker;
  const ordered = marker.match(/^(\d+)([.)])\s+$/);
  if (ordered) {
    nextMarker = String(Number(ordered[1]) + 1) + ordered[2] + " ";
  } else {
    // A checklist continua desmarcada, nunca herda o "[x]".
    nextMarker = marker.replace(/\[[xX]\]/, "[ ]");
  }

  const insertion = "\n" + indent + nextMarker;
  return {
    text: text.slice(0, start) + insertion + text.slice(start),
    start: start + insertion.length,
    end: start + insertion.length,
  };
}

/**
 * Enter dentro de uma citação continua a citação; Enter numa citação vazia sai
 * dela. Mesmo contrato de continueList.
 */
export function continueQuote(state: EditorState): EditorState | null {
  const { text, start, end } = state;
  if (start !== end) return null;

  const lineStart = text.lastIndexOf("\n", start - 1) + 1;
  const line = text.slice(lineStart, start);
  const match = line.match(QUOTE_RE);
  if (!match) return null;

  const [, indent, marker, content] = match;

  if (!content.trim()) {
    return {
      text: text.slice(0, lineStart) + text.slice(start),
      start: lineStart,
      end: lineStart,
    };
  }

  // "> " é o marcador canônico mesmo quando a linha veio com ">" colado.
  const insertion = "\n" + indent + (marker.endsWith(" ") ? marker : marker + " ");
  return {
    text: text.slice(0, start) + insertion + text.slice(start),
    start: start + insertion.length,
    end: start + insertion.length,
  };
}

/** Enter no editor: continua lista ou citação, o que estiver valendo na linha. */
export function continueBlock(state: EditorState): EditorState | null {
  return continueList(state) ?? continueQuote(state);
}

/**
 * Backspace logo depois da marcação de um item ("- ", "1. ", "> ", "- [ ] ")
 * apaga a marcação inteira em vez de uma letra. Um segundo Backspace, agora
 * sobre a indentação, tira um nível de recuo. Devolve null quando a tecla deve
 * seguir o caminho normal.
 */
export function deleteMarkupBackward(state: EditorState): EditorState | null {
  const { text, start, end } = state;
  if (start !== end || start === 0) return null;

  const lineStart = text.lastIndexOf("\n", start - 1) + 1;
  const before = text.slice(lineStart, start);

  const markup = before.match(MARKUP_RE);
  if (markup) {
    const keep = markup[1];
    return {
      text: text.slice(0, lineStart) + keep + text.slice(start),
      start: lineStart + keep.length,
      end: lineStart + keep.length,
    };
  }

  // Só espaços entre o começo da linha e o cursor: recua um nível.
  if (before.length > 0 && /^\s+$/.test(before)) {
    const width = before.endsWith("\t") ? 1 : Math.min(2, before.length);
    return {
      text: text.slice(0, start - width) + text.slice(start),
      start: start - width,
      end: start - width,
    };
  }

  return null;
}
