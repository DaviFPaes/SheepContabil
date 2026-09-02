import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { prisma } from "@/lib/prisma";
import { obterPermissoesUsuario, listarOperadoresParaGestao } from "./consultas";

const USUARIO_ID = "u-teste-permissoes-consultas";

beforeAll(async () => {
  await prisma.usuario.upsert({
    where: { id: USUARIO_ID },
    update: {},
    create: {
      id: USUARIO_ID,
      email: "u-teste-permissoes-consultas@example.com",
      nome: "Operador Teste Permissoes",
      senhaHash: "x",
      papel: "OPERADOR",
      setor: "Processos",
    },
  });
});

afterAll(async () => {
  await prisma.permissaoSubArea.deleteMany({ where: { usuarioId: USUARIO_ID } });
  await prisma.permissaoModulo.deleteMany({ where: { usuarioId: USUARIO_ID } });
  await prisma.usuario.deleteMany({ where: { id: USUARIO_ID } });
});

describe("obterPermissoesUsuario", () => {
  it("sem nenhuma linha, devolve os dois conjuntos vazios", async () => {
    const permissoes = await obterPermissoesUsuario(USUARIO_ID);
    expect(permissoes.modulosLigados.size).toBe(0);
    expect(permissoes.subAreasDesligadas.size).toBe(0);
  });

  it("so entra no conjunto de modulos ligados quem tem habilitado = true", async () => {
    await prisma.permissaoModulo.create({
      data: { usuarioId: USUARIO_ID, moduloCodigo: "SC-20", habilitado: true },
    });
    await prisma.permissaoModulo.create({
      data: { usuarioId: USUARIO_ID, moduloCodigo: "SC-01", habilitado: false },
    });

    const permissoes = await obterPermissoesUsuario(USUARIO_ID);
    expect(permissoes.modulosLigados).toEqual(new Set(["SC-20"]));
  });

  it("so entra no conjunto de sub-areas desligadas quem tem habilitado = false", async () => {
    await prisma.permissaoSubArea.create({
      data: {
        usuarioId: USUARIO_ID,
        moduloCodigo: "SC-20",
        subArea: "aba_historico",
        habilitado: false,
      },
    });
    await prisma.permissaoSubArea.create({
      data: {
        usuarioId: USUARIO_ID,
        moduloCodigo: "SC-20",
        subArea: "sino_avisos",
        habilitado: true,
      },
    });

    const permissoes = await obterPermissoesUsuario(USUARIO_ID);
    expect(permissoes.subAreasDesligadas).toEqual(new Set(["SC-20:aba_historico"]));
  });
});

describe("listarOperadoresParaGestao", () => {
  it("conta so os modulos elegiveis pelo setor do operador, ligados de verdade", async () => {
    await prisma.permissaoModulo.upsert({
      where: { usuarioId_moduloCodigo: { usuarioId: USUARIO_ID, moduloCodigo: "SC-20" } },
      update: { habilitado: true },
      create: { usuarioId: USUARIO_ID, moduloCodigo: "SC-20", habilitado: true },
    });

    const lista = await listarOperadoresParaGestao();
    const item = lista.find((o) => o.id === USUARIO_ID);

    expect(item).toBeDefined();
    expect(item?.setor).toBe("Processos");
    expect(item?.modulosElegiveis.every((m) => m.setorDono === "Processos")).toBe(true);
    expect(item?.permissoes.modulosLigados.has("SC-20")).toBe(true);
  });

  it("so lista usuarios com papel OPERADOR", async () => {
    const lista = await listarOperadoresParaGestao();
    expect(lista.some((o) => o.email === "admin@sheepcontabil.com.br")).toBe(false);
  });
});
