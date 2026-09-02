import { afterEach, describe, expect, it } from "vitest";
import { prisma } from "@/lib/prisma";
import {
  criarExtratorFake,
  type ExtratorExtrato,
  type LinhaExtraida,
} from "./extrator-extrato";
import { processarDocumento, processarExtratos } from "./processar-sc01";

// Limpeza por prefixo de nomeArquivo + CNPJ fixo (nao por timestamp): cada teste
// cria seus proprios docs com o prefixo MARCADOR e o afterEach apaga exatamente
// esses, deixando o banco identico ao estado anterior.
const MARCADOR = "sc01-teste";

afterEach(async () => {
  await prisma.lancamento.deleteMany({
    where: { documentoEntrada: { nomeArquivo: { startsWith: MARCADOR } } },
  });
  await prisma.documentoEntrada.deleteMany({
    where: { nomeArquivo: { startsWith: MARCADOR } },
  });
  await prisma.cliente.deleteMany({ where: { cnpj: "77.777.777/0001-77" } });

  // processarExtratos faz um sweep GLOBAL: ele tambem varre os 4 extratos do
  // seed (extrato-*.pdf / extrato-foto.jpg), se o banco estiver semeado.
  // Devolve esses ao estado original pra suite ficar idempotente e a caixa de
  // entrada de demonstracao continuar populada apos rodar os testes.
  await prisma.lancamento.deleteMany({
    where: { documentoEntrada: { nomeArquivo: { startsWith: "extrato-" } } },
  });
  await prisma.documentoEntrada.updateMany({
    where: { tipo: "EXTRATO", nomeArquivo: { startsWith: "extrato-" } },
    data: { status: "PENDENTE", processadoEm: null, erro: null },
  });
});

async function clienteTeste() {
  return prisma.cliente.upsert({
    where: { cnpj: "77.777.777/0001-77" },
    update: {},
    create: {
      razaoSocial: "Cliente SC-01 Teste",
      cnpj: "77.777.777/0001-77",
      atividade: "Teste",
      email: "cliente-sc01-teste@example.com",
    },
  });
}

async function docTeste(nome: string, conteudo = "fake-pdf-bytes") {
  const cliente = await clienteTeste();
  return prisma.documentoEntrada.create({
    data: {
      tipo: "EXTRATO",
      clienteId: cliente.id,
      nomeArquivo: `${MARCADOR}-${nome}.pdf`,
      mimeType: "application/pdf",
      arquivo: Buffer.from(conteudo),
      chegadaEm: new Date(),
    },
  });
}

const LINHAS_OK: LinhaExtraida[] = [
  { data: "2026-08-03", historico: "PAG A", valor: -10, confianca: 1 },
  { data: "2026-08-05", historico: "REC B", valor: 200, confianca: 0.6 }, // baixa confiança
];

describe("processarDocumento", () => {
  it("cria os lancamentos classificados e marca PROCESSADO", async () => {
    const doc = await docTeste("a");
    await processarDocumento(doc.id, criarExtratorFake(LINHAS_OK));

    const atualizado = await prisma.documentoEntrada.findUniqueOrThrow({
      where: { id: doc.id },
      include: { lancamentos: { orderBy: { data: "asc" } } },
    });
    expect(atualizado.status).toBe("PROCESSADO");
    expect(atualizado.processadoEm).not.toBeNull();
    expect(atualizado.lancamentos).toHaveLength(2);
    expect(atualizado.lancamentos[0].status).toBe("CONFIRMADO");
    expect(atualizado.lancamentos[1].status).toBe("PENDENTE_REVISAO");
  });

  it("marca ERRO com mensagem legivel quando o extrator lanca IaIndisponivelError", async () => {
    const doc = await docTeste("b");
    const extratorQuebrado = async () => {
      const { IaIndisponivelError } = await import("./extrator-extrato");
      throw new IaIndisponivelError();
    };
    await processarDocumento(doc.id, extratorQuebrado);

    const atualizado = await prisma.documentoEntrada.findUniqueOrThrow({
      where: { id: doc.id },
    });
    expect(atualizado.status).toBe("ERRO");
    expect(atualizado.erro).toContain("IA indisponível");
    expect(
      await prisma.lancamento.count({ where: { documentoEntradaId: doc.id } }),
    ).toBe(0);
  });

  it("nao reprocessa um doc que ja saiu de PENDENTE", async () => {
    const doc = await docTeste("c");
    await processarDocumento(doc.id, criarExtratorFake(LINHAS_OK));
    await processarDocumento(doc.id, criarExtratorFake([]));
    expect(
      await prisma.lancamento.count({ where: { documentoEntradaId: doc.id } }),
    ).toBe(2);
  });
});

describe("processarExtratos", () => {
  it("processa o lote e devolve PARCIAL quando um documento falha", async () => {
    const bom = await docTeste("bom", "conteudo-extrato-bom");
    const ruim = await docTeste("ruim", "conteudo-extrato-ruim-ilegivel");

    // Extrator POR DOCUMENTO (nao por contador de chamadas): quebra so no doc
    // cujo conteudo marca "ruim". Assim o teste nao depende da ordem nem da
    // quantidade de pendentes — processarExtratos faz um sweep global e pode
    // pegar tambem os extratos do seed.
    const extrator: ExtratorExtrato = async ({ base64 }) => {
      const conteudo = Buffer.from(base64, "base64").toString("utf8");
      if (conteudo.includes("ruim")) throw new Error("Arquivo ilegível.");
      return LINHAS_OK;
    };
    const resultado = await processarExtratos({ extrator });

    // Ao menos um doc falhou (o "ruim"), entao o lote e PARCIAL.
    expect(resultado.status).toBe("PARCIAL");
    expect(resultado.resumo).toMatch(/documento\(s\) no lote/i);
    expect(resultado.resumo).toMatch(/com erro/i);

    // Afirma so sobre os 2 docs deste teste — o sweep pode ter tocado noutros.
    const depoisBom = await prisma.documentoEntrada.findUniqueOrThrow({
      where: { id: bom.id },
    });
    const depoisRuim = await prisma.documentoEntrada.findUniqueOrThrow({
      where: { id: ruim.id },
    });
    expect(depoisBom.status).toBe("PROCESSADO");
    expect(depoisRuim.status).toBe("ERRO");
    expect(depoisRuim.erro).toContain("ilegível");
  });
});
