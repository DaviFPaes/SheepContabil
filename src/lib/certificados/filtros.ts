import type { Bucket } from "./bucket";
import type { CertificadoLinha } from "./consultas";

export type FiltroTipo = "TODOS" | CertificadoLinha["tipo"];
export type FiltroFaixa = "TODAS" | Bucket;

export type Filtros = {
  busca: string;
  tipo: FiltroTipo;
  faixa: FiltroFaixa;
};

export type Ordenacao =
  | "validade-asc"
  | "validade-desc"
  | "cliente-asc"
  | "cliente-desc"
  | "dias-asc"
  | "dias-desc"
  | "tipo-asc"
  | "tipo-desc";

function normalizar(texto: string): string {
  return texto
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "");
}

export function filtrarCertificados(
  linhas: CertificadoLinha[],
  { busca, tipo, faixa }: Filtros,
): CertificadoLinha[] {
  const q = normalizar(busca.trim());
  return linhas.filter((l) => {
    if (tipo !== "TODOS" && l.tipo !== tipo) return false;
    if (faixa !== "TODAS" && l.bucket !== faixa) return false;
    if (q && !normalizar(l.razaoSocial).includes(q) && !normalizar(l.titular).includes(q)) {
      return false;
    }
    return true;
  });
}

const COMPARADORES: Record<
  Ordenacao,
  (a: CertificadoLinha, b: CertificadoLinha) => number
> = {
  "validade-asc": (a, b) => a.dataValidade.getTime() - b.dataValidade.getTime(),
  "validade-desc": (a, b) => b.dataValidade.getTime() - a.dataValidade.getTime(),
  "cliente-asc": (a, b) => a.razaoSocial.localeCompare(b.razaoSocial, "pt-BR"),
  "cliente-desc": (a, b) => b.razaoSocial.localeCompare(a.razaoSocial, "pt-BR"),
  "dias-asc": (a, b) => a.diasRestantes - b.diasRestantes,
  "dias-desc": (a, b) => b.diasRestantes - a.diasRestantes,
  "tipo-asc": (a, b) => a.tipo.localeCompare(b.tipo),
  "tipo-desc": (a, b) => b.tipo.localeCompare(a.tipo),
};

export function ordenarCertificados(
  linhas: CertificadoLinha[],
  ordenacao: Ordenacao,
): CertificadoLinha[] {
  return [...linhas].sort(COMPARADORES[ordenacao]);
}
