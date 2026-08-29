import { afterEach, describe, expect, it } from "vitest";
import { prisma } from "@/lib/prisma";
import {
  listarAvisos,
  listarCertificadosComStatus,
} from "./consultas";

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
      },
    });
    await prisma.certificado.create({
      data: { clienteId: cliente.id, dataValidade: dataDaqui(10) },
    });

    const lista = await listarCertificadosComStatus();
    const alvo = lista.find((c) => c.razaoSocial === "Cliente Consultas SC-20");

    expect(alvo).toBeDefined();
    expect(alvo?.diasRestantes).toBe(10);
    expect(alvo?.faixa).toBe("ALERTA");
  });
});

describe("listarAvisos", () => {
  it("devolve os avisos com a razao social do cliente e o texto da mensagem", async () => {
    const cliente = await prisma.cliente.create({
      data: {
        razaoSocial: "Cliente Consultas SC-20",
        cnpj: CNPJ_TESTE,
        atividade: "Teste",
      },
    });
    const certificado = await prisma.certificado.create({
      data: { clienteId: cliente.id, dataValidade: dataDaqui(3) },
    });
    await prisma.avisoCertificado.create({
      data: {
        certificadoId: certificado.id,
        faixa: "CRITICO",
        diasRestantes: 3,
        mensagem: "mensagem de teste",
      },
    });

    const avisos = await listarAvisos();
    const alvo = avisos.find((a) => a.mensagem === "mensagem de teste");

    expect(alvo).toBeDefined();
    expect(alvo?.razaoSocial).toBe("Cliente Consultas SC-20");
    expect(alvo?.faixa).toBe("CRITICO");
  });
});
