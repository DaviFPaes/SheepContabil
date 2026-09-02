"use client";

import { editarTermo, removerTermo } from "@/lib/presuncao/acoes-sc11";
import type { TermoView } from "@/lib/presuncao/consultas-sc11";
import type { AliquotaPresuncao } from "@/lib/presuncao/presuncao-termos";
import { ROTULO_ALIQUOTA } from "@/lib/presuncao/formato-presuncao";

// Substitui a antiga TabelaTermos: agrupado por base em vez de <table>, porque
// a base de presunção (8%/32%) é a própria informação central do módulo —
// separar visualmente em duas colunas reforça isso antes mesmo de ler o texto.

function outraBase(aliquota: AliquotaPresuncao): AliquotaPresuncao {
  return aliquota === "P8" ? "P32" : "P8";
}

const FILETE_BASE: Record<AliquotaPresuncao, string> = {
  P8: "border-t-turquesa",
  P32: "border-t-grafite",
};

function Coluna({
  aliquota,
  termos,
}: {
  aliquota: AliquotaPresuncao;
  termos: TermoView[];
}) {
  const alvo = outraBase(aliquota);
  return (
    <div
      className={`overflow-hidden rounded-xl border border-t-[3px] border-grafite/15 bg-white ${FILETE_BASE[aliquota]}`}
    >
      <div className="flex items-center justify-between border-b border-grafite/10 bg-nevoa/60 px-4 py-2.5">
        <h3 className="font-titulo text-sm font-bold text-tinta">
          Base {ROTULO_ALIQUOTA[aliquota]}
        </h3>
        <span className="font-codigo text-xs tabular-nums text-grafite">
          {termos.length} {termos.length === 1 ? "termo" : "termos"}
        </span>
      </div>

      {termos.length === 0 ? (
        <p className="px-4 py-6 text-center font-texto text-sm text-grafite">
          Nenhum termo nesta base ainda.
        </p>
      ) : (
        <ul className="divide-y divide-grafite/10">
          {termos.map((termo) => (
            <li
              key={termo.id}
              className="flex items-center justify-between gap-3 px-4 py-2.5"
            >
              <span className="font-texto text-sm text-tinta">{termo.termo}</span>
              <div className="flex shrink-0 items-center gap-3">
                <form action={editarTermo}>
                  <input type="hidden" name="id" value={termo.id} />
                  <button
                    type="submit"
                    name="aliquota"
                    value={alvo}
                    title={`Mover para ${ROTULO_ALIQUOTA[alvo]}`}
                    className="inline-flex items-center gap-1 rounded font-codigo text-xs font-medium tabular-nums text-turquesa underline-offset-2 transition-colors hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-turquesa motion-reduce:transition-none"
                  >
                    → {ROTULO_ALIQUOTA[alvo]}
                  </button>
                </form>
                <form
                  action={removerTermo}
                  onSubmit={(evento) => {
                    if (!confirm(`Remover o termo "${termo.termo}"?`)) {
                      evento.preventDefault();
                    }
                  }}
                >
                  <input type="hidden" name="id" value={termo.id} />
                  <button
                    type="submit"
                    aria-label={`Remover termo ${termo.termo}`}
                    title="Remover"
                    className="inline-flex items-center rounded p-1 text-carmim/70 transition-colors hover:bg-carmim/10 hover:text-carmim focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-carmim motion-reduce:transition-none"
                  >
                    <svg
                      aria-hidden="true"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth={1.75}
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      className="h-3.5 w-3.5"
                    >
                      <path d="M4 7h16M10 11v6M14 11v6M5 7l1 13h12l1-13M9 7V4h6v3" />
                    </svg>
                  </button>
                </form>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export function PainelTermos({ termos }: { termos: TermoView[] }) {
  if (termos.length === 0) {
    return (
      <div className="rounded-xl border border-grafite/15 bg-white px-6 py-12 text-center">
        <p className="font-titulo text-sm font-bold text-tinta">
          Nenhum termo cadastrado
        </p>
        <p className="mx-auto mt-1 max-w-sm font-texto text-sm text-grafite">
          Cadastre termos acima para que a classificação por regra reconheça os
          serviços recorrentes.
        </p>
      </div>
    );
  }

  const p8 = termos.filter((t) => t.aliquota === "P8");
  const p32 = termos.filter((t) => t.aliquota === "P32");

  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <Coluna aliquota="P8" termos={p8} />
      <Coluna aliquota="P32" termos={p32} />
    </div>
  );
}
