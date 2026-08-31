"use client";

import { useActionState } from "react";
import { criarTermo, type EstadoTermo } from "@/lib/presuncao/acoes-sc11";

// Mesmo recorte de campo do FormularioCertificado (SC-20).
const CAMPO =
  "rounded border border-grafite/40 bg-white px-3 py-2 text-sm text-tinta outline-none transition-colors focus:border-turquesa focus:ring-2 focus:ring-turquesa/20 disabled:cursor-not-allowed disabled:bg-nevoa/60 disabled:text-grafite motion-reduce:transition-none";

export function FormularioTermo() {
  const [estado, acaoFormulario, pendente] = useActionState<
    EstadoTermo,
    FormData
  >(criarTermo, null);

  return (
    <form
      action={acaoFormulario}
      className="flex flex-wrap items-end gap-4 rounded-lg border border-grafite/20 bg-white p-5 font-texto shadow-sm"
    >
      <label className="flex flex-col gap-1.5 text-sm">
        <span className="font-medium text-grafite">Termo</span>
        <input
          type="text"
          name="termo"
          required
          minLength={2}
          placeholder="ex.: consulta médica"
          className={`${CAMPO} min-w-64`}
        />
      </label>

      <label className="flex flex-col gap-1.5 text-sm">
        <span className="font-medium text-grafite">Base de presunção</span>
        <select
          name="aliquota"
          required
          defaultValue="P8"
          className={`${CAMPO} min-w-40`}
        >
          <option value="P8">8%</option>
          <option value="P32">32%</option>
        </select>
      </label>

      <button
        type="submit"
        disabled={pendente}
        className="inline-flex items-center gap-2 rounded bg-petroleo px-4 py-2 text-sm font-semibold text-nevoa transition-colors hover:bg-turquesa focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-petroleo disabled:cursor-not-allowed disabled:opacity-60 motion-reduce:transition-none"
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
            <path d="M12 5v14" />
            <path d="M5 12h14" />
          </svg>
        )}
        {pendente ? "Adicionando…" : "Adicionar"}
      </button>

      {estado?.erro ? (
        <p
          role="alert"
          className="flex w-full items-start gap-2 rounded border border-carmim/30 bg-carmim/10 px-3 py-2 text-sm text-carmim"
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
