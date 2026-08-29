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

export async function processarAvisosCertificados(
  hoje: Date = new Date(),
): Promise<ResultadoExecucao> {
  const certificados = await prisma.certificado.findMany({
    include: {
      cliente: true,
      // Desempate por id: sob empate de milissegundo em criadoEm, a escolha
      // da "ultima faixa avisada" precisa ser deterministica.
      avisos: { orderBy: [{ criadoEm: "desc" }, { id: "desc" }], take: 1 },
    },
    orderBy: { dataValidade: "asc" },
  });

  let avisosNovos = 0;
  let falhas = 0;
  const contagemPorFaixa = new Map<FaixaUrgencia, number>();

  for (const certificado of certificados) {
    const dias = diasRestantes(certificado.dataValidade, hoje);
    if (dias > JANELA_DIAS) continue;

    const faixaAtual = calcularFaixa(dias);
    const faixaUltimoAviso =
      (certificado.avisos[0]?.faixa as FaixaUrgencia | undefined) ?? null;

    if (!deveGerarAviso(faixaAtual, faixaUltimoAviso)) continue;

    try {
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
    } catch (erro) {
      // Falha em um certificado nao aborta o lote: os avisos ja gravados
      // ficam, este certificado entra na contagem de falhas e a execucao
      // termina como PARCIAL (spec §5.1 / §12 — processamento granular).
      falhas += 1;
      console.error(
        `[processarAvisosCertificados] falha ao criar aviso do certificado ${certificado.id}:`,
        erro,
      );
      continue;
    }

    avisosNovos += 1;
    contagemPorFaixa.set(
      faixaAtual,
      (contagemPorFaixa.get(faixaAtual) ?? 0) + 1,
    );
  }

  const status: ResultadoExecucao["status"] =
    falhas > 0 ? "PARCIAL" : "SUCESSO";
  const sufixoFalhas =
    falhas > 0 ? `; ${falhas} certificado(s) falharam` : "";
  const total = certificados.length;

  if (avisosNovos === 0) {
    return {
      status,
      resumo: `${total} certificados na carteira, nenhum aviso novo${sufixoFalhas}.`,
    };
  }

  const detalhe = [...contagemPorFaixa.entries()]
    .map(([faixa, n]) => `${n} ${ROTULO_FAIXA[faixa]}`)
    .join(", ");

  return {
    status,
    resumo: `${total} certificados na carteira, ${avisosNovos} aviso(s) novo(s): ${detalhe}${sufixoFalhas}.`,
  };
}
