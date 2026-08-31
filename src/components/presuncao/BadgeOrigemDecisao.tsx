import type { OrigemDecisao } from "@/lib/presuncao/presuncao-termos";
import { ROTULO_ORIGEM } from "@/lib/presuncao/formato-presuncao";

// Mesmo idioma do BadgeStatusDocumento (SC-01): fundo suave + texto no tom +
// anel interno, so tokens da paleta. REGRA = casou termo cadastrado (turquesa);
// IA = classificado pelo modelo (petroleo); MANUAL = operador confirmou (ambar).
const CLASSE: Record<OrigemDecisao, string> = {
  REGRA: "bg-turquesa/10 text-turquesa ring-turquesa/25",
  IA: "bg-petroleo/10 text-petroleo ring-petroleo/25",
  MANUAL: "bg-ambar/15 text-ambar ring-ambar/35",
};

export function BadgeOrigemDecisao({ origem }: { origem: OrigemDecisao }) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 font-texto text-xs font-medium leading-none ring-1 ring-inset ${CLASSE[origem]}`}
    >
      <span
        aria-hidden="true"
        className="h-1.5 w-1.5 shrink-0 rounded-full bg-current"
      />
      {ROTULO_ORIGEM[origem]}
    </span>
  );
}
