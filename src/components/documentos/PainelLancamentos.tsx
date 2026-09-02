import type { DocumentoDetalhe } from "@/lib/documentos/consultas-sc01";
import type { StatusConferencia } from "@/lib/documentos/conferencia";
import {
  formatarConfianca,
  formatarDataUTC,
  formatarValor,
  tomConfianca,
} from "@/lib/documentos/formato-documentos";
import { LinhaConferencia } from "./LinhaConferencia";

const CELULA = "px-4 py-3 align-middle";
const TH = "px-4 py-2.5 font-texto text-xs uppercase tracking-wide text-grafite";

const BADGE_STATUS: Record<StatusConferencia, { rotulo: string; classe: string }> =
  {
    CONFIRMADO: {
      rotulo: "Confirmado",
      classe: "bg-turquesa/10 text-turquesa ring-turquesa/25",
    },
    PENDENTE_REVISAO: {
      rotulo: "Em conferência",
      classe: "bg-ambar/15 text-ambar ring-ambar/35",
    },
  };

function BadgeLancamento({ status }: { status: StatusConferencia }) {
  const { rotulo, classe } = BADGE_STATUS[status];
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 font-texto text-xs font-medium leading-none ring-1 ring-inset ${classe}`}
    >
      <span
        aria-hidden="true"
        className="h-1.5 w-1.5 shrink-0 rounded-full bg-current"
      />
      {rotulo}
    </span>
  );
}

export function PainelLancamentos({
  documento,
}: {
  documento: DocumentoDetalhe;
}) {
  if (documento.status === "ERRO") {
    return (
      <div
        role="alert"
        className="flex items-start gap-3 rounded-xl border border-carmim/30 bg-carmim/10 p-4 font-texto text-sm text-carmim"
      >
        <svg
          aria-hidden="true"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth={1.75}
          strokeLinecap="round"
          strokeLinejoin="round"
          className="mt-0.5 h-5 w-5 shrink-0"
        >
          <path d="M12 9v4M12 17h.01M10.3 3.9 2.4 18a2 2 0 0 0 1.7 3h15.8a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0Z" />
        </svg>
        <span className="flex flex-col gap-1">
          <span className="font-titulo text-sm font-bold">
            A leitura deste documento falhou
          </span>
          <span className="leading-relaxed">
            {documento.erro ?? "Sem detalhes registrados. Reprocesse o documento."}
          </span>
        </span>
      </div>
    );
  }

  if (documento.lancamentos.length === 0) {
    return (
      <div className="flex flex-col items-center gap-2 rounded-xl border border-grafite/20 bg-white px-6 py-12 text-center">
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
          <path d="M7 3h7l5 5v13H7z" />
          <path d="M14 3v5h5" />
          <path d="M9 13h6M9 17h4" />
        </svg>
        <p className="font-titulo text-sm font-bold text-tinta">
          Documento ainda não processado
        </p>
        <p className="max-w-sm font-texto text-sm text-grafite">
          Rode o processamento para a IA ler o extrato e listar os lançamentos
          aqui.
        </p>
      </div>
    );
  }

  const emConferencia = documento.lancamentos.filter(
    (l) => l.status === "PENDENTE_REVISAO",
  );

  return (
    <div className="flex flex-col gap-8">
      <div className="overflow-hidden rounded-xl border border-grafite/20 bg-white">
        <div className="overflow-x-auto">
          <table className="w-full border-collapse font-texto text-sm">
            <caption className="sr-only">
              Lançamentos lidos do extrato, em ordem de data
            </caption>
            <thead>
              <tr className="border-b border-grafite/20 bg-nevoa/60 text-left">
                <th scope="col" className={TH}>
                  Data
                </th>
                <th scope="col" className={TH}>
                  Histórico
                </th>
                <th scope="col" className={`${TH} text-right`}>
                  Valor
                </th>
                <th scope="col" className={`${TH} text-right`}>
                  Confiança
                </th>
                <th scope="col" className={TH}>
                  Status
                </th>
              </tr>
            </thead>
            <tbody>
              {documento.lancamentos.map((lancamento) => (
                <tr
                  key={lancamento.id}
                  className="border-b border-grafite/10 transition-colors last:border-0 hover:bg-nevoa/70 motion-reduce:transition-none"
                >
                  <td
                    className={`${CELULA} whitespace-nowrap font-codigo text-xs tabular-nums text-grafite`}
                  >
                    <time dateTime={lancamento.data.toISOString()}>
                      {formatarDataUTC(lancamento.data)}
                    </time>
                  </td>
                  <td className={`${CELULA} text-tinta`}>
                    {lancamento.historico}
                  </td>
                  <td
                    className={`${CELULA} whitespace-nowrap text-right font-codigo tabular-nums ${
                      lancamento.valor < 0 ? "text-carmim" : "text-tinta"
                    }`}
                  >
                    {formatarValor(lancamento.valor)}
                  </td>
                  <td
                    className={`${CELULA} whitespace-nowrap text-right font-codigo text-xs tabular-nums ${tomConfianca(
                      lancamento.confianca,
                    )}`}
                  >
                    {formatarConfianca(lancamento.confianca)}
                  </td>
                  <td className={CELULA}>
                    <BadgeLancamento status={lancamento.status} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {emConferencia.length > 0 ? (
        <section>
          <div className="mb-3 flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1.5">
            <h3 className="font-titulo text-lg font-bold text-tinta">
              Conferência
            </h3>
            <span className="font-codigo text-xs tabular-nums text-grafite">
              {emConferencia.length}{" "}
              {emConferencia.length === 1 ? "linha" : "linhas"} para revisar
            </span>
          </div>
          <div className="flex flex-col gap-4">
            {emConferencia.map((lancamento) => (
              <LinhaConferencia key={lancamento.id} lancamento={lancamento} />
            ))}
          </div>
        </section>
      ) : null}
    </div>
  );
}
