import { prisma } from "@/lib/prisma";
import type { ResultadoExecucao } from "@/lib/execucao";
import { classificarLancamento } from "./conferencia";
import {
  extrairExtratoComClaude,
  IaIndisponivelError,
  type ExtratorExtrato,
} from "./extrator-extrato";

function mensagemDeErro(erro: unknown): string {
  if (erro instanceof IaIndisponivelError) return erro.message;
  if (erro instanceof Error) return erro.message;
  return "Falha inesperada ao processar o documento.";
}

export function derivarCompetencia(iso: string | null, fallback: Date): string {
  if (iso && /^\d{4}-\d{2}-\d{2}$/.test(iso)) return iso.slice(0, 7);
  return `${fallback.getUTCFullYear()}-${String(fallback.getUTCMonth() + 1).padStart(2, "0")}`;
}

export async function processarDocumento(
  documentoId: string,
  extrator: ExtratorExtrato = extrairExtratoComClaude,
): Promise<void> {
  const doc = await prisma.documentoEntrada.findUnique({
    where: { id: documentoId },
  });
  if (!doc || doc.status !== "PENDENTE") return;

  try {
    const resultado = await extrator({
      mimeType: doc.mimeType,
      base64: Buffer.from(doc.arquivo).toString("base64"),
    });

    await prisma.$transaction(async (tx) => {
      for (const linha of resultado.linhas) {
        await tx.lancamento.create({
          data: {
            documentoEntradaId: doc.id,
            data: new Date(`${linha.data}T00:00:00Z`),
            historico: linha.historico,
            valor: linha.valor,
            confianca: linha.confianca,
            trechoOriginal: linha.trechoOriginal ?? null,
            status: classificarLancamento(linha.confianca),
          },
        });
      }
      const emRevisao = resultado.linhas.filter(
        (l) => classificarLancamento(l.confianca) === "PENDENTE_REVISAO",
      ).length;

      await tx.documentoEntrada.update({
        where: { id: doc.id },
        data: {
          status: "PROCESSADO",
          processadoEm: new Date(),
          erro: null,
          periodoInicio: resultado.periodoInicio
            ? new Date(`${resultado.periodoInicio}T00:00:00Z`)
            : null,
          periodoFim: resultado.periodoFim
            ? new Date(`${resultado.periodoFim}T00:00:00Z`)
            : null,
          competencia: derivarCompetencia(
            resultado.periodoFim ?? resultado.periodoInicio,
            doc.chegadaEm,
          ),
        },
      });

      await tx.registroAuditoria.create({
        data: {
          entidade: "DocumentoEntrada",
          entidadeId: doc.id,
          acao: "LEITURA_CONCLUIDA",
          descricao:
            `IA leu ${resultado.linhas.length} ` +
            `${resultado.linhas.length === 1 ? "linha" : "linhas"} de ${doc.nomeArquivo}` +
            (emRevisao > 0 ? ` — ${emRevisao} em conferência` : ""),
          autorId: null,
          autorEmail: null,
          clienteId: doc.clienteId,
        },
      });
    });
  } catch (erro) {
    await prisma.documentoEntrada.update({
      where: { id: doc.id },
      data: { status: "ERRO", erro: mensagemDeErro(erro) },
    });
    await prisma.registroAuditoria.create({
      data: {
        entidade: "DocumentoEntrada",
        entidadeId: doc.id,
        acao: "LEITURA_FALHOU",
        descricao: `Falha ao ler ${doc.nomeArquivo}: ${mensagemDeErro(erro)}`,
        autorId: null,
        autorEmail: null,
        clienteId: doc.clienteId,
      },
    });
  }
}

export async function processarExtratos(opts?: {
  extrator?: ExtratorExtrato;
}): Promise<ResultadoExecucao> {
  const pendentes = await prisma.documentoEntrada.findMany({
    where: { tipo: "EXTRATO", status: "PENDENTE" },
    orderBy: { chegadaEm: "asc" },
    select: { id: true },
  });

  for (const { id } of pendentes) {
    await processarDocumento(id, opts?.extrator);
  }

  const ids = pendentes.map((p) => p.id);
  const depois = await prisma.documentoEntrada.findMany({
    where: { id: { in: ids } },
    include: {
      _count: { select: { lancamentos: true } },
      lancamentos: { select: { status: true } },
    },
  });

  const processados = depois.filter((d) => d.status === "PROCESSADO").length;
  const comErro = depois.filter((d) => d.status === "ERRO").length;
  const emRevisao = depois.reduce(
    (n, d) =>
      n + d.lancamentos.filter((l) => l.status === "PENDENTE_REVISAO").length,
    0,
  );

  const resumo =
    `${pendentes.length} documento(s) no lote: ${processados} processado(s), ${comErro} com erro` +
    (emRevisao > 0 ? `; ${emRevisao} linha(s) em conferência` : "");

  return { status: comErro > 0 ? "PARCIAL" : "SUCESSO", resumo };
}
