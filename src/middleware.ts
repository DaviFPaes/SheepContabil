import { NextRequest, NextResponse } from "next/server";
import { COOKIE_SESSAO, verificarTokenSessao } from "@/lib/sessao";
import { deveRedirecionarParaLogin } from "@/lib/middleware-logica";

export async function middleware(request: NextRequest) {
  const token = request.cookies.get(COOKIE_SESSAO)?.value;
  const sessao = token ? await verificarTokenSessao(token) : null;

  if (deveRedirecionarParaLogin(request.nextUrl.pathname, sessao !== null)) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
