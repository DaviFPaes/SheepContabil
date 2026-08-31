import Link from "next/link";
import { redirect } from "next/navigation";
import { obterSessao } from "@/lib/sessao-servidor";
import { sair } from "@/lib/sessao-acoes";
import { CabecalhoPortal } from "@/components/CabecalhoPortal";
import {
  listarAuditoriaTermos,
  listarTermos,
} from "@/lib/presuncao/consultas-sc11";
import { FormularioTermo } from "@/components/presuncao/FormularioTermo";
import { TabelaTermos } from "@/components/presuncao/TabelaTermos";
import { HistoricoAuditoriaTermos } from "@/components/presuncao/HistoricoAuditoriaTermos";

export default async function PaginaTermosSc11() {
  const sessao = await obterSessao();
  if (!sessao) {
    redirect("/login");
  }
  if (sessao.papel !== "ADMIN") {
    redirect("/modulos/sc-11");
  }

  const [termos, auditoria] = await Promise.all([
    listarTermos(),
    listarAuditoriaTermos(),
  ]);

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
            ← Voltar para o SC-11
          </Link>
          <div className="mt-3">
            <span className="font-codigo text-xs uppercase tracking-wide text-grafite">
              SC-11 · Administração
            </span>
            <h1 className="font-titulo text-2xl font-bold text-tinta">
              Termos de presunção
            </h1>
            <p className="mt-1 max-w-prose font-texto text-sm text-grafite">
              A classificação por regra casa a descrição de cada item com estes
              termos antes de recorrer ao modelo. Toda mudança fica registrada na
              auditoria.
            </p>
          </div>
        </div>

        <section>
          <div className="mb-3">
            <h2 className="font-titulo text-lg font-bold text-tinta">
              Novo termo
            </h2>
            <p className="mt-1 max-w-prose font-texto text-sm text-grafite">
              Cadastre um termo e a base de presunção que ele força (8% ou 32%).
            </p>
          </div>
          <FormularioTermo />
        </section>

        <section>
          <div className="mb-3">
            <h2 className="font-titulo text-lg font-bold text-tinta">
              Termos cadastrados
            </h2>
            <p className="mt-1 max-w-prose font-texto text-sm text-grafite">
              Em ordem alfabética. Reclassifique ou remova; cada ação gera uma
              linha na auditoria.
            </p>
          </div>
          <TabelaTermos termos={termos} />
        </section>

        <section>
          <div className="mb-3">
            <h2 className="font-titulo text-lg font-bold text-tinta">
              Histórico de auditoria
            </h2>
            <p className="mt-1 max-w-prose font-texto text-sm text-grafite">
              Últimas 50 alterações, da mais recente à mais antiga.
            </p>
          </div>
          <HistoricoAuditoriaTermos linhas={auditoria} />
        </section>
      </main>
    </>
  );
}
