"use client";

import { useActionState } from "react";
import { entrar, type EstadoLogin } from "./actions";

const classesCampo =
  "rounded-lg border border-grafite/30 bg-white/70 px-3 py-2.5 text-tinta transition outline-none placeholder:text-grafite/50 focus:border-turquesa focus:bg-white focus:ring-2 focus:ring-turquesa/25";

export function FormularioLogin() {
  const [estado, acaoFormulario, pendente] = useActionState<
    EstadoLogin,
    FormData
  >(entrar, null);

  return (
    <form action={acaoFormulario} className="flex flex-col gap-4 font-texto">
      <label className="flex flex-col gap-1.5 text-sm font-medium text-grafite">
        E-mail
        <input
          type="email"
          name="email"
          required
          autoComplete="email"
          autoFocus
          className={classesCampo}
        />
      </label>
      <label className="flex flex-col gap-1.5 text-sm font-medium text-grafite">
        Senha
        <input
          type="password"
          name="senha"
          required
          autoComplete="current-password"
          className={classesCampo}
        />
      </label>
      {estado?.erro ? (
        <p
          className="rounded-lg bg-carmim/10 px-3 py-2 text-sm text-carmim"
          role="alert"
        >
          {estado.erro}
        </p>
      ) : null}
      <button
        type="submit"
        disabled={pendente}
        className="mt-2 rounded-lg bg-petroleo px-4 py-2.5 font-semibold text-nevoa transition hover:bg-turquesa focus-visible:ring-2 focus-visible:ring-turquesa focus-visible:ring-offset-2 focus-visible:ring-offset-nevoa disabled:cursor-not-allowed disabled:opacity-60"
      >
        {pendente ? "Entrando..." : "Entrar"}
      </button>
    </form>
  );
}
