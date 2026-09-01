"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { marcarGrupoLido } from "@/lib/certificados/acoes";

export type NotificacaoView = {
  id: string;
  tipo: "D60_ENTROU" | "D7_ENTROU" | "D3_ENTROU";
  certificadoId: string;
  clienteId: string;
  lidaEm: Date | null;
  criadoEm: Date;
};

type Grupo = {
  tipo: NotificacaoView["tipo"];
  diaISO: string;
  quantidade: number;
  frase: string;
};

const FOCO_POR_TIPO: Record<NotificacaoView["tipo"], "D60" | "D7" | "D3"> = {
  D60_ENTROU: "D60",
  D7_ENTROU: "D7",
  D3_ENTROU: "D3",
};

function frase(tipo: NotificacaoView["tipo"], n: number): string {
  if (tipo === "D3_ENTROU") {
    return n === 1
      ? "1 cliente para confirmar se fez a renovação"
      : `${n} clientes para confirmar se fizeram a renovação`;
  }
  const faixa = tipo === "D60_ENTROU" ? "60 dias" : "7 dias";
  return n === 1
    ? `1 certificado entrou na faixa de ${faixa}`
    : `${n} certificados entraram na faixa de ${faixa}`;
}

function diaISO(data: Date): string {
  return data.toISOString().slice(0, 10);
}

export function agruparNotificacoes(notificacoes: NotificacaoView[]): Grupo[] {
  const mapa = new Map<string, { tipo: NotificacaoView["tipo"]; diaISO: string; quantidade: number }>();
  for (const n of notificacoes) {
    const dia = diaISO(n.criadoEm);
    const chave = `${n.tipo}#${dia}`;
    const atual = mapa.get(chave);
    if (atual) atual.quantidade += 1;
    else mapa.set(chave, { tipo: n.tipo, diaISO: dia, quantidade: 1 });
  }

  return [...mapa.values()]
    .sort((a, b) => (a.diaISO < b.diaISO ? 1 : a.diaISO > b.diaISO ? -1 : 0))
    .map((g) => ({ ...g, frase: frase(g.tipo, g.quantidade) }));
}

export function SinoAvisos({ notificacoes }: { notificacoes: NotificacaoView[] }) {
  const router = useRouter();
  const [aberto, setAberto] = useState(false);
  const grupos = agruparNotificacoes(notificacoes);
  const total = notificacoes.length;

  function abrirGrupo(grupo: Grupo) {
    setAberto(false);
    marcarGrupoLido(grupo.tipo, grupo.diaISO);
    router.push(
      `/modulos/sc-20?aba=certificados&visao=kanban&foco=${FOCO_POR_TIPO[grupo.tipo]}`,
    );
  }

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setAberto((v) => !v)}
        aria-label={`Avisos${total > 0 ? ` (${total} não lidos)` : ""}`}
        aria-expanded={aberto}
        className="relative rounded p-2 text-grafite transition-colors hover:bg-nevoa hover:text-tinta focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-petroleo motion-reduce:transition-none"
      >
        <svg
          aria-hidden="true"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth={1.6}
          strokeLinecap="round"
          strokeLinejoin="round"
          className="h-5 w-5"
        >
          <path d="M6 8a6 6 0 0 1 12 0c0 4.5 1.2 6.2 2 7H4c.8-.8 2-2.5 2-7Z" />
          <path d="M10 20a2 2 0 0 0 4 0" />
        </svg>
        {total > 0 ? (
          <span className="absolute -right-0.5 -top-0.5 inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-carmim px-1 font-codigo text-[10px] font-bold leading-none text-white">
            {total}
          </span>
        ) : null}
      </button>

      {aberto ? (
        <div className="absolute right-0 z-40 mt-2 w-80 rounded-lg border border-grafite/20 bg-white p-2 shadow-xl">
          {grupos.length === 0 ? (
            <p className="px-2 py-4 text-center font-texto text-sm text-grafite">
              Nenhum aviso não lido.
            </p>
          ) : (
            <ul className="flex flex-col gap-1">
              {grupos.map((grupo) => (
                <li key={`${grupo.tipo}-${grupo.diaISO}`}>
                  <button
                    type="button"
                    onClick={() => abrirGrupo(grupo)}
                    className="flex w-full items-start gap-2 rounded px-2 py-2 text-left font-texto text-sm text-tinta transition-colors hover:bg-nevoa motion-reduce:transition-none"
                  >
                    <span
                      aria-hidden="true"
                      className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-ambar"
                    />
                    <span className="flex flex-col">
                      <span>{grupo.frase}</span>
                      <span className="font-codigo text-xs text-grafite">
                        {grupo.diaISO.split("-").reverse().join("/")}
                      </span>
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      ) : null}
    </div>
  );
}
