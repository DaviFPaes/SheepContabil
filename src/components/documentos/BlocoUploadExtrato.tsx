"use client";

export type ClienteOpcao = { id: string; razaoSocial: string };
export type ContaOpcao = { id: string; rotulo: string };

export type BlocoValor = {
  clienteId: string;
  contaBancariaId: string;
  nomeArquivo: string | null;
  deteccao: "idle" | "lendo" | "ok" | "manual";
};

// Recorte de campo herdado do antigo FormularioUploadDocumento (SC-01).
const CAMPO =
  "rounded border border-grafite/40 bg-white px-3 py-2 text-sm text-tinta outline-none transition-colors focus:border-turquesa focus:ring-2 focus:ring-turquesa/20 disabled:cursor-not-allowed disabled:bg-nevoa/60 disabled:text-grafite motion-reduce:transition-none";

const ROTULO = "flex flex-col gap-1.5 font-texto text-sm";
const ROTULO_TEXTO = "font-medium text-grafite";

// A cor do fio à esquerda do cartão acompanha o estado da detecção — leitura
// periférica do que o arquivo já disse sobre si mesmo.
const ACENTO: Record<BlocoValor["deteccao"], string> = {
  idle: "border-l-grafite/30",
  lendo: "border-l-turquesa",
  ok: "border-l-turquesa",
  manual: "border-l-ambar",
};

export function BlocoUploadExtrato({
  indice,
  clientes,
  contasPorCliente,
  valor,
  aoMudar,
  aoArquivo,
  aoRemover,
  erro,
}: {
  indice: number;
  clientes: ClienteOpcao[];
  contasPorCliente: Record<string, ContaOpcao[]>;
  valor: BlocoValor;
  aoMudar: (patch: Partial<BlocoValor>) => void;
  aoArquivo: (file: File) => void;
  aoRemover?: () => void;
  erro?: string;
}) {
  const contas = valor.clienteId ? (contasPorCliente[valor.clienteId] ?? []) : [];
  const idArquivo = `bloco-${indice}-arquivo`;
  const idCliente = `bloco-${indice}-cliente`;
  const idBanco = `bloco-${indice}-banco`;

  return (
    <div
      className={`relative rounded-lg border border-l-2 border-grafite/25 bg-white p-4 font-texto ${ACENTO[valor.deteccao]}`}
    >
      <div className="mb-3 flex items-center justify-between gap-3">
        <span className="font-titulo text-xs font-bold uppercase tracking-wide text-grafite">
          Extrato {indice + 1}
        </span>
        {aoRemover ? (
          <button
            type="button"
            onClick={aoRemover}
            aria-label={`Remover extrato ${indice + 1}`}
            className="-mr-1 -mt-1 rounded p-1 text-grafite transition-colors hover:bg-carmim/10 hover:text-carmim focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-petroleo motion-reduce:transition-none"
          >
            <svg
              aria-hidden="true"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth={1.75}
              strokeLinecap="round"
              className="h-4 w-4"
            >
              <path d="m6 6 12 12M18 6 6 18" />
            </svg>
          </button>
        ) : null}
      </div>

      <div className="flex flex-col gap-4">
        <label className={ROTULO} htmlFor={idArquivo}>
          <span className={ROTULO_TEXTO}>Extrato (PDF, JPG ou PNG)</span>
          <input
            id={idArquivo}
            name={`arquivo-${indice}`}
            type="file"
            accept="application/pdf,image/jpeg,image/png"
            onChange={(evento) => {
              const arquivo = evento.target.files?.[0];
              if (arquivo) aoArquivo(arquivo);
            }}
            className={`${CAMPO} py-1.5 file:mr-3 file:rounded file:border-0 file:bg-nevoa file:px-3 file:py-1.5 file:font-texto file:text-xs file:font-semibold file:text-petroleo hover:file:bg-turquesa/15`}
          />
        </label>

        <EstadoDeteccao deteccao={valor.deteccao} />

        {valor.nomeArquivo ? (
          <p className="flex items-center gap-1.5 text-grafite">
            <svg
              aria-hidden="true"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth={1.75}
              strokeLinecap="round"
              strokeLinejoin="round"
              className="h-3.5 w-3.5 shrink-0"
            >
              <path d="M21.44 11.05 12.25 20.24a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48" />
            </svg>
            <span className="font-codigo text-xs">{valor.nomeArquivo}</span>
          </p>
        ) : null}

        <div className="grid gap-4 sm:grid-cols-2">
          <label className={ROTULO} htmlFor={idCliente}>
            <span className={ROTULO_TEXTO}>Cliente</span>
            <select
              id={idCliente}
              value={valor.clienteId}
              onChange={(evento) =>
                aoMudar({ clienteId: evento.target.value, contaBancariaId: "" })
              }
              className={CAMPO}
            >
              <option value="">Selecione o cliente…</option>
              {clientes.map((cliente) => (
                <option key={cliente.id} value={cliente.id}>
                  {cliente.razaoSocial}
                </option>
              ))}
            </select>
          </label>

          <label className={ROTULO} htmlFor={idBanco}>
            <span className={ROTULO_TEXTO}>Banco</span>
            <select
              id={idBanco}
              value={valor.contaBancariaId}
              disabled={!valor.clienteId}
              onChange={(evento) => aoMudar({ contaBancariaId: evento.target.value })}
              className={CAMPO}
            >
              <option value="">
                {!valor.clienteId
                  ? "Escolha o cliente primeiro"
                  : contas.length === 0
                    ? "Nenhuma conta cadastrada"
                    : "Selecione a conta…"}
              </option>
              {contas.map((conta) => (
                <option key={conta.id} value={conta.id}>
                  {conta.rotulo}
                </option>
              ))}
            </select>
          </label>
        </div>

        {erro ? (
          <p
            role="alert"
            className="flex items-start gap-1.5 rounded border border-carmim/30 bg-carmim/10 px-2.5 py-1.5 text-xs text-carmim"
          >
            <svg
              aria-hidden="true"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth={1.75}
              strokeLinecap="round"
              strokeLinejoin="round"
              className="mt-0.5 h-3.5 w-3.5 shrink-0"
            >
              <path d="M12 9v4M12 17h.01M10.3 3.9 2.4 18a2 2 0 0 0 1.7 3h15.8a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0Z" />
            </svg>
            {erro}
          </p>
        ) : null}
      </div>
    </div>
  );
}

function EstadoDeteccao({ deteccao }: { deteccao: BlocoValor["deteccao"] }) {
  if (deteccao === "idle") return null;

  if (deteccao === "lendo") {
    return (
      <p className="flex items-center gap-2 text-xs text-grafite">
        <svg
          aria-hidden="true"
          viewBox="0 0 24 24"
          fill="none"
          className="h-3.5 w-3.5 shrink-0 animate-spin text-turquesa motion-reduce:animate-none"
        >
          <circle cx="12" cy="12" r="9" stroke="currentColor" strokeOpacity="0.3" strokeWidth="3" />
          <path d="M21 12a9 9 0 0 0-9-9" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
        </svg>
        Identificando…
      </p>
    );
  }

  if (deteccao === "ok") {
    return (
      <p className="flex items-center gap-1.5 text-xs font-medium text-turquesa">
        <svg
          aria-hidden="true"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth={1.75}
          strokeLinecap="round"
          strokeLinejoin="round"
          className="h-3.5 w-3.5 shrink-0"
        >
          <path d="M20 6 9 17l-5-5" />
        </svg>
        Identificado pelo arquivo
      </p>
    );
  }

  return (
    <p className="flex items-center gap-1.5 text-xs font-medium text-ambar">
      <svg
        aria-hidden="true"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth={1.75}
        strokeLinecap="round"
        strokeLinejoin="round"
        className="h-3.5 w-3.5 shrink-0"
      >
        <path d="M12 9v4M12 17h.01M10.3 3.9 2.4 18a2 2 0 0 0 1.7 3h15.8a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0Z" />
      </svg>
      Não identifiquei — selecione na mão
    </p>
  );
}
