const CAMINHOS_PUBLICOS = ["/login"];
const PREFIXOS_PUBLICOS = ["/api/"];

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
