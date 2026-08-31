import { afterEach, describe, expect, it } from "vitest";
import { prisma } from "@/lib/prisma";
import { criarClassificadorFake } from "./classificador-itens";
import { processarDocumento } from "./processar-sc11";
import {
  listarNotas,
  obterNotaComItens,
  listarTermos,
  listarAuditoriaTermos,
} from "./consultas-sc11";

const MARCADOR = "sc11-teste";
const CNPJ = "66.666.666/0001-66";
const TERMO_MARCADOR = "zzz-teste-";

afterEach(async () => {
  await prisma.itemNota.deleteMany({
    where: { notaServico: { documentoEntrada: { nomeArquivo: { startsWith: MARCADOR } } } },
  });
  await prisma.notaServico.deleteMany({
    where: { documentoEntrada: { nomeArquivo: { startsWith: MARCADOR } } },
  });
  await prisma.documentoEntrada.deleteMany({ where: { nomeArquivo: { startsWith: MARCADOR } } });
  await prisma.cliente.deleteMany({ where: { cnpj: CNPJ } });
  await prisma.auditoriaTermo.deleteMany({ where: { termoTexto: { startsWith: TERMO_MARCADOR } } });
  await prisma.termoPresuncao.deleteMany({ where: { termo: { startsWith: TERMO_MARCADOR } } });
});

function xml(numero: string, itens: { d: string; v: number }[]): string {
  const linhas = itens
    .map((i) => `<Item><Discriminacao>${i.d}</Discriminacao><Valor>${i.v}</Valor></Item>`)
    .join("");
  return `<NFSe><InfNfse><Numero>${numero}</Numero><DataEmissao>2026-08-07</DataEmissao><ListaItens>${linhas}</ListaItens><ValorTotal>0</ValorTotal></InfNfse></NFSe>`;
}

async function notaProcessada(nome: string, confianca: number) {
  const cliente = await prisma.cliente.upsert({
    where: { cnpj: CNPJ },
    update: {},
    create: { razaoSocial: "Cliente SC-11 Teste", cnpj: CNPJ, atividade: "Teste" },
  });
  const doc = await prisma.documentoEntrada.create({
    data: {
      tipo: "NFSE",
      clienteId: cliente.id,
      nomeArquivo: `${MARCADOR}-${nome}.xml`,
      mimeType: "application/xml",
      arquivo: Buffer.from(xml("77", [{ d: "Servico sem termo alfa", v: 100 }]), "utf8"),
      chegadaEm: new Date(),
    },
  });
  await processarDocumento(
    doc.id,
    criarClassificadorFake((itens) =>
      itens.map((_, indice) => ({ indice, aliquota: "P8" as const, confianca, justificativa: "ok" })),
    ),
  );
  return doc;
}

describe("listarNotas / obterNotaComItens", () => {
  it("resume contagem e conferência; o detalhe traz o consolidado", async () => {
    const doc = await notaProcessada("a", 0.5); // baixa confiança -> 1 item em revisão

    const resumo = (await listarNotas()).find((n) => n.documentoId === doc.id);
    expect(resumo).toMatchObject({ status: "PROCESSADO", totalItens: 1, emRevisao: 1, podeExportar: false });

    const detalhe = await obterNotaComItens(doc.id);
    expect(detalhe?.numero).toBe("77");
    expect(detalhe?.itens).toHaveLength(1);
    expect(detalhe?.consolidado.porBalde[0]).toMatchObject({ aliquota: "P8", somaValor: 100, basePresuncao: 8 });
    expect(detalhe?.podeExportar).toBe(false);
    expect(detalhe?.motivoBloqueio).toMatch(/conferência/);
  });

  it("nota alta confiança já sai exportável", async () => {
    const doc = await notaProcessada("b", 0.99);
    const detalhe = await obterNotaComItens(doc.id);
    expect(detalhe?.podeExportar).toBe(true);
    expect(detalhe?.motivoBloqueio).toBeNull();
  });

  it("obterNotaComItens devolve null para id inexistente", async () => {
    expect(await obterNotaComItens("nao-existe")).toBeNull();
  });
});

describe("listarTermos / listarAuditoriaTermos", () => {
  it("lista termos ordenados e a auditoria do mais novo pro mais velho", async () => {
    const t = await prisma.termoPresuncao.create({
      data: { termo: `${TERMO_MARCADOR}tomografia`, aliquota: "P8" },
    });
    await prisma.auditoriaTermo.create({
      data: { termoId: t.id, termoTexto: t.termo, acao: "CRIACAO", aliquotaNova: "P8", autorEmail: "a@b.c" },
    });
    await prisma.auditoriaTermo.create({
      data: { termoId: t.id, termoTexto: t.termo, acao: "RECLASSIFICACAO", aliquotaAnterior: "P8", aliquotaNova: "P32", autorEmail: "a@b.c" },
    });

    expect((await listarTermos()).some((x) => x.termo === t.termo)).toBe(true);
    const aud = (await listarAuditoriaTermos()).filter((a) => a.termoTexto === t.termo);
    expect(aud[0].acao).toBe("RECLASSIFICACAO");
    expect(aud[1].acao).toBe("CRIACAO");
  });
});
