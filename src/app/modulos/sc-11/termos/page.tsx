import Link from "next/link";
import { redirect } from "next/navigation";
import { obterSessao } from "@/lib/sessao-servidor";
import { sair } from "@/lib/sessao-acoes";
import { CabecalhoPortal } from "@/components/CabecalhoPortal";
import { VeuAtmosferico } from "@/components/VeuAtmosferico";
import {
  listarAuditoriaTermos,
  listarTermos,
} from "@/lib/presuncao/consultas-sc11";
import { FormularioTermo } from "@/components/presuncao/FormularioTermo";
import { PainelTermos } from "@/components/presuncao/PainelTermos";
import { TimelineAuditoriaTermos } from "@/components/presuncao/TimelineAuditoriaTermos";

type Aba = "termos" | "auditoria";

const abaClasse = (ativa: boolean) =>
  `border-b-2 px-1 pb-2.5 font-texto text-sm font-semibold transition-colors motion-reduce:transition-none ${
    ativa ? "border-petroleo text-tinta" : "border-transparent text-grafite hover:text-tinta"
  }`;

export default async function PaginaTermosSc11({
  searchParams,
}: {
  searchParams: Promise<{ aba?: string }>;
}) {
  const sessao = await obterSessao();
  if (!sessao) {
    redirect("/login");
  }
  if (sessao.papel !== "ADMIN") {
    redirect("/modulos/sc-11");
  }

  const sp = await searchParams;
  const aba: Aba = sp.aba === "auditoria" ? "auditoria" : "termos";

  const [termos, auditoria] = await Promise.all([
    listarTermos(),
    listarAuditoriaTermos(),
  ]);

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
            href="/modulos/sc-11"
            className="font-codigo text-[11px] font-medium uppercase tracking-[0.28em] text-turquesa hover:underline"
          >
            ← SC-11 · Presunção NFS-e
          </Link>

          <div className="mt-4">
            <p className="font-codigo text-[11px] font-medium uppercase tracking-[0.32em] text-turquesa">
              SC-11 · Administração
            </p>
            <h1 className="mt-2 font-titulo text-3xl font-extrabold leading-[1.05] tracking-tight text-nevoa sm:text-[2.6rem]">
              Termos de presunção
            </h1>
            <p className="mt-3 max-w-xl font-texto text-[15px] leading-relaxed text-nevoa/70">
              A classificação por regra casa a descrição de cada item com estes
              termos antes de recorrer ao modelo. Toda mudança fica registrada
              na auditoria.
            </p>
          </div>
        </section>

        <section className="pb-4">
          <div className="rounded-2xl border border-white/15 bg-nevoa/95 p-4 shadow-[0_24px_70px_-15px_rgba(11,26,32,0.65)] backdrop-blur-xl sm:p-6">
            <nav className="mb-5 flex gap-5 border-b border-grafite/15">
              <Link
                href="/modulos/sc-11/termos?aba=termos"
                className={abaClasse(aba === "termos")}
              >
                Termos
              </Link>
              <Link
                href="/modulos/sc-11/termos?aba=auditoria"
                className={abaClasse(aba === "auditoria")}
              >
                Auditoria
              </Link>
            </nav>

            {aba === "termos" ? (
              <div className="flex flex-col gap-6">
                <FormularioTermo />
                <PainelTermos termos={termos} />
              </div>
            ) : (
              <TimelineAuditoriaTermos linhas={auditoria} />
            )}
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
