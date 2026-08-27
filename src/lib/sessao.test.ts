// @vitest-environment node
//
// Nota (Task 5): o ambiente global do Vitest e' jsdom (ver vitest.config.ts).
// O TextEncoder do jsdom produz um Uint8Array de um realm JS diferente do
// globalThis.Uint8Array, e o jose faz um "instanceof Uint8Array" estrito ao
// assinar/verificar com HS256 — isso quebra so' dentro do jsdom, nao no
// runtime real do Next.js (dev/build/middleware/edge), que nunca roda sob
// jsdom. Este comentario forca este arquivo a rodar sob o ambiente "node"
// do Vitest, que usa os globals reais do Node e nao tem esse problema de
// realm. Ver diagnostico completo no relatorio do Task 5.
import { beforeAll, describe, expect, it } from "vitest";
import { criarTokenSessao, verificarTokenSessao } from "./sessao";

beforeAll(() => {
  process.env.SESSION_SECRET =
    "segredo-de-teste-com-pelo-menos-32-caracteres";
});

describe("sessao", () => {
  it("cria um token que verifica de volta para o mesmo payload", async () => {
    const payload = {
      usuarioId: "abc123",
      email: "ana@sheepcontabil.com.br",
      nome: "Ana Souza",
      papel: "ADMIN" as const,
      setor: null,
    };

    const token = await criarTokenSessao(payload);
    const resultado = await verificarTokenSessao(token);

    expect(resultado).toEqual(payload);
  });

  it("retorna null para um token invalido", async () => {
    const resultado = await verificarTokenSessao("token-invalido");
    expect(resultado).toBeNull();
  });
});
