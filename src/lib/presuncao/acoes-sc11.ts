"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import type { Prisma } from "@/generated/prisma/client";
import { obterSessao } from "@/lib/sessao-servidor";
import { filtrarModulosVisiveis } from "@/lib/modulos-catalogo";
import { executarModulo } from "@/lib/execucao";
import { processarDocumento, processarNotas } from "./processar-sc11";
import { normalizar, type AliquotaPresuncao } from "./presuncao-termos";

const ROTA = "/modulos/sc-11";
const ROTA_TERMOS = "/modulos/sc-11/termos";
const TAMANHO_MAX = 5 * 1024 * 1024;

async function exigirAcessoSc11() {
  const sessao = await obterSessao();
  const podeVer =
    sessao !== null &&
    filtrarModulosVisiveis(sessao.papel, sessao.setor).some((m) => m.codigo === "SC-11");
  if (!sessao || !podeVer) throw new Error("Sem acesso ao módulo SC-11.");
  return sessao;
}

async function exigirAdminSc11() {
  const sessao = await exigirAcessoSc11();
  if (sessao.papel !== "ADMIN") throw new Error("Ação restrita ao administrador.");
  return sessao;
}

export type EstadoUpload = { erro: string } | null;

const esquemaUpload = z.object({ clienteId: z.string().min(1, "Selecione o cliente.") });

export async function enviarNota(
  _prev: EstadoUpload,
  formData: FormData,
): Promise<EstadoUpload> {
  await exigirAcessoSc11();

  const dados = esquemaUpload.safeParse({ clienteId: formData.get("clienteId") });
  if (!dados.success) return { erro: dados.error.issues[0]?.message ?? "Dados inválidos." };

  const arquivo = formData.get("arquivo");
  if (!(arquivo instanceof File) || arquivo.size === 0) {
    return { erro: "Anexe o XML da NFS-e." };
  }
  if (!arquivo.name.toLowerCase().endsWith(".xml")) {
    return { erro: "Formato não suportado. Envie o XML da NFS-e." };
  }
  if (arquivo.size > TAMANHO_MAX) return { erro: "Arquivo acima de 5 MB." };

  const cliente = await prisma.cliente.findUnique({ where: { id: dados.data.clienteId } });
  if (!cliente) return { erro: "Cliente não encontrado." };

  await prisma.documentoEntrada.create({
    data: {
      tipo: "NFSE",
      clienteId: dados.data.clienteId,
      nomeArquivo: arquivo.name,
      mimeType: arquivo.type || "application/xml",
      arquivo: Buffer.from(await arquivo.arrayBuffer()),
      chegadaEm: new Date(),
    },
  });

  revalidatePath(ROTA);
  redirect(ROTA);
}

export async function processarPendentes(): Promise<void> {
  const sessao = await exigirAcessoSc11();
  await executarModulo("SC-11", sessao.email, () => processarNotas());
  revalidatePath(ROTA);
}

export async function processarUma(formData: FormData): Promise<void> {
  const sessao = await exigirAcessoSc11();
  const documentoId = String(formData.get("documentoId") ?? "");
  if (!documentoId) return;
  await executarModulo("SC-11", sessao.email, async () => {
    await processarDocumento(documentoId);
    return { status: "SUCESSO", resumo: `Nota ${documentoId} processada sob demanda.` };
  });
  revalidatePath(ROTA);
  revalidatePath(`${ROTA}/nota/${documentoId}`);
}

export type EstadoRevisao = { erro: string } | null;

const esquemaRevisao = z.object({
  itemId: z.string().min(1),
  aliquota: z.enum(["P8", "P32"]),
});

export async function revisarItem(
  _prev: EstadoRevisao,
  formData: FormData,
): Promise<EstadoRevisao> {
  const sessao = await exigirAcessoSc11();
  const dados = esquemaRevisao.safeParse({
    itemId: formData.get("itemId"),
    aliquota: formData.get("aliquota"),
  });
  if (!dados.success) return { erro: "Dados inválidos." };

  const item = await prisma.itemNota.findUnique({
    where: { id: dados.data.itemId },
    include: { notaServico: true },
  });
  if (!item) return { erro: "Item não encontrado." };

  const mudou = item.aliquota !== dados.data.aliquota;
  await prisma.itemNota.update({
    where: { id: item.id },
    data: {
      aliquota: dados.data.aliquota,
      origem: "MANUAL",
      status: "CONFIRMADO",
      confianca: null,
      justificativa: mudou
        ? `Reclassificado de ${item.aliquota === "P8" ? "8%" : "32%"} para ${dados.data.aliquota === "P8" ? "8%" : "32%"} por ${sessao.email}.`
        : `Base ${dados.data.aliquota === "P8" ? "8%" : "32%"} confirmada por ${sessao.email}.`,
    },
  });
  revalidatePath(`${ROTA}/nota/${item.notaServico.documentoEntradaId}`);
  return null;
}

export async function excluirNota(formData: FormData): Promise<void> {
  await exigirAcessoSc11();
  const documentoId = String(formData.get("documentoId") ?? "");
  if (documentoId) {
    await prisma.documentoEntrada.deleteMany({ where: { id: documentoId } });
  }
  revalidatePath(ROTA);
  redirect(ROTA);
}

// ---- Termos (admin) ----

async function registrarAuditoria(
  tx: Prisma.TransactionClient,
  dados: {
    termoId: string | null;
    termoTexto: string;
    acao: "CRIACAO" | "RECLASSIFICACAO" | "REMOCAO";
    aliquotaAnterior?: AliquotaPresuncao | null;
    aliquotaNova?: AliquotaPresuncao | null;
    autorEmail: string;
  },
) {
  await tx.auditoriaTermo.create({
    data: {
      termoId: dados.termoId,
      termoTexto: dados.termoTexto,
      acao: dados.acao,
      aliquotaAnterior: dados.aliquotaAnterior ?? null,
      aliquotaNova: dados.aliquotaNova ?? null,
      autorEmail: dados.autorEmail,
    },
  });
}

export type EstadoTermo = { erro: string } | null;

const esquemaTermo = z.object({
  termo: z.string().trim().min(2, "Termo muito curto."),
  aliquota: z.enum(["P8", "P32"]),
});

export async function criarTermo(
  _prev: EstadoTermo,
  formData: FormData,
): Promise<EstadoTermo> {
  const sessao = await exigirAdminSc11();
  const dados = esquemaTermo.safeParse({
    termo: formData.get("termo"),
    aliquota: formData.get("aliquota"),
  });
  if (!dados.success) return { erro: dados.error.issues[0]?.message ?? "Dados inválidos." };

  const alvo = normalizar(dados.data.termo);
  const existentes = await prisma.termoPresuncao.findMany({ select: { termo: true } });
  if (existentes.some((t) => normalizar(t.termo) === alvo)) {
    return { erro: "Termo equivalente já cadastrado." };
  }

  await prisma.$transaction(async (tx) => {
    const criado = await tx.termoPresuncao.create({
      data: { termo: dados.data.termo, aliquota: dados.data.aliquota },
    });
    await registrarAuditoria(tx, {
      termoId: criado.id,
      termoTexto: criado.termo,
      acao: "CRIACAO",
      aliquotaNova: dados.data.aliquota,
      autorEmail: sessao.email,
    });
  });

  revalidatePath(ROTA_TERMOS);
  return null;
}

const esquemaReclassificar = z.object({
  id: z.string().min(1),
  aliquota: z.enum(["P8", "P32"]),
});

export async function editarTermo(formData: FormData): Promise<void> {
  const sessao = await exigirAdminSc11();
  const dados = esquemaReclassificar.safeParse({
    id: formData.get("id"),
    aliquota: formData.get("aliquota"),
  });
  if (!dados.success) return;

  const termo = await prisma.termoPresuncao.findUnique({ where: { id: dados.data.id } });
  if (!termo || termo.aliquota === dados.data.aliquota) {
    revalidatePath(ROTA_TERMOS);
    return; // no-op não gera auditoria
  }

  await prisma.$transaction(async (tx) => {
    await tx.termoPresuncao.update({
      where: { id: termo.id },
      data: { aliquota: dados.data.aliquota },
    });
    await registrarAuditoria(tx, {
      termoId: termo.id,
      termoTexto: termo.termo,
      acao: "RECLASSIFICACAO",
      aliquotaAnterior: termo.aliquota as AliquotaPresuncao,
      aliquotaNova: dados.data.aliquota,
      autorEmail: sessao.email,
    });
  });

  revalidatePath(ROTA_TERMOS);
}

export async function removerTermo(formData: FormData): Promise<void> {
  const sessao = await exigirAdminSc11();
  const id = String(formData.get("id") ?? "");
  if (!id) return;
  const termo = await prisma.termoPresuncao.findUnique({ where: { id } });
  if (!termo) return;

  await prisma.$transaction(async (tx) => {
    await tx.termoPresuncao.delete({ where: { id } });
    await registrarAuditoria(tx, {
      termoId: null,
      termoTexto: termo.termo,
      acao: "REMOCAO",
      aliquotaAnterior: termo.aliquota as AliquotaPresuncao,
      autorEmail: sessao.email,
    });
  });

  revalidatePath(ROTA_TERMOS);
}
