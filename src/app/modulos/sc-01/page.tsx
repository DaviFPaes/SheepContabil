import Link from "next/link";
import { redirect } from "next/navigation";
import { obterSessao } from "@/lib/sessao-servidor";
import { sair } from "@/lib/sessao-acoes";
import { CabecalhoPortal } from "@/components/CabecalhoPortal";
import { VeuAtmosferico } from "@/components/VeuAtmosferico";
import { HistoricoExecucoes } from "@/components/HistoricoExecucoes";
import { filtrarModulosVisiveis, obterModulo } from "@/lib/modulos-catalogo";
import { listarHistorico } from "@/lib/execucao";
import {
  listarClientesParaUpload,
  listarContasDoCliente,
  listarDocumentos,
} from "@/lib/documentos/consultas-sc01";
import { processarPendentes } from "@/lib/documentos/acoes-sc01";
import { FormularioUploadDocumento } from "@/components/documentos/FormularioUploadDocumento";
import { TabelaDocumentos } from "@/components/documentos/TabelaDocumentos";
import { BotaoProcessar } from "@/components/documentos/BotaoProcessar";

type Conta = { id: string; rotulo: string };

function contar(qtd: number, singular: string, plural: string): string {
  return `${qtd} ${qtd === 1 ? singular : plural}`;
}

function KpiTile({
  valor,
  rotulo,
  destaque = false,
}: {
  valor: number;
  rotulo: string;
  destaque?: boolean;
}) {
  return (
    <div className="flex flex-col-reverse px-5 py-3 first:pl-0">
      <dt className="mt-1 font-codigo text-[10px] uppercase tracking-[0.16em] text-nevoa/50">
        {rotulo}
      </dt>
      <dd
        className={`font-titulo text-2xl font-extrabold tabular-nums ${
          destaque ? "text-ambar" : "text-nevoa"
        }`}
      >
        {valor}
      </dd>
    </div>
  );
}

export default async function PaginaSc01() {
  const sessao = await obterSessao();
  if (!sessao) {
    redirect("/login");
  }

  const modulo = obterModulo("SC-01");
  const podeVer =
    modulo !== undefined &&
    filtrarModulosVisiveis(sessao.papel, sessao.setor).some((m) => m.codigo === "SC-01");
  if (!modulo || !podeVer) {
    redirect("/");
  }

  const [execucoes, documentos, clientes] = await Promise.all([
    listarHistorico("SC-01"),
    listarDocumentos({ tipo: "EXTRATO" }),
    listarClientesParaUpload(),
  ]);

  const contasPorCliente: Record<string, Conta[]> = Object.fromEntries(
    await Promise.all(
      clientes.map(async (c) => [c.id, await listarContasDoCliente(c.id)] as const),
    ),
  );

  const pendentes = documentos.filter((d) => d.status === "PENDENTE").length;

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

      <main className="mx-auto max-w-[80rem] px-6 pb-20">
        <section className="animate-entrada pt-12 pb-8">
          <Link
            href="/"
            className="font-codigo text-[11px] font-medium uppercase tracking-[0.28em] text-turquesa hover:underline"
          >
            ← Portal
          </Link>

          <div className="mt-4 flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="font-codigo text-[11px] font-medium uppercase tracking-[0.32em] text-turquesa">
                SC-01 · Extrato bancário
              </p>
              <h1 className="mt-2 font-titulo text-3xl font-extrabold leading-[1.05] tracking-tight text-nevoa sm:text-[2.6rem]">
                {modulo.nome}
              </h1>
              <p className="mt-3 max-w-xl font-texto text-[15px] leading-relaxed text-nevoa/70">
                {pendentes > 0
                  ? `A IA lê os ${contar(pendentes, "extrato pendente", "extratos pendentes")} da fila e grava os lançamentos.`
                  : "A IA lê os extratos pendentes da fila e grava os lançamentos."}
              </p>
            </div>

            <div className="flex flex-col items-end gap-2">
              <BotaoProcessar acao={processarPendentes} rotulo="Processar pendentes" tom="escuro" />
            </div>
          </div>

          <dl className="mt-8 grid max-w-md grid-cols-2 divide-x divide-white/10 border-y border-white/10">
            <KpiTile valor={pendentes} rotulo="Na fila" destaque={pendentes > 0} />
            <KpiTile valor={documentos.length} rotulo="Documentos" />
          </dl>
        </section>

        <section className="pb-4">
          <div className="flex flex-col gap-8 rounded-2xl border border-white/15 bg-nevoa/95 p-4 shadow-[0_24px_70px_-15px_rgba(11,26,32,0.65)] backdrop-blur-xl sm:p-6">
            <section>
              <h2 className="font-titulo text-lg font-bold text-tinta">Enviar extrato</h2>
              <p className="mt-1 max-w-prose font-texto text-sm text-grafite">
                Anexe o extrato em PDF ou foto e escolha o cliente e a conta. Ele
                entra na fila como pendente até o processamento.
              </p>
              <div className="mt-3">
                <FormularioUploadDocumento clientes={clientes} contasPorCliente={contasPorCliente} />
              </div>
            </section>

            <section>
              <div className="mb-3 flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1.5">
                <h2 className="font-titulo text-lg font-bold text-tinta">Documentos</h2>
                {documentos.length > 0 ? (
                  <span className="font-codigo text-xs tabular-nums text-grafite">
                    {pendentes > 0
                      ? `${contar(documentos.length, "documento", "documentos")} · ${pendentes} na fila`
                      : contar(documentos.length, "documento", "documentos")}
                  </span>
                ) : null}
              </div>
              <TabelaDocumentos documentos={documentos} />
            </section>

            <section>
              <h2 className="mb-3 font-titulo text-lg font-bold text-tinta">
                Histórico de execução
              </h2>
              <HistoricoExecucoes execucoes={execucoes} />
            </section>
          </div>
        </section>
      </main>

      <footer className="mx-auto max-w-[80rem] border-t border-white/10 px-6 py-6">
        <p className="font-codigo text-[10px] uppercase tracking-[0.28em] text-nevoa/40">
          Acesso restrito · SheepContabil
        </p>
      </footer>
    </div>
  );
}
