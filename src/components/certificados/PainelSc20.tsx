"use client";

import { useMemo, useState } from "react";
import type { CertificadoLinha, ColunasKanban } from "@/lib/certificados/consultas";
import { AlternadorVisao, type Visao } from "./AlternadorVisao";
import { PainelCertificados } from "./PainelCertificados";
import { QuadroKanban, type FocoKanban } from "./QuadroKanban";
import { ModalCertificado } from "./ModalCertificado";
import { ModalPerfilCliente } from "./ModalPerfilCliente";
import { ModalEnvioLote, type DestinatarioLote } from "./ModalEnvioLote";

type ClienteOpcao = { id: string; razaoSocial: string };

function destinatarios(cards: CertificadoLinha[]): DestinatarioLote[] {
  return cards.map((c) => ({
    clienteId: c.clienteId,
    razaoSocial: c.razaoSocial,
    email: c.clienteEmail,
  }));
}

export function PainelSc20({
  certificados,
  colunas,
  contagem,
  clientes,
  visaoUrl,
  focoInicial,
}: {
  certificados: CertificadoLinha[];
  colunas: ColunasKanban;
  contagem: { d60: number; d7: number };
  clientes: ClienteOpcao[];
  visaoUrl: Visao | null;
  focoInicial: FocoKanban;
}) {
  const [visao, setVisao] = useState<Visao>(visaoUrl ?? "tabela");
  const [perfilClienteId, setPerfilClienteId] = useState<string | null>(null);
  const [certificadoModal, setCertificadoModal] = useState<
    "novo" | CertificadoLinha | null
  >(null);
  const [envioLote, setEnvioLote] = useState<"D60" | "D7" | null>(null);

  // Certificados ativos por cliente — alimenta o select de "certificado
  // anterior" no fluxo de renovacao do ModalCertificado.
  const certificadosPorCliente = useMemo(() => {
    const mapa: Record<string, { id: string; titular: string; dataValidade: Date }[]> = {};
    for (const c of certificados) {
      if (!c.ativo) continue;
      (mapa[c.clienteId] ??= []).push({
        id: c.id,
        titular: c.titular,
        dataValidade: c.dataValidade,
      });
    }
    return mapa;
  }, [certificados]);

  const destinatariosLote =
    envioLote === "D60"
      ? destinatarios(colunas.aAvisar60)
      : envioLote === "D7"
        ? destinatarios(colunas.aAvisar7)
        : [];

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <AlternadorVisao visaoUrl={visaoUrl} aoMudar={setVisao} />
        <button
          type="button"
          onClick={() => setCertificadoModal("novo")}
          className="inline-flex items-center gap-1.5 rounded bg-petroleo px-3 py-1.5 font-texto text-sm font-semibold text-nevoa transition-colors hover:bg-turquesa focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-petroleo motion-reduce:transition-none"
        >
          <svg
            aria-hidden="true"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth={2}
            strokeLinecap="round"
            className="h-4 w-4"
          >
            <path d="M12 5v14M5 12h14" />
          </svg>
          Novo certificado
        </button>
      </div>

      {visao === "kanban" ? (
        <QuadroKanban
          colunas={colunas}
          contagem={contagem}
          aoAbrirCliente={setPerfilClienteId}
          aoEnviarLote={setEnvioLote}
          focoInicial={focoInicial}
        />
      ) : (
        <PainelCertificados
          certificados={certificados}
          aoEditar={(id) =>
            setCertificadoModal(certificados.find((c) => c.id === id) ?? null)
          }
          aoAbrirCliente={setPerfilClienteId}
        />
      )}

      <ModalCertificado
        aberto={certificadoModal !== null}
        aoFechar={() => setCertificadoModal(null)}
        clientes={clientes}
        certificadosPorCliente={certificadosPorCliente}
        certificado={certificadoModal === "novo" ? null : certificadoModal}
      />

      <ModalPerfilCliente
        clienteId={perfilClienteId}
        aoFechar={() => setPerfilClienteId(null)}
      />

      <ModalEnvioLote
        aberto={envioLote !== null}
        marco={envioLote}
        aoFechar={() => setEnvioLote(null)}
        destinatarios={destinatariosLote}
      />
    </div>
  );
}
