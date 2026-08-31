import type { ItemDetalhe } from "@/lib/presuncao/consultas-sc11";
import type { Consolidado } from "@/lib/presuncao/presuncao-termos";
import { formatarValorBRL } from "@/lib/presuncao/formato-presuncao";
import { BadgeAliquota } from "./BadgeAliquota";
import { BadgeOrigemDecisao } from "./BadgeOrigemDecisao";

const CELULA = "px-4 py-3 align-top";
const CELULA_CONSOLIDADO = "px-4 py-2.5 align-middle";
const TH =
  "px-4 py-2.5 font-texto text-xs font-semibold uppercase tracking-wide text-grafite";
const FAIXA_TITULO =
  "border-b border-grafite/15 bg-nevoa/60 px-4 py-2.5 font-texto text-xs font-semibold uppercase tracking-wide text-grafite";

export function PainelItens({
  itens,
  consolidado,
}: {
  itens: ItemDetalhe[];
  consolidado: Consolidado;
}) {
  return (
    <section className="flex flex-col gap-4">
      <h2 className="font-titulo text-lg font-bold text-tinta">
        Itens classificados
      </h2>

      <div className="overflow-hidden rounded-lg border border-grafite/20 bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full border-collapse font-texto text-sm">
            <thead>
              <tr className="border-b border-grafite/20 bg-nevoa/60 text-left">
                <th scope="col" className={TH}>
                  Descrição
                </th>
                <th scope="col" className={`${TH} text-right`}>
                  Valor
                </th>
                <th scope="col" className={TH}>
                  Base
                </th>
                <th scope="col" className={TH}>
                  Origem
                </th>
              </tr>
            </thead>
            <tbody>
              {itens.map((item) => (
                <tr
                  key={item.id}
                  className="border-b border-grafite/10 last:border-0"
                >
                  <td className={`${CELULA} text-tinta`}>
                    <span className="font-medium">{item.descricao}</span>
                    <span className="mt-1 block font-texto text-xs text-grafite">
                      {item.justificativa}
                    </span>
                  </td>
                  <td
                    className={`${CELULA} whitespace-nowrap text-right font-codigo tabular-nums text-tinta`}
                  >
                    {formatarValorBRL(item.valor)}
                  </td>
                  <td className={CELULA}>
                    <BadgeAliquota aliquota={item.aliquota} />
                  </td>
                  <td className={CELULA}>
                    <BadgeOrigemDecisao origem={item.origem} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="overflow-hidden rounded-lg border border-grafite/20 bg-white shadow-sm">
        <p className={FAIXA_TITULO}>Consolidado por balde</p>
        <div className="overflow-x-auto">
          <table className="w-full border-collapse font-texto text-sm">
            <thead>
              <tr className="border-b border-grafite/20 text-left">
                <th scope="col" className={TH}>
                  Base
                </th>
                <th scope="col" className={`${TH} text-right`}>
                  Itens
                </th>
                <th scope="col" className={`${TH} text-right`}>
                  Σ Valor
                </th>
                <th scope="col" className={`${TH} text-right`}>
                  Base de presunção
                </th>
              </tr>
            </thead>
            <tbody>
              {consolidado.porBalde.map((linha) => (
                <tr
                  key={linha.aliquota}
                  className="border-b border-grafite/10 last:border-0"
                >
                  <td className={CELULA_CONSOLIDADO}>
                    <BadgeAliquota aliquota={linha.aliquota} />
                  </td>
                  <td
                    className={`${CELULA_CONSOLIDADO} text-right font-codigo tabular-nums text-tinta`}
                  >
                    {linha.qtdItens}
                  </td>
                  <td
                    className={`${CELULA_CONSOLIDADO} whitespace-nowrap text-right font-codigo tabular-nums text-tinta`}
                  >
                    {formatarValorBRL(linha.somaValor)}
                  </td>
                  <td
                    className={`${CELULA_CONSOLIDADO} whitespace-nowrap text-right font-codigo tabular-nums text-tinta`}
                  >
                    {formatarValorBRL(linha.basePresuncao)}
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="border-t border-grafite/20 bg-nevoa/60 font-semibold">
                <td className={`${CELULA_CONSOLIDADO} text-tinta`}>Total</td>
                <td className={CELULA_CONSOLIDADO} aria-hidden="true" />
                <td
                  className={`${CELULA_CONSOLIDADO} whitespace-nowrap text-right font-codigo tabular-nums text-tinta`}
                >
                  {formatarValorBRL(consolidado.totalValor)}
                </td>
                <td
                  className={`${CELULA_CONSOLIDADO} whitespace-nowrap text-right font-codigo tabular-nums text-tinta`}
                >
                  {formatarValorBRL(consolidado.totalBase)}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>
    </section>
  );
}
