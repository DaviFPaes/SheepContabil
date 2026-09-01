import type { DocumentoResumo } from "@/lib/documentos/consultas-sc01";

type StatusDocumento = DocumentoResumo["status"];

const ROTULO: Record<StatusDocumento, string> = {
  PENDENTE: "Pendente",
  PROCESSADO: "Processado",
  ERRO: "Erro",
};

// Mesmo idioma do SeloBucket (SC-20): fundo suave + texto no tom + anel
// interno. So tokens da paleta. Ambar = ainda na fila; turquesa = pronto;
// carmim = falhou.
const CLASSE: Record<StatusDocumento, string> = {
  PENDENTE: "bg-ambar/15 text-ambar ring-ambar/35",
  PROCESSADO: "bg-turquesa/10 text-turquesa ring-turquesa/25",
  ERRO: "bg-carmim/15 text-carmim ring-carmim/30",
};

export function BadgeStatusDocumento({ status }: { status: StatusDocumento }) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 font-texto text-xs font-medium leading-none ring-1 ring-inset ${CLASSE[status]}`}
    >
      <span
        aria-hidden="true"
        className="h-1.5 w-1.5 shrink-0 rounded-full bg-current"
      />
      {ROTULO[status]}
    </span>
  );
}
