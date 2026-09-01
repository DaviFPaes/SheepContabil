import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { prisma } from "@/lib/prisma";
import {
  listarDocumentos,
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
  await prisma.documentoEntrada.deleteMany({ where: { cliente: { cnpj: CNPJ } } });
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

describe("listarDocumentos", () => {
  it("traz contagem e trava do OFX", async () => {
    const { doc } = await cenario();
    const lista = await listarDocumentos("EXTRATO");
    const alvo = lista.find((d) => d.id === doc.id);
    expect(alvo?.totalLancamentos).toBe(2);
    expect(alvo?.emRevisao).toBe(1);
    expect(alvo?.podeBaixarOfx).toBe(false);
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
