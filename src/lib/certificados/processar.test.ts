import { afterEach, describe, expect, it } from "vitest";
import { prisma } from "@/lib/prisma";
import { processarAvisosCertificados } from "./processar";

const CNPJ_TESTE = "99.999.999/0001-99";

async function criarClienteTeste() {
  return prisma.cliente.create({
    data: {
      razaoSocial: "Cliente Teste SC-20",
      cnpj: CNPJ_TESTE,
      atividade: "Teste",
    },
  });
}

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

describe("processarAvisosCertificados", () => {
  it("cria um aviso CRITICO para certificado vencendo em 5 dias", async () => {
    const cliente = await criarClienteTeste();
    const certificado = await prisma.certificado.create({
      data: { clienteId: cliente.id, dataValidade: dataDaqui(5) },
    });

    const resultado = await processarAvisosCertificados();
    expect(resultado.status).toBe("SUCESSO");

    const avisos = await prisma.avisoCertificado.findMany({
      where: { certificadoId: certificado.id },
    });
    expect(avisos).toHaveLength(1);
    expect(avisos[0].faixa).toBe("CRITICO");
    expect(avisos[0].diasRestantes).toBe(5);
    expect(avisos[0].mensagem).toContain("vence em 5 dias");
  });

  it("nao cria aviso repetido quando a faixa nao mudou", async () => {
    const cliente = await criarClienteTeste();
    const certificado = await prisma.certificado.create({
      data: { clienteId: cliente.id, dataValidade: dataDaqui(5) },
    });

    await processarAvisosCertificados();
    await processarAvisosCertificados();

    const avisos = await prisma.avisoCertificado.findMany({
      where: { certificadoId: certificado.id },
    });
    expect(avisos).toHaveLength(1);
  });

  it("cria um novo aviso quando a faixa piora", async () => {
    const cliente = await criarClienteTeste();
    const certificado = await prisma.certificado.create({
      data: { clienteId: cliente.id, dataValidade: dataDaqui(20) },
    });

    await processarAvisosCertificados(); // ALERTA

    await prisma.certificado.update({
      where: { id: certificado.id },
      data: { dataValidade: dataDaqui(3) },
    });
    await processarAvisosCertificados(); // CRITICO

    const avisos = await prisma.avisoCertificado.findMany({
      where: { certificadoId: certificado.id },
      orderBy: { criadoEm: "asc" },
    });
    expect(avisos.map((a) => a.faixa)).toEqual(["ALERTA", "CRITICO"]);
  });

  it("ignora certificado fora da janela de 60 dias", async () => {
    const cliente = await criarClienteTeste();
    const certificado = await prisma.certificado.create({
      data: { clienteId: cliente.id, dataValidade: dataDaqui(90) },
    });

    await processarAvisosCertificados();

    const avisos = await prisma.avisoCertificado.findMany({
      where: { certificadoId: certificado.id },
    });
    expect(avisos).toHaveLength(0);
  });
});
