import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/sessao-servidor", () => ({
  obterSessao: vi.fn(async () => ({
    usuarioId: "u1",
    email: "admin@teste.com",
    nome: "Admin Teste",
    papel: "ADMIN",
    setor: null,
  })),
}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

import { prisma } from "@/lib/prisma";
import { criarClassificadorFake } from "./classificador-itens";
import { processarDocumento } from "./processar-sc11";
import { criarTermo, editarTermo, removerTermo, revisarItem } from "./acoes-sc11";

const TERMO_MARCADOR = "zzz-teste-";
const MARCADOR = "sc11-teste";
const CNPJ = "66.666.666/0001-66";

function fd(obj: Record<string, string>): FormData {
  const f = new FormData();
  for (const [k, v] of Object.entries(obj)) f.set(k, v);
  return f;
}

afterEach(async () => {
  await prisma.itemNota.deleteMany({
    where: { notaServico: { documentoEntrada: { nomeArquivo: { startsWith: MARCADOR } } } },
  });
  await prisma.notaServico.deleteMany({
    where: { documentoEntrada: { nomeArquivo: { startsWith: MARCADOR } } },
  });
  await prisma.documentoEntrada.deleteMany({ where: { nomeArquivo: { startsWith: MARCADOR } } });
  await prisma.cliente.deleteMany({ where: { cnpj: CNPJ } });
  await prisma.auditoriaTermo.deleteMany({ where: { termoTexto: { startsWith: TERMO_MARCADOR } } });
  await prisma.termoPresuncao.deleteMany({ where: { termo: { startsWith: TERMO_MARCADOR } } });
});

describe("criarTermo / editarTermo / removerTermo — auditoria", () => {
  it("criarTermo grava AuditoriaTermo CRIACAO", async () => {
    await criarTermo(null, fd({ termo: `${TERMO_MARCADOR}tomografia`, aliquota: "P8" }));
    const t = await prisma.termoPresuncao.findFirstOrThrow({ where: { termo: `${TERMO_MARCADOR}tomografia` } });
    const aud = await prisma.auditoriaTermo.findFirstOrThrow({ where: { termoId: t.id } });
    expect(aud.acao).toBe("CRIACAO");
    expect(aud.aliquotaNova).toBe("P8");
    expect(aud.autorEmail).toBe("admin@teste.com");
  });

  it("criarTermo rejeita termo equivalente (normalizado)", async () => {
    await criarTermo(null, fd({ termo: `${TERMO_MARCADOR}Raio X`, aliquota: "P8" }));
    const r = await criarTermo(null, fd({ termo: `${TERMO_MARCADOR}raio  x`, aliquota: "P32" }));
    expect(r).toEqual({ erro: "Termo equivalente já cadastrado." });
  });

  it("editarTermo com base diferente grava RECLASSIFICACAO; sem mudança não grava", async () => {
    await criarTermo(null, fd({ termo: `${TERMO_MARCADOR}tc`, aliquota: "P8" }));
    const t = await prisma.termoPresuncao.findFirstOrThrow({ where: { termo: `${TERMO_MARCADOR}tc` } });

    await editarTermo(fd({ id: t.id, aliquota: "P8" })); // no-op
    await editarTermo(fd({ id: t.id, aliquota: "P32" })); // reclassifica

    const auds = await prisma.auditoriaTermo.findMany({
      where: { termoTexto: `${TERMO_MARCADOR}tc` },
      orderBy: { criadoEm: "asc" },
    });
    expect(auds.map((a) => a.acao)).toEqual(["CRIACAO", "RECLASSIFICACAO"]);
    expect(auds[1].aliquotaAnterior).toBe("P8");
    expect(auds[1].aliquotaNova).toBe("P32");
  });

  it("removerTermo grava REMOCAO com snapshot e termoId null", async () => {
    await criarTermo(null, fd({ termo: `${TERMO_MARCADOR}del`, aliquota: "P32" }));
    const t = await prisma.termoPresuncao.findFirstOrThrow({ where: { termo: `${TERMO_MARCADOR}del` } });
    await removerTermo(fd({ id: t.id }));
    expect(await prisma.termoPresuncao.findUnique({ where: { id: t.id } })).toBeNull();
    const aud = await prisma.auditoriaTermo.findFirstOrThrow({
      where: { termoTexto: `${TERMO_MARCADOR}del`, acao: "REMOCAO" },
    });
    expect(aud.termoId).toBeNull();
    expect(aud.aliquotaAnterior).toBe("P32");
  });
});

describe("revisarItem", () => {
  it("vira MANUAL/CONFIRMADO e limpa a confiança", async () => {
    const cliente = await prisma.cliente.upsert({
      where: { cnpj: CNPJ },
      update: {},
      create: {
        razaoSocial: "Cliente SC-11 Teste",
        cnpj: CNPJ,
        atividade: "Teste",
        email: "cliente-sc11-teste@example.com",
      },
    });
    const doc = await prisma.documentoEntrada.create({
      data: {
        tipo: "NFSE",
        clienteId: cliente.id,
        nomeArquivo: `${MARCADOR}-rev.xml`,
        mimeType: "application/xml",
        arquivo: Buffer.from(
          `<NFSe><InfNfse><Numero>1</Numero><DataEmissao>2026-08-01</DataEmissao><ListaItens><Item><Discriminacao>Servico vago</Discriminacao><Valor>50</Valor></Item></ListaItens><ValorTotal>50</ValorTotal></InfNfse></NFSe>`,
          "utf8",
        ),
        chegadaEm: new Date(),
      },
    });
    await processarDocumento(
      doc.id,
      criarClassificadorFake((itens) =>
        itens.map((_, indice) => ({ indice, aliquota: "P32" as const, confianca: 0.3, justificativa: "vago" })),
      ),
    );
    const item = await prisma.itemNota.findFirstOrThrow({
      where: { notaServico: { documentoEntradaId: doc.id } },
    });

    await revisarItem(null, fd({ itemId: item.id, aliquota: "P8" }));

    const depois = await prisma.itemNota.findUniqueOrThrow({ where: { id: item.id } });
    expect(depois.origem).toBe("MANUAL");
    expect(depois.status).toBe("CONFIRMADO");
    expect(depois.aliquota).toBe("P8");
    expect(depois.confianca).toBeNull();
    expect(depois.justificativa).toMatch(/Reclassificado de 32% para 8%/);
  });
});
