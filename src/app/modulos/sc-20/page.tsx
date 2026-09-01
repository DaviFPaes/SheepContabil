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
  montarColunasKanban,
} from "@/lib/certificados/consultas";
import { rodarAgora } from "@/lib/certificados/acoes";
import { PainelSc20 } from "@/components/certificados/PainelSc20";
import { BotaoRodarAgora } from "@/components/certificados/BotaoRodarAgora";

type Visao = "tabela" | "kanban";
type Foco = "D60" | "D7" | "D3" | null;

function contar(qtd: number, singular: string, plural: string): string {
  return `${qtd} ${qtd === 1 ? singular : plural}`;
}

// NOTA (Tasks 12-13-16-17-18 do plano de implementacao — ver
// docs/superpowers/plans/2026-09-01-sc-20-vencimento-certificado-etapa-1.md):
// esta pagina esta temporariamente reduzida a tabela + botao Atualizar,
// sem o formulario inline (removido — vira ModalCertificado na Task 13),
// sem a lista de avisos (removida — vira SinoAvisos + aba Historico nas
// Tasks 16-18) e sem o Kanban/toggle/modal de perfil (Tasks 10-11-14-18).
export default async function PaginaSc20({
  searchParams,
}: {
  searchParams: Promise<{ visao?: string; foco?: string }>;
}) {
  const sessao = await obterSessao();
  if (!sessao) {
    redirect("/login");
  }

  const modulo = obterModulo("SC-20");
  const podeVer =
    modulo !== undefined &&
    filtrarModulosVisiveis(sessao.papel, sessao.setor).some(
      (m) => m.codigo === "SC-20",
    );
  if (!modulo || !podeVer) {
    redirect("/");
  }

  const { visao, foco } = await searchParams;
  const visaoUrl: Visao | null = visao === "kanban" || visao === "tabela" ? visao : null;
  const focoInicial: Foco =
    foco === "D60" || foco === "D7" || foco === "D3" ? foco : null;

  const [execucoes, certificados] = await Promise.all([
    listarExecucoes("SC-20"),
    listarCertificados(),
  ]);

  const colunas = montarColunasKanban(certificados);
  const contagem = contarNaoAvisados(colunas);

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
            <form action={rodarAgora}>
              <BotaoRodarAgora />
            </form>
            <p className="max-w-prose font-texto text-xs text-grafite">
              Reavalia o bucket de cada certificado e gera os avisos internos
              das faixas que mudaram. Roda sozinho todo dia de madrugada.
            </p>
          </div>
        }
        conteudo={
          <section>
            <div className="mb-3">
              <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1.5">
                <h2 className="font-titulo text-lg font-bold text-tinta">
                  Certificados da carteira
                </h2>
                {certificados.length > 0 ? (
                  <span className="font-codigo text-xs tabular-nums text-grafite">
                    {contar(certificados.length, "certificado", "certificados")}
                  </span>
                ) : null}
              </div>
              <p className="mt-1 max-w-prose font-texto text-sm text-grafite">
                Tabela mostra tudo; o Kanban, só o que está a ≤ 60 dias,
                vencido ou renovado há pouco.
              </p>
            </div>
            <PainelSc20
              certificados={certificados}
              colunas={colunas}
              contagem={contagem}
              visaoUrl={visaoUrl}
              focoInicial={focoInicial}
            />
          </section>
        }
      />
    </>
  );
}
