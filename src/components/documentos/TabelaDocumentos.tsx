import Link from "next/link";
import type { DocumentoResumo } from "@/lib/documentos/consultas-sc01";
import type { OrdenacaoDocumento } from "@/lib/documentos/filtros-documentos";
import { formatarDataUTC } from "@/lib/documentos/formato-documentos";
import { BadgeStatusDocumento } from "./BadgeStatusDocumento";

type ColunaOrdenavel = "cliente" | "chegada" | "status" | "linhas";

const CELULA = "px-4 py-3 align-middle";
const TH =
  "px-4 py-2.5 font-texto text-xs font-semibold uppercase tracking-wide text-grafite";

function Cabecalho({
  rotulo,
  coluna,
  ordenacao,
  aoOrdenar,
  className = "",
}: {
  rotulo: string;
  coluna: ColunaOrdenavel;
  ordenacao: OrdenacaoDocumento;
  aoOrdenar: (coluna: ColunaOrdenavel) => void;
  className?: string;
}) {
  const asc = ordenacao === `${coluna}-asc`;
  const desc = ordenacao === `${coluna}-desc`;
  const ativo = asc || desc;
  return (
    <th scope="col" className={`${TH} ${className}`}>
      <button
        type="button"
        onClick={() => aoOrdenar(coluna)}
        className="inline-flex items-center gap-1 rounded font-semibold uppercase tracking-wide transition-colors hover:text-tinta focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-petroleo motion-reduce:transition-none"
      >
        {rotulo}
        <span
          aria-hidden="true"
          className={`text-[0.7em] leading-none ${ativo ? "text-petroleo" : "text-grafite/35"}`}
        >
          {desc ? "▼" : "▲"}
        </span>
      </button>
    </th>
  );
}

function ColunaLinhas({ documento }: { documento: DocumentoResumo }) {
  if (documento.status !== "PROCESSADO" || documento.totalLancamentos === 0) {
    return <span className="text-grafite/60">—</span>;
  }
  return (
    <span className="inline-flex items-center gap-2">
      <span className="tabular-nums text-tinta">
        {documento.totalLancamentos}
      </span>
      {documento.emRevisao > 0 ? (
        <span className="inline-flex items-center gap-1.5 rounded-full bg-ambar/15 px-2 py-0.5 font-texto text-xs font-medium leading-none text-ambar ring-1 ring-inset ring-ambar/35">
          <span
            aria-hidden="true"
            className="h-1.5 w-1.5 shrink-0 rounded-full bg-current"
          />
          {documento.emRevisao} em revisão
        </span>
      ) : null}
    </span>
  );
}

export function TabelaDocumentos({
  documentos,
  ordenacao,
  aoOrdenar,
}: {
  documentos: DocumentoResumo[];
  ordenacao: OrdenacaoDocumento;
  aoOrdenar: (coluna: "cliente" | "chegada" | "status" | "linhas") => void;
}) {
  if (documentos.length === 0) {
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
          <path d="M4 13h4l2 3h4l2-3h4" />
          <path d="M4 13 6.5 5.5A2 2 0 0 1 8.4 4h7.2a2 2 0 0 1 1.9 1.5L20 13v5a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2Z" />
        </svg>
        <p className="font-titulo text-sm font-bold text-tinta">
          Nenhum documento na caixa de entrada
        </p>
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-lg border border-grafite/20 bg-white shadow-sm">
      <div className="overflow-x-auto">
        <table className="w-full border-collapse font-texto text-sm">
          <caption className="sr-only">
            Documentos recebidos, filtráveis e ordenáveis por coluna
          </caption>
          <thead>
            <tr className="border-b border-grafite/20 bg-nevoa/60 text-left">
              <Cabecalho
                rotulo="Cliente"
                coluna="cliente"
                ordenacao={ordenacao}
                aoOrdenar={aoOrdenar}
              />
              <th scope="col" className={TH}>
                Arquivo
              </th>
              <th scope="col" className={TH}>
                Banco
              </th>
              <Cabecalho
                rotulo="Chegada"
                coluna="chegada"
                ordenacao={ordenacao}
                aoOrdenar={aoOrdenar}
              />
              <Cabecalho
                rotulo="Status"
                coluna="status"
                ordenacao={ordenacao}
                aoOrdenar={aoOrdenar}
              />
              <Cabecalho
                rotulo="Linhas"
                coluna="linhas"
                ordenacao={ordenacao}
                aoOrdenar={aoOrdenar}
              />
              <th scope="col" className="px-4 py-2.5 text-right">
                <span className="sr-only">Ações</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {documentos.map((documento) => (
              <tr
                key={documento.id}
                className="border-b border-grafite/10 transition-colors last:border-0 hover:bg-nevoa/70 motion-reduce:transition-none"
              >
                <td className={`${CELULA} font-medium text-tinta`}>
                  {documento.clienteRazaoSocial}
                </td>
                <td className={CELULA}>
                  <a
                    href={`/modulos/sc-01/documento/${documento.id}/arquivo`}
                    target="_blank"
                    rel="noopener noreferrer"
                    title={documento.nomeArquivo}
                    className="inline-flex max-w-xs items-center gap-1 rounded font-codigo text-xs text-turquesa underline-offset-2 transition-colors hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-turquesa motion-reduce:transition-none"
                  >
                    <span className="truncate">{documento.nomeArquivo}</span>
                    <svg
                      aria-hidden="true"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth={1.75}
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      className="h-3 w-3 shrink-0"
                    >
                      <path d="M7 17 17 7" />
                      <path d="M9 7h8v8" />
                    </svg>
                  </a>
                </td>
                <td
                  className={`${CELULA} font-codigo text-xs text-grafite`}
                >
                  {documento.bancoRotulo ?? "—"}
                </td>
                <td
                  className={`${CELULA} whitespace-nowrap font-codigo text-xs tabular-nums text-grafite`}
                >
                  <time dateTime={documento.chegadaEm.toISOString()}>
                    {formatarDataUTC(documento.chegadaEm)}
                  </time>
                </td>
                <td className={CELULA}>
                  <BadgeStatusDocumento status={documento.status} />
                </td>
                <td className={`${CELULA} whitespace-nowrap`}>
                  <ColunaLinhas documento={documento} />
                </td>
                <td className={`${CELULA} text-right`}>
                  <Link
                    href={`/modulos/sc-01/documento/${documento.id}`}
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
