import { prisma } from "@/lib/prisma";
import type { ResultadoExecucao } from "@/lib/execucao";
import { diasRestantes } from "./faixa-urgencia";

const JANELA_DIAS = 60;

// STUB temporario (Task 1 do plano de implementacao — ver
// docs/superpowers/plans/2026-09-01-sc-20-vencimento-certificado-etapa-1.md).
// A migracao sc20_kanban_avisos mudou o que AvisoCertificado representa (de
// "faixa mudou" para "marco de e-mail"), entao o motor antigo nao compila
// mais como estava. O motor real — recalcularBucketsCertificados, que grava
// bucket + RegistroAuditoria + NotificacaoInApp — entra na Task 5. Ate la,
// este stub so mantem o cron e o botao "Atualizar" funcionando sem erro.
export async function processarAvisosCertificados(
  hoje: Date = new Date(),
): Promise<ResultadoExecucao> {
  const certificados = await prisma.certificado.findMany({
    where: { ativo: true },
    orderBy: { dataValidade: "asc" },
  });

  const dentroDaJanela = certificados.filter(
    (certificado) => diasRestantes(certificado.dataValidade, hoje) <= JANELA_DIAS,
  ).length;

  return {
    status: "SUCESSO",
    resumo: `${certificados.length} certificados ativos, ${dentroDaJanela} dentro da janela de 60 dias (motor completo chega na Task 5).`,
  };
}
