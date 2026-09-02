"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { after } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import type { Prisma } from "@/generated/prisma/client";
import { obterSessao } from "@/lib/sessao-servidor";
import { filtrarModulosVisiveis } from "@/lib/modulos-catalogo";
import { executarModulo } from "@/lib/execucao";
import { processarDocumento } from "./processar-sc01";
import {
  casarCabecalho,
  detectarCabecalhoComClaude,
  type CabecalhoExtrato,
} from "./deteccao-cabecalho";

const ROTA = "/modulos/sc-01";
const MIMES_OK = ["application/pdf", "image/jpeg", "image/png"];
const TAMANHO_MAX = 15 * 1024 * 1024;

async function exigirAcessoSc01() {
  const sessao = await obterSessao();
  const podeVer =
    sessao !== null &&
    filtrarModulosVisiveis(sessao.papel, sessao.setor).some(
      (m) => m.codigo === "SC-01",
    );
  if (!sessao || !podeVer) {
    throw new Error("Sem acesso ao módulo SC-01.");
  }
  return sessao;
}

export type EstadoUpload = { erro: string } | null;

export type EstadoEnvio =
  | { erro: string; indice?: number }
  | { ok: true; enviados: number }
  | null;

// Envio multi-bloco do modal de upload da SC-01. Lê `quantidade` e os campos
// indexados `arquivo-i` / `clienteId-i` / `contaBancariaId-i`.
//
// Regra dura: valida TODOS os blocos antes de criar QUALQUER DocumentoEntrada.
// Se um bloco falha, devolve { erro, indice } e nada é persistido.
export async function enviarDocumentos(
  _prev: EstadoEnvio,
  formData: FormData,
): Promise<EstadoEnvio> {
  const sessao = await exigirAcessoSc01();

  const qtd = Number(formData.get("quantidade") ?? 0);
  if (!Number.isInteger(qtd) || qtd < 1) {
    return { erro: "Anexe ao menos um extrato." };
  }

  type Pronto = {
    clienteId: string;
    contaBancariaId: string;
    bytes: Buffer<ArrayBuffer>;
    nome: string;
    mime: string;
  };
  const prontos: Pronto[] = [];

  for (let i = 0; i < qtd; i += 1) {
    const arquivo = formData.get(`arquivo-${i}`);
    const clienteId = String(formData.get(`clienteId-${i}`) ?? "");
    const contaBancariaId = String(formData.get(`contaBancariaId-${i}`) ?? "");

    if (!(arquivo instanceof File) || arquivo.size === 0) {
      return { erro: "Anexe o arquivo do extrato (PDF, JPG ou PNG).", indice: i };
    }
    if (!MIMES_OK.includes(arquivo.type)) {
      return { erro: "Formato não suportado. Use PDF, JPG ou PNG.", indice: i };
    }
    if (arquivo.size > TAMANHO_MAX) {
      return { erro: "Arquivo acima de 15 MB.", indice: i };
    }
    if (!clienteId || !contaBancariaId) {
      return { erro: "Identifique o cliente e a conta deste extrato.", indice: i };
    }

    const conta = await prisma.contaBancaria.findFirst({
      where: { id: contaBancariaId, clienteId },
    });
    if (!conta) {
      return { erro: "Conta bancária não encontrada para esse cliente.", indice: i };
    }

    prontos.push({
      clienteId,
      contaBancariaId,
      bytes: Buffer.from(await arquivo.arrayBuffer()),
      nome: arquivo.name,
      mime: arquivo.type,
    });
  }

  const ids: string[] = [];
  for (const p of prontos) {
    const doc = await prisma.documentoEntrada.create({
      data: {
        tipo: "EXTRATO",
        clienteId: p.clienteId,
        contaBancariaId: p.contaBancariaId,
        nomeArquivo: p.nome,
        mimeType: p.mime,
        arquivo: p.bytes,
        chegadaEm: new Date(),
      },
    });
    await prisma.registroAuditoria.create({
      data: {
        entidade: "DocumentoEntrada",
        entidadeId: doc.id,
        acao: "EXTRATO_ENVIADO",
        descricao: `Extrato ${p.nome} enviado para a fila`,
        autorId: sessao.usuarioId,
        autorEmail: sessao.email,
        clienteId: p.clienteId,
      },
    });
    ids.push(doc.id);
  }

  revalidatePath(ROTA);

  // Dispara a leitura de cada documento depois da resposta. `after` (estável no
  // Next 16) roda o callback quando a request termina; se por algum motivo ele
  // não rodar, o cron diário (processarExtratos) varre os PENDENTE e é a rede.
  const rodar = async () => {
    for (const id of ids) {
      try {
        await processarDocumento(id);
      } catch (e) {
        console.error("[sc-01 auto]", id, e);
      }
    }
  };
  if (typeof after === "function") after(rodar);
  else void rodar();

  return { ok: true, enviados: ids.length };
}

// Lê só o cabeçalho de UM arquivo (pré-visualização do modal) e tenta casar
// cliente + conta a partir dele. Nunca persiste nada.
export async function detectarCabecalho(
  formData: FormData,
): Promise<
  | { clienteId: string | null; contaBancariaId: string | null; cabecalho: CabecalhoExtrato }
  | { erro: string }
> {
  await exigirAcessoSc01();

  const arquivo = formData.get("arquivo");
  if (!(arquivo instanceof File) || arquivo.size === 0) {
    return { erro: "Arquivo vazio." };
  }
  if (!MIMES_OK.includes(arquivo.type)) {
    return { erro: "Formato não suportado. Use PDF, JPG ou PNG." };
  }
  if (arquivo.size > TAMANHO_MAX) {
    return { erro: "Arquivo acima de 15 MB." };
  }

  const base64 = Buffer.from(await arquivo.arrayBuffer()).toString("base64");
  let cabecalho: CabecalhoExtrato;
  try {
    cabecalho = await detectarCabecalhoComClaude({ mimeType: arquivo.type, base64 });
  } catch {
    return { erro: "Não consegui ler o cabeçalho — selecione cliente e conta na mão." };
  }

  const [clientes, contas] = await Promise.all([
    prisma.cliente.findMany({ select: { id: true, razaoSocial: true } }),
    prisma.contaBancaria.findMany({
      select: { id: true, clienteId: true, bancoNome: true, agencia: true, numero: true },
    }),
  ]);
  const contasPorCliente: Record<
    string,
    { id: string; bancoNome: string; agencia: string; numero: string }[]
  > = {};
  for (const c of contas) (contasPorCliente[c.clienteId] ??= []).push(c);

  const { clienteId, contaBancariaId } = casarCabecalho(
    cabecalho,
    clientes,
    contasPorCliente,
  );
  return { clienteId, contaBancariaId, cabecalho };
}

// Reprocessa um único documento sob demanda (botão na tela de detalhe).
// Renomeado de `processarUm`.
export async function reprocessarDocumento(formData: FormData): Promise<void> {
  const sessao = await exigirAcessoSc01();
  const documentoId = String(formData.get("documentoId") ?? "");
  if (!documentoId) return;

  await executarModulo("SC-01", sessao.email, async () => {
    await processarDocumento(documentoId);
    return {
      status: "SUCESSO",
      resumo: `Documento ${documentoId} reprocessado sob demanda.`,
    };
  });

  const doc = await prisma.documentoEntrada.findUnique({
    where: { id: documentoId },
    select: { clienteId: true, nomeArquivo: true },
  });
  if (doc) {
    await prisma.registroAuditoria.create({
      data: {
        entidade: "DocumentoEntrada",
        entidadeId: documentoId,
        acao: "REPROCESSADO",
        descricao: `Documento ${doc.nomeArquivo} reprocessado sob demanda`,
        autorId: sessao.usuarioId,
        autorEmail: sessao.email,
        clienteId: doc.clienteId,
      },
    });
  }

  revalidatePath(ROTA);
  revalidatePath(`${ROTA}/documento/${documentoId}`);
}

const esquemaConferencia = z.object({
  lancamentoId: z.string().min(1),
  data: z.string().optional(),
  historico: z.string().optional(),
  valor: z.string().optional(),
});

export async function confirmarLancamento(
  _prev: { erro: string } | null,
  formData: FormData,
): Promise<{ erro: string } | null> {
  const sessao = await exigirAcessoSc01();
  const dados = esquemaConferencia.safeParse({
    lancamentoId: formData.get("lancamentoId"),
    data: formData.get("data") ?? undefined,
    historico: formData.get("historico") ?? undefined,
    valor: formData.get("valor") ?? undefined,
  });
  if (!dados.success) return { erro: "Dados inválidos." };

  const lancamento = await prisma.lancamento.findUnique({
    where: { id: dados.data.lancamentoId },
    include: { documentoEntrada: { select: { clienteId: true } } },
  });
  if (!lancamento) return { erro: "Lançamento não encontrado." };

  const patch: Prisma.LancamentoUpdateInput = {
    status: "CONFIRMADO",
    confianca: 1,
  };
  let dataFinal = lancamento.data;
  let historicoFinal = lancamento.historico;
  let valorFinal = Number(lancamento.valor);

  if (dados.data.data) {
    const d = new Date(`${dados.data.data}T00:00:00Z`);
    if (Number.isNaN(d.getTime())) return { erro: "Data inválida." };
    patch.data = d;
    dataFinal = d;
  }
  if (dados.data.historico) {
    patch.historico = dados.data.historico;
    historicoFinal = dados.data.historico;
  }
  if (dados.data.valor !== undefined && dados.data.valor.trim() !== "") {
    const n = Number(dados.data.valor.trim().replace(",", "."));
    if (!Number.isFinite(n)) return { erro: "Valor inválido." };
    patch.valor = n;
    valorFinal = n;
  }

  const dadosAntes = {
    data: lancamento.data.toISOString(),
    historico: lancamento.historico,
    valor: Number(lancamento.valor),
  };
  const dadosDepois = {
    data: dataFinal.toISOString(),
    historico: historicoFinal,
    valor: valorFinal,
  };

  await prisma.$transaction(async (tx) => {
    await tx.lancamento.update({
      where: { id: dados.data.lancamentoId },
      data: patch,
    });
    await tx.registroAuditoria.create({
      data: {
        entidade: "Lancamento",
        entidadeId: dados.data.lancamentoId,
        acao: "LINHA_CONFERIDA",
        descricao: `Linha "${historicoFinal}" conferida`,
        autorId: sessao.usuarioId,
        autorEmail: sessao.email,
        clienteId: lancamento.documentoEntrada.clienteId,
        dadosAntes,
        dadosDepois,
      },
    });
  });

  revalidatePath(`${ROTA}/documento/${lancamento.documentoEntradaId}`);
  return null;
}

export async function excluirDocumento(formData: FormData): Promise<void> {
  const sessao = await exigirAcessoSc01();
  const documentoId = String(formData.get("documentoId") ?? "");
  if (documentoId) {
    const doc = await prisma.documentoEntrada.findUnique({
      where: { id: documentoId },
      select: { clienteId: true, nomeArquivo: true },
    });
    if (doc) {
      await prisma.$transaction(async (tx) => {
        await tx.documentoEntrada.deleteMany({ where: { id: documentoId } });
        await tx.registroAuditoria.create({
          data: {
            entidade: "DocumentoEntrada",
            entidadeId: documentoId,
            acao: "DOCUMENTO_EXCLUIDO",
            descricao: `Documento ${doc.nomeArquivo} excluído`,
            autorId: sessao.usuarioId,
            autorEmail: sessao.email,
            clienteId: doc.clienteId,
          },
        });
      });
    }
  }
  revalidatePath(ROTA);
  redirect(ROTA);
}
