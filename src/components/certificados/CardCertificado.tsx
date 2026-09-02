import type { CertificadoLinha } from "@/lib/certificados/consultas";
import { textoDias } from "@/lib/certificados/bucket";
import { estadoContato } from "@/lib/certificados/contato";
import { formatarDataUTC } from "@/lib/certificados/formato";
import { SpecularButton } from "@/components/ui/SpecularButton";

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

function textoAvisado(data: Date, hoje: Date): string {
  const d = diasDesde(data, hoje);
  return d === 0 ? "Avisado hoje" : `Avisado há ${d}d`;
}

// Selo de status do contato, no rodapé do card.
function selo(linha: CertificadoLinha, hoje: Date): { texto: string; tom: "ok" | "erro" | "espera" | "neutro" } | null {
  const estado = estadoContato(linha);
  if (estado === "falhou") return { texto: "Envio falhou", tom: "erro" };
  if (estado === "avisado") {
    if (linha.bucket === "D3" && linha.avisoD3Em) {
      return { texto: textoAvisado(linha.avisoD3Em, hoje), tom: "ok" };
    }
    const aviso = linha.bucket === "D7" ? linha.avisoD7 : linha.avisoD60;
    return {
      texto: aviso?.enviadoEm ? textoAvisado(aviso.enviadoEm, hoje) : "Avisado",
      tom: "ok",
    };
  }
  if (estado === "pendente") {
    return {
      texto: linha.bucket === "D3" ? "Sem aviso ainda" : "Aguardando contato",
      tom: "espera",
    };
  }
  if (linha.bucket === "RENOVADO") return { texto: "Renovado", tom: "neutro" };
  return null;
}

const CLASSE_SELO: Record<"ok" | "erro" | "espera" | "neutro", string> = {
  ok: "bg-turquesa/10 text-turquesa ring-turquesa/20",
  erro: "bg-carmim/10 text-carmim ring-carmim/30",
  espera: "bg-tinta/10 text-tinta ring-tinta/10",
  neutro: "bg-grafite/10 text-grafite ring-grafite/20",
};

export function CardCertificado({
  linha,
  aoAbrir,
  acao,
  aoRenovar,
  aoAvisar,
  hoje = new Date(),
}: {
  linha: CertificadoLinha;
  aoAbrir: (clienteId: string) => void;
  acao?: "renovar" | "avisar";
  aoRenovar?: (certificado: CertificadoLinha) => void;
  aoAvisar?: (certificado: CertificadoLinha) => void;
  hoje?: Date;
}) {
  const estado = estadoContato(linha);
  const emAmbar = estado === "pendente" || estado === "falhou";
  const s = selo(linha, hoje);

  const fundo =
    estado === "falhou"
      ? "bg-ambar border-carmim/50"
      : estado === "pendente"
        ? "bg-ambar border-ambar/70"
        : estado === "avisado"
          ? "bg-nevoa border-grafite/25"
          : "bg-white border-grafite/20";

  const textoSecundario = emAmbar ? "text-tinta/70" : "text-grafite";

  return (
    <article
      className={`relative rounded-lg border shadow-sm transition-shadow hover:shadow-md motion-reduce:transition-none ${fundo}`}
    >
      <button
        type="button"
        onClick={() => aoAbrir(linha.clienteId)}
        aria-label={`Abrir perfil de ${linha.razaoSocial}`}
        className="absolute inset-0 rounded-lg focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-petroleo"
      />

      <div className="pointer-events-none relative flex flex-col gap-2 p-3">
        <div className="flex items-start justify-between gap-2">
          <span className="font-titulo text-sm font-bold leading-tight text-tinta">
            {linha.razaoSocial}
          </span>
          {estado === "falhou" ? (
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

        <div className={`flex flex-wrap items-center gap-x-2 gap-y-1 font-texto text-xs ${textoSecundario}`}>
          <span>{ROTULO_TIPO[linha.tipo]}</span>
          <span aria-hidden="true">·</span>
          <span className="truncate">{linha.titular}</span>
        </div>

        <div className="flex items-center justify-between gap-2">
          <time
            dateTime={linha.dataValidade.toISOString().slice(0, 10)}
            className={`font-codigo text-xs tabular-nums ${textoSecundario}`}
          >
            {formatarDataUTC(linha.dataValidade)}
          </time>
          <span
            className={`font-codigo text-xs font-medium tabular-nums ${
              linha.bucket === "VENCIDO" ? "text-carmim" : "text-tinta"
            }`}
          >
            {textoDias(linha.diasRestantes)}
          </span>
        </div>

        {s ? (
          <span
            className={`inline-flex w-fit rounded-full px-2 py-0.5 font-texto text-[11px] font-medium leading-none ring-1 ring-inset ${CLASSE_SELO[s.tom]}`}
          >
            {s.texto}
          </span>
        ) : null}

        {acao === "renovar" && aoRenovar ? (
          <div className="pointer-events-auto pt-0.5">
            <SpecularButton
              variante="primario"
              tamanho="sm"
              className="w-full"
              onClick={() => aoRenovar(linha)}
            >
              Renovar certificado
            </SpecularButton>
          </div>
        ) : null}

        {acao === "avisar" ? (
          <div className="pointer-events-auto pt-0.5">
            {estado === "avisado" ? (
              <span className="flex items-center justify-center gap-1.5 rounded-md bg-turquesa/10 py-1.5 font-texto text-xs font-semibold text-turquesa">
                <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" className="h-3.5 w-3.5">
                  <path d="m5 13 4 4L19 7" />
                </svg>
                Cliente avisado
              </span>
            ) : aoAvisar ? (
              <SpecularButton
                variante="primario"
                tamanho="sm"
                className="w-full"
                onClick={() => aoAvisar(linha)}
              >
                Avisar cliente
              </SpecularButton>
            ) : null}
          </div>
        ) : null}
      </div>
    </article>
  );
}
