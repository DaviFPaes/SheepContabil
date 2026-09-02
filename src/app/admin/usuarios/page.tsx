import { redirect } from "next/navigation";
import { obterSessao } from "@/lib/sessao-servidor";
import { sair } from "@/lib/sessao-acoes";
import { CabecalhoPortal } from "@/components/CabecalhoPortal";
import { listarOperadoresParaGestao } from "@/lib/permissoes/consultas";
import {
  PainelGestaoUsuarios,
  type OperadorGestaoView,
} from "@/components/usuarios/PainelGestaoUsuarios";

export default async function PaginaGestaoUsuarios() {
  const sessao = await obterSessao();
  if (!sessao) {
    redirect("/login");
  }
  if (sessao.papel !== "ADMIN") {
    redirect("/");
  }

  const operadores = await listarOperadoresParaGestao();
  // Sets não cruzam a fronteira Server → Client Component (só JSON):
  // convertidos para array só aqui, na borda.
  const operadoresView: OperadorGestaoView[] = operadores.map((o) => ({
    id: o.id,
    nome: o.nome,
    email: o.email,
    setor: o.setor,
    modulosElegiveis: o.modulosElegiveis.map((m) => ({ codigo: m.codigo, nome: m.nome })),
    modulosLigados: [...o.permissoes.modulosLigados],
    subAreasDesligadas: [...o.permissoes.subAreasDesligadas],
  }));

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
      <main className="mx-auto flex max-w-4xl flex-col gap-6 px-6 py-10">
        <div>
          <span className="font-codigo text-xs uppercase tracking-wide text-grafite">
            Administração
          </span>
          <h1 className="font-titulo text-2xl font-bold text-tinta">Gerenciar usuários</h1>
          <p className="mt-1 max-w-prose font-texto text-sm text-grafite">
            Escolha um operador para ligar ou desligar os módulos e as áreas que aparecem
            para ele. Sem nada ligado aqui, o operador não vê módulo nenhum.
          </p>
        </div>

        <PainelGestaoUsuarios operadores={operadoresView} />
      </main>
    </>
  );
}
