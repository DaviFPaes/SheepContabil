"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { COOKIE_SESSAO } from "@/lib/sessao";

export async function sair(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.delete(COOKIE_SESSAO);
  redirect("/login");
}
