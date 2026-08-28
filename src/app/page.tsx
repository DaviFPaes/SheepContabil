import { redirect } from "next/navigation";
import { obterSessao } from "@/lib/sessao-servidor";
import { sair } from "@/lib/sessao-acoes";
import { CabecalhoPortal } from "@/components/CabecalhoPortal";
import { ModuloCard } from "@/components/ModuloCard";
import { filtrarModulosVisiveis } from "@/lib/modulos-catalogo";

export default async function PaginaHome() {
  const sessao = await obterSessao();

  if (!sessao) {
    redirect("/login");
  }

  const modulos = filtrarModulosVisiveis(sessao.papel, sessao.setor);

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
      <main className="mx-auto max-w-5xl px-6 py-10">
        <h1 className="mb-6 font-titulo text-2xl font-bold text-tinta">
          Módulos disponíveis
        </h1>
        {modulos.length === 0 ? (
          <p className="font-texto text-sm text-grafite">
            Nenhum módulo disponível para o seu perfil ainda.
          </p>
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {modulos.map((modulo) => (
              <ModuloCard key={modulo.codigo} modulo={modulo} />
            ))}
          </div>
        )}
      </main>
    </>
  );
}
