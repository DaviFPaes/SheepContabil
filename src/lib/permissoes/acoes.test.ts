import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";

const USUARIO_ADMIN_ID = "u-teste-permissoes-admin";
const USUARIO_OPERADOR_ID = "u-teste-permissoes-operador";

let papelSessao: "ADMIN" | "OPERADOR" = "ADMIN";

vi.mock("@/lib/sessao-servidor", () => ({
  obterSessao: vi.fn(async () =>
    papelSessao === "ADMIN"
      ? {
          usuarioId: USUARIO_ADMIN_ID,
          email: "admin-teste-permissoes@sheepcontabil.com.br",
          nome: "Admin Teste",
          papel: "ADMIN",
          setor: null,
        }
      : {
          usuarioId: USUARIO_OPERADOR_ID,
          email: "operador-teste-permissoes@sheepcontabil.com.br",
          nome: "Operador Teste",
          papel: "OPERADOR",
          setor: "Processos",
        },
  ),
}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

import { prisma } from "@/lib/prisma";
import { alternarPermissaoModulo, alternarPermissaoSubArea } from "./acoes";

beforeAll(async () => {
  await prisma.usuario.upsert({
    where: { id: USUARIO_ADMIN_ID },
    update: {},
    create: {
      id: USUARIO_ADMIN_ID,
      email: "u-teste-permissoes-admin@example.com",
      nome: "Admin Teste Acoes",
      senhaHash: "x",
      papel: "ADMIN",
      setor: null,
    },
  });
  await prisma.usuario.upsert({
    where: { id: USUARIO_OPERADOR_ID },
    update: {},
    create: {
      id: USUARIO_OPERADOR_ID,
      email: "u-teste-permissoes-operador@example.com",
      nome: "Operador Teste Acoes",
      senhaHash: "x",
      papel: "OPERADOR",
      setor: "Processos",
    },
  });
});

afterAll(async () => {
  await prisma.registroAuditoria.deleteMany({ where: { entidadeId: USUARIO_OPERADOR_ID } });
  await prisma.permissaoSubArea.deleteMany({ where: { usuarioId: USUARIO_OPERADOR_ID } });
  await prisma.permissaoModulo.deleteMany({ where: { usuarioId: USUARIO_OPERADOR_ID } });
  await prisma.usuario.deleteMany({
    where: { id: { in: [USUARIO_ADMIN_ID, USUARIO_OPERADOR_ID] } },
  });
});

afterEach(() => {
  papelSessao = "ADMIN";
});

describe("alternarPermissaoModulo", () => {
  it("liga um modulo e grava auditoria", async () => {
    const r = await alternarPermissaoModulo(USUARIO_OPERADOR_ID, "SC-20", true);
    expect(r).toEqual({ ok: true });

    const linha = await prisma.permissaoModulo.findUnique({
      where: {
        usuarioId_moduloCodigo: { usuarioId: USUARIO_OPERADOR_ID, moduloCodigo: "SC-20" },
      },
    });
    expect(linha?.habilitado).toBe(true);

    const auditoria = await prisma.registroAuditoria.findFirst({
      where: { entidadeId: USUARIO_OPERADOR_ID, acao: "PERMISSAO_MODULO" },
      orderBy: { criadoEm: "desc" },
    });
    expect(auditoria?.dadosDepois).toEqual({ habilitado: true });
    expect(auditoria?.autorId).toBe(USUARIO_ADMIN_ID);
  });

  it("upsert e idempotente — nao duplica linha ao chamar duas vezes", async () => {
    await alternarPermissaoModulo(USUARIO_OPERADOR_ID, "SC-20", true);
    await alternarPermissaoModulo(USUARIO_OPERADOR_ID, "SC-20", true);

    const linhas = await prisma.permissaoModulo.findMany({
      where: { usuarioId: USUARIO_OPERADOR_ID, moduloCodigo: "SC-20" },
    });
    expect(linhas).toHaveLength(1);
  });

  it("bloqueia quem nao e ADMIN", async () => {
    papelSessao = "OPERADOR";
    await expect(alternarPermissaoModulo(USUARIO_OPERADOR_ID, "SC-20", true)).rejects.toThrow();
  });
});

describe("alternarPermissaoSubArea", () => {
  it("desliga uma sub-area e grava auditoria", async () => {
    const r = await alternarPermissaoSubArea(
      USUARIO_OPERADOR_ID,
      "SC-20",
      "aba_historico",
      false,
    );
    expect(r).toEqual({ ok: true });

    const linha = await prisma.permissaoSubArea.findUnique({
      where: {
        usuarioId_moduloCodigo_subArea: {
          usuarioId: USUARIO_OPERADOR_ID,
          moduloCodigo: "SC-20",
          subArea: "aba_historico",
        },
      },
    });
    expect(linha?.habilitado).toBe(false);
  });

  it("bloqueia quem nao e ADMIN", async () => {
    papelSessao = "OPERADOR";
    await expect(
      alternarPermissaoSubArea(USUARIO_OPERADOR_ID, "SC-20", "aba_historico", false),
    ).rejects.toThrow();
  });
});
