"use client";

import { useEffect, useRef, useState } from "react";
import type { CertificadoLinha } from "@/lib/certificados/consultas";
import type { ColunasKanban } from "@/lib/certificados/kanban";
import { SpecularButton } from "@/components/ui/SpecularButton";
import { CardCertificado } from "./CardCertificado";

type MarcoLote = "D60" | "D7";
export type FocoKanban = "D60" | "D7" | "D3" | null;

type DefColuna = {
  chave: keyof ColunasKanban;
  foco: string;
  titulo: string;
  stripe: string;
  loteMarco?: MarcoLote;
  acaoCard?: "renovar" | "avisar";
  carmim?: boolean;
};

const COLUNAS: DefColuna[] = [
  { chave: "d60", foco: "D60", titulo: "60 dias", stripe: "bg-turquesa", loteMarco: "D60" },
  { chave: "d7", foco: "D7", titulo: "7 dias", stripe: "bg-ambar", loteMarco: "D7" },
  { chave: "confirmar3", foco: "D3", titulo: "Confirmar renovação — 3 dias", stripe: "bg-carmim/70", acaoCard: "avisar" },
  { chave: "vencido", foco: "VENCIDO", titulo: "Vencido", stripe: "bg-carmim", acaoCard: "renovar", carmim: true },
];

export function QuadroKanban({
  colunas,
  contagem,
  aoAbrirCliente,
  aoEnviarLote,
  aoRenovar,
  aoAvisar,
  focoInicial,
}: {
  colunas: ColunasKanban;
  contagem: { d60: number; d7: number };
  aoAbrirCliente: (clienteId: string) => void;
  aoEnviarLote: (marco: MarcoLote) => void;
  aoRenovar: (certificado: CertificadoLinha) => void;
  aoAvisar: (certificado: CertificadoLinha) => void;
  focoInicial: FocoKanban;
}) {
  const refs = useRef<Record<string, HTMLElement | null>>({});
  const [realce, setRealce] = useState<string | null>(null);

  useEffect(() => {
    if (!focoInicial) return;
    const alvo = refs.current[focoInicial];
    if (!alvo) return;
    if (typeof alvo.scrollIntoView === "function") {
      alvo.scrollIntoView({ behavior: "smooth", block: "nearest" });
    }
    setRealce(focoInicial);
    const t = setTimeout(() => setRealce((r) => (r === focoInicial ? null : r)), 2000);
    return () => clearTimeout(t);
  }, [focoInicial]);

  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      {COLUNAS.map((def) => {
        const cards = colunas[def.chave];
        const n =
          def.loteMarco === "D60" ? contagem.d60 : def.loteMarco === "D7" ? contagem.d7 : 0;

        return (
          <section
            key={def.chave}
            ref={(el) => {
              refs.current[def.chave] = el;
              if (def.foco) refs.current[def.foco] = el;
            }}
            className={`flex min-w-0 flex-col overflow-hidden rounded-xl border transition-shadow ${
              realce === def.chave || realce === def.foco
                ? "border-ambar ring-2 ring-ambar"
                : def.carmim
                  ? "border-carmim/25"
                  : "border-grafite/20"
            } ${def.carmim ? "bg-carmim/[0.04]" : "bg-white"}`}
          >
            <span aria-hidden="true" className={`h-1 ${def.stripe}`} />

            <header className="flex items-start justify-between gap-2 px-3 pb-1.5 pt-2.5">
              <h3
                className={`font-titulo text-xs font-bold uppercase leading-tight tracking-wide ${
                  def.carmim ? "text-carmim" : "text-tinta"
                }`}
              >
                {def.titulo}
              </h3>
              <span className="mt-0.5 shrink-0 rounded-full bg-grafite/10 px-1.5 font-codigo text-xs font-bold leading-5 tabular-nums text-grafite">
                {cards.length}
              </span>
            </header>

            {def.loteMarco ? (
              <div className="px-3 pb-2">
                <SpecularButton
                  variante="primario"
                  tamanho="sm"
                  disabled={n === 0}
                  onClick={() => aoEnviarLote(def.loteMarco!)}
                  className="w-full"
                >
                  {n === 0 ? "Tudo avisado" : `Enviar avisos (${n})`}
                </SpecularButton>
              </div>
            ) : null}

            <div className="flex flex-1 flex-col gap-2 overflow-y-auto px-3 pb-3 [mask-image:linear-gradient(to_bottom,transparent,#000_10px,#000_calc(100%-10px),transparent)] [max-height:60vh]">
              {cards.length === 0 ? (
                <p className="py-8 text-center font-texto text-xs text-grafite/60">
                  Coluna limpa por aqui.
                </p>
              ) : (
                cards.map((linha) => (
                  <CardCertificado
                    key={linha.id}
                    linha={linha}
                    aoAbrir={aoAbrirCliente}
                    acao={def.acaoCard}
                    aoRenovar={aoRenovar}
                    aoAvisar={aoAvisar}
                  />
                ))
              )}
            </div>
          </section>
        );
      })}
    </div>
  );
}
