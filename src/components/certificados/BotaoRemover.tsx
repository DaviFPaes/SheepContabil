"use client";

import { removerCertificado } from "@/lib/certificados/acoes";

export function BotaoRemover({ id }: { id: string }) {
  return (
    <form
      action={removerCertificado}
      onSubmit={(evento) => {
        if (!confirm("Remover este certificado?")) {
          evento.preventDefault();
        }
      }}
    >
      <input type="hidden" name="id" value={id} />
      <button
        type="submit"
        className="inline-flex items-center gap-1 rounded font-texto text-xs font-medium text-carmim underline-offset-2 transition-colors hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-carmim motion-reduce:transition-none"
      >
        <svg
          aria-hidden="true"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth={1.75}
          strokeLinecap="round"
          strokeLinejoin="round"
          className="h-3.5 w-3.5"
        >
          <path d="M4 7h16M10 11v6M14 11v6M5 7l1 13h12l1-13M9 7V4h6v3" />
        </svg>
        Remover
      </button>
    </form>
  );
}
