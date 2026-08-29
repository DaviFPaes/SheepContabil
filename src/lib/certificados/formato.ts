// Datas de certificado sao normalizadas para meia-noite UTC ao gravar
// (ver `normalizarValidade` em ./acoes). Formatar SEMPRE em UTC evita o
// deslocamento de um dia que apareceria no fuso de Sao Paulo (UTC-3).

/** Data legivel em pt-BR (dd/mm/aaaa), ancorada em UTC. */
export function formatarDataUTC(data: Date): string {
  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeZone: "UTC",
  }).format(data);
}

/** Valor `aaaa-mm-dd` para <input type="date">, ancorado em UTC. */
export function dataParaInput(data: Date): string {
  return data.toISOString().slice(0, 10);
}
