import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { prisma } from "@/lib/prisma";
import {
  listarDocumentos,
  listarHistoricoDocumentos,
  obterDocumentoComLancamentos,
} from "./consultas-sc01";

const CNPJ = "66.666.666/0001-66";
let testStart: Date;
beforeEach(() => {
  testStart = new Date();
});
afterEach(async () => {
  await prisma.lancamento.deleteMany({
    where: { criadoEm: { gte: testStart } },
  });
  await prisma.registroAuditoria.deleteMany({
    where: { cliente: { cnpj: CNPJ } },
  });
  await prisma.documentoEntrada.deleteMany({ where: { cliente: { cnpj: CNPJ } } });
  await prisma.contaBancaria.deleteMany({ where: { cliente: { cnpj: CNPJ } } });
  await prisma.cliente.deleteMany({ where: { cnpj: CNPJ } });
});

async function cenario() {
  const cliente = await prisma.cliente.create({
    data: {
      razaoSocial: "Consultas SC-01",
      cnpj: CNPJ,
      atividade: "T",
      email: "consultas-sc01@example.com",
    },
  });
  const doc = await prisma.documentoEntrada.create({
    data: {
      tipo: "EXTRATO",
      clienteId: cliente.id,
      nomeArquivo: "x.pdf",
      mimeType: "application/pdf",
      arquivo: Buffer.from("z"),
      chegadaEm: new Date(),
      status: "PROCESSADO",
      lancamentos: {
        create: [
          { data: new Date("2026-08-01T00:00:00Z"), historico: "A", valor: -10, confianca: 0.95, status: "CONFIRMADO" },
          { data: new Date("2026-08-02T00:00:00Z"), historico: "B", valor: 20, confianca: 0.5, status: "PENDENTE_REVISAO" },
        ],
      },
    },
  });
  return { doc };
}

async function cenarioComConta() {
  const cliente = await prisma.cliente.create({
    data: {
      razaoSocial: "Consultas SC-01 com conta",
      cnpj: CNPJ,
      atividade: "T",
      email: "consultas-sc01@example.com",
    },
  });
  const conta = await prisma.contaBancaria.create({
    data: {
      clienteId: cliente.id,
      bancoNome: "Banco Teste",
      compe: "341",
      agencia: "1234",
      numero: "56789-0",
    },
  });
  // chegadaEm bem no futuro: garante que estes 2 docs vêm primeiro no orderBy desc
  const chegadaEm = new Date("2099-08-15T09:00:00Z");
  for (let i = 0; i < 2; i++) {
    await prisma.documentoEntrada.create({
      data: {
        tipo: "EXTRATO",
        clienteId: cliente.id,
        contaBancariaId: conta.id,
        nomeArquivo: `conta-${i}.pdf`,
        mimeType: "application/pdf",
        arquivo: Buffer.from("z"),
        chegadaEm,
        status: "PROCESSADO",
        competencia: "2026-08",
      },
    });
  }
  return { clienteId: cliente.id, contaId: conta.id };
}

async function cenarioComAuditoria() {
  const cliente = await prisma.cliente.create({
    data: {
      razaoSocial: "Consultas SC-01 auditoria",
      cnpj: CNPJ,
      atividade: "T",
      email: "consultas-sc01@example.com",
    },
  });
  for (let i = 0; i < 3; i++) {
    await prisma.registroAuditoria.create({
      data: {
        entidade: "DocumentoEntrada",
        entidadeId: `doc-${i}`,
        acao: "EXTRATO_ENVIADO",
        descricao: `extrato ${i} enviado`,
        clienteId: cliente.id,
      },
    });
  }
  return { clienteId: cliente.id };
}

describe("listarDocumentos", () => {
  it("traz contagem e trava do OFX", async () => {
    const { doc } = await cenario();
    const lista = await listarDocumentos({ tipo: "EXTRATO" });
    const alvo = lista.find((d) => d.id === doc.id);
    expect(alvo?.totalLancamentos).toBe(2);
    expect(alvo?.emRevisao).toBe(1);
    expect(alvo?.podeBaixarOfx).toBe(false);
  });

  it("listarDocumentos traz bancoRotulo e competencia e filtra por competência", async () => {
    const { clienteId } = await cenarioComConta();
    const ags = await listarDocumentos({ tipo: "EXTRATO", competencia: "2026-08" });
    expect(ags.every((d) => d.competencia === "2026-08")).toBe(true);
    expect(ags[0].bancoRotulo).toMatch(/ag .* c\/c /);
  });
});

describe("obterDocumentoComLancamentos", () => {
  it("devolve o detalhe com valor como number e o motivo do bloqueio", async () => {
    const { doc } = await cenario();
    const d = await obterDocumentoComLancamentos(doc.id);
    expect(d?.lancamentos).toHaveLength(2);
    expect(typeof d?.lancamentos[0].valor).toBe("number");
    expect(d?.podeBaixarOfx).toBe(false);
    expect(d?.motivoBloqueio).toBe("1 linha ainda em conferência");
  });
});

describe("listarHistoricoDocumentos", () => {
  it("listarHistoricoDocumentos filtra por ação e pagina", async () => {
    const { clienteId } = await cenarioComAuditoria();
    const r = await listarHistoricoDocumentos({ clienteId, acao: "EXTRATO_ENVIADO", pagina: 1, porPagina: 10 });
    expect(r.total).toBeGreaterThanOrEqual(1);
    expect(r.linhas.every((l) => l.acao === "EXTRATO_ENVIADO")).toBe(true);
  });

  it("listarHistoricoDocumentos ignora eventos de outras entidades (Certificado)", async () => {
    const { clienteId } = await cenarioComAuditoria();
    await prisma.registroAuditoria.create({
      data: { entidade: "Certificado", entidadeId: "x", acao: "CRIADO", descricao: "não deve aparecer", clienteId },
    });
    const r = await listarHistoricoDocumentos({ clienteId, pagina: 1, porPagina: 50 });
    expect(r.linhas.some((l) => l.descricao === "não deve aparecer")).toBe(false);
  });
});
