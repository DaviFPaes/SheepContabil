import { describe, expect, it } from "vitest";
import { gerarCsvAuditoria } from "./csv-auditoria";
import type { LinhaAuditoriaDocumento } from "./historico";

const linha = (over: Partial<LinhaAuditoriaDocumento>): LinhaAuditoriaDocumento => ({
  id: "1",
  acao: "EXTRATO_ENVIADO",
  descricao: "Extrato agosto.pdf enviado",
  autorEmail: "op@sheepcontabil.com.br",
  criadoEm: new Date("2026-08-10T13:05:00Z"),
  dadosAntes: null,
  dadosDepois: null,
  ...over,
});

describe("gerarCsvAuditoria", () => {
  it("tem BOM, cabeçalho e usa ';'", () => {
    const csv = gerarCsvAuditoria([linha({})]);
    expect(csv.startsWith("﻿")).toBe(true);
    expect(csv.slice(1).split("\r\n")[0]).toBe("data;hora;ator;evento;descricao");
  });
  it("ator vira 'Sistema' quando autorEmail é null e escapa ';' no texto", () => {
    const csv = gerarCsvAuditoria([linha({ autorEmail: null, descricao: "a; b" })]);
    expect(csv).toContain(";Sistema;");
    expect(csv).toContain('"a; b"');
  });
});
