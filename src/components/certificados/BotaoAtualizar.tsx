"use client";

import { useFormStatus } from "react-dom";

// Fica dentro do <form action={atualizarAgora}> (server-side) so para ler
// o status de envio: enquanto `pending`, o botao se desabilita e troca o
// rotulo, evitando o duplo clique que dispararia duas execucoes
// sobrepostas.
export function BotaoAtualizar() {
  const { pending } = useFormStatus();

  return (
    <button
      type="submit"
      disabled={pending}
      aria-disabled={pending}
      className="inline-flex items-center gap-2 rounded bg-petroleo px-4 py-2 font-texto text-sm font-semibold text-nevoa transition-colors hover:bg-turquesa focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-petroleo disabled:opacity-60 motion-reduce:transition-none"
    >
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
        <path d="M3 12a9 9 0 0 1 15-6.7L21 8M21 3v5h-5" />
        <path d="M21 12a9 9 0 0 1-15 6.7L3 16M3 21v-5h5" />
      </svg>
      {pending ? "Atualizando…" : "Atualizar"}
    </button>
  );
}
