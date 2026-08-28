import { prisma } from "@/lib/prisma";
import type { Execucao } from "@/generated/prisma/client";

export type ResultadoExecucao = {
  status: "SUCESSO" | "PARCIAL";
  resumo: string;
};

export type ExecucaoRegistrada = Execucao;

export async function executarModulo(
  moduloCodigo: string,
  disparadoPor: string,
  executar: () => Promise<ResultadoExecucao>,
): Promise<ExecucaoRegistrada> {
  const execucao = await prisma.execucao.create({
    data: { moduloCodigo, disparadoPor, status: "PENDENTE" },
  });

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

    return await prisma.execucao.update({
      where: { id: execucao.id },
      data: {
        status: "ERRO",
        erro: mensagem,
        finalizadoEm: new Date(),
      },
    });
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
