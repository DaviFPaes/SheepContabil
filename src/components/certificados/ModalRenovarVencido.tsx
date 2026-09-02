"use client";

import { useState, type FormEvent } from "react";
import { SpecularButton } from "@/components/ui/SpecularButton";
import { renovarCertificadoVencido } from "@/lib/certificados/acoes";
import type { CertificadoLinha } from "@/lib/certificados/consultas";
import { textoDias } from "@/lib/certificados/bucket";
import { dataParaInput, formatarDataUTC } from "@/lib/certificados/formato";
import { Modal } from "./Modal";

const CAMPO =
  "rounded border border-grafite/40 bg-white px-3 py-2 font-texto text-sm text-tinta outline-none transition-colors focus:border-turquesa focus:ring-2 focus:ring-turquesa/20 motion-reduce:transition-none";

function daquiUmAno(): string {
  const d = new Date();
  d.setUTCFullYear(d.getUTCFullYear() + 1);
  return dataParaInput(d);
}

export function ModalRenovarVencido({
  certificado,
  aoFechar,
}: {
  certificado: CertificadoLinha | null;
  aoFechar: () => void;
}) {
  const [novaData, setNovaData] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const [pendente, setPendente] = useState(false);

  // Reinicia os campos a cada certificado aberto (padrão de ajuste de
  // estado durante o render, sem efeito).
  const [idAberto, setIdAberto] = useState<string | null>(null);
  const idAtual = certificado?.id ?? null;
  if (idAtual !== idAberto) {
    setIdAberto(idAtual);
    setNovaData(certificado ? daquiUmAno() : "");
    setErro(null);
    setPendente(false);
  }

  async function confirmar(evento: FormEvent) {
    evento.preventDefault();
    if (!certificado) return;
    setPendente(true);
    setErro(null);
    const r = await renovarCertificadoVencido(certificado.id, novaData);
    setPendente(false);
    if (r && "erro" in r) {
      setErro(r.erro);
      return;
    }
    aoFechar();
  }

  return (
    <Modal
      aberto={certificado !== null}
      aoFechar={aoFechar}
      titulo="Renovar certificado"
    >
      {certificado ? (
        <form onSubmit={confirmar} className="flex flex-col gap-4">
          <div className="rounded-lg border border-grafite/20 bg-nevoa/60 p-3">
            <p className="font-titulo text-sm font-bold text-tinta">
              {certificado.razaoSocial}
            </p>
            <p className="mt-0.5 font-texto text-xs text-grafite">
              {certificado.titular}
            </p>
            <p className="mt-2 font-codigo text-xs tabular-nums text-carmim">
              Venceu em {formatarDataUTC(certificado.dataValidade)} ·{" "}
              {textoDias(certificado.diasRestantes)}
            </p>
          </div>

          <label className="flex flex-col gap-1.5 font-texto text-sm" htmlFor="mrv-data">
            <span className="font-medium text-grafite">Nova data de validade</span>
            <input
              id="mrv-data"
              type="date"
              value={novaData}
              onChange={(e) => setNovaData(e.target.value)}
              required
              className={CAMPO}
            />
            <span className="font-texto text-xs text-grafite">
              Precisa ser uma data futura. Confirmada a renovação, o certificado
              sai da coluna Vencido e vai para Renovado.
            </span>
          </label>

          {erro ? (
            <p
              role="alert"
              className="rounded border border-carmim/30 bg-carmim/10 px-3 py-2 font-texto text-sm text-carmim"
            >
              {erro}
            </p>
          ) : null}

          <div className="flex items-center justify-end gap-2.5">
            <SpecularButton variante="fantasma" tamanho="sm" onClick={aoFechar}>
              Cancelar
            </SpecularButton>
            <SpecularButton type="submit" variante="primario" tamanho="sm" disabled={pendente}>
              {pendente ? "Renovando…" : "Confirmar renovação"}
            </SpecularButton>
          </div>
        </form>
      ) : null}
    </Modal>
  );
}
