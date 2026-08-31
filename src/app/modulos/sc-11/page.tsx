import Link from "next/link";
import { redirect } from "next/navigation";
import { obterSessao } from "@/lib/sessao-servidor";
import { sair } from "@/lib/sessao-acoes";
import { CabecalhoPortal } from "@/components/CabecalhoPortal";
import { ModuloPageLayout } from "@/components/ModuloPageLayout";
import { filtrarModulosVisiveis, obterModulo } from "@/lib/modulos-catalogo";
import { listarHistorico } from "@/lib/execucao";
import { listarNotas, listarTermos } from "@/lib/presuncao/consultas-sc11";
import { processarPendentes } from "@/lib/presuncao/acoes-sc11";
import { listarClientesParaUpload } from "@/lib/clientes";
import { FormularioUploadNota } from "@/components/presuncao/FormularioUploadNota";
import { TabelaNotas } from "@/components/presuncao/TabelaNotas";
import { BotaoProcessar } from "@/components/documentos/BotaoProcessar";

function contar(qtd: number, singular: string, plural: string): string {
  return `${qtd} ${qtd === 1 ? singular : plural}`;
}

export default async function PaginaSc11() {
  const sessao = await obterSessao();
  if (!sessao) {
    redirect("/login");
  }

  const modulo = obterModulo("SC-11");
  const podeVer =
    modulo !== undefined &&
    filtrarModulosVisiveis(sessao.papel, sessao.setor).some(
      (m) => m.codigo === "SC-11",
    );
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
      <ModuloPageLayout
        modulo={modulo}
        execucoes={execucoes}
        acoes={
          <div className="flex flex-col gap-2">
            <BotaoProcessar
              acao={processarPendentes}
              rotulo="Processar pendentes"
            />
            <p className="max-w-prose font-texto text-xs text-grafite">
              {pendentes > 0
                ? `A IA classifica os itens das ${contar(pendentes, "nota pendente", "notas pendentes")} da fila na base de presunção; os ${contar(termos.length, "termo cadastrado", "termos cadastrados")} resolvem os casos recorrentes e o restante cai no modelo. Cada lote aparece no histórico abaixo.`
                : `A IA classifica os itens das notas pendentes na base de presunção; os ${contar(termos.length, "termo cadastrado", "termos cadastrados")} resolvem os casos recorrentes e o restante cai no modelo. Cada lote aparece no histórico abaixo.`}
            </p>
            {sessao.papel === "ADMIN" ? (
              <Link
                href="/modulos/sc-11/termos"
                className="font-texto text-sm text-turquesa hover:underline"
              >
                Gerenciar termos de presunção
              </Link>
            ) : null}
          </div>
        }
        conteudo={
          <div className="flex flex-col gap-8">
            <section>
              <div className="mb-3">
                <h2 className="font-titulo text-lg font-bold text-tinta">
                  Enviar NFS-e
                </h2>
                <p className="mt-1 max-w-prose font-texto text-sm text-grafite">
                  Anexe o XML da nota de serviço e escolha o cliente. Ela entra na
                  fila como pendente até o processamento.
                </p>
              </div>
              <FormularioUploadNota clientes={clientes} />
            </section>

            <section>
              <div className="mb-3">
                <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1.5">
                  <h2 className="font-titulo text-lg font-bold text-tinta">
                    Notas
                  </h2>
                  {notas.length > 0 ? (
                    <span className="font-codigo text-xs tabular-nums text-grafite">
                      {pendentes > 0
                        ? `${contar(notas.length, "nota", "notas")} · ${pendentes} na fila`
                        : contar(notas.length, "nota", "notas")}
                    </span>
                  ) : null}
                </div>
                <p className="mt-1 max-w-prose font-texto text-sm text-grafite">
                  Tudo que já foi enviado, da mais recente à mais antiga. Abra uma
                  nota para conferir a classificação e baixar o relatório.
                </p>
              </div>
              <TabelaNotas notas={notas} />
            </section>
          </div>
        }
      />
    </>
  );
}
