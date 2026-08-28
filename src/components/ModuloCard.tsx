import Link from "next/link";
import type { ModuloCatalogo } from "@/lib/modulos-catalogo";
import { NOMES_NATUREZA } from "@/lib/modulos-catalogo";

export function ModuloCard({ modulo }: { modulo: ModuloCatalogo }) {
  return (
    <Link
      href={`/modulos/${modulo.codigo.toLowerCase()}`}
      className="flex flex-col gap-2 rounded-lg border border-grafite/20 bg-white p-5 shadow-sm transition hover:border-turquesa hover:shadow-md"
    >
      <span className="font-codigo text-xs uppercase tracking-wide text-grafite">
        {modulo.codigo}
      </span>
      <span className="font-titulo text-base font-bold text-tinta">
        {modulo.nome}
      </span>
      <span className="font-texto text-sm text-grafite">
        {modulo.descricao}
      </span>
      <span className="mt-2 inline-block w-fit rounded-full bg-turquesa/10 px-3 py-1 font-texto text-xs font-medium text-turquesa">
        {NOMES_NATUREZA[modulo.natureza]}
      </span>
    </Link>
  );
}
