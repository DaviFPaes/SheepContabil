"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { obterSessao } from "@/lib/sessao-servidor";
import { filtrarModulosVisiveis } from "@/lib/modulos-catalogo";
import { executarModulo } from "@/lib/execucao";
import { recalcularBucketsCertificados } from "./processar";
import { calcularBucket, diasRestantes } from "./bucket";
import { obterPerfilCliente as lerPerfilCliente } from "./consultas";

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

export type EstadoForm = { erro: string } | { ok: true } | null;

function normalizarData(data: Date): Date {
  const d = new Date(data);
  d.setUTCHours(0, 0, 0, 0);
  return d;
}

// `formData.get` devolve `null` quando o campo nao veio; sem `z.string()` na
// frente, `z.coerce.date` transformaria isso em epoch e passaria.
const dataObrigatoria = (rotulo: string) =>
  z
    .string()
    .min(1, `Informe ${rotulo}.`)
    .pipe(z.coerce.date({ error: `Informe ${rotulo} válida.` }));

const esquemaCertificado = z.object({
  clienteId: z.string().min(1, "Selecione o cliente."),
  tipo: z.enum(["ECNPJ", "ECPF", "NFE"], { error: "Selecione o tipo do certificado." }),
  titular: z.string().min(1, "Informe o titular."),
  emitidoEm: dataObrigatoria("a data de emissão"),
  dataValidade: dataObrigatoria("a data de validade"),
  observacao: z
    .string()
    .optional()
    .transform((v) => (v && v.trim().length > 0 ? v.trim() : null)),
  ehRenovacao: z.string().optional(),
  certificadoAnteriorId: z.string().optional(),
});

function lerFormCertificado(formData: FormData) {
  return esquemaCertificado.safeParse({
    clienteId: formData.get("clienteId"),
    tipo: formData.get("tipo"),
    titular: formData.get("titular"),
    emitidoEm: formData.get("emitidoEm"),
    dataValidade: formData.get("dataValidade"),
    observacao: formData.get("observacao") ?? undefined,
    ehRenovacao: formData.get("ehRenovacao") ?? undefined,
    certificadoAnteriorId: formData.get("certificadoAnteriorId") ?? undefined,
  });
}

export async function criarCertificado(
  _estadoAnterior: EstadoForm,
  formData: FormData,
): Promise<EstadoForm> {
  const sessao = await exigirAcessoSc20();

  const dados = lerFormCertificado(formData);
  if (!dados.success) {
    return { erro: dados.error.issues[0]?.message ?? "Dados inválidos." };
  }

  const emissao = normalizarData(dados.data.emitidoEm);
  const validade = normalizarData(dados.data.dataValidade);
  if (validade <= emissao) {
    return { erro: "A data de validade deve ser posterior à data de emissão." };
  }

  const cliente = await prisma.cliente.findUnique({ where: { id: dados.data.clienteId } });
  if (!cliente) {
    return { erro: "Cliente não encontrado." };
  }

  const ehRenovacao =
    dados.data.ehRenovacao === "on" && Boolean(dados.data.certificadoAnteriorId);
  const bucket = calcularBucket(diasRestantes(validade), { renovado: false });

  await prisma.$transaction(async (tx) => {
    const novo = await tx.certificado.create({
      data: {
        clienteId: dados.data.clienteId,
        tipo: dados.data.tipo,
        titular: dados.data.titular,
        emitidoEm: emissao,
        dataValidade: validade,
        observacao: dados.data.observacao,
        bucket,
      },
    });

    await tx.registroAuditoria.create({
      data: {
        entidade: "Certificado",
        entidadeId: novo.id,
        acao: "CRIADO",
        descricao: `Certificado ${dados.data.tipo} de ${cliente.razaoSocial} criado`,
        autorId: sessao.usuarioId,
        autorEmail: sessao.email,
        clienteId: cliente.id,
        dadosDepois: {
          tipo: dados.data.tipo,
          titular: dados.data.titular,
          dataValidade: validade.toISOString(),
        },
      },
    });

    if (ehRenovacao) {
      const anterior = await tx.certificado.findUnique({
        where: { id: dados.data.certificadoAnteriorId },
      });
      if (anterior && anterior.clienteId === cliente.id) {
        await tx.certificado.update({
          where: { id: anterior.id },
          data: {
            substituidoPorId: novo.id,
            renovadoEm: new Date(),
            ativo: false,
            bucket: "RENOVADO",
          },
        });
        await tx.registroAuditoria.create({
          data: {
            entidade: "Certificado",
            entidadeId: anterior.id,
            acao: "RENOVACAO",
            descricao: `Certificado de ${cliente.razaoSocial} renovado — substituído pelo novo registro`,
            autorId: sessao.usuarioId,
            autorEmail: sessao.email,
            clienteId: cliente.id,
            dadosDepois: { substituidoPorId: novo.id },
          },
        });
        await tx.registroAuditoria.create({
          data: {
            entidade: "Certificado",
            entidadeId: anterior.id,
            acao: "DESATIVADO",
            descricao: `Certificado de ${cliente.razaoSocial} desativado pela renovação`,
            autorId: sessao.usuarioId,
            autorEmail: sessao.email,
            clienteId: cliente.id,
          },
        });
      }
    }
  });

  revalidatePath(ROTA);
  return { ok: true };
}

export async function editarCertificado(
  _estadoAnterior: EstadoForm,
  formData: FormData,
): Promise<EstadoForm> {
  const sessao = await exigirAcessoSc20();

  const id = String(formData.get("id") ?? "");
  if (!id) {
    return { erro: "Certificado não informado." };
  }

  const dados = lerFormCertificado(formData);
  if (!dados.success) {
    return { erro: dados.error.issues[0]?.message ?? "Dados inválidos." };
  }

  const emissao = normalizarData(dados.data.emitidoEm);
  const validade = normalizarData(dados.data.dataValidade);
  if (validade <= emissao) {
    return { erro: "A data de validade deve ser posterior à data de emissão." };
  }

  const anterior = await prisma.certificado.findUnique({ where: { id } });
  if (!anterior) {
    return { erro: "Certificado não encontrado." };
  }

  const bucket = calcularBucket(diasRestantes(validade), {
    renovado: anterior.substituidoPorId !== null,
  });

  const dadosAntes = {
    tipo: anterior.tipo,
    titular: anterior.titular,
    emitidoEm: anterior.emitidoEm.toISOString(),
    dataValidade: anterior.dataValidade.toISOString(),
  };
  const dadosDepois = {
    tipo: dados.data.tipo,
    titular: dados.data.titular,
    emitidoEm: emissao.toISOString(),
    dataValidade: validade.toISOString(),
  };

  await prisma.$transaction(async (tx) => {
    await tx.certificado.update({
      where: { id },
      data: {
        clienteId: dados.data.clienteId,
        tipo: dados.data.tipo,
        titular: dados.data.titular,
        emitidoEm: emissao,
        dataValidade: validade,
        observacao: dados.data.observacao,
        bucket,
      },
    });
    await tx.registroAuditoria.create({
      data: {
        entidade: "Certificado",
        entidadeId: id,
        acao: "EDITADO",
        descricao: `Certificado editado`,
        autorId: sessao.usuarioId,
        autorEmail: sessao.email,
        clienteId: dados.data.clienteId,
        dadosAntes,
        dadosDepois,
      },
    });
  });

  revalidatePath(ROTA);
  return { ok: true };
}

export async function desativarCertificado(formData: FormData): Promise<void> {
  const sessao = await exigirAcessoSc20();

  const id = String(formData.get("id") ?? "");
  if (!id) return;

  const certificado = await prisma.certificado.findUnique({ where: { id } });
  if (!certificado) return;

  await prisma.$transaction(async (tx) => {
    await tx.certificado.update({ where: { id }, data: { ativo: false } });
    await tx.registroAuditoria.create({
      data: {
        entidade: "Certificado",
        entidadeId: id,
        acao: "DESATIVADO",
        descricao: `Certificado desativado manualmente`,
        autorId: sessao.usuarioId,
        autorEmail: sessao.email,
        clienteId: certificado.clienteId,
      },
    });
  });

  revalidatePath(ROTA);
}

// Ponte ate a Task 12 trocar o BotaoRemover para desativarCertificado.
export async function removerCertificado(formData: FormData): Promise<void> {
  return desativarCertificado(formData);
}

const esquemaMarcarLido = z.object({
  tipo: z.enum(["D60_ENTROU", "D7_ENTROU", "D3_ENTROU"]),
  diaISO: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Dia inválido."),
});

export async function marcarGrupoLido(
  tipo: "D60_ENTROU" | "D7_ENTROU" | "D3_ENTROU",
  diaISO: string,
): Promise<void> {
  const sessao = await exigirAcessoSc20();

  const dados = esquemaMarcarLido.safeParse({ tipo, diaISO });
  if (!dados.success) return;

  const inicio = new Date(`${dados.data.diaISO}T00:00:00.000Z`);
  const fim = new Date(inicio.getTime() + 24 * 60 * 60 * 1000);

  await prisma.notificacaoInApp.updateMany({
    where: {
      usuarioId: sessao.usuarioId,
      tipo: dados.data.tipo,
      lidaEm: null,
      criadoEm: { gte: inicio, lt: fim },
    },
    data: { lidaEm: new Date() },
  });

  revalidatePath(ROTA);
}

export async function obterPerfilCliente(clienteId: string) {
  await exigirAcessoSc20();
  const id = z.string().min(1).safeParse(clienteId);
  if (!id.success) return null;
  return lerPerfilCliente(id.data);
}

export async function atualizarAgora(): Promise<void> {
  const sessao = await exigirAcessoSc20();
  await executarModulo("SC-20", sessao.email, () =>
    recalcularBucketsCertificados(new Date(), {
      autorId: sessao.usuarioId,
      autorEmail: sessao.email,
    }),
  );
  revalidatePath(ROTA);
}

// Ponte ate a Task 18 renomear o botao/import na pagina.
export async function rodarAgora(): Promise<void> {
  return atualizarAgora();
}
