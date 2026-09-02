import {
  ACENTO_ACAO,
  camposAlterados,
  rotuloAtor,
  type LinhaAuditoriaDocumento,
} from "@/lib/documentos/historico";
import { formatarDataUTC } from "@/lib/documentos/formato-documentos";

const NO_COR: Record<"turquesa" | "ambar" | "carmim", string> = {
  turquesa: "bg-turquesa",
  ambar: "bg-ambar",
  carmim: "bg-carmim",
};

function horaUTC(data: Date): string {
  return new Intl.DateTimeFormat("pt-BR", {
    timeStyle: "short",
    timeZone: "UTC",
  }).format(data);
}

function valorLegivel(v: unknown): string {
  if (v === null || v === undefined) return "—";
  if (v instanceof Date) return formatarDataUTC(v);
  return String(v);
}

export function TimelineAuditoria({
  linhas,
}: {
  linhas: LinhaAuditoriaDocumento[];
}) {
  if (linhas.length === 0) {
    return (
      <div className="rounded-xl border border-grafite/15 bg-white px-6 py-12 text-center">
        <p className="font-titulo text-sm font-bold text-tinta">
          Nada registrado ainda
        </p>
        <p className="mt-1 font-texto text-sm text-grafite">
          Envio, leitura, conferência e download de OFX aparecem aqui.
        </p>
      </div>
    );
  }

  return (
    <ol className="relative ml-1 flex flex-col gap-3 border-l border-grafite/25 pl-6">
      {linhas.map((linha) => {
        const mudancas = camposAlterados(linha.dadosAntes, linha.dadosDepois);
        return (
          <li key={linha.id} className="relative">
            <span
              aria-hidden="true"
              className={`absolute -left-[1.7rem] top-3 h-2.5 w-2.5 rounded-full ring-[3px] ring-nevoa ${NO_COR[ACENTO_ACAO[linha.acao]]}`}
            />
            <div className="rounded-xl border border-grafite/15 bg-white p-3.5">
              <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
                <span className="font-texto text-sm text-tinta">
                  {linha.descricao}
                </span>
                <time
                  dateTime={linha.criadoEm.toISOString()}
                  className="font-codigo text-xs tabular-nums text-grafite"
                >
                  {formatarDataUTC(linha.criadoEm)} · {horaUTC(linha.criadoEm)}
                </time>
              </div>

              {mudancas.length > 0 ? (
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {mudancas.map((m) => (
                    <span
                      key={m.campo}
                      className="inline-flex items-center gap-1 rounded bg-nevoa px-1.5 py-0.5 font-codigo text-[11px] text-grafite"
                    >
                      <span className="font-medium text-tinta">{m.campo}:</span>{" "}
                      {valorLegivel(m.de)} → {valorLegivel(m.para)}
                    </span>
                  ))}
                </div>
              ) : null}

              <p className="mt-1.5 font-codigo text-[11px] uppercase tracking-wide text-grafite/70">
                {rotuloAtor(linha.autorEmail)}
              </p>
            </div>
          </li>
        );
      })}
    </ol>
  );
}
