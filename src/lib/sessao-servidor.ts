import { cookies } from "next/headers";
import { COOKIE_SESSAO, verificarTokenSessao, type PayloadSessao } from "@/lib/sessao";

export async function obterSessao(): Promise<PayloadSessao | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(COOKIE_SESSAO)?.value;
  if (!token) return null;
  return verificarTokenSessao(token);
}
