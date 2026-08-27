import { SignJWT, jwtVerify } from "jose";
import type { PapelUsuario } from "@/generated/prisma/client";

export const COOKIE_SESSAO = "sheep_sessao";

export type PayloadSessao = {
  usuarioId: string;
  email: string;
  nome: string;
  papel: PapelUsuario;
  setor: string | null;
};

function obterChaveSecreta(): Uint8Array {
  const segredo = process.env.SESSION_SECRET;
  if (!segredo) {
    throw new Error("SESSION_SECRET não configurado.");
  }
  return new TextEncoder().encode(segredo);
}

export async function criarTokenSessao(
  payload: PayloadSessao,
): Promise<string> {
  return new SignJWT({ ...payload })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("8h")
    .sign(obterChaveSecreta());
}

export async function verificarTokenSessao(
  token: string,
): Promise<PayloadSessao | null> {
  try {
    const { payload } = await jwtVerify(token, obterChaveSecreta());
    return {
      usuarioId: String(payload.usuarioId),
      email: String(payload.email),
      nome: String(payload.nome),
      papel: payload.papel as PapelUsuario,
      setor: (payload.setor as string | null) ?? null,
    };
  } catch {
    return null;
  }
}
