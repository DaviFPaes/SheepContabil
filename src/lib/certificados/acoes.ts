"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { obterSessao } from "@/lib/sessao-servidor";
import { filtrarModulosVisiveis } from "@/lib/modulos-catalogo";
import { executarModulo } from "@/lib/execucao";
import { processarAvisosCertificados } from "./processar";

const ROTA = "/modulos/sc-20";

async function exigirAcessoSc20() {
  const sessao = await obterSessao();
  const podeVer =
    sessao !== null &&
    filtrarModulosVisiveis(sessao.papel, sessao.setor).some(
      (modulo) => modulo.codigo === "SC-20",
    );

  if (!sessao || !podeVer) {
    throw new Error("Sem acesso ao módulo SC-20.");
  }
  return sessao;
}

const esquemaCertificado = z.object({
  clienteId: z.string().min(1, "Selecione o cliente."),
  // `formData.get` devolve `null` quando o campo nao veio; sem o `z.string()`
  // na frente, `z.coerce.date` transformaria isso em `new Date(null)` (epoch)
  // e passaria. Exigir a string primeiro rejeita a data ausente.
  dataValidade: z
    .string()
    .min(1, "Informe a data de validade.")
    .pipe(z.coerce.date({ error: "Informe uma data de validade válida." })),
});

export type EstadoFormCertificado = { erro: string } | null;

function normalizarValidade(data: Date): Date {
  const normalizada = new Date(data);
  normalizada.setUTCHours(0, 0, 0, 0);
  return normalizada;
}

export async function criarCertificado(
  _estadoAnterior: EstadoFormCertificado,
  formData: FormData,
): Promise<EstadoFormCertificado> {
  await exigirAcessoSc20();

  const dados = esquemaCertificado.safeParse({
    clienteId: formData.get("clienteId"),
    dataValidade: formData.get("dataValidade"),
  });
  if (!dados.success) {
    return { erro: dados.error.issues[0]?.message ?? "Dados inválidos." };
  }

  const cliente = await prisma.cliente.findUnique({
    where: { id: dados.data.clienteId },
  });
  if (!cliente) {
    return { erro: "Cliente não encontrado." };
  }

  // STUB temporario (Task 1 do plano): tipo/titular/emitidoEm agora sao
  // obrigatorios em Certificado. O formulario real (com esses campos e o
  // fluxo de renovacao) entra na Task 7 — ModalCertificado, Task 13.
  await prisma.certificado.create({
    data: {
      clienteId: dados.data.clienteId,
      dataValidade: normalizarValidade(dados.data.dataValidade),
      tipo: "ECNPJ",
      titular: cliente.razaoSocial,
      emitidoEm: new Date(
        normalizarValidade(dados.data.dataValidade).getTime() -
          365 * 24 * 60 * 60 * 1000,
      ),
    },
  });

  revalidatePath(ROTA);
  redirect(ROTA);
}

export async function editarCertificado(
  _estadoAnterior: EstadoFormCertificado,
  formData: FormData,
): Promise<EstadoFormCertificado> {
  await exigirAcessoSc20();

  const id = String(formData.get("id") ?? "");
  if (!id) {
    return { erro: "Certificado não informado." };
  }

  const dados = esquemaCertificado.safeParse({
    clienteId: formData.get("clienteId"),
    dataValidade: formData.get("dataValidade"),
  });
  if (!dados.success) {
    return { erro: dados.error.issues[0]?.message ?? "Dados inválidos." };
  }

  const certificado = await prisma.certificado.findUnique({ where: { id } });
  if (!certificado) {
    return { erro: "Certificado não encontrado." };
  }

  const cliente = await prisma.cliente.findUnique({
    where: { id: dados.data.clienteId },
  });
  if (!cliente) {
    return { erro: "Cliente não encontrado." };
  }

  await prisma.certificado.update({
    where: { id },
    data: {
      clienteId: dados.data.clienteId,
      dataValidade: normalizarValidade(dados.data.dataValidade),
    },
  });

  revalidatePath(ROTA);
  redirect(ROTA);
}

export async function removerCertificado(formData: FormData): Promise<void> {
  await exigirAcessoSc20();

  const id = String(formData.get("id") ?? "");
  if (id) {
    await prisma.certificado.deleteMany({ where: { id } });
  }
  revalidatePath(ROTA);
}

export async function rodarAgora(): Promise<void> {
  const sessao = await exigirAcessoSc20();
  await executarModulo("SC-20", sessao.email, processarAvisosCertificados);
  revalidatePath(ROTA);
}
