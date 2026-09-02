import { prisma } from "@/lib/prisma";
import type { Prisma } from "@/generated/prisma/client";
import type { ContaOfx } from "./ofx";
import {
  documentoPodeBaixarOfx,
  motivoBloqueioOfx,
  type StatusConferencia,
} from "./conferencia";
import { derivarCompetencia } from "./processar-sc01";
import type {
  AcaoAuditoriaDocumento,
  LinhaAuditoriaDocumento,
} from "./historico";

// Entidades que compõem a trilha de auditoria do SC-01. `listarHistoricoDocumentos`
// sempre filtra por elas — eventos de outros módulos (ex. "Certificado") ficam de fora.
const ENTIDADES_SC01 = [
  "DocumentoEntrada",
  "Lancamento",
  "Cliente",
  "CobrancaExtrato",
];

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
  bancoRotulo: string | null;
  competencia: string;
};

export async function listarDocumentos(opts?: {
  tipo?: "EXTRATO" | "NFSE";
  competencia?: string;
  clienteId?: string;
}): Promise<DocumentoResumo[]> {
  const docs = await prisma.documentoEntrada.findMany({
    where: {
      ...(opts?.tipo ? { tipo: opts.tipo } : {}),
      ...(opts?.competencia ? { competencia: opts.competencia } : {}),
      ...(opts?.clienteId ? { clienteId: opts.clienteId } : {}),
    },
    orderBy: { chegadaEm: "desc" },
    include: {
      cliente: { select: { razaoSocial: true } },
      contaBancaria: { select: { bancoNome: true, agencia: true, numero: true } },
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
      bancoRotulo: d.contaBancaria
        ? `${d.contaBancaria.bancoNome} — ag ${d.contaBancaria.agencia} c/c ${d.contaBancaria.numero}`
        : null,
      competencia: d.competencia ?? derivarCompetencia(null, d.chegadaEm),
    };
  });
}

function paraLinhaAuditoria(r: {
  id: string;
  acao: string;
  descricao: string;
  autorEmail: string | null;
  criadoEm: Date;
  dadosAntes: Prisma.JsonValue;
  dadosDepois: Prisma.JsonValue;
}): LinhaAuditoriaDocumento {
  return {
    id: r.id,
    acao: r.acao as AcaoAuditoriaDocumento,
    descricao: r.descricao,
    autorEmail: r.autorEmail,
    criadoEm: r.criadoEm,
    dadosAntes: (r.dadosAntes as Record<string, unknown> | null) ?? null,
    dadosDepois: (r.dadosDepois as Record<string, unknown> | null) ?? null,
  };
}

export async function listarHistoricoDocumentos(
  filtros: {
    clienteId?: string;
    acao?: AcaoAuditoriaDocumento;
    de?: Date;
    ate?: Date;
    pagina?: number;
    porPagina?: number;
  } = {},
): Promise<{ linhas: LinhaAuditoriaDocumento[]; total: number }> {
  const pagina = filtros.pagina ?? 1;
  const porPagina = filtros.porPagina ?? 30;
  const where: Prisma.RegistroAuditoriaWhereInput = {
    entidade: { in: ENTIDADES_SC01 },
    ...(filtros.clienteId ? { clienteId: filtros.clienteId } : {}),
    ...(filtros.acao ? { acao: filtros.acao } : {}),
    ...(filtros.de || filtros.ate
      ? {
          criadoEm: {
            ...(filtros.de ? { gte: filtros.de } : {}),
            ...(filtros.ate ? { lte: filtros.ate } : {}),
          },
        }
      : {}),
  };
  const [registros, total] = await Promise.all([
    prisma.registroAuditoria.findMany({
      where,
      orderBy: { criadoEm: "desc" },
      skip: (pagina - 1) * porPagina,
      take: porPagina,
    }),
    prisma.registroAuditoria.count({ where }),
  ]);
  return { linhas: registros.map(paraLinhaAuditoria), total };
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
