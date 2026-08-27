"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { senhaConfere } from "@/lib/senha";
import { COOKIE_SESSAO, criarTokenSessao } from "@/lib/sessao";

const esquemaLogin = z.object({
  email: z.string().email("E-mail inválido"),
  senha: z.string().min(1, "Informe a senha"),
});

export type EstadoLogin = { erro: string } | null;

export async function entrar(
  _estadoAnterior: EstadoLogin,
  formData: FormData,
): Promise<EstadoLogin> {
  const dados = esquemaLogin.safeParse({
    email: formData.get("email"),
    senha: formData.get("senha"),
  });

  if (!dados.success) {
    return { erro: "Preencha e-mail e senha válidos." };
  }

  const usuario = await prisma.usuario.findUnique({
    where: { email: dados.data.email },
  });

  if (!usuario) {
    return { erro: "E-mail ou senha incorretos." };
  }

  const senhaOk = await senhaConfere(dados.data.senha, usuario.senhaHash);

  if (!senhaOk) {
    return { erro: "E-mail ou senha incorretos." };
  }

  const token = await criarTokenSessao({
    usuarioId: usuario.id,
    email: usuario.email,
    nome: usuario.nome,
    papel: usuario.papel,
    setor: usuario.setor,
  });

  const cookieStore = await cookies();
  cookieStore.set(COOKIE_SESSAO, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 8,
  });

  redirect("/");
}
