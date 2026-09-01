import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { prisma } from "@/lib/prisma";
import type { Prisma } from "@/generated/prisma/client";
import { recalcularBucketsCertificados } from "./processar";

const CNPJ_TESTE = "99.999.999/0001-99";

// Mesmo criterio de "usuario elegivel" do motor (§4.5 do design): ADMIN ou
// OPERADOR do setor Processos.
const ELEGIVEIS_WHERE: Prisma.UsuarioWhereInput = {
  OR: [{ papel: "ADMIN" }, { AND: [{ papel: "OPERADOR" }, { setor: "Processos" }] }],
};

let testStart: Date;

beforeEach(() => {
  testStart = new Date();
});

afterEach(async () => {
  await prisma.registroAuditoria.deleteMany({ where: { criadoEm: { gte: testStart } } });
  await prisma.notificacaoInApp.deleteMany({ where: { criadoEm: { gte: testStart } } });
  await prisma.avisoCertificado.deleteMany({ where: { criadoEm: { gte: testStart } } });
  await prisma.certificado.deleteMany({ where: { cliente: { cnpj: CNPJ_TESTE } } });
  await prisma.cliente.deleteMany({ where: { cnpj: CNPJ_TESTE } });
});

async function cenario() {
  const cliente = await prisma.cliente.create({
    data: {
      razaoSocial: "Cliente Teste SC-20",
      cnpj: CNPJ_TESTE,
      atividade: "Teste",
      email: "cliente-teste-sc20@example.com",
    },
  });
  return { cliente };
}

function dataDaqui(dias: number): Date {
  const d = new Date();
  d.setUTCHours(0, 0, 0, 0);
  d.setUTCDate(d.getUTCDate() + dias);
  return d;
}

function dadosCert(clienteId: string, dataValidade: Date, extra: Partial<Prisma.CertificadoUncheckedCreateInput> = {}) {
  return {
    clienteId,
    dataValidade,
    tipo: "ECNPJ" as const,
    titular: "Cliente Teste SC-20",
    emitidoEm: dataDaqui(-365),
    ...extra,
  };
}

describe("recalcularBucketsCertificados", () => {
  it("primeiro calculo de um certificado a 30 dias gera bucket D60, auditoria e notificacao", async () => {
    const { cliente } = await cenario();
    const cert = await prisma.certificado.create({ data: dadosCert(cliente.id, dataDaqui(30)) });

    const resultado = await recalcularBucketsCertificados();
    expect(resultado.status).toBe("SUCESSO");

    const salvo = await prisma.certificado.findUniqueOrThrow({ where: { id: cert.id } });
    expect(salvo.bucket).toBe("D60");

    const audit = await prisma.registroAuditoria.findMany({
      where: { entidade: "Certificado", entidadeId: cert.id, acao: "TRANSICAO_BUCKET" },
    });
    expect(audit).toHaveLength(1);
    expect(audit[0].autorEmail).toBeNull();
    expect(audit[0].descricao).toContain("60 dias");

    const notifs = await prisma.notificacaoInApp.findMany({ where: { certificadoId: cert.id } });
    const totalElegiveis = await prisma.usuario.count({ where: ELEGIVEIS_WHERE });
    expect(notifs).toHaveLength(totalElegiveis);
    expect(notifs[0].tipo).toBe("D60_ENTROU");
  });

  it("segunda execucao no mesmo dia e idempotente", async () => {
    const { cliente } = await cenario();
    const cert = await prisma.certificado.create({ data: dadosCert(cliente.id, dataDaqui(30)) });

    await recalcularBucketsCertificados();
    await recalcularBucketsCertificados();

    const totalElegiveis = await prisma.usuario.count({ where: ELEGIVEIS_WHERE });
    const notifs = await prisma.notificacaoInApp.count({ where: { certificadoId: cert.id } });
    const audit = await prisma.registroAuditoria.count({
      where: { entidadeId: cert.id, acao: "TRANSICAO_BUCKET" },
    });
    expect(notifs).toBe(totalElegiveis);
    expect(audit).toBe(1);
  });

  it("ir para VENCIDO grava auditoria mas nao gera notificacao", async () => {
    const { cliente } = await cenario();
    const cert = await prisma.certificado.create({ data: dadosCert(cliente.id, dataDaqui(-1)) });

    await recalcularBucketsCertificados();

    const salvo = await prisma.certificado.findUniqueOrThrow({ where: { id: cert.id } });
    expect(salvo.bucket).toBe("VENCIDO");
    expect(await prisma.notificacaoInApp.count({ where: { certificadoId: cert.id } })).toBe(0);
  });

  it("certificado inativo nao e reavaliado", async () => {
    const { cliente } = await cenario();
    const cert = await prisma.certificado.create({
      data: dadosCert(cliente.id, dataDaqui(5), { ativo: false, bucket: "RENOVADO" }),
    });

    await recalcularBucketsCertificados();

    const salvo = await prisma.certificado.findUniqueOrThrow({ where: { id: cert.id } });
    expect(salvo.bucket).toBe("RENOVADO");
    expect(await prisma.registroAuditoria.count({ where: { entidadeId: cert.id } })).toBe(0);
  });

  it("transicao para uma faixa mais urgente gera um segundo evento", async () => {
    const { cliente } = await cenario();
    const cert = await prisma.certificado.create({ data: dadosCert(cliente.id, dataDaqui(20)) });

    await recalcularBucketsCertificados(dataDaqui(0)); // D60

    // Mesmo "hoje" nas duas chamadas: a idempotencia do motor e por
    // (usuario, certificado, TIPO) — como o tipo muda de D60_ENTROU para
    // D3_ENTROU, a segunda notificacao nao e bloqueada mesmo no mesmo dia.
    await prisma.certificado.update({ where: { id: cert.id }, data: { dataValidade: dataDaqui(3) } });
    await recalcularBucketsCertificados(dataDaqui(0)); // D3

    const notifs = await prisma.notificacaoInApp.findMany({
      where: { certificadoId: cert.id },
      orderBy: { criadoEm: "asc" },
    });
    const tipos = [...new Set(notifs.map((n) => n.tipo))];
    expect(tipos).toEqual(["D60_ENTROU", "D3_ENTROU"]);
  });

  it("grava um RegistroAuditoria ATUALIZAR_EXECUTADO por execucao", async () => {
    await cenario();
    const antes = await prisma.registroAuditoria.count({ where: { acao: "ATUALIZAR_EXECUTADO" } });
    await recalcularBucketsCertificados();
    const depois = await prisma.registroAuditoria.count({ where: { acao: "ATUALIZAR_EXECUTADO" } });
    expect(depois).toBe(antes + 1);
  });

  it("usa o ator informado no contexto em vez de Sistema", async () => {
    const { cliente } = await cenario();
    const cert = await prisma.certificado.create({ data: dadosCert(cliente.id, dataDaqui(30)) });

    await recalcularBucketsCertificados(new Date(), {
      autorId: null,
      autorEmail: "operador.processos@sheepcontabil.com.br",
    });

    const audit = await prisma.registroAuditoria.findFirst({
      where: { entidadeId: cert.id, acao: "TRANSICAO_BUCKET" },
    });
    expect(audit?.autorEmail).toBe("operador.processos@sheepcontabil.com.br");
  });
});
