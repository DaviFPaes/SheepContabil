import Link from "next/link";
import { redirect } from "next/navigation";
import { obterSessao } from "@/lib/sessao-servidor";
import { sair } from "@/lib/sessao-acoes";
import { CabecalhoPortal } from "@/components/CabecalhoPortal";
import { ModuloPageLayout } from "@/components/ModuloPageLayout";
import { filtrarModulosVisiveis, obterModulo } from "@/lib/modulos-catalogo";
import { listarHistorico as listarExecucoes } from "@/lib/execucao";
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
import { atualizarAgora } from "@/lib/certificados/acoes";
import { PainelSc20 } from "@/components/certificados/PainelSc20";
import { BotaoAtualizar } from "@/components/certificados/BotaoAtualizar";
import { SinoAvisos } from "@/components/certificados/SinoAvisos";
import { FiltrosHistorico } from "@/components/certificados/FiltrosHistorico";
import { TimelineHistorico } from "@/components/certificados/TimelineHistorico";

type Visao = "tabela" | "kanban";
type Foco = "D60" | "D7" | "D3" | null;

const POR_PAGINA = 30;
const ACOES_VALIDAS = new Set(NATUREZAS.map((n) => n.valor));

function contar(qtd: number, singular: string, plural: string): string {
  return `${qtd} ${qtd === 1 ? singular : plural}`;
}

function dataOpcional(iso: string | undefined): Date | undefined {
  if (!iso || !/^\d{4}-\d{2}-\d{2}$/.test(iso)) return undefined;
  return new Date(`${iso}T00:00:00.000Z`);
}

export default async function PaginaSc20({
  searchParams,
}: {
  searchParams: Promise<{
    aba?: string;
    visao?: string;
    foco?: string;
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

  const [execucoes, certificados, clientes, notificacoes] = await Promise.all([
    listarExecucoes("SC-20"),
    listarCertificados(),
    listarClientesParaSelecao(),
    listarNotificacoes(sessao.usuarioId),
  ]);

  const colunas = montarColunasKanban(certificados);
  const contagem = contarNaoAvisados(colunas);

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
    `border-b-2 px-1 pb-2 font-texto text-sm font-medium transition-colors motion-reduce:transition-none ${
      ativa
        ? "border-petroleo text-tinta"
        : "border-transparent text-grafite hover:text-tinta"
    }`;

  return (
    <>
      <CabecalhoPortal
        nomeUsuario={sessao.nome}
        papel={sessao.papel}
        acaoSair={
          <form action={sair}>
            <button className="font-texto text-sm underline underline-offset-2">Sair</button>
          </form>
        }
      />
      <ModuloPageLayout
        modulo={modulo}
        execucoes={execucoes}
        acoes={
          <div className="flex w-full flex-wrap items-start justify-between gap-3">
            <div className="flex flex-col gap-2">
              <form action={atualizarAgora}>
                <BotaoAtualizar />
              </form>
              <p className="max-w-prose font-texto text-xs text-grafite">
                Reavalia o bucket de cada certificado e gera os avisos internos
                das faixas que mudaram. Roda sozinho todo dia de madrugada.
              </p>
            </div>
            <SinoAvisos notificacoes={notificacoes} />
          </div>
        }
        conteudo={
          <div className="flex flex-col gap-5">
            <nav className="flex gap-5 border-b border-grafite/20">
              <Link href="/modulos/sc-20?aba=certificados" className={abaClasse(aba === "certificados")}>
                Certificados
              </Link>
              <Link href="/modulos/sc-20?aba=historico" className={abaClasse(aba === "historico")}>
                Histórico
              </Link>
            </nav>

            {aba === "certificados" ? (
              <section>
                <div className="mb-3 flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1.5">
                  <h2 className="font-titulo text-lg font-bold text-tinta">
                    Certificados da carteira
                  </h2>
                  {certificados.length > 0 ? (
                    <span className="font-codigo text-xs tabular-nums text-grafite">
                      {contar(certificados.length, "certificado", "certificados")}
                    </span>
                  ) : null}
                </div>
                <PainelSc20
                  certificados={certificados}
                  colunas={colunas}
                  contagem={contagem}
                  clientes={clientes}
                  visaoUrl={visaoUrl}
                  focoInicial={focoInicial}
                />
              </section>
            ) : (
              <section className="flex flex-col gap-4">
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
                    <div className="flex gap-3">
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
              </section>
            )}
          </div>
        }
      />
    </>
  );
}
