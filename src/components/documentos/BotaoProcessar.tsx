"use client";

import { useFormStatus } from "react-dom";
import { SpecularButton } from "@/components/ui/SpecularButton";

// Mesmo motivo do BotaoAtualizar (SC-20): fica DENTRO do <form action={acao}>
// so para ler o status de envio e, enquanto `pending`, desabilitar + trocar o
// rotulo — evita o duplo clique que dispararia duas execucoes sobrepostas.
// Serve tanto para "processar pendentes" (sem documentoId) quanto para o
// "reprocessar" da tela de detalhe (com documentoId no hidden).

type AcaoFormulario = (formData: FormData) => void | Promise<void>;

function Disparador({
  rotulo,
  tom = "claro",
}: {
  rotulo: string;
  tom?: "claro" | "escuro";
}) {
  const { pending } = useFormStatus();

  return (
    <SpecularButton
      type="submit"
      variante="primario"
      tom={tom}
      tamanho="sm"
      disabled={pending}
      aria-disabled={pending}
    >
      {pending ? (
        <svg
          aria-hidden="true"
          viewBox="0 0 24 24"
          fill="none"
          className="h-4 w-4 animate-spin motion-reduce:animate-none"
        >
          <circle cx="12" cy="12" r="9" stroke="currentColor" strokeOpacity="0.3" strokeWidth="3" />
          <path d="M21 12a9 9 0 0 0-9-9" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
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
    </SpecularButton>
  );
}

export function BotaoProcessar({
  acao,
  rotulo,
  documentoId,
  tom = "claro",
}: {
  acao: AcaoFormulario;
  rotulo: string;
  documentoId?: string;
  tom?: "claro" | "escuro";
}) {
  return (
    <form action={acao}>
      {documentoId ? (
        <input type="hidden" name="documentoId" value={documentoId} />
      ) : null}
      <Disparador rotulo={rotulo} tom={tom} />
    </form>
  );
}
