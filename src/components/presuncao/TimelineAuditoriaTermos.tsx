import type { AuditoriaView } from "@/lib/presuncao/consultas-sc11";
import {
  ROTULO_ALIQUOTA,
  formatarDataUTC,
} from "@/lib/presuncao/formato-presuncao";

// Substitui a antiga HistoricoAuditoriaTermos (lista de cartões com filete
// lateral) pela timeline vertical usada no SC-01/SC-20 (TimelineAuditoria /
// TimelineHistorico) — mesmo ponto colorido por tipo de ação, mesma régua.
const NO_COR: Record<AuditoriaView["acao"], string> = {
  CRIACAO: "bg-turquesa",
  RECLASSIFICACAO: "bg-ambar",
  REMOCAO: "bg-carmim",
};

// Datas de auditoria sao timestamps reais; ancorar em UTC mantem a coluna
// consistente com formatarDataUTC (o resto do portal formata sempre em UTC).
function horaUTC(data: Date): string {
  return new Intl.DateTimeFormat("pt-BR", {
    timeStyle: "short",
    timeZone: "UTC",
  }).format(data);
}

function descreverMudanca(linha: AuditoriaView): string {
  const nova = linha.aliquotaNova ? ROTULO_ALIQUOTA[linha.aliquotaNova] : "—";
  const anterior = linha.aliquotaAnterior
    ? ROTULO_ALIQUOTA[linha.aliquotaAnterior]
    : "—";
  if (linha.acao === "CRIACAO") return `criado como ${nova}`;
  if (linha.acao === "REMOCAO") return `removido (era ${anterior})`;
  return `${anterior} → ${nova}`;
}

export function TimelineAuditoriaTermos({
  linhas,
}: {
  linhas: AuditoriaView[];
}) {
  if (linhas.length === 0) {
    return (
      <div className="rounded-xl border border-grafite/15 bg-white px-6 py-12 text-center">
        <p className="font-titulo text-sm font-bold text-tinta">
          Nenhuma alteração ainda
        </p>
        <p className="mt-1 font-texto text-sm text-grafite">
          Criação, reclassificação e remoção de termo aparecem aqui.
        </p>
      </div>
    );
  }

  return (
    <ol className="relative ml-1 flex flex-col gap-3 border-l border-grafite/25 pl-6">
      {linhas.map((linha) => (
        <li key={linha.id} className="relative">
          <span
            aria-hidden="true"
            className={`absolute -left-[1.7rem] top-3 h-2.5 w-2.5 rounded-full ring-[3px] ring-nevoa ${NO_COR[linha.acao]}`}
          />
          <div className="rounded-xl border border-grafite/15 bg-white p-3.5">
            <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
              <span className="font-titulo text-sm font-bold text-tinta">
                {linha.termoTexto}
              </span>
              <time
                dateTime={linha.criadoEm.toISOString()}
                className="font-codigo text-xs tabular-nums text-grafite"
              >
                {formatarDataUTC(linha.criadoEm)} · {horaUTC(linha.criadoEm)}
              </time>
            </div>
            <p className="mt-1 font-texto text-sm leading-relaxed text-tinta">
              {descreverMudanca(linha)}
            </p>
            <p className="mt-1.5 font-codigo text-[11px] uppercase tracking-wide text-grafite/70">
              {linha.autorEmail}
            </p>
          </div>
        </li>
      ))}
    </ol>
  );
}
