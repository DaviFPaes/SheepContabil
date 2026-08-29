import { prisma } from "@/lib/prisma";
import {
  calcularFaixa,
  diasRestantes,
  type FaixaUrgencia,
} from "./faixa-urgencia";

export type CertificadoComStatus = {
  id: string;
  clienteId: string;
  razaoSocial: string;
  dataValidade: Date;
  diasRestantes: number;
  faixa: FaixaUrgencia;
};

export async function listarCertificadosComStatus(
  hoje: Date = new Date(),
): Promise<CertificadoComStatus[]> {
  const certificados = await prisma.certificado.findMany({
    include: { cliente: true },
    orderBy: { dataValidade: "asc" },
  });

  return certificados.map((certificado) => {
    const dias = diasRestantes(certificado.dataValidade, hoje);
    return {
      id: certificado.id,
      clienteId: certificado.clienteId,
      razaoSocial: certificado.cliente.razaoSocial,
      dataValidade: certificado.dataValidade,
      diasRestantes: dias,
      faixa: calcularFaixa(dias),
    };
  });
}

export type AvisoComCliente = {
  id: string;
  razaoSocial: string;
  faixa: FaixaUrgencia;
  diasRestantes: number;
  mensagem: string;
  criadoEm: Date;
};

export async function listarAvisos(
  limite = 50,
): Promise<AvisoComCliente[]> {
  const avisos = await prisma.avisoCertificado.findMany({
    include: { certificado: { include: { cliente: true } } },
    orderBy: { criadoEm: "desc" },
    take: limite,
  });

  return avisos.map((aviso) => ({
    id: aviso.id,
    razaoSocial: aviso.certificado.cliente.razaoSocial,
    faixa: aviso.faixa as FaixaUrgencia,
    diasRestantes: aviso.diasRestantes,
    mensagem: aviso.mensagem,
    criadoEm: aviso.criadoEm,
  }));
}

export async function listarClientesParaSelecao(): Promise<
  { id: string; razaoSocial: string }[]
> {
  return prisma.cliente.findMany({
    orderBy: { razaoSocial: "asc" },
    select: { id: true, razaoSocial: true },
  });
}
