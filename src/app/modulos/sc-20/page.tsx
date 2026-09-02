import Link from "next/link";
import { redirect } from "next/navigation";
import { obterSessao } from "@/lib/sessao-servidor";
import { sair } from "@/lib/sessao-acoes";
import { CabecalhoPortal } from "@/components/CabecalhoPortal";
import { VeuAtmosferico } from "@/components/VeuAtmosferico";
import { filtrarModulosVisiveis, obterModulo } from "@/lib/modulos-catalogo";
import {
  contarNaoAvisados,
  listarCertificados,
  listarClientesParaSelecao,
  listarHistorico,
  listarNotificacoes,
  montarColunasKanban,
} from "@/lib/certificados/consultas";
import type { AcaoAuditoria } from "@/lib/certificados/historico";
import { NATUREZAS } from "@/lib/certificados/historico";
import type { Bucket } from "@/lib/certificados/bucket";
import type { FiltroFaixa, FiltroTipo } from "@/lib/certificados/filtros";
import { PainelSc20 } from "@/components/certificados/PainelSc20";
import { SinoAvisos } from "@/components/certificados/SinoAvisos";
import { FiltrosHistorico } from "@/components/certificados/FiltrosHistorico";
import { TimelineHistorico } from "@/components/certificados/TimelineHistorico";

type Visao = "tabela" | "kanban";
type Foco = "D60" | "D7" | "D3" | null;

const POR_PAGINA = 30;
const ACOES_VALIDAS = new Set(NATUREZAS.map((n) => n.valor));
const FAIXAS_VALIDAS = new Set<Bucket>(["OK", "D60", "D7", "D3", "VENCIDO", "RENOVADO"]);
const TIPOS_VALIDOS = new Set(["ECNPJ", "ECPF", "NFE"]);

function contar(qtd: number, singular: string, plural: string): string {
  return `${qtd} ${qtd === 1 ? singular : plural}`;
}

function dataOpcional(iso: string | undefined): Date | undefined {
  if (!iso || !/^\d{4}-\d{2}-\d{2}$/.test(iso)) return undefined;
  return new Date(`${iso}T00:00:00.000Z`);
}

function KpiTile({
  valor,
  rotulo,
  faixa,
  destaque = false,
}: {
  valor: number;
  rotulo: string;
  faixa: Bucket;
  destaque?: boolean;
}) {
  return (
    <Link
      href={`/modulos/sc-20?visao=tabela&faixa=${faixa}`}
      className="flex flex-col-reverse px-5 py-3 transition-colors hover:bg-white/[0.05] first:pl-0"
    >
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
    </Link>
  );
}

export default async function PaginaSc20({
  searchParams,
}: {
  searchParams: Promise<{
    aba?: string;
    visao?: string;
    foco?: string;
    faixa?: string;
    tipo?: string;
    cliente?: string;
    evento?: string;
    de?: string;
    ate?: string;
    pagina?: string;
  }>;
}) {
  const sessao = await obterSessao();
  if (!sessao) {
    redirect("/login");
  }

  const modulo = obterModulo("SC-20");
  const podeVer =
    modulo !== undefined &&
    filtrarModulosVisiveis(sessao.papel, sessao.setor).some((m) => m.codigo === "SC-20");
  if (!modulo || !podeVer) {
    redirect("/");
  }

  const sp = await searchParams;
  const aba = sp.aba === "historico" ? "historico" : "certificados";
  const visaoUrl: Visao | null = sp.visao === "kanban" || sp.visao === "tabela" ? sp.visao : null;
  const focoInicial: Foco =
    sp.foco === "D60" || sp.foco === "D7" || sp.foco === "D3" ? sp.foco : null;
  const faixaInicial: FiltroFaixa =
    sp.faixa && FAIXAS_VALIDAS.has(sp.faixa as Bucket) ? (sp.faixa as FiltroFaixa) : "TODAS";
  const tipoInicial: FiltroTipo =
    sp.tipo && TIPOS_VALIDOS.has(sp.tipo) ? (sp.tipo as FiltroTipo) : "TODOS";

  const [certificados, clientes, notificacoes] = await Promise.all([
    listarCertificados(),
    listarClientesParaSelecao(),
    listarNotificacoes(sessao.usuarioId),
  ]);

  const colunas = montarColunasKanban(certificados);
  const contagem = contarNaoAvisados(colunas);
  const aAvisar = contagem.d60 + contagem.d7;

  const filtroCliente = sp.cliente || undefined;
  const filtroEvento =
    sp.evento && ACOES_VALIDAS.has(sp.evento as AcaoAuditoria)
      ? (sp.evento as AcaoAuditoria)
      : undefined;
  const pagina = Math.max(1, Number.parseInt(sp.pagina ?? "1", 10) || 1);

  const historico =
    aba === "historico"
      ? await listarHistorico({
          clienteId: filtroCliente,
          acao: filtroEvento,
          de: dataOpcional(sp.de),
          ate: dataOpcional(sp.ate),
          pagina,
          porPagina: POR_PAGINA,
        })
      : null;

  const totalPaginas = historico ? Math.max(1, Math.ceil(historico.total / POR_PAGINA)) : 1;
  const paramsPagina = (n: number) => {
    const p = new URLSearchParams({ aba: "historico" });
    if (filtroCliente) p.set("cliente", filtroCliente);
    if (filtroEvento) p.set("evento", filtroEvento);
    if (sp.de) p.set("de", sp.de);
    if (sp.ate) p.set("ate", sp.ate);
    p.set("pagina", String(n));
    return `/modulos/sc-20?${p.toString()}`;
  };

  const abaClasse = (ativa: boolean) =>
    `border-b-2 px-1 pb-2.5 font-texto text-sm font-semibold transition-colors motion-reduce:transition-none ${
      ativa ? "border-petroleo text-tinta" : "border-transparent text-grafite hover:text-tinta"
    }`;

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
            href="/"
            className="font-codigo text-[11px] font-medium uppercase tracking-[0.28em] text-turquesa hover:underline"
          >
            ← Portal
          </Link>

          <div className="mt-4 flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="font-codigo text-[11px] font-medium uppercase tracking-[0.32em] text-turquesa">
                SC-20 · Certificado digital
              </p>
              <h1 className="mt-2 font-titulo text-3xl font-extrabold leading-[1.05] tracking-tight text-nevoa sm:text-[2.6rem]">
                Vencimento de Certificado Digital
              </h1>
              <p className="mt-3 max-w-xl font-texto text-[15px] leading-relaxed text-nevoa/70">
                {contar(certificados.length, "certificado", "certificados")} na carteira
                {aAvisar > 0
                  ? ` · ${contar(aAvisar, "pede", "pedem")} contato esta semana.`
                  : " · nada pendente esta semana."}
              </p>
            </div>

            <SinoAvisos notificacoes={notificacoes} tom="escuro" />
          </div>

          <dl className="mt-8 grid max-w-2xl grid-cols-2 divide-x divide-white/10 border-y border-white/10 sm:grid-cols-4">
            <KpiTile valor={colunas.d60.length} rotulo="60 dias" faixa="D60" />
            <KpiTile valor={colunas.d7.length} rotulo="7 dias" faixa="D7" />
            <KpiTile
              valor={colunas.confirmar3.length}
              rotulo="3 dias"
              faixa="D3"
              destaque={colunas.confirmar3.length > 0}
            />
            <KpiTile
              valor={colunas.vencido.length}
              rotulo="Vencidos"
              faixa="VENCIDO"
              destaque={colunas.vencido.length > 0}
            />
          </dl>
        </section>

        <section className="pb-4">
          <div className="rounded-2xl border border-white/15 bg-nevoa/95 p-4 shadow-[0_24px_70px_-15px_rgba(11,26,32,0.65)] backdrop-blur-xl sm:p-6">
            <nav className="mb-5 flex gap-5 border-b border-grafite/15">
              <Link href="/modulos/sc-20?aba=certificados" className={abaClasse(aba === "certificados")}>
                Certificados
              </Link>
              <Link href="/modulos/sc-20?aba=historico" className={abaClasse(aba === "historico")}>
                Histórico
              </Link>
            </nav>

            {aba === "certificados" ? (
              <PainelSc20
                certificados={certificados}
                clientes={clientes}
                visaoUrl={visaoUrl}
                focoInicial={focoInicial}
                faixaInicial={faixaInicial}
                tipoInicial={tipoInicial}
              />
            ) : (
              <div className="flex flex-col gap-4">
                <FiltrosHistorico
                  clientes={clientes}
                  valores={{
                    cliente: filtroCliente,
                    evento: filtroEvento,
                    de: sp.de,
                    ate: sp.ate,
                  }}
                />
                <TimelineHistorico linhas={historico?.linhas ?? []} />
                {historico && historico.total > POR_PAGINA ? (
                  <div className="flex items-center justify-between font-texto text-sm text-grafite">
                    <span>
                      Página {pagina} de {totalPaginas} · {historico.total} eventos
                    </span>
                    <div className="flex gap-4">
                      {pagina > 1 ? (
                        <Link href={paramsPagina(pagina - 1)} className="text-turquesa hover:underline">
                          ← Anterior
                        </Link>
                      ) : null}
                      {pagina < totalPaginas ? (
                        <Link href={paramsPagina(pagina + 1)} className="text-turquesa hover:underline">
                          Próxima →
                        </Link>
                      ) : null}
                    </div>
                  </div>
                ) : null}
              </div>
            )}
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
