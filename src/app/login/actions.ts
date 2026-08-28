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

// Hash fictício (nao corresponde a nenhuma senha real) usado só para igualar
// o tempo de resposta entre "e-mail não existe" e "senha errada" — sem isso,
// a ausência da chamada ao bcrypt para e-mail desconhecido vira um oráculo
// de tempo que revela qual dos dois casos ocorreu.
const HASH_FICTICIO_PARA_TIMING =
  "$2a$10$CwTycUXWue0Thq9StjUM0uJ8G9jUZ8bA3TB9pQFPl4vFFHKQxtTQm";

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

  const senhaOk = await senhaConfere(
    dados.data.senha,
    usuario?.senhaHash ?? HASH_FICTICIO_PARA_TIMING,
  );

  if (!usuario || !senhaOk) {
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
