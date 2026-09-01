import { describe, expect, it } from "vitest";
import { agruparNotificacoes } from "./SinoAvisos";

const d = (iso: string) => new Date(iso);

describe("agruparNotificacoes", () => {
  it("agrupa por tipo + dia e monta a frase no plural certo", () => {
    const g = agruparNotificacoes([
      { id: "1", tipo: "D60_ENTROU", certificadoId: "a", clienteId: "x", lidaEm: null, criadoEm: d("2026-09-01T05:00:00Z") },
      { id: "2", tipo: "D60_ENTROU", certificadoId: "b", clienteId: "y", lidaEm: null, criadoEm: d("2026-09-01T06:00:00Z") },
      { id: "3", tipo: "D7_ENTROU", certificadoId: "c", clienteId: "z", lidaEm: null, criadoEm: d("2026-09-01T05:00:00Z") },
    ]);

    expect(g).toHaveLength(2);
    const d60 = g.find((x) => x.tipo === "D60_ENTROU")!;
    expect(d60.quantidade).toBe(2);
    expect(d60.diaISO).toBe("2026-09-01");
    expect(d60.frase).toBe("2 certificados entraram na faixa de 60 dias");

    const d7 = g.find((x) => x.tipo === "D7_ENTROU")!;
    expect(d7.frase).toBe("1 certificado entrou na faixa de 7 dias");
  });

  it("frase do D3 fala em confirmar renovacao", () => {
    const g = agruparNotificacoes([
      { id: "1", tipo: "D3_ENTROU", certificadoId: "a", clienteId: "x", lidaEm: null, criadoEm: d("2026-09-01T05:00:00Z") },
      { id: "2", tipo: "D3_ENTROU", certificadoId: "b", clienteId: "y", lidaEm: null, criadoEm: d("2026-09-01T05:00:00Z") },
    ]);
    expect(g[0].frase).toBe("2 clientes para confirmar se fizeram a renovação");
  });

  it("ordena por dia decrescente", () => {
    const g = agruparNotificacoes([
      { id: "1", tipo: "D60_ENTROU", certificadoId: "a", clienteId: "x", lidaEm: null, criadoEm: d("2026-08-30T05:00:00Z") },
      { id: "2", tipo: "D60_ENTROU", certificadoId: "b", clienteId: "y", lidaEm: null, criadoEm: d("2026-09-02T05:00:00Z") },
    ]);
    expect(g.map((x) => x.diaISO)).toEqual(["2026-09-02", "2026-08-30"]);
  });
});
