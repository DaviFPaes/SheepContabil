import { prisma } from "@/lib/prisma";
import type { ResultadoExecucao } from "@/lib/execucao";
import { IaIndisponivelError } from "@/lib/ia";
import {
  casarTermo,
  classificarStatusItem,
  type AliquotaPresuncao,
  type TermoParaCasar,
} from "./presuncao-termos";
import { parsearNfse, XmlInvalidoError } from "./parsear-nfse";
import {
  classificarComClaude,
  type ClassificadorItens,
  type ItemParaClassificar,
} from "./classificador-itens";

export const CHUNK_ITENS = 40;

function mensagemDeErro(erro: unknown): string {
  if (erro instanceof IaIndisponivelError) return erro.message;
  if (erro instanceof XmlInvalidoError) return erro.message;
  if (erro instanceof Error) return erro.message;
  return "Falha inesperada ao processar a nota.";
}

type ItemMontado = {
  descricao: string;
  valor: number;
  aliquota: AliquotaPresuncao;
  origem: "REGRA" | "IA";
  justificativa: string;
  confianca: number | null;
  status: "CONFIRMADO" | "PENDENTE_REVISAO";
};

async function classificarItens(
  itens: { descricao: string; valor: number }[],
  termos: TermoParaCasar[],
  classificador: ClassificadorItens,
): Promise<ItemMontado[]> {
  const montados: (ItemMontado | null)[] = new Array(itens.length).fill(null);
  const paraIa: { indiceOriginal: number; item: ItemParaClassificar }[] = [];

  itens.forEach((item, i) => {
    const match = casarTermo(item.descricao, termos);
    if (match) {
      montados[i] = {
        descricao: item.descricao,
        valor: item.valor,
        aliquota: match.aliquota,
        origem: "REGRA",
        justificativa: `Termo "${match.termo}".`,
        confianca: null,
        status: "CONFIRMADO",
      };
    } else {
      paraIa.push({ indiceOriginal: i, item: { descricao: item.descricao } });
    }
  });

  for (let inicio = 0; inicio < paraIa.length; inicio += CHUNK_ITENS) {
    const fatia = paraIa.slice(inicio, inicio + CHUNK_ITENS);
    const classificados = await classificador(fatia.map((f) => f.item));
    classificados.forEach((c) => {
      const alvo = fatia[c.indice];
      if (!alvo) return;
      const original = itens[alvo.indiceOriginal];
      montados[alvo.indiceOriginal] = {
        descricao: original.descricao,
        valor: original.valor,
        aliquota: c.aliquota,
        origem: "IA",
        justificativa: c.justificativa,
        confianca: c.confianca,
        status: classificarStatusItem(c.confianca),
      };
    });
  }

  return montados.map((m, i) =>
    m ?? {
      descricao: itens[i].descricao,
      valor: itens[i].valor,
      aliquota: "P32" as const,
      origem: "IA" as const,
      justificativa: "IA não classificou este item.",
      confianca: 0,
      status: "PENDENTE_REVISAO" as const,
    },
  );
}

export async function processarDocumento(
  documentoId: string,
  classificador: ClassificadorItens = classificarComClaude,
): Promise<void> {
  const doc = await prisma.documentoEntrada.findUnique({ where: { id: documentoId } });
  if (!doc || doc.tipo !== "NFSE" || doc.status !== "PENDENTE") return;

  try {
    const nota = parsearNfse(Buffer.from(doc.arquivo).toString("utf8"));
    const termos: TermoParaCasar[] = (
      await prisma.termoPresuncao.findMany({ select: { termo: true, aliquota: true } })
    ).map((t) => ({ termo: t.termo, aliquota: t.aliquota as AliquotaPresuncao }));

    const itens = await classificarItens(nota.itens, termos, classificador);

    await prisma.$transaction(async (tx) => {
      const criada = await tx.notaServico.create({
        data: {
          documentoEntradaId: doc.id,
          numero: nota.numero,
          dataEmissao: new Date(`${nota.dataEmissao}T00:00:00Z`),
          valorTotal: nota.valorTotal,
        },
      });
      await tx.itemNota.createMany({
        data: itens.map((item) => ({
          notaServicoId: criada.id,
          descricao: item.descricao,
          valor: item.valor,
          aliquota: item.aliquota,
          origem: item.origem,
          justificativa: item.justificativa,
          confianca: item.confianca,
          status: item.status,
        })),
      });
      await tx.documentoEntrada.update({
        where: { id: doc.id },
        data: { status: "PROCESSADO", processadoEm: new Date(), erro: null },
      });
    });
  } catch (erro) {
    await prisma.documentoEntrada.update({
      where: { id: doc.id },
      data: { status: "ERRO", erro: mensagemDeErro(erro) },
    });
  }
}

export async function processarNotas(opts?: {
  classificador?: ClassificadorItens;
}): Promise<ResultadoExecucao> {
  const pendentes = await prisma.documentoEntrada.findMany({
    where: { tipo: "NFSE", status: "PENDENTE" },
    orderBy: { chegadaEm: "asc" },
    select: { id: true },
  });

  for (const { id } of pendentes) {
    await processarDocumento(id, opts?.classificador);
  }

  const ids = pendentes.map((p) => p.id);
  const depois = await prisma.documentoEntrada.findMany({
    where: { id: { in: ids } },
    include: { notaServico: { include: { itens: { select: { status: true } } } } },
  });

  const processadas = depois.filter((d) => d.status === "PROCESSADO").length;
  const comErro = depois.filter((d) => d.status === "ERRO").length;
  const emRevisao = depois.reduce(
    (n, d) =>
      n +
      (d.notaServico?.itens.filter((i) => i.status === "PENDENTE_REVISAO").length ?? 0),
    0,
  );

  const resumo =
    `${pendentes.length} nota(s) no lote: ${processadas} processada(s), ${comErro} com erro` +
    (emRevisao > 0 ? `; ${emRevisao} item(ns) em conferência` : "");

  return { status: comErro > 0 ? "PARCIAL" : "SUCESSO", resumo };
}
