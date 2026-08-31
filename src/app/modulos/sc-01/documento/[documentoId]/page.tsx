import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { obterSessao } from "@/lib/sessao-servidor";
import { sair } from "@/lib/sessao-acoes";
import { CabecalhoPortal } from "@/components/CabecalhoPortal";
import { filtrarModulosVisiveis, obterModulo } from "@/lib/modulos-catalogo";
import { obterDocumentoComLancamentos } from "@/lib/documentos/consultas-sc01";
import { processarUm } from "@/lib/documentos/acoes-sc01";
import { BadgeStatusDocumento } from "@/components/documentos/BadgeStatusDocumento";
import { BotaoProcessar } from "@/components/documentos/BotaoProcessar";
import { BotaoBaixarOfx } from "@/components/documentos/BotaoBaixarOfx";
import { PainelLancamentos } from "@/components/documentos/PainelLancamentos";

export default async function PaginaDocumentoSc01({
  params,
}: {
  params: Promise<{ documentoId: string }>;
}) {
  const sessao = await obterSessao();
  if (!sessao) {
    redirect("/login");
  }

  const modulo = obterModulo("SC-01");
  const podeVer =
    modulo !== undefined &&
    filtrarModulosVisiveis(sessao.papel, sessao.setor).some(
      (m) => m.codigo === "SC-01",
    );
  if (!modulo || !podeVer) {
    redirect("/");
  }

  const { documentoId } = await params;
  const documento = await obterDocumentoComLancamentos(documentoId);
  if (!documento) {
    notFound();
  }

  const rotuloConta = documento.conta
    ? `${documento.conta.bancoNome} — ag ${documento.conta.agencia} c/c ${documento.conta.numero}`
    : "Sem conta bancária associada a este documento";

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
            href="/modulos/sc-01"
            className="font-texto text-sm text-turquesa hover:underline"
          >
            ← Voltar para o SC-01
          </Link>
          <div className="mt-3 flex flex-wrap items-start justify-between gap-x-4 gap-y-2">
            <div>
              <span className="font-codigo text-xs uppercase tracking-wide text-grafite">
                Documento · {documento.cliente.razaoSocial}
              </span>
              <h1 className="font-titulo text-2xl font-bold text-tinta">
                {documento.nomeArquivo}
              </h1>
              <p className="mt-1 font-texto text-sm text-grafite">
                {rotuloConta}
              </p>
            </div>
            <BadgeStatusDocumento status={documento.status} />
          </div>
        </div>

        {documento.status === "PENDENTE" ? (
          <section className="flex flex-col gap-2">
            <BotaoProcessar
              acao={processarUm}
              rotulo="Processar este documento"
              documentoId={documento.id}
            />
            <p className="max-w-prose font-texto text-xs text-grafite">
              A IA lê este extrato e lista os lançamentos abaixo. O resultado
              também entra no histórico do módulo.
            </p>
          </section>
        ) : null}

        <PainelLancamentos documento={documento} />

        <section>
          <div className="mb-3">
            <h2 className="font-titulo text-lg font-bold text-tinta">
              Arquivo OFX
            </h2>
            <p className="mt-1 max-w-prose font-texto text-sm text-grafite">
              Libera quando o documento está processado e todas as linhas foram
              conferidas. Um <code className="font-codigo">STMTTRN</code> por
              lançamento.
            </p>
          </div>
          <BotaoBaixarOfx
            href={`/modulos/sc-01/documento/${documento.id}/ofx`}
            bloqueado={!documento.podeBaixarOfx}
            motivo={documento.motivoBloqueio}
          />
        </section>
      </main>
    </>
  );
}
