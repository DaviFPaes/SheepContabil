import Link from "next/link";
import type { NotaResumo } from "@/lib/presuncao/consultas-sc11";
import { BadgeStatusDocumento } from "@/components/documentos/BadgeStatusDocumento";

const CELULA = "px-4 py-3 align-middle";
const TH =
  "px-4 py-2.5 font-texto text-xs font-semibold uppercase tracking-wide text-grafite";

export function TabelaNotas({ notas }: { notas: NotaResumo[] }) {
  if (notas.length === 0) {
    return (
      <div className="flex flex-col items-center gap-2 rounded-lg border border-grafite/20 bg-white px-6 py-10 text-center shadow-sm">
        <svg
          aria-hidden="true"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth={1.5}
          strokeLinecap="round"
          strokeLinejoin="round"
          className="h-8 w-8 text-grafite/60"
        >
          <path d="M14 3v5h5" />
          <path d="M7 3h7l5 5v13H7z" />
          <path d="M9 13h6M9 17h6" />
        </svg>
        <p className="font-titulo text-sm font-bold text-tinta">
          Nenhuma NFS-e na caixa de entrada
        </p>
        <p className="max-w-sm font-texto text-sm text-grafite">
          Envie o XML de uma nota pelo formulário acima para começar a fila de
          classificação.
        </p>
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-lg border border-grafite/20 bg-white shadow-sm">
      <div className="overflow-x-auto">
        <table className="w-full border-collapse font-texto text-sm">
          <caption className="sr-only">
            Notas de serviço recebidas, da mais recente à mais antiga
          </caption>
          <thead>
            <tr className="border-b border-grafite/20 bg-nevoa/60 text-left">
              <th scope="col" className={TH}>
                Cliente
              </th>
              <th scope="col" className={TH}>
                Arquivo / nº
              </th>
              <th scope="col" className={TH}>
                Status
              </th>
              <th scope="col" className={TH}>
                Itens
              </th>
              <th scope="col" className={TH}>
                Conferência
              </th>
              <th scope="col" className="px-4 py-2.5 text-right">
                <span className="sr-only">Ações</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {notas.map((nota) => (
              <tr
                key={nota.documentoId}
                className="border-b border-grafite/10 transition-colors last:border-0 hover:bg-nevoa/70 motion-reduce:transition-none"
              >
                <td className={`${CELULA} font-medium text-tinta`}>
                  {nota.clienteRazaoSocial}
                </td>
                <td className={CELULA}>
                  <span
                    className="block max-w-xs truncate font-codigo text-xs text-grafite"
                    title={nota.nomeArquivo}
                  >
                    {nota.nomeArquivo}
                  </span>
                  {nota.numero ? (
                    <span className="font-codigo text-xs text-grafite/70">
                      nº {nota.numero}
                    </span>
                  ) : null}
                </td>
                <td className={CELULA}>
                  <BadgeStatusDocumento status={nota.status} />
                </td>
                <td
                  className={`${CELULA} whitespace-nowrap font-codigo tabular-nums text-tinta`}
                >
                  {nota.totalItens}
                </td>
                <td
                  className={`${CELULA} whitespace-nowrap font-texto text-xs text-grafite`}
                >
                  {nota.emRevisao > 0
                    ? `${nota.emRevisao} em conferência`
                    : "—"}
                </td>
                <td className={`${CELULA} text-right`}>
                  <Link
                    href={`/modulos/sc-11/nota/${nota.documentoId}`}
                    className="inline-flex items-center gap-1 rounded font-texto text-xs font-medium text-turquesa underline-offset-2 transition-colors hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-turquesa motion-reduce:transition-none"
                  >
                    Abrir
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
                      <path d="M5 12h14" />
                      <path d="m13 6 6 6-6 6" />
                    </svg>
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
