import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { obterSessao } from "@/lib/sessao-servidor";
import { sair } from "@/lib/sessao-acoes";
import { CabecalhoPortal } from "@/components/CabecalhoPortal";
import { VeuAtmosferico } from "@/components/VeuAtmosferico";
import { filtrarModulosVisiveis, obterModulo } from "@/lib/modulos-catalogo";
import { obterDocumentoComLancamentos } from "@/lib/documentos/consultas-sc01";
import { reprocessarDocumento } from "@/lib/documentos/acoes-sc01";
import { BadgeStatusDocumento } from "@/components/documentos/BadgeStatusDocumento";
import { BotaoProcessar } from "@/components/documentos/BotaoProcessar";
import { BotaoBaixarOfx } from "@/components/documentos/BotaoBaixarOfx";
import { PainelLancamentos } from "@/components/documentos/PainelLancamentos";
import { VisualizadorArquivo } from "@/components/documentos/VisualizadorArquivo";

export default async function PaginaDocumentoSc01({
  params,
}: {
  params: Promise<{ documentoId: string }>;
}) {
  const sessao = await obterSessao();
  if (!sessao) redirect("/login");
  const modulo = obterModulo("SC-01");
  const podeVer =
    modulo !== undefined &&
    filtrarModulosVisiveis(sessao.papel, sessao.setor).some((m) => m.codigo === "SC-01");
  if (!modulo || !podeVer) redirect("/");

  const { documentoId } = await params;
  const documento = await obterDocumentoComLancamentos(documentoId);
  if (!documento) notFound();

  const rotuloConta = documento.conta
    ? `${documento.conta.bancoNome} — ag ${documento.conta.agencia} c/c ${documento.conta.numero}`
    : "Sem conta bancária associada";

  return (
    <div className="relative min-h-screen overflow-hidden bg-tinta text-nevoa">
      <VeuAtmosferico />
      <CabecalhoPortal
        nomeUsuario={sessao.nome}
        papel={sessao.papel}
        acaoSair={
          <form action={sair}>
            <button className="rounded-full border border-nevoa/25 px-3.5 py-1.5 font-texto text-sm text-nevoa/85 transition hover:border-nevoa/60 hover:bg-white/5 hover:text-nevoa">
              Sair
            </button>
          </form>
        }
      />
      <main className="mx-auto max-w-[88rem] px-6 pb-20">
        <section className="animate-entrada pt-12 pb-8">
          <Link
            href="/modulos/sc-01"
            className="font-codigo text-[11px] font-medium uppercase tracking-[0.28em] text-turquesa hover:underline"
          >
            ← SC-01 · Extrato bancário
          </Link>
          <div className="mt-4 flex flex-wrap items-start justify-between gap-4">
            <div>
              <h1 className="font-titulo text-2xl font-extrabold leading-tight text-nevoa sm:text-3xl">
                {documento.nomeArquivo}
              </h1>
              <p className="mt-2 font-texto text-sm text-nevoa/70">
                {documento.cliente.razaoSocial} · {rotuloConta}
              </p>
            </div>
            <BadgeStatusDocumento status={documento.status} />
          </div>
        </section>

        <section className="pb-4">
          <div className="grid gap-6 rounded-2xl border border-white/15 bg-nevoa/95 p-4 shadow-[0_24px_70px_-15px_rgba(11,26,32,0.65)] backdrop-blur-xl sm:p-6 lg:grid-cols-2">
            <div className="lg:sticky lg:top-6 lg:self-start">
              <h2 className="mb-3 font-titulo text-lg font-bold text-tinta">Extrato original</h2>
              <VisualizadorArquivo
                src={`/modulos/sc-01/documento/${documento.id}/arquivo`}
                mimeType={documento.mimeType}
                nomeArquivo={documento.nomeArquivo}
              />
            </div>

            <div className="flex flex-col gap-8">
              {documento.status === "PENDENTE" || documento.status === "ERRO" ? (
                <BotaoProcessar
                  acao={reprocessarDocumento}
                  rotulo="Reprocessar"
                  documentoId={documento.id}
                />
              ) : null}

              <PainelLancamentos documento={documento} />

              <section>
                <h2 className="mb-3 font-titulo text-lg font-bold text-tinta">Arquivo OFX</h2>
                <BotaoBaixarOfx
                  href={`/modulos/sc-01/documento/${documento.id}/ofx`}
                  bloqueado={!documento.podeBaixarOfx}
                  motivo={documento.motivoBloqueio}
                />
              </section>
            </div>
          </div>
        </section>
      </main>

      <footer className="mx-auto max-w-[88rem] border-t border-white/10 px-6 py-6">
        <p className="font-codigo text-[10px] uppercase tracking-[0.28em] text-nevoa/40">
          Acesso restrito · SheepContabil
        </p>
      </footer>
    </div>
  );
}
