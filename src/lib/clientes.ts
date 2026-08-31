import { prisma } from "@/lib/prisma";

/** Clientes para o <select> dos formulários de upload (SC-01 e SC-11). */
export async function listarClientesParaUpload(): Promise<
  { id: string; razaoSocial: string }[]
> {
  return prisma.cliente.findMany({
    orderBy: { razaoSocial: "asc" },
    select: { id: true, razaoSocial: true },
  });
}
