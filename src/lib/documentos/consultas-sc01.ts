import { prisma } from "@/lib/prisma";
import type { ContaOfx } from "./ofx";
import {
  documentoPodeBaixarOfx,
  motivoBloqueioOfx,
  type StatusConferencia,
} from "./conferencia";

export type DocumentoResumo = {
  id: string;
  clienteRazaoSocial: string;
  tipo: "EXTRATO" | "NFSE";
  nomeArquivo: string;
  status: "PENDENTE" | "PROCESSADO" | "ERRO";
  chegadaEm: Date;
  totalLancamentos: number;
  emRevisao: number;
  podeBaixarOfx: boolean;
};

export async function listarDocumentos(
  tipo?: "EXTRATO" | "NFSE",
): Promise<DocumentoResumo[]> {
  const docs = await prisma.documentoEntrada.findMany({
    where: tipo ? { tipo } : undefined,
    orderBy: { chegadaEm: "desc" },
    include: {
      cliente: { select: { razaoSocial: true } },
      lancamentos: { select: { status: true } },
    },
  });
  return docs.map((d) => {
    const emRevisao = d.lancamentos.filter(
      (l) => l.status === "PENDENTE_REVISAO",
    ).length;
    return {
      id: d.id,
      clienteRazaoSocial: d.cliente.razaoSocial,
      tipo: d.tipo,
      nomeArquivo: d.nomeArquivo,
      status: d.status,
      chegadaEm: d.chegadaEm,
      totalLancamentos: d.lancamentos.length,
      emRevisao,
      podeBaixarOfx:
        d.status === "PROCESSADO" &&
        documentoPodeBaixarOfx(
          d.lancamentos as { status: StatusConferencia }[],
        ),
    };
  });
}

export type LancamentoDetalhe = {
  id: string;
  data: Date;
  historico: string;
  valor: number;
  confianca: number;
  trechoOriginal: string | null;
  status: StatusConferencia;
};

export type DocumentoDetalhe = {
  id: string;
  cliente: { id: string; razaoSocial: string };
  conta: ContaOfx | null;
  tipo: "EXTRATO" | "NFSE";
  nomeArquivo: string;
  mimeType: string;
  status: "PENDENTE" | "PROCESSADO" | "ERRO";
  erro: string | null;
  lancamentos: LancamentoDetalhe[];
  podeBaixarOfx: boolean;
  motivoBloqueio: string | null;
};

export async function obterDocumentoComLancamentos(
  id: string,
): Promise<DocumentoDetalhe | null> {
  const d = await prisma.documentoEntrada.findUnique({
    where: { id },
    include: {
      cliente: { select: { id: true, razaoSocial: true } },
      contaBancaria: true,
      lancamentos: { orderBy: { data: "asc" } },
    },
  });
  if (!d) return null;

  const lancamentos: LancamentoDetalhe[] = d.lancamentos.map((l) => ({
    id: l.id,
    data: l.data,
    historico: l.historico,
    valor: Number(l.valor),
    confianca: l.confianca,
    trechoOriginal: l.trechoOriginal,
    status: l.status as StatusConferencia,
  }));

  return {
    id: d.id,
    cliente: d.cliente,
    conta: d.contaBancaria
      ? {
          bancoNome: d.contaBancaria.bancoNome,
          compe: d.contaBancaria.compe,
          agencia: d.contaBancaria.agencia,
          numero: d.contaBancaria.numero,
        }
      : null,
    tipo: d.tipo,
    nomeArquivo: d.nomeArquivo,
    mimeType: d.mimeType,
    status: d.status,
    erro: d.erro,
    lancamentos,
    podeBaixarOfx:
      d.status === "PROCESSADO" && documentoPodeBaixarOfx(lancamentos),
    motivoBloqueio:
      d.status === "PROCESSADO" ? motivoBloqueioOfx(lancamentos) : "Documento ainda não processado",
  };
}

export async function listarContasDoCliente(
  clienteId: string,
): Promise<{ id: string; rotulo: string }[]> {
  const contas = await prisma.contaBancaria.findMany({
    where: { clienteId },
    orderBy: { bancoNome: "asc" },
  });
  return contas.map((c) => ({
    id: c.id,
    rotulo: `${c.bancoNome} — ag ${c.agencia} c/c ${c.numero}`,
  }));
}

export { listarClientesParaUpload } from "@/lib/clientes";
