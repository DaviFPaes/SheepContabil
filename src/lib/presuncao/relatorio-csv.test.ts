import { describe, expect, it } from "vitest";
import { gerarCsvRelatorio } from "./relatorio-csv";
import type { NotaDetalhe } from "./consultas-sc11";

const NOTA: NotaDetalhe = {
  documentoId: "d1",
  status: "PROCESSADO",
  erro: null,
  clienteRazaoSocial: "Clínica X",
  nomeArquivo: "nfse.xml",
  numero: "2026-1",
  dataEmissao: new Date("2026-08-07T00:00:00Z"),
  itens: [
    { id: "i1", descricao: "Tomografia; com contraste", valor: 450, aliquota: "P8", origem: "REGRA", justificativa: 'Termo "tomografia".', confianca: null, status: "CONFIRMADO" },
    { id: "i2", descricao: "Consulta", valor: 200, aliquota: "P32", origem: "IA", justificativa: "consulta simples", confianca: 0.9, status: "CONFIRMADO" },
  ],
  consolidado: {
    porBalde: [
      { aliquota: "P8", qtdItens: 1, somaValor: 450, basePresuncao: 36 },
      { aliquota: "P32", qtdItens: 1, somaValor: 200, basePresuncao: 64 },
    ],
    totalValor: 650,
    totalBase: 100,
  },
  podeExportar: true,
  motivoBloqueio: null,
};

describe("gerarCsvRelatorio", () => {
  const csv = gerarCsvRelatorio(NOTA);

  it("começa com BOM e o cabeçalho", () => {
    expect(csv.startsWith("﻿")).toBe(true);
    expect(csv).toContain("descricao;valor;aliquota;origem;justificativa");
  });

  it("usa ; como separador e escapa ; dentro do campo com aspas", () => {
    expect(csv).toContain('"Tomografia; com contraste";450.00;8%;Regra;');
  });

  it("inclui as linhas do consolidado", () => {
    expect(csv).toContain("BASE 8%;450.00;;;36.00");
    expect(csv).toContain("BASE 32%;200.00;;;64.00");
    expect(csv).toContain("TOTAL;650.00;;;100.00");
  });

  it("neutraliza valor que começa com caractere de fórmula", () => {
    const nota = { ...NOTA, itens: [{ ...NOTA.itens[0], descricao: "=SOMA(A1:A9)" }] };
    const c = gerarCsvRelatorio(nota);
    expect(c).toContain("'=SOMA(A1:A9)");
  });
});
