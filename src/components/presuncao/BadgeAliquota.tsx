import type { AliquotaPresuncao } from "@/lib/presuncao/presuncao-termos";
import { ROTULO_ALIQUOTA } from "@/lib/presuncao/formato-presuncao";

// 8% = base reduzida (turquesa); 32% = regra geral (grafite).
const CLASSE: Record<AliquotaPresuncao, string> = {
  P8: "bg-turquesa/10 text-turquesa ring-turquesa/25",
  P32: "bg-grafite/10 text-grafite ring-grafite/25",
};

export function BadgeAliquota({ aliquota }: { aliquota: AliquotaPresuncao }) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 font-codigo text-xs font-medium tabular-nums leading-none ring-1 ring-inset ${CLASSE[aliquota]}`}
    >
      {ROTULO_ALIQUOTA[aliquota]}
    </span>
  );
}
