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
    ).resolves.toEqual({
      linhas,
      periodoInicio: null,
      periodoFim: null,
    });
  });

  it("devolve linhas e período nulo por padrão", async () => {
    const LINHA: LinhaExtraida = {
      data: "2026-08-03",
      historico: "TED RECEBIDA",
      valor: 100,
      confianca: 1,
    };
    const ex = criarExtratorFake([LINHA]);
    expect(await ex({ mimeType: "application/pdf", base64: "x" })).toEqual({
      linhas: [LINHA],
      periodoInicio: null,
      periodoFim: null,
    });
  });

  it("devolve o período quando informado", async () => {
    const LINHA: LinhaExtraida = {
      data: "2026-08-03",
      historico: "TED RECEBIDA",
      valor: 100,
      confianca: 1,
    };
    const ex = criarExtratorFake([LINHA], { inicio: "2026-08-01", fim: "2026-08-31" });
    const r = await ex({ mimeType: "application/pdf", base64: "x" });
    expect(r.periodoInicio).toBe("2026-08-01");
    expect(r.periodoFim).toBe("2026-08-31");
  });
});
