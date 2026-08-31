import type { AuditoriaView } from "@/lib/presuncao/consultas-sc11";
import {
  ROTULO_ALIQUOTA,
  formatarDataUTC,
} from "@/lib/presuncao/formato-presuncao";

// Filete lateral no tom da acao: criacao (turquesa), reclassificacao (ambar),
// remocao (carmim) — deixa a natureza da mudanca legivel ao correr o olho.
const ACENTO: Record<AuditoriaView["acao"], string> = {
  CRIACAO: "border-l-turquesa",
  RECLASSIFICACAO: "border-l-ambar",
  REMOCAO: "border-l-carmim",
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

export function HistoricoAuditoriaTermos({
  linhas,
}: {
  linhas: AuditoriaView[];
}) {
  if (linhas.length === 0) {
    return (
      <p className="font-texto text-sm text-grafite">
        Nenhuma alteração ainda.
      </p>
    );
  }

  return (
    <ul className="flex flex-col gap-3">
      {linhas.map((linha) => (
        <li
          key={linha.id}
          className={`rounded-lg border border-l-2 border-grafite/20 bg-white p-4 shadow-sm ${ACENTO[linha.acao]}`}
        >
          <div className="mb-1.5 flex flex-wrap items-start justify-between gap-x-3 gap-y-1">
            <span className="font-titulo text-sm font-bold text-tinta">
              {linha.termoTexto}
            </span>
            <time
              dateTime={linha.criadoEm.toISOString()}
              className="font-codigo text-xs tabular-nums text-grafite"
            >
              {formatarDataUTC(linha.criadoEm)} {horaUTC(linha.criadoEm)}
            </time>
          </div>
          <p className="font-texto text-sm leading-relaxed text-tinta">
            {descreverMudanca(linha)}
          </p>
          <p className="mt-1 font-codigo text-xs text-grafite">
            {linha.autorEmail}
          </p>
        </li>
      ))}
    </ul>
  );
}
