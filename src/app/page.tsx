import { redirect } from "next/navigation";
import { obterSessao } from "@/lib/sessao-servidor";
import { sair } from "@/lib/sessao-acoes";
import { prisma } from "@/lib/prisma";
import { CabecalhoPortal } from "@/components/CabecalhoPortal";
import { GradeModulos } from "@/components/modulos/GradeModulos";
import { VeuAtmosferico } from "@/components/VeuAtmosferico";
import { filtrarModulosVisiveis } from "@/lib/modulos-catalogo";
import { obterKpiModulo } from "@/lib/home/kpis-modulos";

const DIA_MS = 24 * 60 * 60 * 1000;

function saudacao(agora: Date): string {
  const hora = Number(
    new Intl.DateTimeFormat("pt-BR", {
      timeZone: "America/Sao_Paulo",
      hour: "numeric",
      hourCycle: "h23",
    }).format(agora),
  );
  if (hora < 12) return "Bom dia";
  if (hora < 18) return "Boa tarde";
  return "Boa noite";
}

function Metrica({
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

export default async function PaginaHome() {
  const sessao = await obterSessao();

  if (!sessao) {
    redirect("/login");
  }

  const modulos = filtrarModulosVisiveis(sessao.papel, sessao.setor);
  const codigos = modulos.map((modulo) => modulo.codigo);
  const agora = new Date();
  const desde30Dias = new Date(agora.getTime() - 30 * DIA_MS);

  const [kpis, execucoes30Dias] = await Promise.all([
    Promise.all(modulos.map((modulo) => obterKpiModulo(modulo.codigo))),
    codigos.length
      ? prisma.execucao.count({
          where: {
            moduloCodigo: { in: codigos },
            iniciadoEm: { gte: desde30Dias },
          },
        })
      : Promise.resolve(0),
  ]);

  const cartoes = modulos.map((modulo, i) => ({ modulo, kpi: kpis[i] }));
  const pendencias = kpis.reduce(
    (soma, kpi) => soma + (kpi && kpi.tom !== "ok" ? kpi.valor : 0),
    0,
  );
  const primeiroNome = sessao.nome.trim().split(/\s+/)[0];

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

      <main className="mx-auto max-w-5xl px-6 pb-20">
        <section className="animate-entrada pt-14 pb-10">
          <p className="font-codigo text-[11px] font-medium uppercase tracking-[0.32em] text-turquesa">
            Portal de automações
          </p>
          <h1 className="mt-3 max-w-3xl font-titulo text-4xl font-extrabold leading-[1.04] tracking-tight text-nevoa sm:text-[3.25rem]">
            {saudacao(agora)}, {primeiroNome}.
          </h1>

          <dl className="mt-9 grid max-w-lg grid-cols-3 divide-x divide-white/10 border-y border-white/10">
            <Metrica valor={modulos.length} rotulo="Módulos ativos" />
            <Metrica
              valor={pendencias}
              rotulo="Pendências abertas"
              destaque={pendencias > 0}
            />
            <Metrica valor={execucoes30Dias} rotulo="Execuções · 30 dias" />
          </dl>
        </section>

        <section>
          <h2 className="font-codigo text-[11px] font-medium uppercase tracking-[0.28em] text-nevoa/55">
            Módulos disponíveis
          </h2>

          {cartoes.length === 0 ? (
            <div className="mt-5 rounded-2xl border border-dashed border-white/20 bg-white/[0.04] px-8 py-12 text-center">
              <p className="font-texto text-sm text-nevoa/70">
                Nenhum módulo disponível para o seu perfil ainda.
              </p>
              <p className="mt-1 font-codigo text-[11px] uppercase tracking-wider text-nevoa/40">
                Fale com o administrador do portal
              </p>
            </div>
          ) : (
            <GradeModulos cartoes={cartoes} />
          )}
        </section>
      </main>

      <footer className="mx-auto max-w-5xl border-t border-white/10 px-6 py-6">
        <p className="font-codigo text-[10px] uppercase tracking-[0.28em] text-nevoa/40">
          Acesso restrito · SheepContabil
        </p>
      </footer>
    </div>
  );
}
