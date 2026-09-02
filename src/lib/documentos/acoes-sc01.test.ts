import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

// A sessão é mockada como ADMIN com acesso à SC-01.
vi.mock("@/lib/sessao-servidor", () => ({
  obterSessao: async () => ({
    usuarioId: "u-teste",
    email: "admin@sheepcontabil.com.br",
    nome: "Admin",
    papel: "ADMIN",
    setor: null,
  }),
}));
// revalidatePath só funciona dentro de um request scope do Next; fora dele (aqui)
// é um no-op — mesmo padrão dos outros testes de server action (certificados/sc-11).
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
// `after` lança "called outside a request scope" fora do ciclo de request do Next.
// Este teste cobre a criação dos documentos + auditoria, não o agendamento do
// processamento — então `after` vira no-op e `processarDocumento` não roda aqui.
vi.mock("next/server", () => ({ after: vi.fn() }));

import { prisma } from "@/lib/prisma";
import { enviarDocumentos, reprocessarDocumento } from "./acoes-sc01";

// `reprocessarDocumento` é importado para travar o rename (Task 9) — o corpo dele
// é exercido em processar-sc01.test.ts / consultas-sc01.test.ts.
void reprocessarDocumento;

const CNPJ = "77.777.777/0001-77";
const USUARIO_ID = "u-teste";

let inicio: Date;
beforeEach(() => {
  inicio = new Date();
});

beforeAll(async () => {
  // RegistroAuditoria.autorId tem FK real para Usuario.id — a sessão mockada usa
  // "u-teste", então precisa existir uma linha correspondente.
  await prisma.usuario.upsert({
    where: { id: USUARIO_ID },
    update: {},
    create: {
      id: USUARIO_ID,
      email: "u-teste-acoes-sc01@example.com",
      nome: "Admin Teste SC-01",
      senhaHash: "x",
      papel: "ADMIN",
      setor: null,
    },
  });
});

afterEach(async () => {
  await prisma.registroAuditoria.deleteMany({ where: { criadoEm: { gte: inicio } } });
  await prisma.lancamento.deleteMany({ where: { criadoEm: { gte: inicio } } });
  await prisma.documentoEntrada.deleteMany({ where: { cliente: { cnpj: CNPJ } } });
  await prisma.contaBancaria.deleteMany({ where: { cliente: { cnpj: CNPJ } } });
  await prisma.cliente.deleteMany({ where: { cnpj: CNPJ } });
});

afterAll(async () => {
  await prisma.registroAuditoria.deleteMany({ where: { autorId: USUARIO_ID } });
  await prisma.usuario.deleteMany({ where: { id: USUARIO_ID } });
});

async function cliente() {
  const c = await prisma.cliente.create({
    data: { razaoSocial: "Acoes SC-01", cnpj: CNPJ, atividade: "T", email: "acoes-sc01@example.com" },
  });
  const conta = await prisma.contaBancaria.create({
    data: { clienteId: c.id, bancoNome: "Banco T", compe: "001", agencia: "1", numero: "1-1" },
  });
  return { c, conta };
}

function fd(campos: Record<string, string | File>): FormData {
  const f = new FormData();
  for (const [k, v] of Object.entries(campos)) f.append(k, v as never);
  return f;
}
const arq = () => new File([Uint8Array.from([1, 2, 3])], "extrato.pdf", { type: "application/pdf" });

describe("enviarDocumentos", () => {
  it("cria N documentos e grava EXTRATO_ENVIADO por documento", async () => {
    const { c, conta } = await cliente();
    const r = await enviarDocumentos(null, fd({
      quantidade: "2",
      "arquivo-0": arq(), "clienteId-0": c.id, "contaBancariaId-0": conta.id,
      "arquivo-1": arq(), "clienteId-1": c.id, "contaBancariaId-1": conta.id,
    }));
    expect(r).toEqual({ ok: true, enviados: 2 });
    const docs = await prisma.documentoEntrada.findMany({ where: { clienteId: c.id } });
    expect(docs).toHaveLength(2);
    const regs = await prisma.registroAuditoria.count({
      where: { entidade: "DocumentoEntrada", acao: "EXTRATO_ENVIADO", clienteId: c.id },
    });
    expect(regs).toBe(2);
  });

  it("bloqueia o bloco sem cliente resolvido e aponta o índice", async () => {
    const { c, conta } = await cliente();
    const r = await enviarDocumentos(null, fd({
      quantidade: "2",
      "arquivo-0": arq(), "clienteId-0": c.id, "contaBancariaId-0": conta.id,
      "arquivo-1": arq(), "clienteId-1": "", "contaBancariaId-1": "",
    }));
    expect(r).toMatchObject({ indice: 1 });
    expect(await prisma.documentoEntrada.count({ where: { clienteId: c.id } })).toBe(0); // nada persistido
  });

  it("rejeita MIME não suportado", async () => {
    const { c, conta } = await cliente();
    const r = await enviarDocumentos(null, fd({
      quantidade: "1",
      "arquivo-0": new File(["x"], "e.txt", { type: "text/plain" }),
      "clienteId-0": c.id, "contaBancariaId-0": conta.id,
    }));
    expect(r).toMatchObject({ indice: 0 });
  });
});
