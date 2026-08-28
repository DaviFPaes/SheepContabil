import Link from "next/link";
import type { ReactNode } from "react";
import type { ModuloCatalogo } from "@/lib/modulos-catalogo";
import { NOMES_NATUREZA } from "@/lib/modulos-catalogo";
import { HistoricoExecucoes } from "@/components/HistoricoExecucoes";
import type { ExecucaoRegistrada } from "@/lib/execucao";

export function ModuloPageLayout({
  modulo,
  execucoes,
  acoes,
  conteudo,
}: {
  modulo: ModuloCatalogo;
  execucoes: ExecucaoRegistrada[];
  acoes?: ReactNode;
  conteudo?: ReactNode;
}) {
  return (
    <main className="mx-auto flex max-w-4xl flex-col gap-8 px-6 py-10">
      <div>
        <Link
          href="/"
          className="font-texto text-sm text-turquesa hover:underline"
        >
          ← Voltar para a home
        </Link>
        <div className="mt-3 flex items-center justify-between">
          <div>
            <span className="font-codigo text-xs uppercase tracking-wide text-grafite">
              {modulo.codigo}
            </span>
            <h1 className="font-titulo text-2xl font-bold text-tinta">
              {modulo.nome}
            </h1>
            <p className="mt-1 font-texto text-sm text-grafite">
              {modulo.descricao}
            </p>
          </div>
          <span className="rounded-full bg-turquesa/10 px-3 py-1 font-texto text-xs font-medium text-turquesa">
            {NOMES_NATUREZA[modulo.natureza]}
          </span>
        </div>
      </div>

      {acoes ? (
        <section className="flex flex-wrap gap-3">{acoes}</section>
      ) : null}

      {conteudo}

      <section>
        <h2 className="mb-3 font-titulo text-lg font-bold text-tinta">
          Histórico de execução
        </h2>
        <HistoricoExecucoes execucoes={execucoes} />
      </section>
    </main>
  );
}
