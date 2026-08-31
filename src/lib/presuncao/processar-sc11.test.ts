import { afterEach, describe, expect, it } from "vitest";
import { prisma } from "@/lib/prisma";
import { criarClassificadorFake } from "./classificador-itens";
import { processarDocumento, processarNotas, CHUNK_ITENS } from "./processar-sc11";

const MARCADOR = "sc11-teste";
const CNPJ = "66.666.666/0001-66";
const TERMO_MARCADOR = "zzz-teste-";

function xml(numero: string, itens: { d: string; v: number }[]): string {
  const linhas = itens
    .map((i) => `<Item><Discriminacao>${i.d}</Discriminacao><Valor>${i.v}</Valor></Item>`)
    .join("");
  const total = itens.reduce((s, i) => s + i.v, 0);
  return `<NFSe><InfNfse><Numero>${numero}</Numero><DataEmissao>2026-08-07</DataEmissao><ListaItens>${linhas}</ListaItens><ValorTotal>${total}</ValorTotal></InfNfse></NFSe>`;
}

afterEach(async () => {
  await prisma.itemNota.deleteMany({
    where: { notaServico: { documentoEntrada: { nomeArquivo: { startsWith: MARCADOR } } } },
  });
  await prisma.notaServico.deleteMany({
    where: { documentoEntrada: { nomeArquivo: { startsWith: MARCADOR } } },
  });
  await prisma.documentoEntrada.deleteMany({ where: { nomeArquivo: { startsWith: MARCADOR } } });
  await prisma.cliente.deleteMany({ where: { cnpj: CNPJ } });
  await prisma.termoPresuncao.deleteMany({ where: { termo: { startsWith: TERMO_MARCADOR } } });

  // Devolve as NFS-e do seed ao estado PENDENTE (processarNotas faz sweep global).
  await prisma.itemNota.deleteMany({
    where: { notaServico: { documentoEntrada: { nomeArquivo: { startsWith: "nfse-" } } } },
  });
  await prisma.notaServico.deleteMany({
    where: { documentoEntrada: { nomeArquivo: { startsWith: "nfse-" } } },
  });
  await prisma.documentoEntrada.updateMany({
    where: { tipo: "NFSE", nomeArquivo: { startsWith: "nfse-" } },
    data: { status: "PENDENTE", processadoEm: null, erro: null },
  });
});

async function clienteTeste() {
  return prisma.cliente.upsert({
    where: { cnpj: CNPJ },
    update: {},
    create: { razaoSocial: "Cliente SC-11 Teste", cnpj: CNPJ, atividade: "Teste" },
  });
}

async function docTeste(nome: string, conteudoXml: string) {
  const cliente = await clienteTeste();
  return prisma.documentoEntrada.create({
    data: {
      tipo: "NFSE",
      clienteId: cliente.id,
      nomeArquivo: `${MARCADOR}-${nome}.xml`,
      mimeType: "application/xml",
      arquivo: Buffer.from(conteudoXml, "utf8"),
      chegadaEm: new Date(),
    },
  });
}

describe("processarDocumento", () => {
  it("classifica por REGRA quando bate em termo, e cria a NotaServico", async () => {
    await prisma.termoPresuncao.create({
      data: { termo: `${TERMO_MARCADOR}xpto alfa`, aliquota: "P8" },
    });
    const doc = await docTeste("a", xml("1", [
      { d: "Servico zzz-teste-xpto alfa detalhado", v: 100 },
    ]));

    await processarDocumento(doc.id, criarClassificadorFake(() => []));

    const atualizado = await prisma.documentoEntrada.findUniqueOrThrow({
      where: { id: doc.id },
      include: { notaServico: { include: { itens: true } } },
    });
    expect(atualizado.status).toBe("PROCESSADO");
    expect(atualizado.notaServico?.numero).toBe("1");
    expect(atualizado.notaServico?.itens).toHaveLength(1);
    expect(atualizado.notaServico?.itens[0].origem).toBe("REGRA");
    expect(atualizado.notaServico?.itens[0].aliquota).toBe("P8");
    expect(atualizado.notaServico?.itens[0].status).toBe("CONFIRMADO");
  });

  it("manda os itens sem match pra IA; baixa confiança vira PENDENTE_REVISAO", async () => {
    const doc = await docTeste("b", xml("2", [
      { d: "Servico xpto beta sem termo", v: 300 },
    ]));
    const fake = criarClassificadorFake((itens) =>
      itens.map((_, indice) => ({
        indice,
        aliquota: "P32" as const,
        confianca: 0.4,
        justificativa: "descrição vaga",
      })),
    );

    await processarDocumento(doc.id, fake);

    const nota = await prisma.notaServico.findFirstOrThrow({
      where: { documentoEntradaId: doc.id },
      include: { itens: true },
    });
    expect(nota.itens[0].origem).toBe("IA");
    expect(nota.itens[0].confianca).toBe(0.4);
    expect(nota.itens[0].status).toBe("PENDENTE_REVISAO");
  });

  it("XML ruim -> documento ERRO com mensagem legível, sem NotaServico", async () => {
    const doc = await docTeste("c", "<NFSe><InfNfse>");
    await processarDocumento(doc.id, criarClassificadorFake(() => []));
    const atualizado = await prisma.documentoEntrada.findUniqueOrThrow({ where: { id: doc.id } });
    expect(atualizado.status).toBe("ERRO");
    expect(atualizado.erro).toMatch(/ileg[ií]vel|formato/i);
    expect(await prisma.notaServico.count({ where: { documentoEntradaId: doc.id } })).toBe(0);
  });

  it("chama o classificador em mais de um chunk quando há > 40 itens sem match", async () => {
    const muitos = Array.from({ length: CHUNK_ITENS + 5 }, (_, i) => ({
      d: `Servico sem termo numero ${i}`,
      v: 10,
    }));
    const doc = await docTeste("d", xml("3", muitos));
    const tamanhos: number[] = [];
    const fake = criarClassificadorFake((itens) => {
      tamanhos.push(itens.length);
      return itens.map((_, indice) => ({
        indice,
        aliquota: "P8" as const,
        confianca: 0.99,
        justificativa: "ok",
      }));
    });

    await processarDocumento(doc.id, fake);

    expect(tamanhos.length).toBeGreaterThanOrEqual(2);
    expect(Math.max(...tamanhos)).toBeLessThanOrEqual(CHUNK_ITENS);
  });

  it("não reprocessa um doc que já saiu de PENDENTE", async () => {
    const doc = await docTeste("e", xml("4", [{ d: "Servico xpto beta", v: 10 }]));
    const fake = criarClassificadorFake((itens) =>
      itens.map((_, indice) => ({ indice, aliquota: "P8" as const, confianca: 1, justificativa: "ok" })),
    );
    await processarDocumento(doc.id, fake);
    await processarDocumento(doc.id, fake);
    const notas = await prisma.notaServico.count({ where: { documentoEntradaId: doc.id } });
    expect(notas).toBe(1);
  });
});

describe("processarNotas", () => {
  it("processa o lote e devolve PARCIAL quando uma nota falha", async () => {
    const bom = await docTeste("lote-bom", xml("10", [{ d: "Servico xpto beta", v: 10 }]));
    const ruim = await docTeste("lote-ruim", "<NFSe><InfNfse>");
    const fake = criarClassificadorFake((itens) =>
      itens.map((_, indice) => ({ indice, aliquota: "P32" as const, confianca: 1, justificativa: "ok" })),
    );

    const resultado = await processarNotas({ classificador: fake });

    expect(resultado.status).toBe("PARCIAL");
    expect(resultado.resumo).toMatch(/nota\(s\) no lote/i);

    const depoisBom = await prisma.documentoEntrada.findUniqueOrThrow({ where: { id: bom.id } });
    const depoisRuim = await prisma.documentoEntrada.findUniqueOrThrow({ where: { id: ruim.id } });
    expect(depoisBom.status).toBe("PROCESSADO");
    expect(depoisRuim.status).toBe("ERRO");
  });
});
