export function formatarDataHora(data: Date): string {
  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeStyle: "medium",
    timeZone: "America/Sao_Paulo",
  }).format(data);
}

export function formatarDuracao(inicio: Date, fim: Date | null): string {
  if (!fim) return "em andamento";

  const segundosTotais = Math.max(
    0,
    Math.round((fim.getTime() - inicio.getTime()) / 1000),
  );
  const minutos = Math.floor(segundosTotais / 60);
  const segundos = segundosTotais % 60;

  if (minutos === 0) return `${segundos}s`;
  return `${minutos}min ${segundos}s`;
}
