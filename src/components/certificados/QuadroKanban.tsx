"use client";

import { useEffect, useRef } from "react";
import type { CertificadoLinha, ColunasKanban } from "@/lib/certificados/consultas";
import { CardCertificado } from "./CardCertificado";

type MarcoLote = "D60" | "D7";
export type FocoKanban = "D60" | "D7" | "D3" | null;

type DefColuna = {
  chave: keyof ColunasKanban;
  titulo: string;
  listra: string;
  loteMarco?: MarcoLote;
  foco?: Exclude<FocoKanban, null>;
  destaque?: boolean;
};

const COLUNAS: DefColuna[] = [
  { chave: "aAvisar60", titulo: "A avisar — 60 dias", listra: "bg-turquesa", loteMarco: "D60", foco: "D60" },
  { chave: "avisado60", titulo: "Avisado 60d", listra: "bg-turquesa/40" },
  { chave: "aAvisar7", titulo: "A avisar — 7 dias", listra: "bg-ambar", loteMarco: "D7", foco: "D7" },
  { chave: "avisado7", titulo: "Avisado 7d", listra: "bg-ambar/40" },
  { chave: "confirmar3", titulo: "Confirmar renovação — 3 dias", listra: "bg-carmim", foco: "D3" },
  { chave: "vencido", titulo: "Vencido", listra: "bg-carmim", destaque: true },
  { chave: "renovado", titulo: "Renovado", listra: "bg-grafite/50" },
];

export function QuadroKanban({
  colunas,
  contagem,
  aoAbrirCliente,
  aoEnviarLote,
  focoInicial,
}: {
  colunas: ColunasKanban;
  contagem: { d60: number; d7: number };
  aoAbrirCliente: (clienteId: string) => void;
  aoEnviarLote: (marco: MarcoLote) => void;
  focoInicial: FocoKanban;
}) {
  const refs = useRef<Record<string, HTMLElement | null>>({});

  useEffect(() => {
    if (!focoInicial) return;
    const alvo = refs.current[focoInicial];
    if (!alvo) return;
    alvo.scrollIntoView({ behavior: "smooth", inline: "center", block: "nearest" });
    alvo.dataset.foco = "on";
    const t = setTimeout(() => {
      if (alvo) delete alvo.dataset.foco;
    }, 2000);
    return () => clearTimeout(t);
  }, [focoInicial]);

  return (
    <div className="flex gap-3 overflow-x-auto pb-2">
      {COLUNAS.map((def) => {
        const cards = colunas[def.chave] as CertificadoLinha[];
        const n = def.loteMarco === "D60" ? contagem.d60 : def.loteMarco === "D7" ? contagem.d7 : 0;

        return (
          <section
            key={def.chave}
            ref={(el) => {
              if (def.foco) refs.current[def.foco] = el;
            }}
            className="flex w-64 shrink-0 flex-col rounded-lg border border-grafite/20 bg-nevoa/60 data-[foco=on]:ring-2 data-[foco=on]:ring-ambar"
          >
            <span aria-hidden="true" className={`h-1 rounded-t-lg ${def.listra}`} />
            <header className="flex items-center justify-between gap-2 px-3 py-2">
              <h3
                className={`font-titulo text-xs font-bold uppercase tracking-wide ${
                  def.destaque ? "text-carmim" : "text-tinta"
                }`}
              >
                {def.titulo}
              </h3>
              <span className="font-codigo text-xs font-bold tabular-nums text-grafite">
                {cards.length}
              </span>
            </header>

            {def.loteMarco ? (
              <div className="px-3 pb-2">
                <button
                  type="button"
                  disabled={n === 0}
                  onClick={() => aoEnviarLote(def.loteMarco!)}
                  className="w-full rounded-md bg-petroleo px-2 py-1.5 font-texto text-xs font-semibold text-nevoa transition-colors hover:bg-turquesa disabled:cursor-not-allowed disabled:bg-grafite/20 disabled:text-grafite motion-reduce:transition-none"
                >
                  {n === 0 ? "Nada a enviar" : `Enviar avisos (${n})`}
                </button>
              </div>
            ) : null}

            <div className="flex flex-1 flex-col gap-2 overflow-y-auto px-3 pb-3">
              {cards.length === 0 ? (
                <p className="py-6 text-center font-texto text-xs text-grafite/70">
                  Coluna limpa por aqui.
                </p>
              ) : (
                cards.map((linha) => (
                  <CardCertificado key={linha.id} linha={linha} aoAbrir={aoAbrirCliente} />
                ))
              )}
            </div>
          </section>
        );
      })}
    </div>
  );
}
