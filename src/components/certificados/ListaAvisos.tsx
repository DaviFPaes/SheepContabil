import type { AvisoComCliente } from "@/lib/certificados/consultas";
import type { FaixaUrgencia } from "@/lib/certificados/faixa-urgencia";
import { formatarDataUTC } from "@/lib/certificados/formato";
import { BadgeFaixa } from "./BadgeFaixa";

// Filete lateral no tom da faixa: deixa a urgencia legivel ao correr o
// olho pela coluna, sem depender so da cor do selo.
const ACENTO_POR_FAIXA: Record<FaixaUrgencia, string> = {
  VENCIDO: "border-l-carmim",
  CRITICO: "border-l-carmim",
  ALERTA: "border-l-ambar",
  PROXIMO: "border-l-turquesa",
  OK: "border-l-grafite",
};

export function ListaAvisos({ avisos }: { avisos: AvisoComCliente[] }) {
  if (avisos.length === 0) {
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
          <path d="M6 8a6 6 0 0 1 12 0c0 4.5 1.2 6.2 2 7H4c.8-.8 2-2.5 2-7Z" />
          <path d="M10 20a2 2 0 0 0 4 0" />
        </svg>
        <p className="font-titulo text-sm font-bold text-tinta">
          Nenhum aviso emitido ainda
        </p>
        <p className="max-w-sm font-texto text-sm text-grafite">
          Rode o módulo para gerar os avisos dos certificados dentro da janela
          de 60 dias.
        </p>
      </div>
    );
  }

  return (
    <ul className="flex flex-col gap-3">
      {avisos.map((aviso) => (
        <li
          key={aviso.id}
          className={`rounded-lg border border-l-2 border-grafite/20 bg-white p-4 shadow-sm ${ACENTO_POR_FAIXA[aviso.faixa]}`}
        >
          <div className="mb-1.5 flex items-start justify-between gap-3">
            <span className="font-titulo text-sm font-bold text-tinta">
              {aviso.razaoSocial}
            </span>
            <span className="flex shrink-0 items-center gap-2">
              <BadgeFaixa faixa={aviso.faixa} />
              <time className="font-codigo text-xs tabular-nums text-grafite">
                {formatarDataUTC(aviso.criadoEm)}
              </time>
            </span>
          </div>
          <p className="font-texto text-sm leading-relaxed text-tinta">
            {aviso.mensagem}
          </p>
        </li>
      ))}
    </ul>
  );
}
