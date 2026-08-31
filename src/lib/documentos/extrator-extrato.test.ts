import { afterEach, describe, expect, it } from "vitest";
import {
  criarExtratorFake,
  extrairExtratoComClaude,
  IaIndisponivelError,
  type LinhaExtraida,
} from "./extrator-extrato";

const CHAVE_ORIGINAL = process.env.ANTHROPIC_API_KEY;
afterEach(() => {
  if (CHAVE_ORIGINAL === undefined) delete process.env.ANTHROPIC_API_KEY;
  else process.env.ANTHROPIC_API_KEY = CHAVE_ORIGINAL;
});

describe("extrairExtratoComClaude", () => {
  it("lanca IaIndisponivelError quando ANTHROPIC_API_KEY nao esta setada", async () => {
    delete process.env.ANTHROPIC_API_KEY;
    await expect(
      extrairExtratoComClaude({ mimeType: "application/pdf", base64: "AAAA" }),
    ).rejects.toBeInstanceOf(IaIndisponivelError);
  });
});

describe("criarExtratorFake", () => {
  it("devolve exatamente as linhas passadas", async () => {
    const linhas: LinhaExtraida[] = [
      { data: "2026-08-03", historico: "PAG", valor: -10, confianca: 0.9 },
    ];
    const extrator = criarExtratorFake(linhas);
    await expect(
      extrator({ mimeType: "application/pdf", base64: "x" }),
    ).resolves.toEqual(linhas);
  });
});
