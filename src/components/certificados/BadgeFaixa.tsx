import {
  ROTULO_FAIXA,
  type FaixaUrgencia,
} from "@/lib/certificados/faixa-urgencia";

// Cada faixa recebe fundo suave + texto no tom + anel interno para dar
// contorno ao selo sem peso visual. So tokens da paleta SheepContabil.
const CLASSE_POR_FAIXA: Record<FaixaUrgencia, string> = {
  VENCIDO: "bg-carmim/15 text-carmim ring-carmim/30",
  CRITICO: "bg-carmim/10 text-carmim ring-carmim/25",
  ALERTA: "bg-ambar/15 text-ambar ring-ambar/35",
  PROXIMO: "bg-turquesa/10 text-turquesa ring-turquesa/25",
  OK: "bg-grafite/10 text-grafite ring-grafite/25",
};

export function BadgeFaixa({ faixa }: { faixa: FaixaUrgencia }) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 font-texto text-xs font-medium leading-none ring-1 ring-inset ${CLASSE_POR_FAIXA[faixa]}`}
    >
      <span
        aria-hidden="true"
        className="h-1.5 w-1.5 shrink-0 rounded-full bg-current"
      />
      {ROTULO_FAIXA[faixa]}
    </span>
  );
}
