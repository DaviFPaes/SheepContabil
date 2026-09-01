import { describe, expect, it } from "vitest";
import { gerarCsvHistorico } from "./csv-historico";

const base = {
  id: "1",
  autorEmail: null,
  dadosAntes: null,
  dadosDepois: null,
  criadoEm: new Date("2026-09-01T12:30:00Z"),
} as const;

describe("gerarCsvHistorico", () => {
  it("tem cabecalho e uma linha por registro", () => {
    const csv = gerarCsvHistorico([
      { ...base, acao: "CRIADO", descricao: "Certificado criado" },
    ]);
    const linhas = csv.replace(/^﻿/, "").trim().split("\r\n");
    expect(linhas[0]).toBe("data;hora;ator;evento;descricao");
    expect(linhas[1]).toContain("01/09/2026");
    expect(linhas[1]).toContain("Sistema");
    expect(linhas[1]).toContain("CRIADO");
    expect(linhas[1]).toContain("Certificado criado");
  });

  it("usa o e-mail do autor quando existe", () => {
    const csv = gerarCsvHistorico([
      { ...base, acao: "EDITADO", autorEmail: "ana@x.com", descricao: "editou" },
    ]);
    expect(csv).toContain("ana@x.com");
  });

  it("escapa separador e aspas na descricao", () => {
    const csv = gerarCsvHistorico([
      { ...base, acao: "EDITADO", descricao: 'mudou "titular"; e validade' },
    ]);
    expect(csv).toContain('"mudou ""titular""; e validade"');
  });

  it("comeca com BOM UTF-8", () => {
    const csv = gerarCsvHistorico([{ ...base, acao: "CRIADO", descricao: "x" }]);
    expect(csv.charCodeAt(0)).toBe(0xfeff);
  });
});
