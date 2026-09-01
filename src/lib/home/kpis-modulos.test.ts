import { describe, expect, it } from "vitest";
import type { CertificadoComStatus } from "@/lib/certificados/consultas";
import type { DocumentoResumo } from "@/lib/documentos/consultas-sc01";
import type { NotaResumo } from "@/lib/presuncao/consultas-sc11";
import { resumirKpiSc01, resumirKpiSc11, resumirKpiSc20 } from "./kpis-modulos";

function certificado(
  faixa: CertificadoComStatus["faixa"],
): CertificadoComStatus {
  return {
    id: `cert-${Math.random()}`,
    clienteId: "cli-1",
    razaoSocial: "Clínica Exemplo Ltda",
    dataValidade: new Date("2026-10-01T00:00:00Z"),
    diasRestantes: 0,
    faixa,
  };
}

function extrato(
  status: DocumentoResumo["status"],
  emRevisao = 0,
): DocumentoResumo {
  return {
    id: `doc-${Math.random()}`,
    clienteRazaoSocial: "Alfa Comércio Ltda",
    tipo: "EXTRATO",
    nomeArquivo: "extrato.pdf",
    status,
    chegadaEm: new Date("2026-08-30T12:00:00Z"),
    totalLancamentos: emRevisao,
    emRevisao,
    podeBaixarOfx: false,
  };
}

function nota(status: NotaResumo["status"], emRevisao = 0): NotaResumo {
  return {
    documentoId: `nfse-${Math.random()}`,
    clienteRazaoSocial: "Clínica Exemplo Ltda",
    nomeArquivo: "nfse.xml",
    status,
    chegadaEm: new Date("2026-08-30T12:00:00Z"),
    numero: "123",
    totalItens: emRevisao,
    emRevisao,
    podeExportar: false,
  };
}

describe("resumirKpiSc20", () => {
  it("conta vencidos e críticos juntos como atenção", () => {
    const kpi = resumirKpiSc20([
      certificado("VENCIDO"),
      certificado("CRITICO"),
      certificado("CRITICO"),
      certificado("OK"),
    ]);
    expect(kpi).toEqual({
      valor: 3,
      rotulo: "certificados vencidos ou críticos",
      tom: "atencao",
    });
  });

  it("acrescenta a contagem de alerta como detalhe", () => {
    const kpi = resumirKpiSc20([
      certificado("CRITICO"),
      certificado("ALERTA"),
      certificado("ALERTA"),
    ]);
    expect(kpi).toEqual({
      valor: 1,
      rotulo: "certificado vencido ou crítico",
      tom: "atencao",
      detalhe: "2 certificados em alerta",
    });
  });

  it("cai para alerta quando não há nenhum crítico", () => {
    const kpi = resumirKpiSc20([certificado("ALERTA"), certificado("PROXIMO")]);
    expect(kpi).toEqual({
      valor: 1,
      rotulo: "certificado em alerta",
      tom: "atencao",
    });
  });

  it("fica em dia quando tudo está tranquilo", () => {
    const kpi = resumirKpiSc20([certificado("PROXIMO"), certificado("OK")]);
    expect(kpi).toEqual({
      valor: 0,
      rotulo: "certificados em dia",
      tom: "ok",
    });
  });
});

describe("resumirKpiSc01", () => {
  it("erro na execução vem antes de qualquer outra coisa", () => {
    const kpi = resumirKpiSc01([
      extrato("ERRO"),
      extrato("PROCESSADO", 4),
      extrato("PENDENTE"),
    ]);
    expect(kpi).toEqual({
      valor: 1,
      rotulo: "extrato com erro",
      tom: "erro",
      detalhe: "4 linhas em conferência",
    });
  });

  it("soma as linhas em conferência e mostra os pendentes como detalhe", () => {
    const kpi = resumirKpiSc01([
      extrato("PROCESSADO", 2),
      extrato("PROCESSADO", 1),
      extrato("PENDENTE"),
    ]);
    expect(kpi).toEqual({
      valor: 3,
      rotulo: "linhas em conferência",
      tom: "atencao",
      detalhe: "1 extrato pendente",
    });
  });

  it("mostra os pendentes quando não há nada em conferência", () => {
    const kpi = resumirKpiSc01([extrato("PENDENTE"), extrato("PENDENTE")]);
    expect(kpi).toEqual({
      valor: 2,
      rotulo: "extratos aguardando leitura",
      tom: "atencao",
    });
  });

  it("fica em dia quando tudo foi processado", () => {
    const kpi = resumirKpiSc01([extrato("PROCESSADO"), extrato("PROCESSADO")]);
    expect(kpi).toEqual({ valor: 0, rotulo: "extratos em dia", tom: "ok" });
  });
});

describe("resumirKpiSc11", () => {
  it("erro na execução tem prioridade", () => {
    const kpi = resumirKpiSc11([nota("ERRO"), nota("PROCESSADO", 5)]);
    expect(kpi).toEqual({
      valor: 1,
      rotulo: "nota com erro",
      tom: "erro",
      detalhe: "5 itens em conferência",
    });
  });

  it("soma os itens em conferência com as notas pendentes no detalhe", () => {
    const kpi = resumirKpiSc11([
      nota("PROCESSADO", 7),
      nota("PENDENTE"),
      nota("PENDENTE"),
    ]);
    expect(kpi).toEqual({
      valor: 7,
      rotulo: "itens em conferência",
      tom: "atencao",
      detalhe: "2 notas pendentes",
    });
  });

  it("fica em dia sem pendência nenhuma", () => {
    const kpi = resumirKpiSc11([nota("PROCESSADO"), nota("PROCESSADO")]);
    expect(kpi).toEqual({ valor: 0, rotulo: "notas em dia", tom: "ok" });
  });
});
