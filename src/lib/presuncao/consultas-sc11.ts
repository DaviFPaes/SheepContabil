import { prisma } from "@/lib/prisma";
import {
  consolidar,
  motivoBloqueioRelatorio,
  notaPodeExportar,
  type AliquotaPresuncao,
  type Consolidado,
  type OrigemDecisao,
  type StatusItemNota,
} from "./presuncao-termos";

export type NotaResumo = {
  documentoId: string;
  clienteRazaoSocial: string;
  nomeArquivo: string;
  status: "PENDENTE" | "PROCESSADO" | "ERRO";
  chegadaEm: Date;
  numero: string | null;
  totalItens: number;
  emRevisao: number;
  podeExportar: boolean;
};

export async function listarNotas(): Promise<NotaResumo[]> {
  const docs = await prisma.documentoEntrada.findMany({
    where: { tipo: "NFSE" },
    orderBy: { chegadaEm: "desc" },
    include: {
      cliente: { select: { razaoSocial: true } },
      notaServico: { include: { itens: { select: { status: true } } } },
    },
  });

  return docs.map((d) => {
    const itens = d.notaServico?.itens ?? [];
    const emRevisao = itens.filter((i) => i.status === "PENDENTE_REVISAO").length;
    return {
      documentoId: d.id,
      clienteRazaoSocial: d.cliente.razaoSocial,
      nomeArquivo: d.nomeArquivo,
      status: d.status,
      chegadaEm: d.chegadaEm,
      numero: d.notaServico?.numero ?? null,
      totalItens: itens.length,
      emRevisao,
      podeExportar:
        d.status === "PROCESSADO" &&
        notaPodeExportar(itens as { status: StatusItemNota }[]),
    };
  });
}

export type ItemDetalhe = {
  id: string;
  descricao: string;
  valor: number;
  aliquota: AliquotaPresuncao;
  origem: OrigemDecisao;
  justificativa: string;
  confianca: number | null;
  status: StatusItemNota;
};

export type NotaDetalhe = {
  documentoId: string;
  status: "PENDENTE" | "PROCESSADO" | "ERRO";
  erro: string | null;
  clienteRazaoSocial: string;
  nomeArquivo: string;
  numero: string | null;
  dataEmissao: Date | null;
  itens: ItemDetalhe[];
  consolidado: Consolidado;
  podeExportar: boolean;
  motivoBloqueio: string | null;
};

export async function obterNotaComItens(
  documentoId: string,
): Promise<NotaDetalhe | null> {
  const d = await prisma.documentoEntrada.findUnique({
    where: { id: documentoId },
    include: {
      cliente: { select: { razaoSocial: true } },
      notaServico: {
        include: { itens: { orderBy: [{ criadoEm: "asc" }, { id: "asc" }] } },
      },
    },
  });
  if (!d || d.tipo !== "NFSE") return null;

  const itens: ItemDetalhe[] = (d.notaServico?.itens ?? []).map((i) => ({
    id: i.id,
    descricao: i.descricao,
    valor: Number(i.valor),
    aliquota: i.aliquota as AliquotaPresuncao,
    origem: i.origem as OrigemDecisao,
    justificativa: i.justificativa,
    confianca: i.confianca,
    status: i.status as StatusItemNota,
  }));

  return {
    documentoId: d.id,
    status: d.status,
    erro: d.erro,
    clienteRazaoSocial: d.cliente.razaoSocial,
    nomeArquivo: d.nomeArquivo,
    numero: d.notaServico?.numero ?? null,
    dataEmissao: d.notaServico?.dataEmissao ?? null,
    itens,
    consolidado: consolidar(itens),
    podeExportar: d.status === "PROCESSADO" && notaPodeExportar(itens),
    motivoBloqueio:
      d.status === "PROCESSADO"
        ? motivoBloqueioRelatorio(itens)
        : "Nota ainda não processada",
  };
}

export type TermoView = { id: string; termo: string; aliquota: AliquotaPresuncao };

export async function listarTermos(): Promise<TermoView[]> {
  const termos = await prisma.termoPresuncao.findMany({ orderBy: { termo: "asc" } });
  return termos.map((t) => ({
    id: t.id,
    termo: t.termo,
    aliquota: t.aliquota as AliquotaPresuncao,
  }));
}

export type AuditoriaView = {
  id: string;
  termoTexto: string;
  acao: "CRIACAO" | "RECLASSIFICACAO" | "REMOCAO";
  aliquotaAnterior: AliquotaPresuncao | null;
  aliquotaNova: AliquotaPresuncao | null;
  autorEmail: string;
  criadoEm: Date;
};

export async function listarAuditoriaTermos(limite = 50): Promise<AuditoriaView[]> {
  const linhas = await prisma.auditoriaTermo.findMany({
    orderBy: { criadoEm: "desc" },
    take: limite,
  });
  return linhas.map((a) => ({
    id: a.id,
    termoTexto: a.termoTexto,
    acao: a.acao as AuditoriaView["acao"],
    aliquotaAnterior: (a.aliquotaAnterior as AliquotaPresuncao | null) ?? null,
    aliquotaNova: (a.aliquotaNova as AliquotaPresuncao | null) ?? null,
    autorEmail: a.autorEmail,
    criadoEm: a.criadoEm,
  }));
}
