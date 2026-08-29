import { redirect } from "next/navigation";
import { obterSessao } from "@/lib/sessao-servidor";
import { sair } from "@/lib/sessao-acoes";
import { CabecalhoPortal } from "@/components/CabecalhoPortal";
import { ModuloPageLayout } from "@/components/ModuloPageLayout";
import { filtrarModulosVisiveis, obterModulo } from "@/lib/modulos-catalogo";
import { listarHistorico } from "@/lib/execucao";
import {
  listarAvisos,
  listarCertificadosComStatus,
  listarClientesParaSelecao,
} from "@/lib/certificados/consultas";
import { rodarAgora } from "@/lib/certificados/acoes";
import { PainelCertificados } from "@/components/certificados/PainelCertificados";
import { FormularioCertificado } from "@/components/certificados/FormularioCertificado";
import { ListaAvisos } from "@/components/certificados/ListaAvisos";

function contar(qtd: number, singular: string, plural: string): string {
  return `${qtd} ${qtd === 1 ? singular : plural}`;
}

export default async function PaginaSc20({
  searchParams,
}: {
  searchParams: Promise<{ editar?: string }>;
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

  const { editar } = await searchParams;
  const [execucoes, certificados, avisos, clientes] = await Promise.all([
    listarHistorico("SC-20"),
    listarCertificadosComStatus(),
    listarAvisos(),
    listarClientesParaSelecao(),
  ]);

  const certificadoEmEdicao = editar
    ? (certificados.find((c) => c.id === editar) ?? null)
    : null;

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
              <button className="inline-flex items-center gap-2 rounded bg-petroleo px-4 py-2 font-texto text-sm font-semibold text-nevoa transition-colors hover:bg-turquesa focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-petroleo motion-reduce:transition-none">
                <svg
                  aria-hidden="true"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth={1.75}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="h-4 w-4"
                >
                  <path d="M7 4.5v15l12-7.5z" />
                </svg>
                Rodar agora
              </button>
            </form>
            <p className="max-w-prose font-texto text-xs text-grafite">
              Varre os certificados da carteira e emite avisos para os que vencem
              nos próximos 60 dias. Cada execução aparece no histórico abaixo.
            </p>
          </div>
        }
        conteudo={
          <div className="flex flex-col gap-8">
            <section>
              <div className="mb-3">
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
                  <h2 className="font-titulo text-lg font-bold text-tinta">
                    {certificadoEmEdicao
                      ? "Editar certificado"
                      : "Novo certificado"}
                  </h2>
                  {certificadoEmEdicao ? (
                    <span className="inline-flex items-center gap-1.5 rounded-full bg-ambar/15 px-2 py-0.5 font-texto text-xs font-medium leading-none text-ambar ring-1 ring-inset ring-ambar/35">
                      <span
                        aria-hidden="true"
                        className="h-1.5 w-1.5 shrink-0 rounded-full bg-current"
                      />
                      Modo edição
                    </span>
                  ) : null}
                </div>
                <p className="mt-1 max-w-prose font-texto text-sm text-grafite">
                  {certificadoEmEdicao
                    ? `Ajustando o certificado de ${certificadoEmEdicao.razaoSocial}. As mudanças valem só para este registro.`
                    : "Cadastre o certificado digital de um cliente para acompanhar o vencimento."}
                </p>
              </div>
              <FormularioCertificado
                clientes={clientes}
                certificado={certificadoEmEdicao}
              />
            </section>

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
                  Ordenados por validade, do mais urgente ao mais distante. A
                  faixa resume quanto tempo resta.
                </p>
              </div>
              <PainelCertificados certificados={certificados} />
            </section>

            <section>
              <div className="mb-3">
                <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1.5">
                  <h2 className="font-titulo text-lg font-bold text-tinta">
                    Avisos emitidos
                  </h2>
                  {avisos.length > 0 ? (
                    <span className="font-codigo text-xs tabular-nums text-grafite">
                      {contar(avisos.length, "aviso", "avisos")}
                    </span>
                  ) : null}
                </div>
                <p className="mt-1 max-w-prose font-texto text-sm text-grafite">
                  Gerados a cada execução para os certificados dentro da janela de
                  60 dias. Mais recentes no topo.
                </p>
              </div>
              <ListaAvisos avisos={avisos} />
            </section>
          </div>
        }
      />
    </>
  );
}
