import { prisma } from "@/lib/prisma";
import type { ResultadoExecucao } from "@/lib/execucao";
import {
  calcularBucket,
  diasRestantes,
  transicaoGeraNotificacao,
  type Bucket,
} from "./bucket";
import { ROTULO_BUCKET } from "./bucket";

export type ContextoAtor = { autorId: string | null; autorEmail: string | null };

const CONTEXTO_SISTEMA: ContextoAtor = { autorId: null, autorEmail: null };

// Quem enxerga o SC-20 (mesmo criterio de acesso ao modulo): ADMIN, ou
// OPERADOR do setor Processos.
async function listarUsuariosElegiveis() {
  return prisma.usuario.findMany({
    where: {
      OR: [{ papel: "ADMIN" }, { AND: [{ papel: "OPERADOR" }, { setor: "Processos" }] }],
    },
    select: { id: true },
  });
}

function inicioDoDiaUTC(data: Date): Date {
  const d = new Date(data);
  d.setUTCHours(0, 0, 0, 0);
  return d;
}

export async function recalcularBucketsCertificados(
  hoje: Date = new Date(),
  ator: ContextoAtor = CONTEXTO_SISTEMA,
): Promise<ResultadoExecucao> {
  const certificados = await prisma.certificado.findMany({
    where: { ativo: true },
    include: { cliente: true },
    orderBy: { dataValidade: "asc" },
  });

  const usuariosElegiveis = await listarUsuariosElegiveis();
  const inicioHoje = inicioDoDiaUTC(hoje);

  let transicoes = 0;
  let falhas = 0;

  for (const certificado of certificados) {
    try {
      const dias = diasRestantes(certificado.dataValidade, hoje);
      const bucketAtual = calcularBucket(dias, { renovado: false });
      const bucketAnterior = certificado.bucket as Bucket;

      if (bucketAtual === bucketAnterior) continue;

      await prisma.certificado.update({
        where: { id: certificado.id },
        data: { bucket: bucketAtual },
      });

      await prisma.registroAuditoria.create({
        data: {
          entidade: "Certificado",
          entidadeId: certificado.id,
          acao: "TRANSICAO_BUCKET",
          descricao: `Bucket de ${certificado.cliente.razaoSocial} (${certificado.tipo}): ${ROTULO_BUCKET[bucketAnterior]} → ${ROTULO_BUCKET[bucketAtual]}`,
          autorId: ator.autorId,
          autorEmail: ator.autorEmail,
          clienteId: certificado.clienteId,
          dadosAntes: { bucket: bucketAnterior },
          dadosDepois: { bucket: bucketAtual },
        },
      });
      transicoes += 1;

      const tipoNotificacao = transicaoGeraNotificacao(bucketAnterior, bucketAtual);
      if (tipoNotificacao) {
        for (const usuario of usuariosElegiveis) {
          const jaExiste = await prisma.notificacaoInApp.findFirst({
            where: {
              usuarioId: usuario.id,
              certificadoId: certificado.id,
              tipo: tipoNotificacao,
              criadoEm: { gte: inicioHoje },
            },
          });
          if (jaExiste) continue;

          await prisma.notificacaoInApp.create({
            data: {
              usuarioId: usuario.id,
              tipo: tipoNotificacao,
              certificadoId: certificado.id,
              clienteId: certificado.clienteId,
            },
          });
        }
      }
    } catch (erro) {
      // Processamento granular: falha num certificado nao aborta o lote —
      // os demais continuam, a execucao termina como PARCIAL.
      falhas += 1;
      console.error(
        `[recalcularBucketsCertificados] falha ao reavaliar o certificado ${certificado.id}:`,
        erro,
      );
      continue;
    }
  }

  const status: ResultadoExecucao["status"] = falhas > 0 ? "PARCIAL" : "SUCESSO";
  const sufixoFalhas = falhas > 0 ? `; ${falhas} certificado(s) falharam` : "";

  await prisma.registroAuditoria.create({
    data: {
      entidade: "Execucao",
      entidadeId: "",
      acao: "ATUALIZAR_EXECUTADO",
      descricao: `${certificados.length} certificados reavaliados, ${transicoes} transições`,
      autorId: ator.autorId,
      autorEmail: ator.autorEmail,
    },
  });

  return {
    status,
    resumo: `${certificados.length} certificados ativos avaliados, ${transicoes} transição(ões) de faixa${sufixoFalhas}.`,
  };
}
