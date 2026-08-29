"use client";

import { useActionState } from "react";
import {
  criarCertificado,
  editarCertificado,
  type EstadoFormCertificado,
} from "@/lib/certificados/acoes";
import type { CertificadoComStatus } from "@/lib/certificados/consultas";
import { dataParaInput } from "@/lib/certificados/formato";

type Cliente = { id: string; razaoSocial: string };

const CAMPO =
  "rounded border border-grafite/40 bg-white px-3 py-2 text-tinta outline-none transition-colors focus:border-turquesa focus:ring-2 focus:ring-turquesa/20 motion-reduce:transition-none";

export function FormularioCertificado({
  clientes,
  certificado,
}: {
  clientes: Cliente[];
  certificado: CertificadoComStatus | null;
}) {
  const emEdicao = certificado !== null;
  const acao = emEdicao ? editarCertificado : criarCertificado;
  const [estado, acaoFormulario, pendente] = useActionState<
    EstadoFormCertificado,
    FormData
  >(acao, null);

  return (
    <form
      action={acaoFormulario}
      className="flex flex-wrap items-end gap-4 rounded-lg border border-grafite/20 bg-white p-5 font-texto shadow-sm"
    >
      {emEdicao ? (
        <input type="hidden" name="id" value={certificado.id} />
      ) : null}

      <label className="flex flex-col gap-1.5 text-sm">
        <span className="font-medium text-grafite">Cliente</span>
        <select
          name="clienteId"
          required
          defaultValue={certificado?.clienteId ?? ""}
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
        <span className="font-medium text-grafite">Validade</span>
        <input
          type="date"
          name="dataValidade"
          required
          defaultValue={certificado ? dataParaInput(certificado.dataValidade) : ""}
          className={`${CAMPO} min-w-44`}
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
        ) : null}
        {emEdicao
          ? pendente
            ? "Salvando…"
            : "Salvar"
          : pendente
            ? "Adicionando…"
            : "Adicionar"}
      </button>

      {emEdicao ? (
        <a
          href="/modulos/sc-20"
          className="text-sm text-grafite underline underline-offset-2 transition-colors hover:text-tinta motion-reduce:transition-none"
        >
          Cancelar
        </a>
      ) : null}

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
