import { afterEach, describe, expect, it } from "vitest";
import {
  classificarComClaude,
  criarClassificadorFake,
  type ItemParaClassificar,
} from "./classificador-itens";
import { IaIndisponivelError } from "@/lib/ia";

const CHAVE_ORIGINAL = process.env.ANTHROPIC_API_KEY;
afterEach(() => {
  if (CHAVE_ORIGINAL === undefined) delete process.env.ANTHROPIC_API_KEY;
  else process.env.ANTHROPIC_API_KEY = CHAVE_ORIGINAL;
});

describe("classificarComClaude", () => {
  it("lança IaIndisponivelError sem ANTHROPIC_API_KEY", async () => {
    delete process.env.ANTHROPIC_API_KEY;
    await expect(
      classificarComClaude([{ descricao: "Consulta" }]),
    ).rejects.toBeInstanceOf(IaIndisponivelError);
  });
});

describe("criarClassificadorFake", () => {
  it("devolve o que o resolver produzir", async () => {
    const itens: ItemParaClassificar[] = [
      { descricao: "Tomografia" },
      { descricao: "Perícia médica" },
    ];
    const fake = criarClassificadorFake((xs) =>
      xs.map((x, indice) => ({
        indice,
        aliquota: x.descricao.includes("Tomografia") ? "P8" : "P32",
        confianca: 0.9,
        justificativa: "teste",
      })),
    );
    await expect(fake(itens)).resolves.toEqual([
      { indice: 0, aliquota: "P8", confianca: 0.9, justificativa: "teste" },
      { indice: 1, aliquota: "P32", confianca: 0.9, justificativa: "teste" },
    ]);
  });
});
