import { prisma } from "@/lib/prisma";
import type { ResultadoExecucao } from "@/lib/execucao";
import {
  calcularFaixa,
  deveGerarAviso,
  diasRestantes,
  mensagemAviso,
  ROTULO_FAIXA,
  type FaixaUrgencia,
} from "./faixa-urgencia";

const JANELA_DIAS = 60;

export async function processarAvisosCertificados(): Promise<ResultadoExecucao> {
  const certificados = await prisma.certificado.findMany({
    include: {
      cliente: true,
      avisos: { orderBy: { criadoEm: "desc" }, take: 1 },
    },
    orderBy: { dataValidade: "asc" },
  });

  const hoje = new Date();
  let avisosNovos = 0;
  const contagemPorFaixa = new Map<FaixaUrgencia, number>();

  for (const certificado of certificados) {
    const dias = diasRestantes(certificado.dataValidade, hoje);
    if (dias > JANELA_DIAS) continue;

    const faixaAtual = calcularFaixa(dias);
    const faixaUltimoAviso =
      (certificado.avisos[0]?.faixa as FaixaUrgencia | undefined) ?? null;

    if (!deveGerarAviso(faixaAtual, faixaUltimoAviso)) continue;

    await prisma.avisoCertificado.create({
      data: {
        certificadoId: certificado.id,
        faixa: faixaAtual,
        diasRestantes: dias,
        mensagem: mensagemAviso(
          certificado.cliente.razaoSocial,
          dias,
          faixaAtual,
        ),
      },
    });

    avisosNovos += 1;
    contagemPorFaixa.set(
      faixaAtual,
      (contagemPorFaixa.get(faixaAtual) ?? 0) + 1,
    );
  }

  if (avisosNovos === 0) {
    return {
      status: "SUCESSO",
      resumo: `${certificados.length} certificados avaliados, nenhum aviso novo.`,
    };
  }

  const detalhe = [...contagemPorFaixa.entries()]
    .map(([faixa, n]) => `${n} ${ROTULO_FAIXA[faixa]}`)
    .join(", ");

  return {
    status: "SUCESSO",
    resumo: `${certificados.length} certificados avaliados, ${avisosNovos} aviso(s) novo(s): ${detalhe}.`,
  };
}
