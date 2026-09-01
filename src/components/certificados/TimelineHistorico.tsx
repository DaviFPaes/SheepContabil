import {
  ACENTO_ACAO,
  camposAlterados,
  rotuloAtor,
  type LinhaAuditoria,
} from "@/lib/certificados/historico";
import { formatarDataUTC } from "@/lib/certificados/formato";

const ACENTO_CLASSE: Record<"turquesa" | "ambar" | "carmim", string> = {
  turquesa: "border-l-turquesa",
  ambar: "border-l-ambar",
  carmim: "border-l-carmim",
};

function horaUTC(data: Date): string {
  return new Intl.DateTimeFormat("pt-BR", { timeStyle: "short", timeZone: "UTC" }).format(data);
}

function valorLegivel(v: unknown): string {
  if (v === null || v === undefined) return "—";
  if (v instanceof Date) return formatarDataUTC(v);
  return String(v);
}

export function TimelineHistorico({ linhas }: { linhas: LinhaAuditoria[] }) {
  if (linhas.length === 0) {
    return (
      <div className="rounded-lg border border-grafite/20 bg-white px-6 py-10 text-center shadow-sm">
        <p className="font-titulo text-sm font-bold text-tinta">
          Nada registrado ainda
        </p>
        <p className="mt-1 font-texto text-sm text-grafite">
          Toda criação, edição, transição de faixa, aviso e execução de
          &ldquo;Atualizar&rdquo; aparece aqui.
        </p>
      </div>
    );
  }

  return (
    <ul className="flex flex-col gap-3">
      {linhas.map((linha) => {
        const mudancas = camposAlterados(linha.dadosAntes, linha.dadosDepois);
        return (
          <li
            key={linha.id}
            className={`rounded-lg border border-l-2 border-grafite/20 bg-white p-4 shadow-sm ${ACENTO_CLASSE[ACENTO_ACAO[linha.acao]]}`}
          >
            <div className="mb-1.5 flex flex-wrap items-start justify-between gap-x-3 gap-y-1">
              <span className="font-texto text-sm text-tinta">{linha.descricao}</span>
              <time
                dateTime={linha.criadoEm.toISOString()}
                className="font-codigo text-xs tabular-nums text-grafite"
              >
                {formatarDataUTC(linha.criadoEm)} {horaUTC(linha.criadoEm)}
              </time>
            </div>

            {mudancas.length > 0 ? (
              <ul className="mb-1.5 flex flex-col gap-0.5">
                {mudancas.map((m) => (
                  <li key={m.campo} className="font-codigo text-xs text-grafite">
                    {`${m.campo}: ${valorLegivel(m.de)} → ${valorLegivel(m.para)}`}
                  </li>
                ))}
              </ul>
            ) : null}

            <p className="font-codigo text-xs text-grafite">{rotuloAtor(linha.autorEmail)}</p>
          </li>
        );
      })}
    </ul>
  );
}
