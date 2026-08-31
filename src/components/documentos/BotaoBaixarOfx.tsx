// Server component. Nunca vira link morto: quando `bloqueado`, e um <span>
// desabilitado (com o motivo em `title` e visivel ao lado), nao um <a> que
// levaria a uma rota que responde 403.

const ICONE_BAIXAR = (
  <svg
    aria-hidden="true"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth={1.75}
    strokeLinecap="round"
    strokeLinejoin="round"
    className="h-4 w-4 shrink-0"
  >
    <path d="M12 3v12" />
    <path d="m7 12 5 5 5-5" />
    <path d="M5 21h14" />
  </svg>
);

export function BotaoBaixarOfx({
  href,
  bloqueado,
  motivo,
}: {
  href: string;
  bloqueado: boolean;
  motivo?: string | null;
}) {
  if (bloqueado) {
    return (
      <span className="inline-flex flex-wrap items-center gap-x-3 gap-y-1.5">
        <span
          aria-disabled="true"
          title={motivo ?? undefined}
          className="inline-flex cursor-not-allowed items-center gap-2 rounded bg-grafite/20 px-4 py-2 font-texto text-sm font-semibold text-grafite"
        >
          {ICONE_BAIXAR}
          Baixar OFX
        </span>
        {motivo ? (
          <span className="font-texto text-xs text-grafite">{motivo}</span>
        ) : null}
      </span>
    );
  }

  return (
    <a
      href={href}
      download
      className="inline-flex items-center gap-2 rounded bg-petroleo px-4 py-2 font-texto text-sm font-semibold text-nevoa transition-colors hover:bg-turquesa focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-petroleo motion-reduce:transition-none"
    >
      {ICONE_BAIXAR}
      Baixar OFX
    </a>
  );
}
