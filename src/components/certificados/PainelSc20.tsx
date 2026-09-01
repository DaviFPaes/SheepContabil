"use client";

import { useState } from "react";
import type { CertificadoLinha, ColunasKanban } from "@/lib/certificados/consultas";
import { AlternadorVisao, type Visao } from "./AlternadorVisao";
import { PainelCertificados } from "./PainelCertificados";
import { QuadroKanban, type FocoKanban } from "./QuadroKanban";

// Casca client do painel de certificados: hospeda o toggle Tabela/Kanban e
// (a partir das Tasks 13-15-18 do plano) os modais de certificado, perfil
// do cliente e envio em lote. Por ora os callbacks de modal so guardam
// estado — os modais entram nas proximas tasks.
export function PainelSc20({
  certificados,
  colunas,
  contagem,
  visaoUrl,
  focoInicial,
}: {
  certificados: CertificadoLinha[];
  colunas: ColunasKanban;
  contagem: { d60: number; d7: number };
  visaoUrl: Visao | null;
  focoInicial: FocoKanban;
}) {
  const [visao, setVisao] = useState<Visao>(visaoUrl ?? "tabela");
  const [, setPerfilClienteId] = useState<string | null>(null);
  const [, setCertificadoEditando] = useState<"novo" | CertificadoLinha | null>(null);
  const [, setEnvioLote] = useState<"D60" | "D7" | null>(null);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-3">
        <AlternadorVisao visaoUrl={visaoUrl} aoMudar={setVisao} />
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
          aoEditar={(id) => {
            const alvo = certificados.find((c) => c.id === id) ?? null;
            setCertificadoEditando(alvo);
          }}
          aoAbrirCliente={setPerfilClienteId}
        />
      )}
    </div>
  );
}
