"use client";

import { useFormStatus } from "react-dom";

// Mesmo motivo do BotaoRodarAgora (SC-20): fica DENTRO do <form action={acao}>
// so para ler o status de envio e, enquanto `pending`, desabilitar + trocar o
// rotulo — evita o duplo clique que dispararia duas execucoes sobrepostas.
// Serve tanto para "processar pendentes" (sem documentoId) quanto para o
// "reprocessar" da tela de detalhe (com documentoId no hidden).

type AcaoFormulario = (formData: FormData) => void | Promise<void>;

function Disparador({ rotulo }: { rotulo: string }) {
  const { pending } = useFormStatus();

  return (
    <button
      type="submit"
      disabled={pending}
      aria-disabled={pending}
      className="inline-flex items-center gap-2 rounded bg-petroleo px-4 py-2 font-texto text-sm font-semibold text-nevoa transition-colors hover:bg-turquesa focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-petroleo disabled:cursor-not-allowed disabled:opacity-60 motion-reduce:transition-none"
    >
      {pending ? (
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
          <path d="M21 12a9 9 0 1 1-3-7" />
          <path d="M21 5v4h-4" />
        </svg>
      )}
      {pending ? "Processando…" : rotulo}
    </button>
  );
}

export function BotaoProcessar({
  acao,
  rotulo,
  documentoId,
}: {
  acao: AcaoFormulario;
  rotulo: string;
  documentoId?: string;
}) {
  return (
    <form action={acao}>
      {documentoId ? (
        <input type="hidden" name="documentoId" value={documentoId} />
      ) : null}
      <Disparador rotulo={rotulo} />
    </form>
  );
}
