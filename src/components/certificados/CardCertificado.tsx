import type { CertificadoLinha } from "@/lib/certificados/consultas";
import { textoDias, ROTULO_BUCKET } from "@/lib/certificados/bucket";
import { formatarDataUTC } from "@/lib/certificados/formato";

const ROTULO_TIPO: Record<CertificadoLinha["tipo"], string> = {
  ECNPJ: "e-CNPJ",
  ECPF: "e-CPF",
  NFE: "NF-e",
};

function diasDesde(data: Date, hoje: Date): number {
  const DIA = 24 * 60 * 60 * 1000;
  return Math.max(
    0,
    Math.round(
      (Date.UTC(hoje.getUTCFullYear(), hoje.getUTCMonth(), hoje.getUTCDate()) -
        Date.UTC(data.getUTCFullYear(), data.getUTCMonth(), data.getUTCDate())) /
        DIA,
    ),
  );
}

function seloAviso(
  linha: CertificadoLinha,
  hoje: Date,
): { texto: string; erro: boolean } | null {
  const aviso = linha.bucket === "D7" ? linha.avisoD7 : linha.bucket === "D60" ? linha.avisoD60 : null;
  if (!aviso) return null;
  if (aviso.status === "BOUNCED" || aviso.status === "FAILED") {
    return { texto: "Envio falhou", erro: true };
  }
  if (aviso.status === "SENT" || aviso.status === "DELIVERED") {
    const d = aviso.enviadoEm ? diasDesde(aviso.enviadoEm, hoje) : 0;
    return { texto: d === 0 ? "Avisado hoje" : `Avisado há ${d}d`, erro: false };
  }
  return { texto: "Aguardando", erro: false };
}

export function CardCertificado({
  linha,
  aoAbrir,
  hoje = new Date(),
}: {
  linha: CertificadoLinha;
  aoAbrir: (clienteId: string) => void;
  hoje?: Date;
}) {
  const selo = seloAviso(linha, hoje);

  return (
    <button
      type="button"
      onClick={() => aoAbrir(linha.clienteId)}
      className="flex w-full flex-col gap-2 rounded-lg border border-grafite/20 bg-white p-3 text-left shadow-sm transition-shadow hover:shadow-md focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-petroleo motion-reduce:transition-none"
    >
      <div className="flex items-start justify-between gap-2">
        <span className="font-titulo text-sm font-bold leading-tight text-tinta">
          {linha.razaoSocial}
        </span>
        {selo?.erro ? (
          <svg
            aria-label="Falha no envio do aviso"
            role="img"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth={1.75}
            strokeLinecap="round"
            className="mt-0.5 h-4 w-4 shrink-0 text-carmim"
          >
            <path d="M12 9v4M12 17h.01M10.3 3.9 2.4 18a2 2 0 0 0 1.7 3h15.8a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0Z" />
          </svg>
        ) : null}
      </div>

      <div className="flex flex-wrap items-center gap-x-2 gap-y-1 font-texto text-xs text-grafite">
        <span>{ROTULO_TIPO[linha.tipo]}</span>
        <span aria-hidden="true">·</span>
        <span className="truncate">{linha.titular}</span>
      </div>

      <div className="flex items-center justify-between gap-2">
        <time
          dateTime={linha.dataValidade.toISOString().slice(0, 10)}
          className="font-codigo text-xs tabular-nums text-grafite"
        >
          {formatarDataUTC(linha.dataValidade)}
        </time>
        <span className="font-codigo text-xs font-medium tabular-nums text-tinta">
          {textoDias(linha.diasRestantes)}
        </span>
      </div>

      {selo ? (
        <span
          className={`inline-flex w-fit rounded-full px-2 py-0.5 font-texto text-[11px] font-medium leading-none ${
            selo.erro
              ? "bg-carmim/10 text-carmim ring-1 ring-inset ring-carmim/25"
              : "bg-turquesa/10 text-turquesa ring-1 ring-inset ring-turquesa/20"
          }`}
        >
          {selo.texto}
        </span>
      ) : linha.bucket === "RENOVADO" ? (
        <span className="inline-flex w-fit rounded-full bg-grafite/10 px-2 py-0.5 font-texto text-[11px] font-medium leading-none text-grafite">
          {ROTULO_BUCKET.RENOVADO}
        </span>
      ) : null}
    </button>
  );
}
