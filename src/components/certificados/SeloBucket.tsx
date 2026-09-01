import { ROTULO_BUCKET, type Bucket } from "@/lib/certificados/bucket";

// Fundo suave + texto no tom + anel interno, so tokens da paleta
// SheepContabil. Carmim e reservado a erro/urgencia terminal (VENCIDO e
// D3 — "confirme com o cliente hoje"); ambar para D7; turquesa para D60;
// grafite para RENOVADO e OK.
const CLASSE_POR_BUCKET: Record<Bucket, string> = {
  VENCIDO: "bg-carmim/15 text-carmim ring-carmim/30",
  D3: "bg-carmim/10 text-carmim ring-carmim/25",
  D7: "bg-ambar/15 text-ambar ring-ambar/35",
  D60: "bg-turquesa/10 text-turquesa ring-turquesa/25",
  RENOVADO: "bg-grafite/10 text-grafite ring-grafite/25",
  OK: "bg-grafite/10 text-grafite ring-grafite/25",
};

export function SeloBucket({ bucket }: { bucket: Bucket }) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 font-texto text-xs font-medium leading-none ring-1 ring-inset ${CLASSE_POR_BUCKET[bucket]}`}
    >
      <span
        aria-hidden="true"
        className="h-1.5 w-1.5 shrink-0 rounded-full bg-current"
      />
      {ROTULO_BUCKET[bucket]}
    </span>
  );
}
