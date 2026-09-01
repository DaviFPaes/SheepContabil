"use client";

import { useMemo, useState } from "react";
import { Modal } from "./Modal";

export type DestinatarioLote = {
  clienteId: string;
  razaoSocial: string;
  email: string;
};

const ROTULO_MARCO: Record<"D60" | "D7", string> = {
  D60: "60 dias",
  D7: "7 dias",
};

// INTERFACE APENAS (Etapa 1). O envio real de e-mail nao entra nesta
// etapa por decisao do cliente do modulo. ETAPA 2: aqui entra o
// EnviadorEmail — cria os AvisoCertificado (queued), enfileira um e-mail
// individual por cliente (sem CC/BCC), move os cards e trata bounce.
export function ModalEnvioLote({
  aberto,
  marco,
  aoFechar,
  destinatarios,
}: {
  aberto: boolean;
  marco: "D60" | "D7" | null;
  aoFechar: () => void;
  destinatarios: DestinatarioLote[];
}) {
  const [selecionados, setSelecionados] = useState<Set<string>>(
    () => new Set(destinatarios.map((d) => d.clienteId)),
  );

  const chaveReset = useMemo(
    () => destinatarios.map((d) => d.clienteId).join("|"),
    [destinatarios],
  );
  const [chaveAnterior, setChaveAnterior] = useState(chaveReset);
  if (chaveReset !== chaveAnterior) {
    setChaveAnterior(chaveReset);
    setSelecionados(new Set(destinatarios.map((d) => d.clienteId)));
  }

  function alternar(clienteId: string) {
    setSelecionados((atual) => {
      const proximo = new Set(atual);
      if (proximo.has(clienteId)) proximo.delete(clienteId);
      else proximo.add(clienteId);
      return proximo;
    });
  }

  function confirmar() {
    window.alert("Envio de e-mail ainda não disponível nesta etapa.");
    aoFechar();
  }

  return (
    <Modal
      aberto={aberto}
      aoFechar={aoFechar}
      titulo={`Enviar avisos — ${marco ? ROTULO_MARCO[marco] : ""}`}
    >
      <div className="flex flex-col gap-4">
        <p className="font-texto text-sm text-grafite">
          Um e-mail individual por cliente. Revise a lista antes de confirmar.
        </p>

        <ul className="flex max-h-72 flex-col gap-1 overflow-y-auto rounded-lg border border-grafite/20 p-2">
          {destinatarios.map((d) => (
            <li key={d.clienteId}>
              <label className="flex items-center gap-2.5 rounded px-2 py-1.5 font-texto text-sm hover:bg-nevoa">
                <input
                  type="checkbox"
                  checked={selecionados.has(d.clienteId)}
                  onChange={() => alternar(d.clienteId)}
                  className="h-4 w-4 rounded border-grafite/40 text-petroleo focus:ring-turquesa/30"
                />
                <span className="text-tinta">{d.razaoSocial}</span>
                <span className="font-codigo text-xs text-grafite">{d.email}</span>
              </label>
            </li>
          ))}
        </ul>

        <div className="flex items-center justify-between gap-3">
          <span className="font-codigo text-xs tabular-nums text-grafite">
            {selecionados.size} de {destinatarios.length} selecionados
          </span>
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={aoFechar}
              className="font-texto text-sm text-grafite underline underline-offset-2 hover:text-tinta"
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={confirmar}
              disabled={selecionados.size === 0}
              className="rounded bg-petroleo px-4 py-2 font-texto text-sm font-semibold text-nevoa transition-colors hover:bg-turquesa disabled:opacity-60 motion-reduce:transition-none"
            >
              Confirmar envio
            </button>
          </div>
        </div>
      </div>
    </Modal>
  );
}
