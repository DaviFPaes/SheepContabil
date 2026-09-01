import { afterEach, describe, expect, it } from "vitest";
import { prisma } from "@/lib/prisma";
import { listarCertificadosComStatus } from "./consultas";

const CNPJ_TESTE = "88.888.888/0001-88";

function dataDaqui(dias: number): Date {
  const d = new Date();
  d.setUTCHours(0, 0, 0, 0);
  d.setUTCDate(d.getUTCDate() + dias);
  return d;
}

afterEach(async () => {
  await prisma.avisoCertificado.deleteMany({
    where: { certificado: { cliente: { cnpj: CNPJ_TESTE } } },
  });
  await prisma.certificado.deleteMany({
    where: { cliente: { cnpj: CNPJ_TESTE } },
  });
  await prisma.cliente.deleteMany({ where: { cnpj: CNPJ_TESTE } });
});

describe("listarCertificadosComStatus", () => {
  it("devolve dias restantes e faixa calculados para cada certificado", async () => {
    const cliente = await prisma.cliente.create({
      data: {
        razaoSocial: "Cliente Consultas SC-20",
        cnpj: CNPJ_TESTE,
        atividade: "Teste",
        email: "cliente-consultas-sc20@example.com",
      },
    });
    await prisma.certificado.create({
      data: {
        clienteId: cliente.id,
        dataValidade: dataDaqui(10),
        tipo: "ECNPJ",
        titular: cliente.razaoSocial,
        emitidoEm: dataDaqui(-355),
      },
    });

    const lista = await listarCertificadosComStatus();
    const alvo = lista.find((c) => c.razaoSocial === "Cliente Consultas SC-20");

    expect(alvo).toBeDefined();
    expect(alvo?.diasRestantes).toBe(10);
    expect(alvo?.faixa).toBe("ALERTA");
  });
});

// listarAvisos e reescrita pela Task 6 do plano de implementacao (ver
// docs/superpowers/plans/2026-09-01-sc-20-vencimento-certificado-etapa-1.md)
// como parte de listarCertificados/montarColunasKanban/listarHistorico — a
// migracao sc20_kanban_avisos mudou o que AvisoCertificado representa.
describe("listarAvisos", () => {
  it.todo("Task 6: substituida por listarCertificados + montarColunasKanban");
});
