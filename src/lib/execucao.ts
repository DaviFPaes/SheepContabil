import { prisma } from "@/lib/prisma";
import type { Execucao, StatusExecucao } from "@/generated/prisma/client";
import { obterModulo } from "@/lib/modulos-catalogo";

export type ResultadoExecucao = {
  status: Extract<StatusExecucao, "SUCESSO" | "PARCIAL">;
  resumo: string;
};

export type ExecucaoRegistrada = Execucao;

export async function executarModulo(
  moduloCodigo: string,
  disparadoPor: string,
  executar: () => Promise<ResultadoExecucao>,
): Promise<ExecucaoRegistrada> {
  if (!obterModulo(moduloCodigo)) {
    throw new Error(
      `Código de módulo desconhecido: "${moduloCodigo}". Verifique o catálogo em modulos-catalogo.ts.`,
    );
  }

  let execucao: ExecucaoRegistrada;

  try {
    execucao = await prisma.execucao.create({
      data: { moduloCodigo, disparadoPor, status: "PENDENTE" },
    });
  } catch (erroCriacao) {
    console.error(
      "[executarModulo] falha ao criar registro de execução:",
      erroCriacao,
    );
    throw new Error("Falha ao iniciar o registro de execução.");
  }

  try {
    const resultado = await executar();

    return await prisma.execucao.update({
      where: { id: execucao.id },
      data: {
        status: resultado.status,
        resumo: resultado.resumo,
        finalizadoEm: new Date(),
      },
    });
  } catch (erro) {
    const mensagem =
      erro instanceof Error ? erro.message : "Falha inesperada na execução.";

    try {
      return await prisma.execucao.update({
        where: { id: execucao.id },
        data: {
          status: "ERRO",
          erro: mensagem,
          finalizadoEm: new Date(),
        },
      });
    } catch (erroAtualizacao) {
      // Nao conseguiu nem gravar o status de erro (ex.: banco caiu no meio) -
      // ainda assim devolve a mensagem legivel original, nao o erro cru do Prisma.
      console.error(
        "[executarModulo] falha ao gravar status de erro:",
        erroAtualizacao,
      );
      throw new Error(mensagem);
    }
  }
}

export async function listarHistorico(
  moduloCodigo: string,
  limite = 20,
): Promise<ExecucaoRegistrada[]> {
  return prisma.execucao.findMany({
    where: { moduloCodigo },
    orderBy: { iniciadoEm: "desc" },
    take: limite,
  });
}
