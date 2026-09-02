"use client";

import { useMemo, useState } from "react";
import { SpecularButton } from "@/components/ui/SpecularButton";
import { enviarAvisosLote } from "@/lib/certificados/acoes";
import { Modal } from "./Modal";

export type DestinatarioLote = {
  certificadoId: string;
  clienteId: string;
  razaoSocial: string;
  email: string;
};

const ROTULO_MARCO: Record<"D60" | "D7", string> = {
  D60: "60 dias",
  D7: "7 dias",
};

// Envio demonstrativo: não há disparo real de e-mail nesta etapa, mas o
// AvisoCertificado é gravado (status SENT) para os cards da coluna virarem
// névoa. ETAPA 2: aqui entra o EnviadorEmail com fila real, webhook de
// bounce e reenvio individual.
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
    () => new Set(destinatarios.map((d) => d.certificadoId)),
  );
  const [pendente, setPendente] = useState(false);
  const [enviados, setEnviados] = useState<string[] | null>(null);

  const chaveReset = useMemo(
    () => destinatarios.map((d) => d.certificadoId).join("|"),
    [destinatarios],
  );
  const [chaveAnterior, setChaveAnterior] = useState(chaveReset);
  if (chaveReset !== chaveAnterior) {
    setChaveAnterior(chaveReset);
    setSelecionados(new Set(destinatarios.map((d) => d.certificadoId)));
    setEnviados(null);
    setPendente(false);
  }

  function alternar(certificadoId: string) {
    setSelecionados((atual) => {
      const proximo = new Set(atual);
      if (proximo.has(certificadoId)) proximo.delete(certificadoId);
      else proximo.add(certificadoId);
      return proximo;
    });
  }

  async function confirmar() {
    if (!marco) return;
    setPendente(true);
    const alvos = destinatarios.filter((d) => selecionados.has(d.certificadoId));
    const r = await enviarAvisosLote(
      marco,
      alvos.map((d) => d.certificadoId),
    );
    setPendente(false);
    if ("erro" in r) return;
    setEnviados(alvos.map((d) => `${d.razaoSocial} · ${d.email}`));
  }

  return (
    <Modal
      aberto={aberto}
      aoFechar={aoFechar}
      titulo={`Enviar avisos — ${marco ? ROTULO_MARCO[marco] : ""}`}
    >
      {enviados ? (
        <div className="flex flex-col gap-4">
          <div className="flex items-start gap-3">
            <span className="mt-0.5 inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-turquesa/15 text-turquesa">
              <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4">
                <path d="m5 13 4 4L19 7" />
              </svg>
            </span>
            <div>
              <p className="font-titulo text-base font-bold text-tinta">
                {enviados.length === 1
                  ? "1 aviso enviado"
                  : `${enviados.length} avisos enviados`}
              </p>
              <p className="mt-0.5 font-texto text-sm text-grafite">
                Um e-mail individual por cliente. Os cards passaram para
                “avisado”.
              </p>
            </div>
          </div>

          <ul className="flex max-h-64 flex-col gap-1 overflow-y-auto rounded-lg border border-grafite/20 p-2 font-texto text-sm text-tinta">
            {enviados.map((linha) => (
              <li key={linha} className="px-2 py-1">
                {linha}
              </li>
            ))}
          </ul>

          <div className="flex justify-end">
            <SpecularButton variante="primario" tamanho="sm" onClick={aoFechar}>
              Concluir
            </SpecularButton>
          </div>
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          <p className="font-texto text-sm text-grafite">
            Um e-mail individual por cliente. Revise a lista antes de confirmar.
          </p>

          <ul className="flex max-h-72 flex-col gap-1 overflow-y-auto rounded-lg border border-grafite/20 p-2">
            {destinatarios.map((d) => (
              <li key={d.certificadoId}>
                <label className="flex items-center gap-2.5 rounded px-2 py-1.5 font-texto text-sm hover:bg-nevoa">
                  <input
                    type="checkbox"
                    checked={selecionados.has(d.certificadoId)}
                    onChange={() => alternar(d.certificadoId)}
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
            <div className="flex items-center gap-2.5">
              <SpecularButton variante="fantasma" tamanho="sm" onClick={aoFechar}>
                Cancelar
              </SpecularButton>
              <SpecularButton
                variante="primario"
                tamanho="sm"
                onClick={confirmar}
                disabled={selecionados.size === 0 || pendente}
              >
                {pendente ? "Enviando…" : "Confirmar envio"}
              </SpecularButton>
            </div>
          </div>
        </div>
      )}
    </Modal>
  );
}
