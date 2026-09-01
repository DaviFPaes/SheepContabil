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
import { criarCertificado, marcarGrupoLido } from "./acoes";

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
