export type AliquotaPresuncao = "P8" | "P32";
export type StatusItemNota = "CONFIRMADO" | "PENDENTE_REVISAO";
export type OrigemDecisao = "REGRA" | "IA" | "MANUAL";

export const PERCENTUAL_ALIQUOTA: Record<AliquotaPresuncao, number> = {
  P8: 8,
  P32: 32,
};

// Mesmo corte que decide CONFIRMADO x PENDENTE_REVISAO no SC-01. Um número só.
export const LIMIAR_CONFIANCA = 0.85;

/** minúscula, sem diacrítico, espaços colapsados. */
export function normalizar(s: string): string {
  return s
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

export type TermoParaCasar = { termo: string; aliquota: AliquotaPresuncao };

export function casarTermo(
  descricao: string,
  termos: TermoParaCasar[],
): { aliquota: AliquotaPresuncao; termo: string } | null {
  const alvo = normalizar(descricao);
  const candidatos = termos
    .map((t) => ({ ...t, norm: normalizar(t.termo) }))
    .filter((t) => t.norm.length > 0 && alvo.includes(t.norm));

  if (candidatos.length === 0) return null;

  candidatos.sort((a, b) => {
    if (b.norm.length !== a.norm.length) return b.norm.length - a.norm.length;
    // empate de comprimento: P32 (conservador) na frente
    if (a.aliquota !== b.aliquota) return a.aliquota === "P32" ? -1 : 1;
    return 0;
  });

  return { aliquota: candidatos[0].aliquota, termo: candidatos[0].termo };
}

export function classificarStatusItem(confianca: number): StatusItemNota {
  return confianca < LIMIAR_CONFIANCA ? "PENDENTE_REVISAO" : "CONFIRMADO";
}

export type ItemParaConsolidar = { aliquota: AliquotaPresuncao; valor: number };
export type LinhaConsolidada = {
  aliquota: AliquotaPresuncao;
  qtdItens: number;
  somaValor: number;
  basePresuncao: number;
};
export type Consolidado = {
  porBalde: LinhaConsolidada[];
  totalValor: number;
  totalBase: number;
};

function arred2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

export function consolidar(itens: ItemParaConsolidar[]): Consolidado {
  const baldes: AliquotaPresuncao[] = ["P8", "P32"];
  const porBalde: LinhaConsolidada[] = baldes
    .map((aliquota) => {
      const doBalde = itens.filter((i) => i.aliquota === aliquota);
      const somaValor = arred2(doBalde.reduce((s, i) => s + i.valor, 0));
      return {
        aliquota,
        qtdItens: doBalde.length,
        somaValor,
        basePresuncao: arred2((somaValor * PERCENTUAL_ALIQUOTA[aliquota]) / 100),
      };
    })
    .filter((l) => l.qtdItens > 0);

  return {
    porBalde,
    totalValor: arred2(porBalde.reduce((s, l) => s + l.somaValor, 0)),
    totalBase: arred2(porBalde.reduce((s, l) => s + l.basePresuncao, 0)),
  };
}

export type ItemParaExportar = { status: StatusItemNota };

export function notaPodeExportar(itens: ItemParaExportar[]): boolean {
  return itens.length > 0 && itens.every((i) => i.status === "CONFIRMADO");
}

export function motivoBloqueioRelatorio(
  itens: ItemParaExportar[],
): string | null {
  if (itens.length === 0) return "Nenhum item classificado";
  const emRevisao = itens.filter((i) => i.status === "PENDENTE_REVISAO").length;
  if (emRevisao === 0) return null;
  return `${emRevisao} ${emRevisao === 1 ? "item ainda em conferência" : "itens ainda em conferência"}`;
}
