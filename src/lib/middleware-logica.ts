const CAMINHOS_PUBLICOS = ["/login"];
// Só /api/cron/* fica isento de sessão de usuário — essas rotas se
// autenticam sozinhas por CRON_SECRET (ver módulos futuros: SC-20, SC-18,
// SC-01, SC-11). Qualquer outra rota /api/ deve exigir sessão como
// qualquer página, a menos que implemente sua própria autenticação
// explícita dentro da rota.
const PREFIXOS_PUBLICOS = ["/api/cron/"];

export function ehCaminhoPublico(pathname: string): boolean {
  if (CAMINHOS_PUBLICOS.some((caminho) => pathname === caminho)) {
    return true;
  }
  return PREFIXOS_PUBLICOS.some((prefixo) => pathname.startsWith(prefixo));
}

export function deveRedirecionarParaLogin(
  pathname: string,
  sessaoValida: boolean,
): boolean {
  if (ehCaminhoPublico(pathname)) {
    return false;
  }
  return !sessaoValida;
}
