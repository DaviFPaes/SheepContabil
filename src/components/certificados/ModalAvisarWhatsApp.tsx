"use client";

import { useState } from "react";
import { SpecularButton } from "@/components/ui/SpecularButton";
import { avisarClienteD3 } from "@/lib/certificados/acoes";
import type { CertificadoLinha } from "@/lib/certificados/consultas";
import { formatarDataUTC } from "@/lib/certificados/formato";
import { Modal } from "./Modal";

const ROTULO_TIPO: Record<CertificadoLinha["tipo"], string> = {
  ECNPJ: "e-CNPJ",
  ECPF: "e-CPF",
  NFE: "NF-e",
};

function mensagemPadrao(c: CertificadoLinha): string {
  const dias =
    c.diasRestantes <= 0
      ? "vence hoje"
      : `vence em ${c.diasRestantes} ${c.diasRestantes === 1 ? "dia" : "dias"}`;
  return [
    `Olá, ${c.razaoSocial}. Aqui é da SheepContabil.`,
    "",
    `O certificado digital ${ROTULO_TIPO[c.tipo]} (${c.titular}) ${dias} — validade em ${formatarDataUTC(c.dataValidade)}.`,
    "",
    "Para não interromper a emissão de notas e o acesso aos portais, precisamos renovar com urgência. Você consegue nos retornar ainda hoje para agendarmos? Obrigado!",
  ].join("\n");
}

export function ModalAvisarWhatsApp({
  certificado,
  aoFechar,
}: {
  certificado: CertificadoLinha | null;
  aoFechar: () => void;
}) {
  const [mensagem, setMensagem] = useState("");
  const [copiado, setCopiado] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [pendente, setPendente] = useState(false);

  // Reinicia a mensagem a cada certificado aberto (ajuste de estado no
  // render, sem efeito).
  const [idAberto, setIdAberto] = useState<string | null>(null);
  const idAtual = certificado?.id ?? null;
  if (idAtual !== idAberto) {
    setIdAberto(idAtual);
    setMensagem(certificado ? mensagemPadrao(certificado) : "");
    setCopiado(false);
    setErro(null);
    setPendente(false);
  }

  const digitos = (certificado?.clienteTelefone ?? "").replace(/\D/g, "");
  const linkWhatsapp = digitos
    ? `https://wa.me/${digitos}?text=${encodeURIComponent(mensagem)}`
    : null;

  async function copiar() {
    try {
      await navigator.clipboard.writeText(mensagem);
      setCopiado(true);
      window.setTimeout(() => setCopiado(false), 2000);
    } catch {
      setErro("Não foi possível copiar automaticamente — selecione o texto e copie.");
    }
  }

  async function confirmar() {
    if (!certificado) return;
    setPendente(true);
    setErro(null);
    const r = await avisarClienteD3(certificado.id);
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
      titulo="Avisar cliente por WhatsApp"
    >
      {certificado ? (
        <div className="flex flex-col gap-4">
          <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
            <p className="font-titulo text-sm font-bold text-tinta">
              {certificado.razaoSocial}
            </p>
            {certificado.clienteTelefone ? (
              <p className="font-codigo text-xs tabular-nums text-grafite">
                {certificado.clienteTelefone}
              </p>
            ) : (
              <p className="font-texto text-xs font-medium text-carmim">
                Sem telefone cadastrado
              </p>
            )}
          </div>

          <label className="flex flex-col gap-1.5 font-texto text-sm" htmlFor="maw-msg">
            <span className="font-medium text-grafite">Mensagem</span>
            <textarea
              id="maw-msg"
              rows={7}
              value={mensagem}
              onChange={(e) => setMensagem(e.target.value)}
              className="resize-y rounded border border-grafite/40 bg-white px-3 py-2 font-texto text-sm leading-relaxed text-tinta outline-none transition-colors focus:border-turquesa focus:ring-2 focus:ring-turquesa/20 motion-reduce:transition-none"
            />
          </label>

          {!certificado.clienteTelefone ? (
            <p className="rounded border border-ambar/40 bg-ambar/10 px-3 py-2 font-texto text-xs text-ambar">
              Cadastre o telefone no perfil do cliente para abrir a conversa
              direto no WhatsApp. Você ainda pode copiar a mensagem e marcar
              o aviso como feito.
            </p>
          ) : null}

          {erro ? (
            <p
              role="alert"
              className="rounded border border-carmim/30 bg-carmim/10 px-3 py-2 font-texto text-sm text-carmim"
            >
              {erro}
            </p>
          ) : null}

          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-3">
              {linkWhatsapp ? (
                <a
                  href={linkWhatsapp}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 rounded bg-turquesa px-3 py-2 font-texto text-sm font-semibold text-white transition-colors hover:bg-petroleo motion-reduce:transition-none"
                >
                  <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4">
                    <path d="M21 11.5a8.38 8.38 0 0 1-8.5 8.5 8.38 8.38 0 0 1-4-1L3 21l1.9-5.5a8.38 8.38 0 0 1-1-4A8.38 8.38 0 0 1 12.5 3 8.38 8.38 0 0 1 21 11.5Z" />
                  </svg>
                  Abrir no WhatsApp
                </a>
              ) : null}
              <SpecularButton variante="fantasma" tamanho="sm" onClick={copiar}>
                {copiado ? "Copiado!" : "Copiar mensagem"}
              </SpecularButton>
            </div>

            <div className="flex items-center gap-2.5">
              <SpecularButton variante="fantasma" tamanho="sm" onClick={aoFechar}>
                Cancelar
              </SpecularButton>
              <SpecularButton
                variante="primario"
                tamanho="sm"
                onClick={confirmar}
                disabled={pendente}
              >
                {pendente ? "Registrando…" : "Confirmar aviso"}
              </SpecularButton>
            </div>
          </div>
        </div>
      ) : null}
    </Modal>
  );
}
