"use client";

import { useActionState } from "react";
import { entrar, type EstadoLogin } from "./actions";

export function FormularioLogin() {
  const [estado, acaoFormulario, pendente] = useActionState<
    EstadoLogin,
    FormData
  >(entrar, null);

  return (
    <form action={acaoFormulario} className="flex flex-col gap-4 font-texto">
      <label className="flex flex-col gap-1 text-sm text-grafite">
        E-mail
        <input
          type="email"
          name="email"
          required
          className="rounded border border-grafite/40 px-3 py-2 text-tinta outline-none focus:border-turquesa"
        />
      </label>
      <label className="flex flex-col gap-1 text-sm text-grafite">
        Senha
        <input
          type="password"
          name="senha"
          required
          className="rounded border border-grafite/40 px-3 py-2 text-tinta outline-none focus:border-turquesa"
        />
      </label>
      {estado?.erro ? (
        <p className="text-sm text-carmim" role="alert">
          {estado.erro}
        </p>
      ) : null}
      <button
        type="submit"
        disabled={pendente}
        className="mt-2 rounded bg-petroleo px-4 py-2 font-semibold text-nevoa transition hover:bg-turquesa disabled:opacity-60"
      >
        {pendente ? "Entrando..." : "Entrar"}
      </button>
    </form>
  );
}
