import { afterEach, describe, expect, it } from "vitest";
import { prisma } from "@/lib/prisma";
import { executarModulo, listarHistorico } from "./execucao";

const MODULO_TESTE = "TESTE-FAKE";

afterEach(async () => {
  await prisma.execucao.deleteMany({ where: { moduloCodigo: MODULO_TESTE } });
});

describe("executarModulo", () => {
  it("grava SUCESSO quando a funcao termina bem", async () => {
    const resultado = await executarModulo(
      MODULO_TESTE,
      "teste@sheepcontabil.com.br",
      async () => ({ status: "SUCESSO", resumo: "3 itens processados" }),
    );

    expect(resultado.status).toBe("SUCESSO");
    expect(resultado.resumo).toBe("3 itens processados");
    expect(resultado.finalizadoEm).not.toBeNull();
  });

  it("grava ERRO com mensagem legivel quando a funcao lanca excecao", async () => {
    const resultado = await executarModulo(
      MODULO_TESTE,
      "teste@sheepcontabil.com.br",
      async () => {
        throw new Error("Arquivo em formato inesperado.");
      },
    );

    expect(resultado.status).toBe("ERRO");
    expect(resultado.erro).toBe("Arquivo em formato inesperado.");
  });

  it("lista o historico mais recente primeiro", async () => {
    await executarModulo(MODULO_TESTE, "a@sheepcontabil.com.br", async () => ({
      status: "SUCESSO",
      resumo: "primeira",
    }));
    await executarModulo(MODULO_TESTE, "b@sheepcontabil.com.br", async () => ({
      status: "SUCESSO",
      resumo: "segunda",
    }));

    const historico = await listarHistorico(MODULO_TESTE);

    expect(historico[0].resumo).toBe("segunda");
    expect(historico[1].resumo).toBe("primeira");
  });

  it("mesmo se o registro de erro nao puder ser salvo, ainda lanca a mensagem legivel original", async () => {
    await expect(
      executarModulo(MODULO_TESTE, "teste@sheepcontabil.com.br", async () => {
        const [pendente] = await prisma.execucao.findMany({
          where: { moduloCodigo: MODULO_TESTE, status: "PENDENTE" },
          orderBy: { iniciadoEm: "desc" },
          take: 1,
        });
        await prisma.execucao.delete({ where: { id: pendente.id } });
        throw new Error("Falha original legivel.");
      }),
    ).rejects.toThrow("Falha original legivel.");
  });
});
