export const LIMIAR_CONFIANCA = 0.85;

export type StatusConferencia = "CONFIRMADO" | "PENDENTE_REVISAO";

export function classificarLancamento(confianca: number): StatusConferencia {
  return confianca < LIMIAR_CONFIANCA ? "PENDENTE_REVISAO" : "CONFIRMADO";
}

export function documentoPodeBaixarOfx(
  lancamentos: { status: StatusConferencia }[],
): boolean {
  if (lancamentos.length === 0) return false;
  return lancamentos.every((l) => l.status === "CONFIRMADO");
}

export function motivoBloqueioOfx(
  lancamentos: { status: StatusConferencia }[],
): string | null {
  if (lancamentos.length === 0) return "Nenhum lançamento extraído";
  const emRevisao = lancamentos.filter(
    (l) => l.status === "PENDENTE_REVISAO",
  ).length;
  if (emRevisao === 0) return null;
  return `${emRevisao} ${emRevisao === 1 ? "linha ainda em conferência" : "linhas ainda em conferência"}`;
}
