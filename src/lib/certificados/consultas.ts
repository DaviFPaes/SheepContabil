import { prisma } from "@/lib/prisma";
import type { Prisma, TipoCertificado, TipoNotificacao } from "@/generated/prisma/client";
import { calcularBucket, diasRestantes, type Bucket } from "./bucket";
import type { AcaoAuditoria, LinhaAuditoria } from "./historico";

// Reexports para quem já importa daqui (página, testes). A lógica pura mora
// em módulos sem Prisma para poder ser usada também no cliente.
export { estadoContato } from "./contato";
export type { EstadoContato } from "./contato";
export { montarColunasKanban, contarNaoAvisados } from "./kanban";
export type { ColunasKanban, OrdemKanban } from "./kanban";

export type StatusAvisoView = {
  status: "QUEUED" | "SENT" | "DELIVERED" | "BOUNCED" | "FAILED";
  enviadoEm: Date | null;
};

export type CertificadoLinha = {
  id: string;
  clienteId: string;
  razaoSocial: string;
  clienteEmail: string;
  clienteTelefone: string | null;
  titular: string;
  tipo: TipoCertificado;
  dataValidade: Date;
  emitidoEm: Date;
  diasRestantes: number;
  bucket: Bucket;
  ativo: boolean;
  renovadoEm: Date | null;
  avisoD3Em: Date | null;
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

// "Renovado" é um estado temporário: dura 15 dias a partir de `renovadoEm`;
// depois o certificado antigo volta a aparecer como "Em dia".
const DIAS_RENOVADO = 15;

export async function listarCertificados(hoje: Date = new Date()): Promise<CertificadoLinha[]> {
  const certificados = await prisma.certificado.findMany({
    include: { cliente: true, avisos: true },
    orderBy: { dataValidade: "asc" },
  });

  return certificados.map((certificado) => {
    const dias = diasRestantes(certificado.dataValidade, hoje);
    const renovado =
      certificado.substituidoPorId !== null &&
      certificado.renovadoEm !== null &&
      diasRestantes(hoje, certificado.renovadoEm) <= DIAS_RENOVADO;

    return {
      id: certificado.id,
      clienteId: certificado.clienteId,
      razaoSocial: certificado.cliente.razaoSocial,
      clienteEmail: certificado.cliente.email,
      clienteTelefone: certificado.cliente.telefone,
      titular: certificado.titular,
      tipo: certificado.tipo,
      dataValidade: certificado.dataValidade,
      emitidoEm: certificado.emitidoEm,
      diasRestantes: dias,
      bucket: calcularBucket(dias, { renovado }),
      ativo: certificado.ativo,
      renovadoEm: certificado.renovadoEm,
      avisoD3Em: certificado.avisoD3Em,
      avisoD60: avisoView(certificado.avisos, "D60"),
      avisoD7: avisoView(certificado.avisos, "D7"),
    };
  });
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
  cliente: {
    id: string;
    razaoSocial: string;
    cnpj: string;
    email: string;
    telefone: string | null;
    ativo: boolean;
  };
  certificados: CertificadoLinha[];
  historico: LinhaAuditoria[];
} | null> {
  const cliente = await prisma.cliente.findUnique({ where: { id: clienteId } });
  if (!cliente) return null;

  const [certificados, historico] = await Promise.all([
    listarCertificados().then((lista) => lista.filter((c) => c.clienteId === clienteId)),
    prisma.registroAuditoria.findMany({
      where: { clienteId, entidade: { in: ["Certificado", "AvisoCertificado"] } },
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
      telefone: cliente.telefone,
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
    entidade: { in: ["Certificado", "AvisoCertificado"] },
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

export type NotificacaoLida = {
  id: string;
  tipo: TipoNotificacao;
  certificadoId: string;
  clienteId: string;
  razaoSocial: string;
  titular: string;
  lidaEm: Date | null;
  criadoEm: Date;
};

export async function listarNotificacoes(usuarioId: string): Promise<NotificacaoLida[]> {
  const linhas = await prisma.notificacaoInApp.findMany({
    where: { usuarioId, lidaEm: null },
    orderBy: { criadoEm: "desc" },
    include: {
      cliente: { select: { razaoSocial: true } },
      certificado: { select: { titular: true } },
    },
  });
  return linhas.map((n) => ({
    id: n.id,
    tipo: n.tipo,
    certificadoId: n.certificadoId,
    clienteId: n.clienteId,
    razaoSocial: n.cliente.razaoSocial,
    titular: n.certificado.titular,
    lidaEm: n.lidaEm,
    criadoEm: n.criadoEm,
  }));
}

export async function listarClientesParaSelecao(): Promise<
  { id: string; razaoSocial: string; email: string; telefone: string | null }[]
> {
  return prisma.cliente.findMany({
    orderBy: { razaoSocial: "asc" },
    select: { id: true, razaoSocial: true, email: true, telefone: true },
  });
}
