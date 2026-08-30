import { describe, expect, it } from "vitest";

import {
  type EditorState,
  continueList,
  insertCodeBlock,
  insertLink,
  toggleLinePrefix,
  wrapSelection,
} from "@/lib/markdownEditor";

/** Escreve o estado com "|" marcando a seleção, para o teste ficar legível. */
function show(state: EditorState): string {
  return state.text.slice(0, state.start) + "|" + state.text.slice(state.start, state.end) + "|" + state.text.slice(state.end);
}

function at(text: string): EditorState {
  const start = text.indexOf("|");
  const rest = text.slice(0, start) + text.slice(start + 1);
  const end = rest.indexOf("|");
  if (end === -1) return { text: rest, start, end: start };
  return { text: rest.slice(0, end) + rest.slice(end + 1), start, end };
}

describe("wrapSelection", () => {
  it("envolve a selecao", () => {
    expect(show(wrapSelection(at("um |dois| tres"), "**", "texto"))).toBe("um **|dois|** tres");
  });

  it("insere marcador com texto de exemplo quando nao ha selecao", () => {
    expect(show(wrapSelection(at("a |"), "**", "texto"))).toBe("a **|texto|**");
  });

  it("desfaz quando os marcadores estao fora da selecao", () => {
    expect(show(wrapSelection(at("**|dois|**"), "**", "texto"))).toBe("|dois|");
  });

  it("desfaz quando os marcadores estao dentro da selecao", () => {
    expect(show(wrapSelection(at("|**dois**|"), "**", "texto"))).toBe("|dois|");
  });
});

describe("toggleLinePrefix", () => {
  it("adiciona o prefixo na linha do cursor", () => {
    expect(toggleLinePrefix(at("comprar pão|"), "- ").text).toBe("- comprar pão");
  });

  it("remove o prefixo quando ja existe", () => {
    expect(toggleLinePrefix(at("- comprar|"), "- ").text).toBe("comprar");
  });

  it("aplica em todas as linhas da selecao", () => {
    expect(toggleLinePrefix(at("|um\ndois|"), "- ").text).toBe("- um\n- dois");
  });

  it("remove so quando todas as linhas ja tem o prefixo", () => {
    expect(toggleLinePrefix(at("|- um\ndois|"), "- ").text).toBe("- um\n- dois");
  });

  it("troca lista por checklist em vez de empilhar", () => {
    expect(toggleLinePrefix(at("- item|"), "- [ ] ").text).toBe("- [ ] item");
  });

  it("troca um nivel de titulo por outro", () => {
    expect(toggleLinePrefix(at("## titulo|"), "# ").text).toBe("# titulo");
  });

  it("remove o titulo quando o nivel se repete", () => {
    expect(toggleLinePrefix(at("# titulo|"), "# ").text).toBe("titulo");
  });
});

describe("insertLink", () => {
  it("usa a selecao como rotulo e seleciona a URL", () => {
    const result = insertLink(at("veja |o site| aqui"));
    expect(result.text).toBe("veja [o site](https://) aqui");
    expect(result.text.slice(result.start, result.end)).toBe("https://");
  });

  it("usa rotulo de exemplo sem selecao", () => {
    expect(insertLink(at("|")).text).toBe("[texto](https://)");
  });
});

describe("insertCodeBlock", () => {
  it("cerca a selecao e a mantem selecionada", () => {
    const result = insertCodeBlock(at("|const a = 1|"));
    expect(result.text).toBe("```\nconst a = 1\n```\n");
    expect(result.text.slice(result.start, result.end)).toBe("const a = 1");
  });

  it("abre linha nova quando o cursor esta no meio do texto", () => {
    expect(insertCodeBlock(at("texto|")).text).toBe("texto\n```\ncódigo\n```\n");
  });
});

describe("continueList", () => {
  it("continua lista nao ordenada", () => {
    expect(continueList(at("- um|"))?.text).toBe("- um\n- ");
  });

  it("incrementa lista ordenada", () => {
    expect(continueList(at("3. tres|"))?.text).toBe("3. tres\n4. ");
  });

  it("continua checklist sempre desmarcada", () => {
    expect(continueList(at("- [x] feito|"))?.text).toBe("- [x] feito\n- [ ] ");
  });

  it("preserva a indentacao da sublista", () => {
    expect(continueList(at("- pai\n  - filho|"))?.text).toBe("- pai\n  - filho\n  - ");
  });

  it("sai da lista quando o item esta vazio", () => {
    expect(continueList(at("- um\n- |"))?.text).toBe("- um\n");
  });

  it("nao intercepta fora de lista", () => {
    expect(continueList(at("texto comum|"))).toBeNull();
  });

  it("nao intercepta quando ha texto selecionado", () => {
    expect(continueList(at("- |um|"))).toBeNull();
  });
});
