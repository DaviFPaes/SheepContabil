"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import type { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { obterSessao } from "@/lib/sessao-servidor";
import { filtrarModulosVisiveis } from "@/lib/modulos-catalogo";
import { cnpjValido } from "@/lib/cnpj";
import { obterPermissoesUsuario } from "@/lib/permissoes/consultas";
import { calcularBucket, diasRestantes } from "./bucket";
import { obterPerfilCliente as lerPerfilCliente } from "./consultas";

const ROTA = "/modulos/sc-20";

async function exigirAcessoSc20() {
  const sessao = await obterSessao();
  if (!sessao) {
    throw new Error("Sem acesso ao módulo SC-20.");
  }

  const permissoes =
    sessao.papel === "OPERADOR" ? await obterPermissoesUsuario(sessao.usuarioId) : undefined;
  const podeVer = filtrarModulosVisiveis(sessao.papel, sessao.setor, undefined, permissoes).some(
    (modulo) => modulo.codigo === "SC-20",
  );

  if (!podeVer) {
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
  telefone: z
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
    telefone: formData.get("telefone") ?? undefined,
    ehRenovacao: formData.get("ehRenovacao") ?? undefined,
    certificadoAnteriorId: formData.get("certificadoAnteriorId") ?? undefined,
  });
}

// Atualiza o telefone do cliente quando o modal manda um valor diferente do
// que está gravado. Roda dentro da transação de criar/editar certificado.
async function talvezAtualizarTelefone(
  tx: Prisma.TransactionClient,
  cliente: { id: string; telefone: string | null },
  telefone: string | null,
) {
  if (telefone !== null && telefone !== cliente.telefone) {
    await tx.cliente.update({ where: { id: cliente.id }, data: { telefone } });
  }
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
    await talvezAtualizarTelefone(tx, cliente, dados.data.telefone);

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

  const anterior = await prisma.certificado.findUnique({
    where: { id },
    include: { cliente: { select: { id: true, telefone: true } } },
  });
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
    await talvezAtualizarTelefone(tx, anterior.cliente, dados.data.telefone);
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

// Renovação rápida a partir da coluna "Vencido" do Kanban: o operador
// informa uma nova validade e o card sai de Vencido para Renovado. Segue o
// mesmo desenho da renovação do ModalCertificado — cria um Certificado novo
// e encadeia o antigo por `substituidoPorId`.
export async function renovarCertificadoVencido(
  certificadoId: string,
  novaValidadeISO: string,
): Promise<EstadoForm> {
  const sessao = await exigirAcessoSc20();

  const id = z.string().min(1).safeParse(certificadoId);
  if (!id.success) return { erro: "Certificado não informado." };

  const iso = z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Informe uma data de validade válida.")
    .safeParse(novaValidadeISO);
  if (!iso.success) {
    return { erro: iso.error.issues[0]?.message ?? "Data inválida." };
  }

  const certificado = await prisma.certificado.findUnique({
    where: { id: id.data },
    include: { cliente: true },
  });
  if (!certificado) return { erro: "Certificado não encontrado." };

  const jaRenovado = certificado.substituidoPorId !== null;
  const bucketAtual = calcularBucket(diasRestantes(certificado.dataValidade), {
    renovado: jaRenovado,
  });
  if (bucketAtual !== "VENCIDO") {
    return { erro: "Este certificado não está vencido." };
  }

  const hoje = normalizarData(new Date());
  const novaValidade = normalizarData(new Date(`${iso.data}T00:00:00.000Z`));
  if (novaValidade <= hoje) {
    return {
      erro: "A nova data precisa ser futura — o certificado continua vencido.",
    };
  }

  const novoBucket = calcularBucket(diasRestantes(novaValidade), { renovado: false });

  await prisma.$transaction(async (tx) => {
    const novo = await tx.certificado.create({
      data: {
        clienteId: certificado.clienteId,
        tipo: certificado.tipo,
        titular: certificado.titular,
        emitidoEm: hoje,
        dataValidade: novaValidade,
        observacao: certificado.observacao,
        bucket: novoBucket,
      },
    });

    await tx.certificado.update({
      where: { id: certificado.id },
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
        entidadeId: novo.id,
        acao: "CRIADO",
        descricao: `Certificado ${certificado.tipo} de ${certificado.cliente.razaoSocial} criado na renovação de um certificado vencido`,
        autorId: sessao.usuarioId,
        autorEmail: sessao.email,
        clienteId: certificado.clienteId,
        dadosDepois: {
          tipo: certificado.tipo,
          titular: certificado.titular,
          dataValidade: novaValidade.toISOString(),
        },
      },
    });
    await tx.registroAuditoria.create({
      data: {
        entidade: "Certificado",
        entidadeId: certificado.id,
        acao: "RENOVACAO",
        descricao: `Certificado de ${certificado.cliente.razaoSocial} renovado a partir da coluna Vencido`,
        autorId: sessao.usuarioId,
        autorEmail: sessao.email,
        clienteId: certificado.clienteId,
        dadosAntes: { dataValidade: certificado.dataValidade.toISOString() },
        dadosDepois: {
          substituidoPorId: novo.id,
          dataValidade: novaValidade.toISOString(),
        },
      },
    });
    await tx.registroAuditoria.create({
      data: {
        entidade: "Certificado",
        entidadeId: certificado.id,
        acao: "DESATIVADO",
        descricao: `Certificado de ${certificado.cliente.razaoSocial} desativado pela renovação`,
        autorId: sessao.usuarioId,
        autorEmail: sessao.email,
        clienteId: certificado.clienteId,
      },
    });
  });

  revalidatePath(ROTA);
  return { ok: true };
}

// Coluna "Confirmar renovação — 3 dias": o operador dispara um aviso
// individual (WhatsApp) e o card passa de pendente (âmbar) para avisado
// (névoa). Sem integração real nesta etapa — só registra o contato.
export async function avisarClienteD3(certificadoId: string): Promise<EstadoForm> {
  const sessao = await exigirAcessoSc20();

  const id = z.string().min(1).safeParse(certificadoId);
  if (!id.success) return { erro: "Certificado não informado." };

  const certificado = await prisma.certificado.findUnique({
    where: { id: id.data },
    include: { cliente: true },
  });
  if (!certificado) return { erro: "Certificado não encontrado." };

  const jaRenovado = certificado.substituidoPorId !== null;
  const bucket = calcularBucket(diasRestantes(certificado.dataValidade), {
    renovado: jaRenovado,
  });
  if (bucket !== "D3") {
    return { erro: "Este certificado não está na faixa de 3 dias." };
  }

  if (certificado.avisoD3Em) return { ok: true };

  await prisma.$transaction(async (tx) => {
    await tx.certificado.update({
      where: { id: certificado.id },
      data: { avisoD3Em: new Date() },
    });
    await tx.registroAuditoria.create({
      data: {
        entidade: "Certificado",
        entidadeId: certificado.id,
        acao: "AVISO_ENVIADO",
        descricao: `Aviso de renovação enviado por WhatsApp para ${certificado.cliente.razaoSocial}`,
        autorId: sessao.usuarioId,
        autorEmail: sessao.email,
        clienteId: certificado.clienteId,
      },
    });
  });

  revalidatePath(ROTA);
  return { ok: true };
}

// Envio em lote das colunas 60d / 7d. Demonstrativo: não há disparo real de
// e-mail, mas o AvisoCertificado é gravado (status SENT) para o card virar
// névoa. `certificadoIds` vem da coluna correspondente; o bucket é
// reconferido no servidor.
export async function enviarAvisosLote(
  marco: "D60" | "D7",
  certificadoIds: string[],
): Promise<{ enviados: number } | { erro: string }> {
  const sessao = await exigirAcessoSc20();

  const dados = z
    .object({
      marco: z.enum(["D60", "D7"]),
      ids: z.array(z.string().min(1)).min(1),
    })
    .safeParse({ marco, ids: certificadoIds });
  if (!dados.success) return { erro: "Nada para enviar." };

  const alvo = dados.data.marco;
  const certificados = await prisma.certificado.findMany({
    where: { id: { in: dados.data.ids }, ativo: true },
    include: { cliente: true, avisos: true },
  });

  let enviados = 0;
  for (const certificado of certificados) {
    const bucket = calcularBucket(diasRestantes(certificado.dataValidade), {
      renovado: certificado.substituidoPorId !== null,
    });
    if (bucket !== alvo) continue;

    const aviso = certificado.avisos.find((a) => a.marco === alvo);
    if (aviso && (aviso.status === "SENT" || aviso.status === "DELIVERED")) continue;

    await prisma.$transaction(async (tx) => {
      await tx.avisoCertificado.upsert({
        where: {
          certificadoId_marco: { certificadoId: certificado.id, marco: alvo },
        },
        create: {
          certificadoId: certificado.id,
          clienteId: certificado.clienteId,
          marco: alvo,
          destinatarioEmail: certificado.cliente.email,
          status: "SENT",
          enviadoEm: new Date(),
          providerMessageId: `demo-${certificado.id.slice(0, 8)}`,
        },
        update: {
          status: "SENT",
          enviadoEm: new Date(),
          destinatarioEmail: certificado.cliente.email,
          providerMessageId: `demo-${certificado.id.slice(0, 8)}`,
        },
      });
      await tx.registroAuditoria.create({
        data: {
          entidade: "AvisoCertificado",
          entidadeId: certificado.id,
          acao: "AVISO_ENVIADO",
          descricao: `Aviso ${alvo} enviado para ${certificado.cliente.email}`,
          autorId: sessao.usuarioId,
          autorEmail: sessao.email,
          clienteId: certificado.clienteId,
        },
      });
    });
    enviados += 1;
  }

  revalidatePath(ROTA);
  return { enviados };
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

const esquemaCliente = z.object({
  id: z.string().min(1, "Cliente não informado."),
  razaoSocial: z.string().trim().min(1, "Informe a razão social."),
  cnpj: z
    .string()
    .trim()
    .min(1, "Informe o CNPJ.")
    .refine((v) => cnpjValido(v), "Informe um CNPJ válido."),
  atividade: z.string().trim().min(1, "Informe a atividade."),
  email: z.string().trim().min(1, "Informe o e-mail.").email("Informe um e-mail válido."),
  telefone: z
    .string()
    .optional()
    .transform((v) => (v && v.trim().length > 0 ? v.trim() : null)),
  ativo: z.string().optional(),
});

// Acionada pelo link na razão social do "Perfil do cliente" — cobre o caso
// de clientes cadastrados sem telefone/e-mail correto, sem precisar de uma
// tela separada de cadastro.
export async function editarCliente(
  _estadoAnterior: EstadoForm,
  formData: FormData,
): Promise<EstadoForm> {
  const sessao = await exigirAcessoSc20();

  const dados = esquemaCliente.safeParse({
    id: formData.get("id"),
    razaoSocial: formData.get("razaoSocial"),
    cnpj: formData.get("cnpj"),
    atividade: formData.get("atividade"),
    email: formData.get("email"),
    telefone: formData.get("telefone") ?? undefined,
    ativo: formData.get("ativo") ?? undefined,
  });
  if (!dados.success) {
    return { erro: dados.error.issues[0]?.message ?? "Dados inválidos." };
  }

  const cliente = await prisma.cliente.findUnique({ where: { id: dados.data.id } });
  if (!cliente) {
    return { erro: "Cliente não encontrado." };
  }

  const cnpjDuplicado = await prisma.cliente.findFirst({
    where: { cnpj: dados.data.cnpj, NOT: { id: cliente.id } },
    select: { id: true },
  });
  if (cnpjDuplicado) {
    return { erro: "Já existe um cliente cadastrado com este CNPJ." };
  }

  const ativo = dados.data.ativo === "on";
  const dadosAntes = {
    razaoSocial: cliente.razaoSocial,
    cnpj: cliente.cnpj,
    atividade: cliente.atividade,
    email: cliente.email,
    telefone: cliente.telefone,
    ativo: cliente.ativo,
  };
  const dadosDepois = {
    razaoSocial: dados.data.razaoSocial,
    cnpj: dados.data.cnpj,
    atividade: dados.data.atividade,
    email: dados.data.email,
    telefone: dados.data.telefone,
    ativo,
  };

  await prisma.$transaction(async (tx) => {
    await tx.cliente.update({ where: { id: cliente.id }, data: dadosDepois });
    await tx.registroAuditoria.create({
      data: {
        entidade: "Cliente",
        entidadeId: cliente.id,
        acao: "EDITADO",
        descricao: `Cadastro de ${dados.data.razaoSocial} editado`,
        autorId: sessao.usuarioId,
        autorEmail: sessao.email,
        clienteId: cliente.id,
        dadosAntes,
        dadosDepois,
      },
    });
  });

  revalidatePath(ROTA);
  return { ok: true };
}
