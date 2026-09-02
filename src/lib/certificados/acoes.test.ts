import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";

const USUARIO_ID = "u-teste-sc20";

vi.mock("@/lib/sessao-servidor", () => ({
  obterSessao: vi.fn(async () => ({
    usuarioId: "u-teste-sc20",
    email: "operador.processos@sheepcontabil.com.br",
    nome: "Operador Teste",
    papel: "OPERADOR",
    setor: "Processos",
  })),
}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

import { prisma } from "@/lib/prisma";
import {
  avisarClienteD3,
  criarCertificado,
  enviarAvisosLote,
  marcarGrupoLido,
  renovarCertificadoVencido,
} from "./acoes";

const CNPJ = "77.777.777/0001-70";

beforeAll(async () => {
  await prisma.usuario.upsert({
    where: { id: USUARIO_ID },
    update: {},
    create: {
      id: USUARIO_ID,
      email: "u-teste-sc20@example.com",
      nome: "Operador Teste SC-20",
      senhaHash: "x",
      papel: "OPERADOR",
      setor: "Processos",
    },
  });
});

afterAll(async () => {
  await prisma.registroAuditoria.deleteMany({ where: { autorId: USUARIO_ID } });
  await prisma.notificacaoInApp.deleteMany({ where: { usuarioId: USUARIO_ID } });
  await prisma.usuario.deleteMany({ where: { id: USUARIO_ID } });
});

function fd(obj: Record<string, string>): FormData {
  const f = new FormData();
  for (const [k, v] of Object.entries(obj)) f.set(k, v);
  return f;
}

function dataISO(dias: number): string {
  const d = new Date();
  d.setUTCHours(0, 0, 0, 0);
  d.setUTCDate(d.getUTCDate() + dias);
  return d.toISOString().slice(0, 10);
}

afterEach(async () => {
  await prisma.registroAuditoria.deleteMany({ where: { cliente: { cnpj: CNPJ } } });
  await prisma.notificacaoInApp.deleteMany({ where: { cliente: { cnpj: CNPJ } } });
  await prisma.certificado.deleteMany({ where: { cliente: { cnpj: CNPJ } } });
  await prisma.cliente.deleteMany({ where: { cnpj: CNPJ } });
});

async function clienteTeste() {
  return prisma.cliente.create({
    data: {
      razaoSocial: "Cliente Acoes SC-20",
      cnpj: CNPJ,
      atividade: "Teste",
      email: "cliente-acoes-sc20@example.com",
    },
  });
}

describe("criarCertificado", () => {
  it("rejeita validade anterior ou igual a emissao", async () => {
    const cliente = await clienteTeste();
    const r = await criarCertificado(
      null,
      fd({
        clienteId: cliente.id,
        tipo: "ECNPJ",
        titular: "Fulano",
        emitidoEm: dataISO(0),
        dataValidade: dataISO(0),
      }),
    );
    expect(r).toEqual({ erro: expect.stringContaining("posterior") });
  });

  it("cria o certificado e grava auditoria CRIADO", async () => {
    const cliente = await clienteTeste();
    const r = await criarCertificado(
      null,
      fd({
        clienteId: cliente.id,
        tipo: "ECPF",
        titular: "Fulano de Tal",
        emitidoEm: dataISO(-10),
        dataValidade: dataISO(40),
      }),
    );
    expect(r).toEqual({ ok: true });

    const cert = await prisma.certificado.findFirstOrThrow({ where: { clienteId: cliente.id } });
    expect(cert.tipo).toBe("ECPF");
    expect(cert.bucket).toBe("D60");

    const audit = await prisma.registroAuditoria.findMany({
      where: { clienteId: cliente.id, acao: "CRIADO" },
    });
    expect(audit).toHaveLength(1);
  });

  it("renovacao vincula, desativa o anterior e audita as duas pontas", async () => {
    const cliente = await clienteTeste();
    const anterior = await prisma.certificado.create({
      data: {
        clienteId: cliente.id,
        tipo: "ECNPJ",
        titular: "Empresa",
        emitidoEm: new Date(dataISO(-350)),
        dataValidade: new Date(dataISO(5)),
        bucket: "D7",
      },
    });

    const r = await criarCertificado(
      null,
      fd({
        clienteId: cliente.id,
        tipo: "ECNPJ",
        titular: "Empresa",
        emitidoEm: dataISO(0),
        dataValidade: dataISO(365),
        ehRenovacao: "on",
        certificadoAnteriorId: anterior.id,
      }),
    );
    expect(r).toEqual({ ok: true });

    const antigoAtualizado = await prisma.certificado.findUniqueOrThrow({ where: { id: anterior.id } });
    expect(antigoAtualizado.ativo).toBe(false);
    expect(antigoAtualizado.bucket).toBe("RENOVADO");
    expect(antigoAtualizado.substituidoPorId).not.toBeNull();

    const acoes = await prisma.registroAuditoria.findMany({
      where: { entidadeId: anterior.id },
    });
    const tiposAcao = acoes.map((a) => a.acao).sort();
    expect(tiposAcao).toEqual(["DESATIVADO", "RENOVACAO"]);
  });
});

describe("renovarCertificadoVencido", () => {
  async function certVencido() {
    const cliente = await clienteTeste();
    const cert = await prisma.certificado.create({
      data: {
        clienteId: cliente.id,
        tipo: "ECNPJ",
        titular: "Empresa",
        emitidoEm: new Date(dataISO(-400)),
        dataValidade: new Date(dataISO(-10)),
        bucket: "VENCIDO",
      },
    });
    return { cliente, cert };
  }

  it("com data futura: cria o novo certificado, vincula, desativa o antigo e audita as duas pontas", async () => {
    const { cert } = await certVencido();

    const r = await renovarCertificadoVencido(cert.id, dataISO(365));
    expect(r).toEqual({ ok: true });

    const antigo = await prisma.certificado.findUniqueOrThrow({ where: { id: cert.id } });
    expect(antigo.ativo).toBe(false);
    expect(antigo.bucket).toBe("RENOVADO");
    expect(antigo.substituidoPorId).not.toBeNull();
    expect(antigo.renovadoEm).not.toBeNull();

    const novo = await prisma.certificado.findUniqueOrThrow({
      where: { id: antigo.substituidoPorId! },
    });
    expect(novo.dataValidade.toISOString().slice(0, 10)).toBe(dataISO(365));
    expect(novo.ativo).toBe(true);

    const acoesAntigo = (
      await prisma.registroAuditoria.findMany({ where: { entidadeId: cert.id } })
    )
      .map((a) => a.acao)
      .sort();
    expect(acoesAntigo).toEqual(["DESATIVADO", "RENOVACAO"]);
    const criado = await prisma.registroAuditoria.findFirst({
      where: { entidadeId: novo.id, acao: "CRIADO" },
    });
    expect(criado).not.toBeNull();
  });

  it("com data no passado: acusa a falha e nao move o certificado", async () => {
    const { cert } = await certVencido();

    const r = await renovarCertificadoVencido(cert.id, dataISO(-2));
    expect(r).toEqual({ erro: expect.stringMatching(/futura/i) });

    const antigo = await prisma.certificado.findUniqueOrThrow({ where: { id: cert.id } });
    expect(antigo.ativo).toBe(true);
    expect(antigo.substituidoPorId).toBeNull();
  });

  it("recusa certificado que nao esta vencido", async () => {
    const cliente = await clienteTeste();
    const cert = await prisma.certificado.create({
      data: {
        clienteId: cliente.id,
        tipo: "ECNPJ",
        titular: "Empresa",
        emitidoEm: new Date(dataISO(-350)),
        dataValidade: new Date(dataISO(30)),
        bucket: "D60",
      },
    });

    const r = await renovarCertificadoVencido(cert.id, dataISO(365));
    expect(r).toEqual({ erro: expect.stringMatching(/vencid/i) });
  });
});

describe("avisarClienteD3", () => {
  async function certD3() {
    const cliente = await clienteTeste();
    const cert = await prisma.certificado.create({
      data: {
        clienteId: cliente.id,
        tipo: "ECNPJ",
        titular: "Empresa",
        emitidoEm: new Date(dataISO(-360)),
        dataValidade: new Date(dataISO(2)),
        bucket: "D3",
      },
    });
    return { cliente, cert };
  }

  it("marca avisoD3Em e grava auditoria de aviso enviado", async () => {
    const { cert } = await certD3();

    const r = await avisarClienteD3(cert.id);
    expect(r).toEqual({ ok: true });

    const atualizado = await prisma.certificado.findUniqueOrThrow({ where: { id: cert.id } });
    expect(atualizado.avisoD3Em).not.toBeNull();

    const audit = await prisma.registroAuditoria.findMany({
      where: { entidadeId: cert.id, acao: "AVISO_ENVIADO" },
    });
    expect(audit).toHaveLength(1);
  });

  it("recusa certificado que nao esta na faixa de 3 dias", async () => {
    const cliente = await clienteTeste();
    const cert = await prisma.certificado.create({
      data: {
        clienteId: cliente.id,
        tipo: "ECNPJ",
        titular: "Empresa",
        emitidoEm: new Date(dataISO(-350)),
        dataValidade: new Date(dataISO(30)),
        bucket: "D60",
      },
    });

    const r = await avisarClienteD3(cert.id);
    expect(r).toEqual({ erro: expect.any(String) });

    const atualizado = await prisma.certificado.findUniqueOrThrow({ where: { id: cert.id } });
    expect(atualizado.avisoD3Em).toBeNull();
  });
});

describe("enviarAvisosLote", () => {
  async function certD60(clienteId: string, titular: string) {
    return prisma.certificado.create({
      data: {
        clienteId,
        tipo: "ECNPJ",
        titular,
        emitidoEm: new Date(dataISO(-330)),
        dataValidade: new Date(dataISO(40)),
        bucket: "D60",
      },
    });
  }

  it("cria AvisoCertificado SENT e auditoria para cada certificado do marco", async () => {
    const cliente = await clienteTeste();
    const a = await certD60(cliente.id, "A");
    const b = await certD60(cliente.id, "B");

    const r = await enviarAvisosLote("D60", [a.id, b.id]);
    expect(r).toEqual({ enviados: 2 });

    const avisos = await prisma.avisoCertificado.findMany({
      where: { certificadoId: { in: [a.id, b.id] }, marco: "D60" },
    });
    expect(avisos).toHaveLength(2);
    expect(avisos.every((x) => x.status === "SENT")).toBe(true);

    const audit = await prisma.registroAuditoria.findMany({
      where: { entidadeId: { in: [a.id, b.id] }, acao: "AVISO_ENVIADO" },
    });
    expect(audit).toHaveLength(2);
  });

  it("nao reenvia para quem ja foi avisado com sucesso", async () => {
    const cliente = await clienteTeste();
    const a = await certD60(cliente.id, "C");
    await prisma.avisoCertificado.create({
      data: {
        certificadoId: a.id,
        clienteId: a.clienteId,
        marco: "D60",
        destinatarioEmail: "c@example.com",
        status: "DELIVERED",
        enviadoEm: new Date(),
      },
    });

    const r = await enviarAvisosLote("D60", [a.id]);
    expect(r).toEqual({ enviados: 0 });
  });
});

describe("marcarGrupoLido", () => {
  it("zera as notificacoes do grupo (tipo + dia) do proprio usuario", async () => {
    const cliente = await clienteTeste();
    const certificado = await prisma.certificado.create({
      data: {
        clienteId: cliente.id,
        tipo: "ECNPJ",
        titular: "Empresa",
        emitidoEm: new Date(dataISO(-350)),
        dataValidade: new Date(dataISO(30)),
      },
    });
    const hojeISO = new Date().toISOString().slice(0, 10);
    await prisma.notificacaoInApp.create({
      data: {
        usuarioId: "u-teste-sc20",
        tipo: "D60_ENTROU",
        certificadoId: certificado.id,
        clienteId: cliente.id,
      },
    });

    await marcarGrupoLido("D60_ENTROU", hojeISO);

    const restantes = await prisma.notificacaoInApp.count({
      where: { usuarioId: "u-teste-sc20", tipo: "D60_ENTROU", lidaEm: null },
    });
    expect(restantes).toBe(0);

    await prisma.notificacaoInApp.deleteMany({ where: { usuarioId: "u-teste-sc20" } });
  });
});
