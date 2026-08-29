export type FaixaUrgencia =
  | "VENCIDO"
  | "CRITICO"
  | "ALERTA"
  | "PROXIMO"
  | "OK";

const DIA_MS = 24 * 60 * 60 * 1000;

function inicioDoDiaUTC(data: Date): number {
  return Date.UTC(
    data.getUTCFullYear(),
    data.getUTCMonth(),
    data.getUTCDate(),
  );
}

export function diasRestantes(
  dataValidade: Date,
  hoje: Date = new Date(),
): number {
  return Math.round(
    (inicioDoDiaUTC(dataValidade) - inicioDoDiaUTC(hoje)) / DIA_MS,
  );
}

export function calcularFaixa(diasRestantes: number): FaixaUrgencia {
  if (diasRestantes < 0) return "VENCIDO";
  if (diasRestantes <= 7) return "CRITICO";
  if (diasRestantes <= 30) return "ALERTA";
  if (diasRestantes <= 60) return "PROXIMO";
  return "OK";
}

export function deveGerarAviso(
  faixaAtual: FaixaUrgencia,
  faixaUltimoAviso: FaixaUrgencia | null,
): boolean {
  if (faixaAtual === "OK") return false;
  return faixaAtual !== faixaUltimoAviso;
}

export const ROTULO_FAIXA: Record<FaixaUrgencia, string> = {
  VENCIDO: "VENCIDO",
  CRITICO: "CRÍTICO",
  ALERTA: "ALERTA",
  PROXIMO: "PRÓXIMO",
  OK: "OK",
};

export const ORDEM_FAIXAS: FaixaUrgencia[] = [
  "VENCIDO",
  "CRITICO",
  "ALERTA",
  "PROXIMO",
  "OK",
];

export function mensagemAviso(
  razaoSocial: string,
  diasRestantes: number,
  faixa: FaixaUrgencia,
): string {
  const rotulo = ROTULO_FAIXA[faixa];

  if (diasRestantes < 0) {
    const dias = Math.abs(diasRestantes);
    const plural = dias === 1 ? "dia" : "dias";
    return `O certificado digital de ${razaoSocial} venceu há ${dias} ${plural} (faixa ${rotulo}). Renovação e revalidação de acessos necessárias.`;
  }

  if (diasRestantes === 0) {
    return `O certificado digital de ${razaoSocial} vence hoje (faixa ${rotulo}). Renovação urgente.`;
  }

  const plural = diasRestantes === 1 ? "dia" : "dias";
  return `O certificado digital de ${razaoSocial} vence em ${diasRestantes} ${plural} (faixa ${rotulo}).`;
}
