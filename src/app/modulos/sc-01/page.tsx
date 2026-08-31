import { redirect } from "next/navigation";
import { obterSessao } from "@/lib/sessao-servidor";
import { sair } from "@/lib/sessao-acoes";
import { CabecalhoPortal } from "@/components/CabecalhoPortal";
import { ModuloPageLayout } from "@/components/ModuloPageLayout";
import { filtrarModulosVisiveis, obterModulo } from "@/lib/modulos-catalogo";
import { listarHistorico } from "@/lib/execucao";
import {
  listarClientesParaUpload,
  listarContasDoCliente,
  listarDocumentos,
} from "@/lib/documentos/consultas-sc01";
import { processarPendentes } from "@/lib/documentos/acoes-sc01";
import { FormularioUploadDocumento } from "@/components/documentos/FormularioUploadDocumento";
import { TabelaDocumentos } from "@/components/documentos/TabelaDocumentos";
import { BotaoProcessar } from "@/components/documentos/BotaoProcessar";

type Conta = { id: string; rotulo: string };

function contar(qtd: number, singular: string, plural: string): string {
  return `${qtd} ${qtd === 1 ? singular : plural}`;
}

export default async function PaginaSc01() {
  const sessao = await obterSessao();
  if (!sessao) {
    redirect("/login");
  }

  const modulo = obterModulo("SC-01");
  const podeVer =
    modulo !== undefined &&
    filtrarModulosVisiveis(sessao.papel, sessao.setor).some(
      (m) => m.codigo === "SC-01",
    );
  if (!modulo || !podeVer) {
    redirect("/");
  }

  const [execucoes, documentos, clientes] = await Promise.all([
    listarHistorico("SC-01"),
    listarDocumentos("EXTRATO"),
    listarClientesParaUpload(),
  ]);

  // As contas de cada cliente entram pre-carregadas no formulario (o <select>
  // de conta so filtra a lista, sem fetch no client). Depende de `clientes`,
  // por isso roda apos o Promise.all — mas as N consultas vao em paralelo.
  const contasPorCliente: Record<string, Conta[]> = Object.fromEntries(
    await Promise.all(
      clientes.map(
        async (c) => [c.id, await listarContasDoCliente(c.id)] as const,
      ),
    ),
  );

  const pendentes = documentos.filter((d) => d.status === "PENDENTE").length;

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
                ? `A IA lê os ${contar(pendentes, "extrato pendente", "extratos pendentes")} da fila e grava os lançamentos. Cada lote aparece no histórico abaixo.`
                : "A IA lê os extratos pendentes da fila e grava os lançamentos. Cada lote aparece no histórico abaixo."}
            </p>
          </div>
        }
        conteudo={
          <div className="flex flex-col gap-8">
            <section>
              <div className="mb-3">
                <h2 className="font-titulo text-lg font-bold text-tinta">
                  Enviar extrato
                </h2>
                <p className="mt-1 max-w-prose font-texto text-sm text-grafite">
                  Anexe o extrato em PDF ou foto e escolha o cliente e a conta.
                  Ele entra na fila como pendente até o processamento.
                </p>
              </div>
              <FormularioUploadDocumento
                clientes={clientes}
                contasPorCliente={contasPorCliente}
              />
            </section>

            <section>
              <div className="mb-3">
                <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1.5">
                  <h2 className="font-titulo text-lg font-bold text-tinta">
                    Documentos
                  </h2>
                  {documentos.length > 0 ? (
                    <span className="font-codigo text-xs tabular-nums text-grafite">
                      {pendentes > 0
                        ? `${contar(documentos.length, "documento", "documentos")} · ${pendentes} na fila`
                        : contar(documentos.length, "documento", "documentos")}
                    </span>
                  ) : null}
                </div>
                <p className="mt-1 max-w-prose font-texto text-sm text-grafite">
                  Tudo que já foi enviado, do mais recente ao mais antigo. Abra um
                  documento para conferir os lançamentos e baixar o OFX.
                </p>
              </div>
              <TabelaDocumentos documentos={documentos} />
            </section>
          </div>
        }
      />
    </>
  );
}
