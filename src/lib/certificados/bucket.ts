export type Bucket = "OK" | "D60" | "D7" | "D3" | "VENCIDO" | "RENOVADO";

export type TipoNotificacaoBucket = "D60_ENTROU" | "D7_ENTROU" | "D3_ENTROU";

const DIA_MS = 24 * 60 * 60 * 1000;

function inicioDoDiaUTC(data: Date): number {
  return Date.UTC(data.getUTCFullYear(), data.getUTCMonth(), data.getUTCDate());
}

export function diasRestantes(validoAte: Date, hoje: Date = new Date()): number {
  return Math.round((inicioDoDiaUTC(validoAte) - inicioDoDiaUTC(hoje)) / DIA_MS);
}

export function calcularBucket(
  dias: number,
  opcoes: { renovado: boolean },
): Bucket {
  if (opcoes.renovado) return "RENOVADO";
  if (dias < 0) return "VENCIDO";
  if (dias <= 3) return "D3";
  if (dias <= 7) return "D7";
  if (dias <= 60) return "D60";
  return "OK";
}

// Do mais urgente ao menos urgente. RENOVADO nao entra no ranking de
// urgencia — e um estado terminal, nunca comparado por nivel.
export const ORDEM_BUCKETS: Bucket[] = ["VENCIDO", "D3", "D7", "D60", "OK", "RENOVADO"];

export const ROTULO_BUCKET: Record<Bucket, string> = {
  OK: "Em dia",
  D60: "60 dias",
  D7: "7 dias",
  D3: "3 dias",
  VENCIDO: "Vencido",
  RENOVADO: "Renovado",
};

// Nivel de urgencia crescente. VENCIDO e RENOVADO nunca disparam
// notificacao — nao aparecem aqui como alvo, so como possivel origem.
const NIVEL_URGENCIA: Partial<Record<Bucket, number>> = {
  OK: 0,
  D60: 1,
  D7: 2,
  D3: 3,
};

export function transicaoGeraNotificacao(
  de: Bucket | null,
  para: Bucket,
): TipoNotificacaoBucket | null {
  const nivelPara = NIVEL_URGENCIA[para];
  if (nivelPara === undefined) return null; // para VENCIDO ou RENOVADO: nunca notifica

  const nivelDe = de === null ? -1 : (NIVEL_URGENCIA[de] ?? -1);
  if (nivelPara <= nivelDe) return null;

  return `${para}_ENTROU` as TipoNotificacaoBucket;
}

export function textoDias(dias: number): string {
  if (dias < 0) return `vencido há ${Math.abs(dias)}d`;
  if (dias === 0) return "vence hoje";
  return `faltam ${dias}d`;
}
