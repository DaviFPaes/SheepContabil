import Link from "next/link";
import { redirect } from "next/navigation";
import { obterSessao } from "@/lib/sessao-servidor";
import { sair } from "@/lib/sessao-acoes";
import { CabecalhoPortal } from "@/components/CabecalhoPortal";
import { VeuAtmosferico } from "@/components/VeuAtmosferico";
import { HistoricoExecucoes } from "@/components/HistoricoExecucoes";
import { filtrarModulosVisiveis, obterModulo } from "@/lib/modulos-catalogo";
import { listarHistorico } from "@/lib/execucao";
import { listarNotas, listarTermos } from "@/lib/presuncao/consultas-sc11";
import { listarClientesParaUpload } from "@/lib/clientes";
import { FormularioUploadNota } from "@/components/presuncao/FormularioUploadNota";
import { TabelaNotas } from "@/components/presuncao/TabelaNotas";

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

export default async function PaginaSc11() {
  const sessao = await obterSessao();
  if (!sessao) {
    redirect("/login");
  }

  const modulo = obterModulo("SC-11");
  const podeVer =
    modulo !== undefined &&
    filtrarModulosVisiveis(sessao.papel, sessao.setor).some((m) => m.codigo === "SC-11");
  if (!modulo || !podeVer) {
    redirect("/");
  }

  const [execucoes, notas, clientes, termos] = await Promise.all([
    listarHistorico("SC-11"),
    listarNotas(),
    listarClientesParaUpload(),
    listarTermos(),
  ]);

  const pendentes = notas.filter((n) => n.status === "PENDENTE").length;

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
                SC-11 · Presunção NFS-e
              </p>
              <h1 className="mt-2 font-titulo text-3xl font-extrabold leading-[1.05] tracking-tight text-nevoa sm:text-[2.6rem]">
                {modulo.nome}
              </h1>
              <p className="mt-3 max-w-xl font-texto text-[15px] leading-relaxed text-nevoa/70">
                A IA classifica os itens de cada nota assim que ela chega; os{" "}
                {contar(termos.length, "termo cadastrado", "termos cadastrados")}{" "}
                resolvem os casos recorrentes e o restante cai no modelo.
              </p>
            </div>

            {sessao.papel === "ADMIN" ? (
              <Link
                href="/modulos/sc-11/termos"
                className="font-texto text-sm text-turquesa/90 underline-offset-2 hover:text-turquesa hover:underline"
              >
                Gerenciar termos de presunção →
              </Link>
            ) : null}
          </div>

          <dl className="mt-8 grid max-w-lg grid-cols-3 divide-x divide-white/10 border-y border-white/10">
            <KpiTile valor={pendentes} rotulo="Na fila" destaque={pendentes > 0} />
            <KpiTile valor={notas.length} rotulo="Notas" />
            <KpiTile valor={termos.length} rotulo="Termos" />
          </dl>
        </section>

        <section className="pb-4">
          <div className="flex flex-col gap-8 rounded-2xl border border-white/15 bg-nevoa/95 p-4 shadow-[0_24px_70px_-15px_rgba(11,26,32,0.65)] backdrop-blur-xl sm:p-6">
            <section>
              <h2 className="font-titulo text-lg font-bold text-tinta">Enviar NFS-e</h2>
              <p className="mt-1 max-w-prose font-texto text-sm text-grafite">
                Anexe o XML da nota de serviço e escolha o cliente — a
                classificação roda na hora e você já abre na nota com o
                resultado.
              </p>
              <div className="mt-3">
                <FormularioUploadNota clientes={clientes} />
              </div>
            </section>

            <section>
              <div className="mb-3 flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1.5">
                <h2 className="font-titulo text-lg font-bold text-tinta">Notas</h2>
                {notas.length > 0 ? (
                  <span className="font-codigo text-xs tabular-nums text-grafite">
                    {pendentes > 0
                      ? `${contar(notas.length, "nota", "notas")} · ${pendentes} na fila`
                      : contar(notas.length, "nota", "notas")}
                  </span>
                ) : null}
              </div>
              <TabelaNotas notas={notas} />
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
