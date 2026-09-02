import type { DocumentoResumo } from "./consultas-sc01";

export type FiltrosDocumento = {
  busca: string;
  status: "TODOS" | "PENDENTE" | "PROCESSADO" | "ERRO";
  banco: string; // "TODOS" ou um rótulo de bancosDisponiveis
  competencia: string; // "" ou "YYYY-MM"
};

export type OrdenacaoDocumento =
  | "cliente-asc"
  | "cliente-desc"
  | "chegada-asc"
  | "chegada-desc"
  | "status-asc"
  | "status-desc"
  | "linhas-asc"
  | "linhas-desc";

function normalizar(texto: string): string {
  return texto
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "");
}

const RANK_STATUS: Record<DocumentoResumo["status"], number> = {
  PENDENTE: 0,
  PROCESSADO: 1,
  ERRO: 2,
};

export function filtrarDocumentos(
  docs: DocumentoResumo[],
  { busca, status, banco, competencia }: FiltrosDocumento,
): DocumentoResumo[] {
  const q = normalizar(busca.trim());
  return docs.filter((d) => {
    if (status !== "TODOS" && d.status !== status) return false;
    if (banco !== "TODOS" && d.bancoRotulo !== banco) return false;
    if (competencia && d.competencia !== competencia) return false;
    if (
      q &&
      !normalizar(d.clienteRazaoSocial).includes(q) &&
      !normalizar(d.nomeArquivo).includes(q)
    ) {
      return false;
    }
    return true;
  });
}

const COMPARADORES: Record<
  OrdenacaoDocumento,
  (a: DocumentoResumo, b: DocumentoResumo) => number
> = {
  "cliente-asc": (a, b) => a.clienteRazaoSocial.localeCompare(b.clienteRazaoSocial, "pt-BR"),
  "cliente-desc": (a, b) => b.clienteRazaoSocial.localeCompare(a.clienteRazaoSocial, "pt-BR"),
  "chegada-asc": (a, b) => a.chegadaEm.getTime() - b.chegadaEm.getTime(),
  "chegada-desc": (a, b) => b.chegadaEm.getTime() - a.chegadaEm.getTime(),
  "status-asc": (a, b) => RANK_STATUS[a.status] - RANK_STATUS[b.status],
  "status-desc": (a, b) => RANK_STATUS[b.status] - RANK_STATUS[a.status],
  "linhas-asc": (a, b) => a.totalLancamentos - b.totalLancamentos,
  "linhas-desc": (a, b) => b.totalLancamentos - a.totalLancamentos,
};

export function ordenarDocumentos(
  docs: DocumentoResumo[],
  ordenacao: OrdenacaoDocumento,
): DocumentoResumo[] {
  return [...docs].sort(COMPARADORES[ordenacao]);
}

export function bancosDisponiveis(docs: DocumentoResumo[]): string[] {
  const set = new Set<string>();
  for (const d of docs) if (d.bancoRotulo) set.add(d.bancoRotulo);
  return [...set].sort((a, b) => a.localeCompare(b, "pt-BR"));
}
