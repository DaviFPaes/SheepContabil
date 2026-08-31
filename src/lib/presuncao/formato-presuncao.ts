import type {
  AliquotaPresuncao,
  OrigemDecisao,
} from "./presuncao-termos";

export const ROTULO_ALIQUOTA: Record<AliquotaPresuncao, string> = {
  P8: "8%",
  P32: "32%",
};

export const ROTULO_ORIGEM: Record<OrigemDecisao, string> = {
  REGRA: "Regra",
  IA: "IA",
  MANUAL: "Manual",
};

/** R$ 1.234,56 */
export function formatarValorBRL(n: number): string {
  return n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

/** dd/mm/aaaa ancorado em UTC (datas gravadas em meia-noite UTC). */
export function formatarDataUTC(d: Date): string {
  return new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeZone: "UTC" }).format(d);
}
