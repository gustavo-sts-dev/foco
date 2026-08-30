import { describe, expect, it } from "vitest";

import { markdownToPlainText, renderMarkdown } from "@/lib/markdown";

describe("renderMarkdown - seguranca", () => {
  it("escapa HTML escrito dentro da nota", () => {
    const html = renderMarkdown('<script>alert("x")</script>');
    expect(html).not.toContain("<script>");
    expect(html).toContain("&lt;script&gt;");
  });

  it("escapa HTML dentro de bloco de codigo", () => {
    const html = renderMarkdown("```\n<img onerror=alert(1)>\n```");
    expect(html).toContain("&lt;img onerror=alert(1)&gt;");
    expect(html).not.toContain("<img");
  });

  it("nao gera href javascript: (o link vira texto literal)", () => {
    const html = renderMarkdown("[clique](javascript:alert(1))");
    expect(html).not.toContain("<a ");
    expect(html).not.toContain("href=");
    expect(html).toBe("<p>[clique](javascript:alert(1))</p>");
  });

  it("nao gera src data: em imagem", () => {
    const html = renderMarkdown("![x](data:text/html;base64,AAAA)");
    expect(html).not.toContain("<img");
  });

  it("mantem links http normais com rel de seguranca", () => {
    const html = renderMarkdown("[site](https://exemplo.com)");
    expect(html).toContain('href="https://exemplo.com"');
    expect(html).toContain('rel="noopener noreferrer"');
  });
});

describe("renderMarkdown - blocos", () => {
  it("renderiza titulos de 1 a 6", () => {
    expect(renderMarkdown("# A")).toBe("<h1>A</h1>");
    expect(renderMarkdown("###### F")).toBe("<h6>F</h6>");
  });

  it("nao trata 7 hashes como titulo", () => {
    expect(renderMarkdown("####### G")).toBe("<p>####### G</p>");
  });

  it("junta linhas seguidas num paragrafo com quebra visivel", () => {
    expect(renderMarkdown("linha 1\nlinha 2")).toBe("<p>linha 1<br />linha 2</p>");
  });

  it("separa paragrafos por linha em branco", () => {
    expect(renderMarkdown("um\n\ndois")).toBe("<p>um</p><p>dois</p>");
  });

  it("renderiza linha horizontal e nao a confunde com lista", () => {
    expect(renderMarkdown("---")).toBe("<hr />");
    expect(renderMarkdown("***")).toBe("<hr />");
  });

  it("renderiza citacao com blocos internos", () => {
    const html = renderMarkdown("> # titulo\n> texto");
    expect(html).toBe("<blockquote><h1>titulo</h1><p>texto</p></blockquote>");
  });

  it("renderiza bloco de codigo com linguagem", () => {
    const html = renderMarkdown("```js\nconst a = 1;\n```");
    expect(html).toBe('<pre><code class="language-js">const a = 1;</code></pre>');
  });

  it("fecha bloco de codigo nao terminado sem travar", () => {
    const html = renderMarkdown("```\nsem fim");
    expect(html).toBe("<pre><code>sem fim</code></pre>");
  });

  it("renderiza tabela com alinhamento", () => {
    const html = renderMarkdown("| a | b |\n| :-- | --: |\n| 1 | 2 |");
    expect(html).toContain("<table>");
    expect(html).toContain('<th style="text-align:left">a</th>');
    expect(html).toContain('<th style="text-align:right">b</th>');
    expect(html).toContain('<td style="text-align:left">1</td>');
  });

  it("preenche celulas faltantes da tabela", () => {
    const html = renderMarkdown("| a | b |\n| --- | --- |\n| 1 |");
    expect(html).toContain("<td></td>");
  });
});

describe("renderMarkdown - listas", () => {
  it("renderiza lista nao ordenada", () => {
    expect(renderMarkdown("- um\n- dois")).toBe("<ul><li>um</li><li>dois</li></ul>");
  });

  it("renderiza lista ordenada", () => {
    expect(renderMarkdown("1. um\n2. dois")).toBe("<ol><li>um</li><li>dois</li></ol>");
  });

  it("aninha sublistas pela indentacao", () => {
    const html = renderMarkdown("- pai\n  - filho\n- tio");
    expect(html).toBe("<ul><li>pai<ul><li>filho</li></ul></li><li>tio</li></ul>");
  });

  it("normaliza indentacoes irregulares sem perder itens", () => {
    // Recuos 0, 4 e 2: o terceiro item volta para o nivel do segundo.
    const html = renderMarkdown("- a\n    - b\n  - c");
    expect(html).toBe("<ul><li>a<ul><li>b</li><li>c</li></ul></li></ul>");
  });

  it("renderiza checklist com estado", () => {
    const html = renderMarkdown("- [ ] pendente\n- [x] feito");
    expect(html).toContain('class="md-task-list"');
    expect(html).toContain('<input type="checkbox" disabled /><span>pendente</span>');
    expect(html).toContain('<input type="checkbox" disabled checked /><span>feito</span>');
  });

  it("separa listas ordenada e nao ordenada no mesmo nivel", () => {
    const html = renderMarkdown("- a\n1. b");
    expect(html).toBe("<ul><li>a</li></ul><ol><li>b</li></ol>");
  });

  it("mantem a lista viva atraves de uma linha em branco entre itens", () => {
    expect(renderMarkdown("- a\n\n- b")).toBe("<ul><li>a</li><li>b</li></ul>");
  });
});

describe("renderMarkdown - inline", () => {
  it("aplica negrito, italico, tachado e destaque", () => {
    expect(renderMarkdown("**b**")).toBe("<p><strong>b</strong></p>");
    expect(renderMarkdown("*i*")).toBe("<p><em>i</em></p>");
    expect(renderMarkdown("~~s~~")).toBe("<p><del>s</del></p>");
    expect(renderMarkdown("==m==")).toBe("<p><mark>m</mark></p>");
  });

  it("nao formata dentro de codigo inline", () => {
    expect(renderMarkdown("`a **b** c`")).toBe("<p><code>a **b** c</code></p>");
  });

  it("nao transforma underscores dentro de palavras", () => {
    expect(renderMarkdown("nome_de_variavel")).toBe("<p>nome_de_variavel</p>");
  });

  it("aplica italico com underscore isolado", () => {
    expect(renderMarkdown("_texto_")).toBe("<p><em>texto</em></p>");
  });

  it("transforma URL solta em link", () => {
    const html = renderMarkdown("veja https://exemplo.com/a?b=1 agora");
    expect(html).toContain('<a href="https://exemplo.com/a?b=1"');
  });

  it("nao duplica link ja explicito", () => {
    const html = renderMarkdown("[x](https://exemplo.com)");
    expect(html.match(/<a /g)).toHaveLength(1);
  });

  it("combina codigo dentro de link", () => {
    const html = renderMarkdown("[`cod`](https://exemplo.com)");
    expect(html).toContain("<a href=\"https://exemplo.com\"");
    expect(html).toContain("<code>cod</code>");
  });
});

describe("renderMarkdown - robustez", () => {
  it("devolve string vazia para entrada vazia", () => {
    expect(renderMarkdown("")).toBe("");
    expect(renderMarkdown("   \n  ")).toBe("");
  });

  it("aceita CRLF", () => {
    expect(renderMarkdown("# A\r\n\r\ntexto")).toBe("<h1>A</h1><p>texto</p>");
  });

  it("termina em documentos grandes e baguncados", () => {
    const messy = Array.from({ length: 200 }, (_v, i) =>
      i % 5 === 0 ? "- item " + i : i % 5 === 1 ? "    - sub " + i : i % 5 === 2 ? "> cita" : "texto " + i
    ).join("\n");
    expect(() => renderMarkdown(messy)).not.toThrow();
    expect(renderMarkdown(messy).length).toBeGreaterThan(0);
  });
});

describe("markdownToPlainText", () => {
  it("remove marcacao para a previa da lista", () => {
    const text = markdownToPlainText("# Titulo\n\n- [x] item **forte**\n\n`cod`");
    expect(text).toBe("Titulo item forte cod");
  });

  it("remove blocos de codigo inteiros", () => {
    expect(markdownToPlainText("antes\n\n```\nignorado\n```\n\ndepois")).toBe("antes depois");
  });

  it("mantem o texto de links", () => {
    expect(markdownToPlainText("veja [o site](https://exemplo.com)")).toBe("veja o site");
  });
});
