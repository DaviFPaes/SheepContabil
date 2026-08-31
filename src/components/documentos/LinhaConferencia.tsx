"use client";

import { useActionState } from "react";
import { confirmarLancamento } from "@/lib/documentos/acoes-sc01";
import type { LancamentoDetalhe } from "@/lib/documentos/consultas-sc01";

const CAMPO =
  "rounded border border-grafite/40 bg-white px-3 py-2 text-sm text-tinta outline-none transition-colors focus:border-turquesa focus:ring-2 focus:ring-turquesa/20 motion-reduce:transition-none";

// Datas gravadas em meia-noite UTC — fatiar o ISO devolve o aaaa-mm-dd certo
// para o <input type="date"> sem escorregar um dia no fuso local.
function dataParaInput(data: Date): string {
  return data.toISOString().slice(0, 10);
}

function tomConfianca(confianca: number): string {
  if (confianca >= 0.85) return "text-turquesa";
  if (confianca >= 0.6) return "text-ambar";
  return "text-carmim";
}

function MedidorConfianca({ confianca }: { confianca: number }) {
  const pct = Math.round(confianca * 100);
  return (
    <span
      className={`inline-flex items-center gap-2 font-codigo text-xs tabular-nums ${tomConfianca(confianca)}`}
    >
      <span
        aria-hidden="true"
        className="relative h-1.5 w-16 overflow-hidden rounded-full bg-grafite/20"
      >
        <span
          className="absolute inset-y-0 left-0 rounded-full bg-current"
          /* largura orientada por dado — unico valor que nao cabe num utilitario */
          style={{ width: `${pct}%` }}
        />
      </span>
      {pct}% de confiança
    </span>
  );
}

export function LinhaConferencia({
  lancamento,
}: {
  lancamento: LancamentoDetalhe;
}) {
  const [estado, acaoFormulario, pendente] = useActionState<
    { erro: string } | null,
    FormData
  >(confirmarLancamento, null);

  return (
    <form
      action={acaoFormulario}
      className="overflow-hidden rounded-lg border border-l-2 border-grafite/20 border-l-ambar bg-white shadow-sm"
    >
      <input type="hidden" name="lancamentoId" value={lancamento.id} />

      <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1.5 border-b border-grafite/15 bg-nevoa/60 px-4 py-2.5">
        <span className="font-texto text-xs font-semibold uppercase tracking-wide text-grafite">
          Linha em conferência
        </span>
        <MedidorConfianca confianca={lancamento.confianca} />
      </div>

      <div className="grid gap-px bg-grafite/15 md:grid-cols-2">
        <div className="bg-nevoa/70 p-4">
          <span className="font-texto text-xs font-semibold uppercase tracking-wide text-grafite">
            Trecho do extrato
          </span>
          {lancamento.trechoOriginal ? (
            <pre className="mt-2 whitespace-pre-wrap break-words font-codigo text-xs leading-relaxed text-tinta">
              {lancamento.trechoOriginal}
            </pre>
          ) : (
            <p className="mt-2 font-texto text-xs italic text-grafite">
              A IA não guardou o trecho de origem desta linha. Confira pelo
              arquivo antes de confirmar.
            </p>
          )}
        </div>

        <div className="flex flex-col gap-3 bg-white p-4">
          <label className="flex flex-col gap-1.5">
            <span className="font-texto text-sm font-medium text-grafite">
              Data
            </span>
            <input
              type="date"
              name="data"
              defaultValue={dataParaInput(lancamento.data)}
              className={`${CAMPO} font-codigo tabular-nums`}
            />
          </label>

          <label className="flex flex-col gap-1.5">
            <span className="font-texto text-sm font-medium text-grafite">
              Histórico
            </span>
            <input
              type="text"
              name="historico"
              defaultValue={lancamento.historico}
              className={CAMPO}
            />
          </label>

          <label className="flex flex-col gap-1.5">
            <span className="font-texto text-sm font-medium text-grafite">
              Valor
            </span>
            <input
              type="text"
              name="valor"
              inputMode="decimal"
              defaultValue={String(lancamento.valor)}
              className={`${CAMPO} font-codigo tabular-nums`}
            />
            <span className="font-texto text-xs text-grafite">
              Negativo para saída. Ponto ou vírgula como decimal.
            </span>
          </label>

          <button
            type="submit"
            disabled={pendente}
            className="mt-1 inline-flex items-center justify-center gap-2 rounded bg-petroleo px-4 py-2 font-texto text-sm font-semibold text-nevoa transition-colors hover:bg-turquesa focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-petroleo disabled:cursor-not-allowed disabled:opacity-60 motion-reduce:transition-none"
          >
            {pendente ? (
              <svg
                aria-hidden="true"
                viewBox="0 0 24 24"
                fill="none"
                className="h-4 w-4 animate-spin motion-reduce:animate-none"
              >
                <circle
                  cx="12"
                  cy="12"
                  r="9"
                  stroke="currentColor"
                  strokeOpacity="0.3"
                  strokeWidth="3"
                />
                <path
                  d="M21 12a9 9 0 0 0-9-9"
                  stroke="currentColor"
                  strokeWidth="3"
                  strokeLinecap="round"
                />
              </svg>
            ) : (
              <svg
                aria-hidden="true"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth={1.75}
                strokeLinecap="round"
                strokeLinejoin="round"
                className="h-4 w-4"
              >
                <path d="m5 13 4 4L19 7" />
              </svg>
            )}
            {pendente ? "Confirmando…" : "Confirmar"}
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
