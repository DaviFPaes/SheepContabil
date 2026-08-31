import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { obterSessao } from "@/lib/sessao-servidor";
import { sair } from "@/lib/sessao-acoes";
import { CabecalhoPortal } from "@/components/CabecalhoPortal";
import { filtrarModulosVisiveis, obterModulo } from "@/lib/modulos-catalogo";
import { obterNotaComItens } from "@/lib/presuncao/consultas-sc11";
import { processarUma } from "@/lib/presuncao/acoes-sc11";
import { formatarDataUTC } from "@/lib/presuncao/formato-presuncao";
import { BadgeStatusDocumento } from "@/components/documentos/BadgeStatusDocumento";
import { BotaoProcessar } from "@/components/documentos/BotaoProcessar";
import { FilaRevisaoItens } from "@/components/presuncao/FilaRevisaoItens";
import { PainelItens } from "@/components/presuncao/PainelItens";
import { BotaoBaixarRelatorio } from "@/components/presuncao/BotaoBaixarRelatorio";

export default async function PaginaNotaSc11({
  params,
}: {
  params: Promise<{ documentoId: string }>;
}) {
  const sessao = await obterSessao();
  if (!sessao) {
    redirect("/login");
  }

  const modulo = obterModulo("SC-11");
  const podeVer =
    modulo !== undefined &&
    filtrarModulosVisiveis(sessao.papel, sessao.setor).some(
      (m) => m.codigo === "SC-11",
    );
  if (!modulo || !podeVer) {
    redirect("/");
  }

  const { documentoId } = await params;
  const nota = await obterNotaComItens(documentoId);
  if (!nota) {
    notFound();
  }

  return (
    <>
      <CabecalhoPortal
        nomeUsuario={sessao.nome}
        papel={sessao.papel}
        acaoSair={
          <form action={sair}>
            <button className="font-texto text-sm underline underline-offset-2">
              Sair
            </button>
          </form>
        }
      />
      <main className="mx-auto flex max-w-4xl flex-col gap-8 px-6 py-10">
        <div>
          <Link
            href="/modulos/sc-11"
            className="font-texto text-sm text-turquesa hover:underline"
          >
            ← Voltar
          </Link>
          <div className="mt-3 flex flex-wrap items-start justify-between gap-x-4 gap-y-2">
            <div>
              <span className="font-codigo text-xs uppercase tracking-wide text-grafite">
                Nota · {nota.clienteRazaoSocial}
              </span>
              <h1 className="font-titulo text-2xl font-bold text-tinta">
                {nota.numero ? `Nota nº ${nota.numero}` : nota.nomeArquivo}
              </h1>
              {nota.dataEmissao ? (
                <p className="mt-1 font-texto text-sm text-grafite">
                  Emitida em {formatarDataUTC(nota.dataEmissao)}
                </p>
              ) : null}
            </div>
            <BadgeStatusDocumento status={nota.status} />
          </div>
        </div>

        {nota.status === "PENDENTE" ? (
          <section className="flex flex-col gap-2">
            <BotaoProcessar
              acao={processarUma}
              rotulo="Processar agora"
              documentoId={nota.documentoId}
            />
            <p className="max-w-prose font-texto text-xs text-grafite">
              A IA classifica cada item desta nota na base de presunção e lista o
              resultado abaixo. A execução também entra no histórico do módulo.
            </p>
          </section>
        ) : null}

        {nota.status === "ERRO" ? (
          <section className="flex flex-col gap-3">
            <div className="rounded-lg bg-carmim/10 px-4 py-3 font-texto text-sm text-carmim">
              {nota.erro ?? "Falha ao processar a nota."}
            </div>
            <BotaoProcessar
              acao={processarUma}
              rotulo="Reprocessar"
              documentoId={nota.documentoId}
            />
          </section>
        ) : null}

        {nota.status === "PROCESSADO" ? (
          <>
            <FilaRevisaoItens itens={nota.itens} />
            <PainelItens itens={nota.itens} consolidado={nota.consolidado} />
            <section>
              <div className="mb-3">
                <h2 className="font-titulo text-lg font-bold text-tinta">
                  Relatório de presunção
                </h2>
                <p className="mt-1 max-w-prose font-texto text-sm text-grafite">
                  Libera quando todos os itens em conferência forem confirmados.
                  Uma linha por item e os totais por base (8% / 32%).
                </p>
              </div>
              <BotaoBaixarRelatorio
                href={`/modulos/sc-11/nota/${nota.documentoId}/relatorio`}
                bloqueado={!nota.podeExportar}
                motivo={nota.motivoBloqueio}
              />
            </section>
          </>
        ) : null}
      </main>
    </>
  );
}
