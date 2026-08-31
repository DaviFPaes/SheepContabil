"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import type { Prisma } from "@/generated/prisma/client";
import { obterSessao } from "@/lib/sessao-servidor";
import { filtrarModulosVisiveis } from "@/lib/modulos-catalogo";
import { executarModulo } from "@/lib/execucao";
import { processarDocumento, processarExtratos } from "./processar-sc01";

const ROTA = "/modulos/sc-01";
const MIMES_OK = ["application/pdf", "image/jpeg", "image/png"];
const TAMANHO_MAX = 15 * 1024 * 1024;

export async function exigirAcessoSc01() {
  const sessao = await obterSessao();
  const podeVer =
    sessao !== null &&
    filtrarModulosVisiveis(sessao.papel, sessao.setor).some(
      (m) => m.codigo === "SC-01",
    );
  if (!sessao || !podeVer) {
    throw new Error("Sem acesso ao módulo SC-01.");
  }
  return sessao;
}

export type EstadoUpload = { erro: string } | null;

const esquemaUpload = z.object({
  clienteId: z.string().min(1, "Selecione o cliente."),
  contaBancariaId: z.string().min(1, "Selecione a conta bancária."),
});

export async function enviarDocumento(
  _prev: EstadoUpload,
  formData: FormData,
): Promise<EstadoUpload> {
  await exigirAcessoSc01();

  const dados = esquemaUpload.safeParse({
    clienteId: formData.get("clienteId"),
    contaBancariaId: formData.get("contaBancariaId"),
  });
  if (!dados.success) {
    return { erro: dados.error.issues[0]?.message ?? "Dados inválidos." };
  }

  const arquivo = formData.get("arquivo");
  if (!(arquivo instanceof File) || arquivo.size === 0) {
    return { erro: "Anexe o arquivo do extrato (PDF, JPG ou PNG)." };
  }
  if (!MIMES_OK.includes(arquivo.type)) {
    return { erro: "Formato não suportado. Use PDF, JPG ou PNG." };
  }
  if (arquivo.size > TAMANHO_MAX) {
    return { erro: "Arquivo acima de 15 MB." };
  }

  const conta = await prisma.contaBancaria.findFirst({
    where: { id: dados.data.contaBancariaId, clienteId: dados.data.clienteId },
  });
  if (!conta) {
    return { erro: "Conta bancária não encontrada para esse cliente." };
  }

  const bytes = Buffer.from(await arquivo.arrayBuffer());

  await prisma.documentoEntrada.create({
    data: {
      tipo: "EXTRATO",
      clienteId: dados.data.clienteId,
      contaBancariaId: dados.data.contaBancariaId,
      nomeArquivo: arquivo.name,
      mimeType: arquivo.type,
      arquivo: bytes,
      chegadaEm: new Date(),
    },
  });

  revalidatePath(ROTA);
  redirect(ROTA);
}

export async function processarPendentes(): Promise<void> {
  const sessao = await exigirAcessoSc01();
  await executarModulo("SC-01", sessao.email, () => processarExtratos());
  revalidatePath(ROTA);
}

export async function processarUm(formData: FormData): Promise<void> {
  const sessao = await exigirAcessoSc01();
  const documentoId = String(formData.get("documentoId") ?? "");
  if (!documentoId) return;
  await executarModulo("SC-01", sessao.email, async () => {
    await processarDocumento(documentoId);
    return {
      status: "SUCESSO",
      resumo: `Documento ${documentoId} reprocessado sob demanda.`,
    };
  });
  revalidatePath(ROTA);
  revalidatePath(`${ROTA}/documento/${documentoId}`);
}

const esquemaConferencia = z.object({
  lancamentoId: z.string().min(1),
  data: z.string().optional(),
  historico: z.string().optional(),
  valor: z.string().optional(),
});

export async function confirmarLancamento(
  _prev: { erro: string } | null,
  formData: FormData,
): Promise<{ erro: string } | null> {
  await exigirAcessoSc01();
  const dados = esquemaConferencia.safeParse({
    lancamentoId: formData.get("lancamentoId"),
    data: formData.get("data") ?? undefined,
    historico: formData.get("historico") ?? undefined,
    valor: formData.get("valor") ?? undefined,
  });
  if (!dados.success) return { erro: "Dados inválidos." };

  const lancamento = await prisma.lancamento.findUnique({
    where: { id: dados.data.lancamentoId },
  });
  if (!lancamento) return { erro: "Lançamento não encontrado." };

  const patch: Prisma.LancamentoUpdateInput = {
    status: "CONFIRMADO",
    confianca: 1,
  };
  if (dados.data.data) patch.data = new Date(`${dados.data.data}T00:00:00Z`);
  if (dados.data.historico) patch.historico = dados.data.historico;
  if (dados.data.valor !== undefined && dados.data.valor !== "") {
    const n = Number(dados.data.valor.replace(",", "."));
    if (Number.isNaN(n)) return { erro: "Valor inválido." };
    patch.valor = n;
  }

  await prisma.lancamento.update({
    where: { id: dados.data.lancamentoId },
    data: patch,
  });
  revalidatePath(`${ROTA}/documento/${lancamento.documentoEntradaId}`);
  return null;
}

export async function excluirDocumento(formData: FormData): Promise<void> {
  await exigirAcessoSc01();
  const documentoId = String(formData.get("documentoId") ?? "");
  if (documentoId) {
    await prisma.documentoEntrada.deleteMany({ where: { id: documentoId } });
  }
  revalidatePath(ROTA);
  redirect(ROTA);
}
