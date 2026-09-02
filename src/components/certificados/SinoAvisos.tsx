"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { marcarGrupoLido } from "@/lib/certificados/acoes";

type TipoAviso = "D60_ENTROU" | "D7_ENTROU" | "D3_ENTROU";

export type NotificacaoView = {
  id: string;
  tipo: TipoAviso;
  certificadoId: string;
  clienteId: string;
  razaoSocial: string;
  titular: string;
  lidaEm: Date | null;
  criadoEm: Date;
};

type ItemAviso = { id: string; razaoSocial: string; titular: string };

export type Grupo = {
  tipo: TipoAviso;
  diaISO: string;
  quantidade: number;
  frase: string;
  itens: ItemAviso[];
};

const FOCO_POR_TIPO: Record<TipoAviso, "D60" | "D7" | "D3"> = {
  D60_ENTROU: "D60",
  D7_ENTROU: "D7",
  D3_ENTROU: "D3",
};

const PONTO_POR_TIPO: Record<TipoAviso, string> = {
  D60_ENTROU: "bg-turquesa",
  D7_ENTROU: "bg-ambar",
  D3_ENTROU: "bg-carmim",
};

function frase(tipo: TipoAviso, n: number): string {
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
  const mapa = new Map<string, Omit<Grupo, "frase">>();
  for (const n of notificacoes) {
    const dia = diaISO(n.criadoEm);
    const chave = `${n.tipo}#${dia}`;
    const atual = mapa.get(chave);
    const item: ItemAviso = { id: n.id, razaoSocial: n.razaoSocial, titular: n.titular };
    if (atual) {
      atual.quantidade += 1;
      atual.itens.push(item);
    } else {
      mapa.set(chave, { tipo: n.tipo, diaISO: dia, quantidade: 1, itens: [item] });
    }
  }

  return [...mapa.values()]
    .sort((a, b) => (a.diaISO < b.diaISO ? 1 : a.diaISO > b.diaISO ? -1 : 0))
    .map((g) => ({ ...g, frase: frase(g.tipo, g.quantidade) }));
}

export function SinoAvisos({
  notificacoes,
  tom = "claro",
}: {
  notificacoes: NotificacaoView[];
  tom?: "claro" | "escuro";
}) {
  const router = useRouter();
  const [aberto, setAberto] = useState(false);
  const grupos = agruparNotificacoes(notificacoes);
  const total = notificacoes.length;

  const gatilho =
    tom === "escuro"
      ? "border-nevoa/35 text-nevoa hover:border-nevoa/70 hover:bg-white/10 focus-visible:outline-nevoa"
      : "border-grafite/30 text-tinta hover:border-petroleo/50 hover:bg-nevoa focus-visible:outline-petroleo";

  function irPara(grupo: Grupo) {
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
        aria-label={`Avisos${total > 0 ? ` — ${total} não lidos` : ""}`}
        aria-expanded={aberto}
        className={`inline-flex items-center gap-2 rounded-full border px-3 py-1.5 font-texto text-sm font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 motion-reduce:transition-none ${gatilho}`}
      >
        <svg
          aria-hidden="true"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth={2}
          strokeLinecap="round"
          strokeLinejoin="round"
          className="h-4 w-4"
        >
          <path d="M6 8a6 6 0 0 1 12 0c0 4.5 1.2 6.2 2 7H4c.8-.8 2-2.5 2-7Z" />
          <path d="M10 20a2 2 0 0 0 4 0" />
        </svg>
        Avisos
        <span
          className={`inline-flex h-5 min-w-5 items-center justify-center rounded-full px-1.5 font-codigo text-xs font-bold leading-none tabular-nums ${
            total > 0 ? "bg-ambar text-tinta" : "bg-grafite/25 text-grafite"
          }`}
        >
          {total}
        </span>
      </button>

      {aberto ? (
        <div className="absolute right-0 z-40 mt-2 w-[22rem] overflow-hidden rounded-xl border border-grafite/20 bg-white shadow-2xl">
          <div className="flex items-center justify-between border-b border-grafite/15 px-3.5 py-2.5">
            <span className="font-titulo text-sm font-bold text-tinta">Avisos não lidos</span>
            <span className="font-codigo text-xs tabular-nums text-grafite">{total}</span>
          </div>

          {grupos.length === 0 ? (
            <p className="px-4 py-8 text-center font-texto text-sm text-grafite">
              Nenhum aviso não lido.
            </p>
          ) : (
            <div className="max-h-[70vh] overflow-y-auto p-2">
              {grupos.map((grupo) => (
                <section key={`${grupo.tipo}-${grupo.diaISO}`} className="mb-1.5 last:mb-0">
                  <button
                    type="button"
                    onClick={() => irPara(grupo)}
                    className="flex w-full items-start gap-2 rounded-lg px-2 py-2 text-left transition-colors hover:bg-nevoa motion-reduce:transition-none"
                  >
                    <span
                      aria-hidden="true"
                      className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${PONTO_POR_TIPO[grupo.tipo]}`}
                    />
                    <span className="flex flex-col">
                      <span className="font-texto text-sm font-semibold text-tinta">
                        {grupo.frase}
                      </span>
                      <span className="font-codigo text-xs text-grafite">
                        {grupo.diaISO.split("-").reverse().join("/")} · abrir no Kanban
                      </span>
                    </span>
                  </button>

                  <ul className="mt-0.5 flex flex-col gap-0.5 pl-4">
                    {grupo.itens.map((item) => (
                      <li key={item.id}>
                        <button
                          type="button"
                          onClick={() => irPara(grupo)}
                          className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left font-texto text-sm text-tinta transition-transform duration-150 hover:scale-[1.03] hover:bg-nevoa motion-reduce:transition-none motion-reduce:hover:scale-100"
                        >
                          <span
                            aria-hidden="true"
                            className="h-1.5 w-1.5 shrink-0 rounded-full bg-grafite/40"
                          />
                          <span className="truncate">
                            {item.razaoSocial}
                            <span className="ml-1.5 font-codigo text-xs text-grafite">
                              {item.titular}
                            </span>
                          </span>
                        </button>
                      </li>
                    ))}
                  </ul>
                </section>
              ))}
            </div>
          )}
        </div>
      ) : null}
    </div>
  );
}
