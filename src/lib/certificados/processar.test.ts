import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { prisma } from "@/lib/prisma";
import { processarAvisosCertificados } from "./processar";

const CNPJ_TESTE = "99.999.999/0001-99";

// "Hoje" fixo: o motor varre TODOS os certificados, entao as datas dos certs
// de teste sao ancoradas neste valor (nao em `new Date()`) para o calculo de
// dias ser deterministico independentemente de quando a suite roda.
const HOJE = new Date("2026-08-29T12:00:00Z");

// Marca do inicio de cada teste. O `afterEach` apaga TODO aviso criado a
// partir daqui — inclusive os que o motor emite para os certificados do seed —
// para nao envenenar a demo semeada.
let testStart: Date;

async function criarClienteTeste() {
  return prisma.cliente.create({
    data: {
      razaoSocial: "Cliente Teste SC-20",
      cnpj: CNPJ_TESTE,
      atividade: "Teste",
    },
  });
}

function dataRelativaAHoje(dias: number): Date {
  const d = new Date(HOJE);
  d.setUTCHours(0, 0, 0, 0);
  d.setUTCDate(d.getUTCDate() + dias);
  return d;
}

beforeEach(() => {
  testStart = new Date();
});

afterEach(async () => {
  vi.restoreAllMocks();
  await prisma.avisoCertificado.deleteMany({
    where: { criadoEm: { gte: testStart } },
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
      data: { clienteId: cliente.id, dataValidade: dataRelativaAHoje(5) },
    });

    const resultado = await processarAvisosCertificados(HOJE);
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
      data: { clienteId: cliente.id, dataValidade: dataRelativaAHoje(5) },
    });

    await processarAvisosCertificados(HOJE);
    await processarAvisosCertificados(HOJE);

    const avisos = await prisma.avisoCertificado.findMany({
      where: { certificadoId: certificado.id },
    });
    expect(avisos).toHaveLength(1);
  });

  it("cria um novo aviso quando a faixa piora", async () => {
    const cliente = await criarClienteTeste();
    const certificado = await prisma.certificado.create({
      data: { clienteId: cliente.id, dataValidade: dataRelativaAHoje(20) },
    });

    await processarAvisosCertificados(HOJE); // ALERTA

    await prisma.certificado.update({
      where: { id: certificado.id },
      data: { dataValidade: dataRelativaAHoje(3) },
    });
    await processarAvisosCertificados(HOJE); // CRITICO

    const avisos = await prisma.avisoCertificado.findMany({
      where: { certificadoId: certificado.id },
      orderBy: [{ criadoEm: "asc" }, { id: "asc" }],
    });
    expect(avisos.map((a) => a.faixa)).toEqual(["ALERTA", "CRITICO"]);
  });

  it("ignora certificado fora da janela de 60 dias", async () => {
    const cliente = await criarClienteTeste();
    const certificado = await prisma.certificado.create({
      data: { clienteId: cliente.id, dataValidade: dataRelativaAHoje(90) },
    });

    await processarAvisosCertificados(HOJE);

    const avisos = await prisma.avisoCertificado.findMany({
      where: { certificadoId: certificado.id },
    });
    expect(avisos).toHaveLength(0);
  });

  it("devolve PARCIAL quando um aviso falha, sem abortar os demais", async () => {
    const cliente = await criarClienteTeste();
    await prisma.certificado.create({
      data: { clienteId: cliente.id, dataValidade: dataRelativaAHoje(5) },
    });
    await prisma.certificado.create({
      data: { clienteId: cliente.id, dataValidade: dataRelativaAHoje(20) },
    });

    const createOriginal = prisma.avisoCertificado.create;
    const createSpy = vi.spyOn(prisma.avisoCertificado, "create");
    createSpy.mockImplementationOnce(
      () =>
        Promise.reject(
          new Error("falha simulada ao gravar aviso"),
        ) as unknown as ReturnType<typeof createOriginal>,
    );
    createSpy.mockImplementation(createOriginal);
    const erroSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    const resultado = await processarAvisosCertificados(HOJE);

    expect(resultado.status).toBe("PARCIAL");
    expect(resultado.resumo).toContain("1 certificado(s) falharam");
    expect(erroSpy).toHaveBeenCalled();

    // A falha em um item nao derrubou o lote: pelo menos um aviso posterior
    // continua gravado.
    const gravados = await prisma.avisoCertificado.count({
      where: { criadoEm: { gte: testStart } },
    });
    expect(gravados).toBeGreaterThan(0);
  });
});
