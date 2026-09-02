"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { obterSessao } from "@/lib/sessao-servidor";

const ROTA = "/admin/usuarios";

async function exigirAdmin() {
  const sessao = await obterSessao();
  if (!sessao || sessao.papel !== "ADMIN") {
    throw new Error("Sem acesso à gestão de usuários.");
  }
  return sessao;
}

type Resultado = { ok: true } | { erro: string };

const esquemaModulo = z.object({
  usuarioId: z.string().min(1),
  moduloCodigo: z.string().min(1),
  habilitado: z.boolean(),
});

export async function alternarPermissaoModulo(
  usuarioId: string,
  moduloCodigo: string,
  habilitado: boolean,
): Promise<Resultado> {
  const sessao = await exigirAdmin();

  const dados = esquemaModulo.safeParse({ usuarioId, moduloCodigo, habilitado });
  if (!dados.success) return { erro: "Dados inválidos." };

  const usuario = await prisma.usuario.findUnique({ where: { id: dados.data.usuarioId } });
  if (!usuario || usuario.papel !== "OPERADOR") {
    return { erro: "Usuário não encontrado." };
  }

  const anterior = await prisma.permissaoModulo.findUnique({
    where: {
      usuarioId_moduloCodigo: {
        usuarioId: dados.data.usuarioId,
        moduloCodigo: dados.data.moduloCodigo,
      },
    },
  });

  await prisma.$transaction(async (tx) => {
    await tx.permissaoModulo.upsert({
      where: {
        usuarioId_moduloCodigo: {
          usuarioId: dados.data.usuarioId,
          moduloCodigo: dados.data.moduloCodigo,
        },
      },
      update: { habilitado: dados.data.habilitado },
      create: {
        usuarioId: dados.data.usuarioId,
        moduloCodigo: dados.data.moduloCodigo,
        habilitado: dados.data.habilitado,
      },
    });

    await tx.registroAuditoria.create({
      data: {
        entidade: "Usuario",
        entidadeId: dados.data.usuarioId,
        acao: "PERMISSAO_MODULO",
        descricao: `Módulo ${dados.data.moduloCodigo} ${
          dados.data.habilitado ? "ligado" : "desligado"
        } para ${usuario.nome}`,
        autorId: sessao.usuarioId,
        autorEmail: sessao.email,
        dadosAntes: { habilitado: anterior?.habilitado ?? false },
        dadosDepois: { habilitado: dados.data.habilitado },
      },
    });
  });

  revalidatePath(ROTA);
  return { ok: true };
}

const esquemaSubArea = z.object({
  usuarioId: z.string().min(1),
  moduloCodigo: z.string().min(1),
  subArea: z.string().min(1),
  habilitado: z.boolean(),
});

export async function alternarPermissaoSubArea(
  usuarioId: string,
  moduloCodigo: string,
  subArea: string,
  habilitado: boolean,
): Promise<Resultado> {
  const sessao = await exigirAdmin();

  const dados = esquemaSubArea.safeParse({ usuarioId, moduloCodigo, subArea, habilitado });
  if (!dados.success) return { erro: "Dados inválidos." };

  const usuario = await prisma.usuario.findUnique({ where: { id: dados.data.usuarioId } });
  if (!usuario || usuario.papel !== "OPERADOR") {
    return { erro: "Usuário não encontrado." };
  }

  const anterior = await prisma.permissaoSubArea.findUnique({
    where: {
      usuarioId_moduloCodigo_subArea: {
        usuarioId: dados.data.usuarioId,
        moduloCodigo: dados.data.moduloCodigo,
        subArea: dados.data.subArea,
      },
    },
  });

  await prisma.$transaction(async (tx) => {
    await tx.permissaoSubArea.upsert({
      where: {
        usuarioId_moduloCodigo_subArea: {
          usuarioId: dados.data.usuarioId,
          moduloCodigo: dados.data.moduloCodigo,
          subArea: dados.data.subArea,
        },
      },
      update: { habilitado: dados.data.habilitado },
      create: {
        usuarioId: dados.data.usuarioId,
        moduloCodigo: dados.data.moduloCodigo,
        subArea: dados.data.subArea,
        habilitado: dados.data.habilitado,
      },
    });

    await tx.registroAuditoria.create({
      data: {
        entidade: "Usuario",
        entidadeId: dados.data.usuarioId,
        acao: "PERMISSAO_SUBAREA",
        descricao: `Sub-área ${dados.data.moduloCodigo}:${dados.data.subArea} ${
          dados.data.habilitado ? "ligada" : "desligada"
        } para ${usuario.nome}`,
        autorId: sessao.usuarioId,
        autorEmail: sessao.email,
        dadosAntes: { habilitado: anterior?.habilitado ?? true },
        dadosDepois: { habilitado: dados.data.habilitado },
      },
    });
  });

  revalidatePath(ROTA);
  return { ok: true };
}
