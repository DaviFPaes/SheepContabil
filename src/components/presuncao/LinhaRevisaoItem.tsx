"use client";

import { useActionState } from "react";
import { revisarItem, type EstadoRevisao } from "@/lib/presuncao/acoes-sc11";
import type { ItemDetalhe } from "@/lib/presuncao/consultas-sc11";
import { ROTULO_ALIQUOTA } from "@/lib/presuncao/formato-presuncao";

// Confianca da IA como percentual inteiro, no mesmo formato do SC-01
// (Math.round(confianca * 100) + "%"). Null quando a linha ja passou por
// revisao manual.
function percentual(confianca: number | null): string | null {
  return confianca === null ? null : `${Math.round(confianca * 100)}%`;
}

const BOTAO =
  "inline-flex flex-1 items-center justify-center gap-2 rounded px-4 py-2 font-codigo text-sm font-semibold tabular-nums transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 disabled:cursor-not-allowed disabled:opacity-60 motion-reduce:transition-none";
const BOTAO_SUGERIDO =
  "bg-petroleo text-nevoa hover:bg-turquesa focus-visible:outline-petroleo";
const BOTAO_ALTERNATIVO =
  "border border-grafite/40 bg-white text-tinta hover:bg-nevoa focus-visible:outline-grafite";

export function LinhaRevisaoItem({ item }: { item: ItemDetalhe }) {
  const [estado, acaoFormulario, pendente] = useActionState<
    EstadoRevisao,
    FormData
  >(revisarItem, null);
  const pct = percentual(item.confianca);

  return (
    <form
      action={acaoFormulario}
      className="overflow-hidden rounded-lg border border-l-2 border-grafite/20 border-l-ambar bg-white shadow-sm"
    >
      <input type="hidden" name="itemId" value={item.id} />

      <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1.5 border-b border-grafite/15 bg-nevoa/60 px-4 py-2.5">
        <span className="font-texto text-xs font-semibold uppercase tracking-wide text-grafite">
          Item em conferência
        </span>
        <span className="inline-flex items-center gap-2 font-texto text-xs text-grafite">
          Base sugerida pela IA:
          <span className="font-codigo font-semibold tabular-nums text-tinta">
            {ROTULO_ALIQUOTA[item.aliquota]}
          </span>
          {pct ? (
            <span className="font-codigo tabular-nums">
              ({pct} de confiança)
            </span>
          ) : null}
        </span>
      </div>

      <div className="flex flex-col gap-3 p-4">
        <p className="font-texto text-sm font-medium text-tinta">
          {item.descricao}
        </p>
        <p className="font-texto text-xs leading-relaxed text-grafite">
          {item.justificativa}
        </p>

        <div className="mt-1 flex flex-wrap gap-3">
          <button
            type="submit"
            name="aliquota"
            value="P8"
            disabled={pendente}
            className={`${BOTAO} ${
              item.aliquota === "P8" ? BOTAO_SUGERIDO : BOTAO_ALTERNATIVO
            }`}
          >
            Confirmar 8%
          </button>
          <button
            type="submit"
            name="aliquota"
            value="P32"
            disabled={pendente}
            className={`${BOTAO} ${
              item.aliquota === "P32" ? BOTAO_SUGERIDO : BOTAO_ALTERNATIVO
            }`}
          >
            Confirmar 32%
          </button>
        </div>
      </div>

      {estado?.erro ? (
        <p
          role="alert"
          className="flex items-start gap-2 border-t border-carmim/30 bg-carmim/10 px-4 py-2 font-texto text-sm text-carmim"
        >
          <svg
            aria-hidden="true"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth={1.75}
            strokeLinecap="round"
            strokeLinejoin="round"
            className="mt-0.5 h-4 w-4 shrink-0"
          >
            <path d="M12 9v4M12 17h.01M10.3 3.9 2.4 18a2 2 0 0 0 1.7 3h15.8a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0Z" />
          </svg>
          {estado.erro}
        </p>
      ) : null}
    </form>
  );
}
