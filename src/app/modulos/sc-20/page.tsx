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
import { BotaoRodarAgora } from "@/components/certificados/BotaoRodarAgora";

const LIMITE_AVISOS = 50;

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
              <BotaoRodarAgora />
            </form>
            <p className="max-w-prose font-texto text-xs text-grafite">
              Varre os certificados da carteira e emite avisos para os que já
              estão vencidos ou vencem nos próximos 60 dias. Cada execução
              aparece no histórico abaixo.
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
                key={certificadoEmEdicao?.id ?? "novo"}
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
                      {avisos.length === LIMITE_AVISOS
                        ? "(últimos 50)"
                        : contar(avisos.length, "aviso", "avisos")}
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
