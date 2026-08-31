import { describe, expect, it } from "vitest";
import {
  casarTermo,
  classificarStatusItem,
  consolidar,
  motivoBloqueioRelatorio,
  normalizar,
  notaPodeExportar,
  PERCENTUAL_ALIQUOTA,
  type TermoParaCasar,
} from "./presuncao-termos";

const TERMOS: TermoParaCasar[] = [
  { termo: "tomografia", aliquota: "P8" },
  { termo: "tomografia computadorizada de crânio", aliquota: "P8" },
  { termo: "consulta", aliquota: "P32" },
  { termo: "raio-x", aliquota: "P8" },
];

describe("normalizar", () => {
  it("tira acento, caixa e espaço extra", () => {
    expect(normalizar("  Ressonância   Magnética ")).toBe("ressonancia magnetica");
    expect(normalizar("RAIO-X do Tórax")).toBe("raio-x do torax");
  });
});

describe("casarTermo", () => {
  it("devolve null quando nada bate", () => {
    expect(casarTermo("Sessão de acupuntura", TERMOS)).toBeNull();
  });

  it("casa por substring, ignorando acento/caixa", () => {
    const r = casarTermo("TOMOGRAFIA de abdome", TERMOS);
    expect(r).toEqual({ aliquota: "P8", termo: "tomografia" });
  });

  it("com vários matches, o termo mais longo vence", () => {
    const r = casarTermo("Tomografia computadorizada de crânio sem contraste", TERMOS);
    expect(r?.termo).toBe("tomografia computadorizada de crânio");
  });

  it("empate de comprimento -> o P32 (conservador)", () => {
    const termos: TermoParaCasar[] = [
      { termo: "aaaa", aliquota: "P8" },
      { termo: "bbbb", aliquota: "P32" },
    ];
    expect(casarTermo("linha aaaa bbbb", termos)?.aliquota).toBe("P32");
  });
});

describe("classificarStatusItem", () => {
  it("< 0.85 -> PENDENTE_REVISAO; >= 0.85 -> CONFIRMADO", () => {
    expect(classificarStatusItem(0.84)).toBe("PENDENTE_REVISAO");
    expect(classificarStatusItem(0.85)).toBe("CONFIRMADO");
  });
});

describe("consolidar", () => {
  it("agrupa por balde e calcula a base de presunção", () => {
    const c = consolidar([
      { aliquota: "P8", valor: 100 },
      { aliquota: "P8", valor: 50 },
      { aliquota: "P32", valor: 200 },
    ]);
    const p8 = c.porBalde.find((l) => l.aliquota === "P8")!;
    const p32 = c.porBalde.find((l) => l.aliquota === "P32")!;
    expect(p8).toMatchObject({ qtdItens: 2, somaValor: 150, basePresuncao: 12 }); // 150 * 8%
    expect(p32).toMatchObject({ qtdItens: 1, somaValor: 200, basePresuncao: 64 }); // 200 * 32%
    expect(c.totalValor).toBe(350);
    expect(c.totalBase).toBe(76);
  });

  it("arredonda a base a 2 casas", () => {
    const c = consolidar([{ aliquota: "P8", valor: 33.33 }]);
    expect(c.porBalde[0].basePresuncao).toBe(2.67); // 33.33 * 0.08 = 2.6664
  });
});

describe("notaPodeExportar / motivoBloqueioRelatorio", () => {
  it("bloqueia com item em revisão", () => {
    const itens = [{ status: "CONFIRMADO" as const }, { status: "PENDENTE_REVISAO" as const }];
    expect(notaPodeExportar(itens)).toBe(false);
    expect(motivoBloqueioRelatorio(itens)).toMatch(/1 item ainda em conferência/);
  });

  it("libera com tudo confirmado", () => {
    const itens = [{ status: "CONFIRMADO" as const }];
    expect(notaPodeExportar(itens)).toBe(true);
    expect(motivoBloqueioRelatorio(itens)).toBeNull();
  });

  it("nota sem item nenhum não exporta", () => {
    expect(notaPodeExportar([])).toBe(false);
    expect(motivoBloqueioRelatorio([])).toBe("Nenhum item classificado");
  });
});

describe("PERCENTUAL_ALIQUOTA", () => {
  it("mapeia os dois baldes", () => {
    expect(PERCENTUAL_ALIQUOTA).toEqual({ P8: 8, P32: 32 });
  });
});
