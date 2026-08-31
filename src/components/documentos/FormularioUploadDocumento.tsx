"use client";

import { useActionState, useState } from "react";
import { enviarDocumento, type EstadoUpload } from "@/lib/documentos/acoes-sc01";

type Cliente = { id: string; razaoSocial: string };
type Conta = { id: string; rotulo: string };

// Mesmo recorte de campo do FormularioCertificado (SC-20).
const CAMPO =
  "rounded border border-grafite/40 bg-white px-3 py-2 text-sm text-tinta outline-none transition-colors focus:border-turquesa focus:ring-2 focus:ring-turquesa/20 disabled:cursor-not-allowed disabled:bg-nevoa/60 disabled:text-grafite motion-reduce:transition-none";

export function FormularioUploadDocumento({
  clientes,
  contasPorCliente,
}: {
  clientes: Cliente[];
  contasPorCliente: Record<string, Conta[]>;
}) {
  const [estado, acaoFormulario, pendente] = useActionState<
    EstadoUpload,
    FormData
  >(enviarDocumento, null);
  const [clienteId, setClienteId] = useState("");

  // As contas ja chegam pre-carregadas por cliente (prop) — o select de
  // cliente so escolhe qual lista aparece, sem fetch no client.
  const contas = clienteId ? (contasPorCliente[clienteId] ?? []) : [];

  return (
    <form
      action={acaoFormulario}
      className="flex flex-wrap items-end gap-4 rounded-lg border border-grafite/20 bg-white p-5 font-texto shadow-sm"
    >
      <label className="flex flex-col gap-1.5 text-sm">
        <span className="font-medium text-grafite">Cliente</span>
        <select
          name="clienteId"
          required
          value={clienteId}
          onChange={(evento) => setClienteId(evento.target.value)}
          className={`${CAMPO} min-w-56`}
        >
          <option value="" disabled>
            Selecione…
          </option>
          {clientes.map((cliente) => (
            <option key={cliente.id} value={cliente.id}>
              {cliente.razaoSocial}
            </option>
          ))}
        </select>
      </label>

      <label className="flex flex-col gap-1.5 text-sm">
        <span className="font-medium text-grafite">Conta bancária</span>
        <select
          name="contaBancariaId"
          required
          disabled={contas.length === 0}
          defaultValue=""
          key={clienteId}
          className={`${CAMPO} min-w-56`}
        >
          <option value="" disabled>
            {clienteId
              ? contas.length === 0
                ? "Nenhuma conta cadastrada"
                : "Selecione…"
              : "Escolha o cliente primeiro"}
          </option>
          {contas.map((conta) => (
            <option key={conta.id} value={conta.id}>
              {conta.rotulo}
            </option>
          ))}
        </select>
      </label>

      <label className="flex flex-col gap-1.5 text-sm">
        <span className="font-medium text-grafite">Extrato (PDF, JPG ou PNG)</span>
        <input
          type="file"
          name="arquivo"
          required
          accept="application/pdf,image/jpeg,image/png"
          className={`${CAMPO} min-w-56 py-1.5 file:mr-3 file:rounded file:border-0 file:bg-nevoa file:px-3 file:py-1.5 file:font-texto file:text-xs file:font-semibold file:text-petroleo hover:file:bg-turquesa/15`}
        />
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
            <path d="M12 15V3" />
            <path d="m7 8 5-5 5 5" />
            <path d="M5 21h14" />
          </svg>
        )}
        {pendente ? "Enviando…" : "Enviar para a fila"}
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
