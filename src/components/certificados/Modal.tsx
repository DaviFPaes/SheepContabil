"use client";

import { useEffect, useRef, type ReactNode } from "react";

// Overlay proprio (nao <dialog> nativo) para comportamento identico em
// jsdom e no browser: fecha no X, no clique no backdrop e no Esc; trava o
// scroll do fundo enquanto aberto e devolve o foco ao gatilho ao fechar.
// So tokens da paleta SheepContabil.
export function Modal({
  aberto,
  aoFechar,
  titulo,
  children,
}: {
  aberto: boolean;
  aoFechar: () => void;
  titulo: string;
  children: ReactNode;
}) {
  const gatilhoRef = useRef<Element | null>(null);
  const painelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!aberto) return;

    gatilhoRef.current = document.activeElement;
    const overflowAnterior = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    function aoTeclar(evento: KeyboardEvent) {
      if (evento.key === "Escape") aoFechar();
    }
    document.addEventListener("keydown", aoTeclar);
    painelRef.current?.focus();

    return () => {
      document.removeEventListener("keydown", aoTeclar);
      document.body.style.overflow = overflowAnterior;
      if (gatilhoRef.current instanceof HTMLElement) gatilhoRef.current.focus();
    };
  }, [aberto, aoFechar]);

  if (!aberto) return null;

  return (
    <div
      data-testid="modal-backdrop"
      onClick={(evento) => {
        if (evento.target === evento.currentTarget) aoFechar();
      }}
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-tinta/50 p-4 backdrop-blur-[1px] sm:p-8"
    >
      <div
        ref={painelRef}
        role="dialog"
        aria-modal="true"
        aria-label={titulo}
        tabIndex={-1}
        className="my-4 w-full max-w-2xl rounded-xl border border-grafite/25 bg-white shadow-xl outline-none"
      >
        <div className="flex items-center justify-between gap-4 border-b border-grafite/15 px-5 py-3.5">
          <h2 className="font-titulo text-base font-bold text-tinta">{titulo}</h2>
          <button
            type="button"
            onClick={aoFechar}
            aria-label="Fechar"
            className="-mr-1 rounded p-1 text-grafite transition-colors hover:bg-nevoa hover:text-tinta focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-petroleo motion-reduce:transition-none"
          >
            <svg
              aria-hidden="true"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth={1.75}
              strokeLinecap="round"
              className="h-4.5 w-4.5"
            >
              <path d="m6 6 12 12M18 6 6 18" />
            </svg>
          </button>
        </div>
        <div className="px-5 py-4">{children}</div>
      </div>
    </div>
  );
}
