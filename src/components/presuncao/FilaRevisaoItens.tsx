import type { ItemDetalhe } from "@/lib/presuncao/consultas-sc11";
import { LinhaRevisaoItem } from "./LinhaRevisaoItem";

export function FilaRevisaoItens({ itens }: { itens: ItemDetalhe[] }) {
  const pendentes = itens.filter((item) => item.status === "PENDENTE_REVISAO");
  if (pendentes.length === 0) return null;

  return (
    <section className="flex flex-col gap-3">
      <h2 className="flex items-center gap-2 font-titulo text-lg font-bold text-tinta">
        Conferência
        <span className="inline-flex items-center rounded-full bg-ambar/15 px-2 py-0.5 font-codigo text-xs font-medium leading-none tabular-nums text-ambar ring-1 ring-inset ring-ambar/35">
          {pendentes.length}
        </span>
      </h2>
      <p className="font-texto text-sm text-grafite">
        Revise os itens de baixa confiança da IA antes de liberar o relatório.
      </p>
      <div className="flex flex-col gap-3">
        {pendentes.map((item) => (
          <LinhaRevisaoItem key={item.id} item={item} />
        ))}
      </div>
    </section>
  );
}
