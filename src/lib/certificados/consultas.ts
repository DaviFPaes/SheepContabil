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

// STUB temporario (Task 1 do plano de implementacao): AvisoCertificado
// deixou de guardar faixa/diasRestantes/mensagem (virou "marco de e-mail"
// na migracao sc20_kanban_avisos). listarHistorico, na Task 6, substitui
// esta funcao como fonte da lista de eventos da UI.
export async function listarAvisos(
  limite = 50,
): Promise<AvisoComCliente[]> {
  void limite;
  return [];
}

export async function listarClientesParaSelecao(): Promise<
  { id: string; razaoSocial: string }[]
> {
  return prisma.cliente.findMany({
    orderBy: { razaoSocial: "asc" },
    select: { id: true, razaoSocial: true },
  });
}
