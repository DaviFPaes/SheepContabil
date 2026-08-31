// Datas dos lancamentos sao gravadas ancoradas em meia-noite UTC
// (`new Date(`${linha.data}T00:00:00Z`)` em processar-sc01). Formatar SEMPRE
// em UTC evita o deslocamento de um dia no fuso de Sao Paulo (UTC-3).

/** Data legivel em pt-BR (dd/mm/aaaa), ancorada em UTC. */
export function formatarDataUTC(data: Date): string {
  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeZone: "UTC",
  }).format(data);
}

/** Tamanho de arquivo compacto: B ate 1 KiB, KB ate 1 MiB, senao MB. */
export function formatarBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(0)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}

/** Valor monetario em Real (R$ 1.234,56). */
export function formatarValor(v: number): string {
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}
