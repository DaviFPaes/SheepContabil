import Link from "next/link";
import { redirect } from "next/navigation";
import { obterSessao } from "@/lib/sessao-servidor";
import { sair } from "@/lib/sessao-acoes";
import { CabecalhoPortal } from "@/components/CabecalhoPortal";
import { VeuAtmosferico } from "@/components/VeuAtmosferico";
import { filtrarModulosVisiveis, obterModulo } from "@/lib/modulos-catalogo";
import {
  listarClientesParaUpload,
  listarContasDoCliente,
  listarDocumentos,
  listarHistoricoDocumentos,
} from "@/lib/documentos/consultas-sc01";
import { NATUREZAS, type AcaoAuditoriaDocumento } from "@/lib/documentos/historico";
import { PainelDocumentos } from "@/components/documentos/PainelDocumentos";
import { FiltrosAuditoriaDocumentos } from "@/components/documentos/FiltrosAuditoriaDocumentos";
import { TimelineAuditoria } from "@/components/documentos/TimelineAuditoria";
import { BotaoNovoExtrato } from "@/components/documentos/BotaoNovoExtrato";

type Conta = { id: string; rotulo: string };
type Aba = "documentos" | "auditoria";

const POR_PAGINA = 30;
const ACOES_VALIDAS = new Set(NATUREZAS.map((n) => n.valor));

function competenciaAtual(): string {
  const hoje = new Date();
  return `${hoje.getUTCFullYear()}-${String(hoje.getUTCMonth() + 1).padStart(2, "0")}`;
}

function dataOpcional(iso: string | undefined): Date | undefined {
  if (!iso || !/^\d{4}-\d{2}-\d{2}$/.test(iso)) return undefined;
  return new Date(`${iso}T00:00:00.000Z`);
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

export default async function PaginaSc01({
  searchParams,
}: {
  searchParams: Promise<{
    aba?: string;
    competencia?: string;
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

  const modulo = obterModulo("SC-01");
  const podeVer =
    modulo !== undefined &&
    filtrarModulosVisiveis(sessao.papel, sessao.setor).some((m) => m.codigo === "SC-01");
  if (!modulo || !podeVer) {
    redirect("/");
  }

  const sp = await searchParams;
  const aba: Aba = sp.aba === "auditoria" ? "auditoria" : "documentos";
  const competencia = /^\d{4}-\d{2}$/.test(sp.competencia ?? "")
    ? (sp.competencia as string)
    : competenciaAtual();

  // Busca a lista INTEIRA de extratos (sem filtrar por competência no
  // servidor) — a aba Documentos filtra por mês no cliente (PainelDocumentos),
  // então o seletor de mês dela precisa enxergar todos os meses.
  const [documentos, clientes] = await Promise.all([
    listarDocumentos({ tipo: "EXTRATO" }),
    listarClientesParaUpload(),
  ]);

  const contasPorCliente: Record<string, Conta[]> = Object.fromEntries(
    await Promise.all(
      clientes.map(async (c) => [c.id, await listarContasDoCliente(c.id)] as const),
    ),
  );

  const doMes = documentos.filter((d) => d.competencia === competencia);
  const naFila = doMes.filter((d) => d.status === "PENDENTE").length;
  const emConferencia = doMes.filter((d) => d.emRevisao > 0).length;
  const comErro = doMes.filter((d) => d.status === "ERRO").length;

  const filtroCliente = sp.cliente || undefined;
  const filtroEvento =
    sp.evento && ACOES_VALIDAS.has(sp.evento as AcaoAuditoriaDocumento)
      ? (sp.evento as AcaoAuditoriaDocumento)
      : undefined;
  const pagina = Math.max(1, Number.parseInt(sp.pagina ?? "1", 10) || 1);

  const historico =
    aba === "auditoria"
      ? await listarHistoricoDocumentos({
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
    const p = new URLSearchParams({ aba: "auditoria" });
    if (filtroCliente) p.set("cliente", filtroCliente);
    if (filtroEvento) p.set("evento", filtroEvento);
    if (sp.de) p.set("de", sp.de);
    if (sp.ate) p.set("ate", sp.ate);
    p.set("pagina", String(n));
    return `/modulos/sc-01?${p.toString()}`;
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
                SC-01 · Extrato bancário
              </p>
              <h1 className="mt-2 font-titulo text-3xl font-extrabold leading-[1.05] tracking-tight text-nevoa sm:text-[2.6rem]">
                {modulo.nome}
              </h1>
            </div>

            <BotaoNovoExtrato clientes={clientes} contasPorCliente={contasPorCliente} />
          </div>

          <dl className="mt-8 grid max-w-2xl grid-cols-2 divide-x divide-white/10 border-y border-white/10 sm:grid-cols-4">
            <KpiTile valor={naFila} rotulo="Na fila" destaque={naFila > 0} />
            <KpiTile valor={emConferencia} rotulo="Em conferência" destaque={emConferencia > 0} />
            <KpiTile valor={comErro} rotulo="Com erro" destaque={comErro > 0} />
            <KpiTile valor={doMes.length} rotulo="No mês" />
          </dl>
        </section>

        <section className="pb-4">
          <div className="rounded-2xl border border-white/15 bg-nevoa/95 p-4 shadow-[0_24px_70px_-15px_rgba(11,26,32,0.65)] backdrop-blur-xl sm:p-6">
            <nav className="mb-5 flex gap-5 border-b border-grafite/15">
              <Link href="/modulos/sc-01?aba=documentos" className={abaClasse(aba === "documentos")}>
                Documentos
              </Link>
              <Link href="/modulos/sc-01?aba=auditoria" className={abaClasse(aba === "auditoria")}>
                Auditoria
              </Link>
            </nav>

            {aba === "documentos" ? (
              <PainelDocumentos documentos={documentos} competenciaInicial={competencia} />
            ) : (
              <div className="flex flex-col gap-4">
                <FiltrosAuditoriaDocumentos
                  clientes={clientes}
                  valores={{ cliente: filtroCliente, evento: filtroEvento, de: sp.de, ate: sp.ate }}
                />
                <TimelineAuditoria linhas={historico?.linhas ?? []} />
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
