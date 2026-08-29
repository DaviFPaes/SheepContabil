import { afterEach, describe, expect, it } from "vitest";
import { prisma } from "@/lib/prisma";
import { executarModulo, listarHistorico } from "./execucao";

// SC-18 e um codigo valido do catalogo estatico (executarModulo valida contra
// ele e lanca para codigos desconhecidos), mas segue com `implementado: false`
// - nao tem historico real de Execucao nem aparece na home, entao exercitar o
// motor generico aqui nao mexe em nenhum modulo de verdade. (SC-20, que ja
// esta implementado, tinha historico real sendo apagado por este arquivo.)
const MODULO_TESTE = "SC-18";

// Todas as chamadas deste arquivo usam este `disparadoPor` dedicado, e a
// limpeza do afterEach so remove linhas com ele - nunca toca em execucoes
// reais, mesmo que um dia o MODULO_TESTE passe a ser um modulo implementado.
const DISPARADO_POR = "__teste_execucao__";

afterEach(async () => {
  await prisma.execucao.deleteMany({
    where: { moduloCodigo: MODULO_TESTE, disparadoPor: DISPARADO_POR },
  });
});

describe("executarModulo", () => {
  it("grava SUCESSO quando a funcao termina bem", async () => {
    const resultado = await executarModulo(
      MODULO_TESTE,
      DISPARADO_POR,
      async () => ({ status: "SUCESSO", resumo: "3 itens processados" }),
    );

    expect(resultado.status).toBe("SUCESSO");
    expect(resultado.resumo).toBe("3 itens processados");
    expect(resultado.finalizadoEm).not.toBeNull();
  });

  it("grava ERRO com mensagem legivel quando a funcao lanca excecao", async () => {
    const resultado = await executarModulo(
      MODULO_TESTE,
      DISPARADO_POR,
      async () => {
        throw new Error("Arquivo em formato inesperado.");
      },
    );

    expect(resultado.status).toBe("ERRO");
    expect(resultado.erro).toBe("Arquivo em formato inesperado.");
  });

  it("lista o historico mais recente primeiro", async () => {
    await executarModulo(MODULO_TESTE, DISPARADO_POR, async () => ({
      status: "SUCESSO",
      resumo: "primeira",
    }));
    await executarModulo(MODULO_TESTE, DISPARADO_POR, async () => ({
      status: "SUCESSO",
      resumo: "segunda",
    }));

    const historico = await listarHistorico(MODULO_TESTE);

    expect(historico[0].resumo).toBe("segunda");
    expect(historico[1].resumo).toBe("primeira");
  });

  it("mesmo se o registro de erro nao puder ser salvo, ainda lanca a mensagem legivel original", async () => {
    await expect(
      executarModulo(MODULO_TESTE, DISPARADO_POR, async () => {
        const [pendente] = await prisma.execucao.findMany({
          where: {
            moduloCodigo: MODULO_TESTE,
            disparadoPor: DISPARADO_POR,
            status: "PENDENTE",
          },
          orderBy: { iniciadoEm: "desc" },
          take: 1,
        });
        await prisma.execucao.delete({ where: { id: pendente.id } });
        throw new Error("Falha original legivel.");
      }),
    ).rejects.toThrow("Falha original legivel.");
  });
});
