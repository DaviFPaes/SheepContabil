"use client";

import { editarTermo, removerTermo } from "@/lib/presuncao/acoes-sc11";
import type { TermoView } from "@/lib/presuncao/consultas-sc11";
import type { AliquotaPresuncao } from "@/lib/presuncao/presuncao-termos";
import { ROTULO_ALIQUOTA } from "@/lib/presuncao/formato-presuncao";
import { BadgeAliquota } from "./BadgeAliquota";

const CELULA = "px-4 py-3 align-middle";
const TH =
  "px-4 py-2.5 font-texto text-xs font-semibold uppercase tracking-wide text-grafite";

function outraBase(aliquota: AliquotaPresuncao): AliquotaPresuncao {
  return aliquota === "P8" ? "P32" : "P8";
}

export function TabelaTermos({ termos }: { termos: TermoView[] }) {
  if (termos.length === 0) {
    return (
      <div className="rounded-lg border border-grafite/20 bg-white px-6 py-10 text-center shadow-sm">
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

  return (
    <div className="overflow-hidden rounded-lg border border-grafite/20 bg-white shadow-sm">
      <div className="overflow-x-auto">
        <table className="w-full border-collapse font-texto text-sm">
          <caption className="sr-only">
            Termos de presunção cadastrados, em ordem alfabética
          </caption>
          <thead>
            <tr className="border-b border-grafite/20 bg-nevoa/60 text-left">
              <th scope="col" className={TH}>
                Termo
              </th>
              <th scope="col" className={TH}>
                Base
              </th>
              <th scope="col" className="px-4 py-2.5 text-right">
                <span className="sr-only">Ações</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {termos.map((termo) => {
              const alvo = outraBase(termo.aliquota);
              return (
                <tr
                  key={termo.id}
                  className="border-b border-grafite/10 transition-colors last:border-0 hover:bg-nevoa/70 motion-reduce:transition-none"
                >
                  <td className={`${CELULA} font-medium text-tinta`}>
                    {termo.termo}
                  </td>
                  <td className={CELULA}>
                    <BadgeAliquota aliquota={termo.aliquota} />
                  </td>
                  <td className={`${CELULA} text-right`}>
                    <div className="flex items-center justify-end gap-4">
                      <form action={editarTermo}>
                        <input type="hidden" name="id" value={termo.id} />
                        <button
                          type="submit"
                          name="aliquota"
                          value={alvo}
                          className="inline-flex items-center gap-1 rounded font-codigo text-xs font-medium tabular-nums text-turquesa underline-offset-2 transition-colors hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-turquesa motion-reduce:transition-none"
                        >
                          → {ROTULO_ALIQUOTA[alvo]}
                        </button>
                      </form>
                      <form
                        action={removerTermo}
                        onSubmit={(evento) => {
                          if (
                            !confirm(`Remover o termo "${termo.termo}"?`)
                          ) {
                            evento.preventDefault();
                          }
                        }}
                      >
                        <input type="hidden" name="id" value={termo.id} />
                        <button
                          type="submit"
                          className="inline-flex items-center gap-1 rounded font-texto text-xs font-medium text-carmim underline-offset-2 transition-colors hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-carmim motion-reduce:transition-none"
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
                          Remover
                        </button>
                      </form>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
