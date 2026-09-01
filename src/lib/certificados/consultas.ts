import { prisma } from "@/lib/prisma";
import type { Prisma, TipoCertificado, TipoNotificacao } from "@/generated/prisma/client";
import { calcularBucket, diasRestantes, type Bucket } from "./bucket";
import type { AcaoAuditoria, LinhaAuditoria } from "./historico";

const JANELA_RENOVADO_DIAS = 7;

export type StatusAvisoView = {
  status: "QUEUED" | "SENT" | "DELIVERED" | "BOUNCED" | "FAILED";
  enviadoEm: Date | null;
};

export type CertificadoLinha = {
  id: string;
  clienteId: string;
  razaoSocial: string;
  clienteEmail: string;
  titular: string;
  tipo: TipoCertificado;
  dataValidade: Date;
  emitidoEm: Date;
  diasRestantes: number;
  bucket: Bucket;
  ativo: boolean;
  renovadoEm: Date | null;
  avisoD60: StatusAvisoView | null;
  avisoD7: StatusAvisoView | null;
};

function avisoView(
  avisos: { marco: string; status: string; enviadoEm: Date | null }[],
  marco: "D60" | "D7",
): StatusAvisoView | null {
  const aviso = avisos.find((a) => a.marco === marco);
  if (!aviso) return null;
  return { status: aviso.status as StatusAvisoView["status"], enviadoEm: aviso.enviadoEm };
}

export async function listarCertificados(hoje: Date = new Date()): Promise<CertificadoLinha[]> {
  const certificados = await prisma.certificado.findMany({
    include: { cliente: true, avisos: true },
    orderBy: { dataValidade: "asc" },
  });

  return certificados.map((certificado) => {
    const dias = diasRestantes(certificado.dataValidade, hoje);
    const renovado = certificado.substituidoPorId !== null;

    return {
      id: certificado.id,
      clienteId: certificado.clienteId,
      razaoSocial: certificado.cliente.razaoSocial,
      clienteEmail: certificado.cliente.email,
      titular: certificado.titular,
      tipo: certificado.tipo,
      dataValidade: certificado.dataValidade,
      emitidoEm: certificado.emitidoEm,
      diasRestantes: dias,
      bucket: calcularBucket(dias, { renovado }),
      ativo: certificado.ativo,
      renovadoEm: certificado.renovadoEm,
      avisoD60: avisoView(certificado.avisos, "D60"),
      avisoD7: avisoView(certificado.avisos, "D7"),
    };
  });
}

export type ColunasKanban = {
  aAvisar60: CertificadoLinha[];
  avisado60: CertificadoLinha[];
  aAvisar7: CertificadoLinha[];
  avisado7: CertificadoLinha[];
  confirmar3: CertificadoLinha[];
  vencido: CertificadoLinha[];
  renovado: CertificadoLinha[];
};

function avisado(status: StatusAvisoView | null): boolean {
  return status !== null && (status.status === "SENT" || status.status === "DELIVERED");
}

// Puro: recebe as linhas ja lidas e so decide em qual coluna cada uma cai.
// Posicao e sempre derivada dos dados — nunca ha estado de coluna gravado.
export function montarColunasKanban(
  linhas: CertificadoLinha[],
  hoje: Date = new Date(),
): ColunasKanban {
  const colunas: ColunasKanban = {
    aAvisar60: [],
    avisado60: [],
    aAvisar7: [],
    avisado7: [],
    confirmar3: [],
    vencido: [],
    renovado: [],
  };

  for (const linha of linhas) {
    switch (linha.bucket) {
      case "D60":
        (avisado(linha.avisoD60) ? colunas.avisado60 : colunas.aAvisar60).push(linha);
        break;
      case "D7":
        (avisado(linha.avisoD7) ? colunas.avisado7 : colunas.aAvisar7).push(linha);
        break;
      case "D3":
        colunas.confirmar3.push(linha);
        break;
      case "VENCIDO":
        colunas.vencido.push(linha);
        break;
      case "RENOVADO": {
        if (!linha.renovadoEm) break;
        // diasRestantes(hoje, renovadoEm): dias desde a renovacao ate hoje
        // (positivo quando renovadoEm ja passou, que e sempre o caso aqui).
        const diasDesdeRenovacao = diasRestantes(hoje, linha.renovadoEm);
        if (diasDesdeRenovacao <= JANELA_RENOVADO_DIAS) colunas.renovado.push(linha);
        break;
      }
      case "OK":
        break;
    }
  }

  return colunas;
}

export function contarNaoAvisados(colunas: ColunasKanban): { d60: number; d7: number } {
  return { d60: colunas.aAvisar60.length, d7: colunas.aAvisar7.length };
}

function paraLinhaAuditoria(registro: {
  id: string;
  acao: string;
  descricao: string;
  autorEmail: string | null;
  criadoEm: Date;
  dadosAntes: Prisma.JsonValue;
  dadosDepois: Prisma.JsonValue;
}): LinhaAuditoria {
  return {
    id: registro.id,
    acao: registro.acao as AcaoAuditoria,
    descricao: registro.descricao,
    autorEmail: registro.autorEmail,
    criadoEm: registro.criadoEm,
    dadosAntes: (registro.dadosAntes as Record<string, unknown> | null) ?? null,
    dadosDepois: (registro.dadosDepois as Record<string, unknown> | null) ?? null,
  };
}

const LIMITE_HISTORICO_PERFIL = 20;

export async function obterPerfilCliente(clienteId: string): Promise<{
  cliente: { id: string; razaoSocial: string; cnpj: string; email: string; ativo: boolean };
  certificados: CertificadoLinha[];
  historico: LinhaAuditoria[];
} | null> {
  const cliente = await prisma.cliente.findUnique({ where: { id: clienteId } });
  if (!cliente) return null;

  const [certificados, historico] = await Promise.all([
    listarCertificados().then((lista) => lista.filter((c) => c.clienteId === clienteId)),
    prisma.registroAuditoria.findMany({
      where: { clienteId },
      orderBy: { criadoEm: "desc" },
      take: LIMITE_HISTORICO_PERFIL,
    }),
  ]);

  return {
    cliente: {
      id: cliente.id,
      razaoSocial: cliente.razaoSocial,
      cnpj: cliente.cnpj,
      email: cliente.email,
      ativo: cliente.ativo,
    },
    certificados,
    historico: historico.map(paraLinhaAuditoria),
  };
}

export type FiltrosHistorico = {
  clienteId?: string;
  acao?: AcaoAuditoria;
  de?: Date;
  ate?: Date;
  pagina?: number;
  porPagina?: number;
};

export async function listarHistorico(
  filtros: FiltrosHistorico = {},
): Promise<{ linhas: LinhaAuditoria[]; total: number }> {
  const pagina = filtros.pagina ?? 1;
  const porPagina = filtros.porPagina ?? 30;

  const where: Prisma.RegistroAuditoriaWhereInput = {
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

export async function listarNotificacoes(usuarioId: string): Promise<
  {
    id: string;
    tipo: TipoNotificacao;
    certificadoId: string;
    clienteId: string;
    lidaEm: Date | null;
    criadoEm: Date;
  }[]
> {
  return prisma.notificacaoInApp.findMany({
    where: { usuarioId, lidaEm: null },
    orderBy: { criadoEm: "desc" },
  });
}

export async function listarClientesParaSelecao(): Promise<
  { id: string; razaoSocial: string; email: string }[]
> {
  return prisma.cliente.findMany({
    orderBy: { razaoSocial: "asc" },
    select: { id: true, razaoSocial: true, email: true },
  });
}
