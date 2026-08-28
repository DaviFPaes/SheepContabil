import { describe, expect, it } from "vitest";
import { deveRedirecionarParaLogin } from "./middleware-logica";

describe("deveRedirecionarParaLogin", () => {
  it("nao redireciona a pagina de login mesmo sem sessao", () => {
    expect(deveRedirecionarParaLogin("/login", false)).toBe(false);
  });

  it("redireciona rota protegida sem sessao valida", () => {
    expect(deveRedirecionarParaLogin("/", false)).toBe(true);
  });

  it("nao redireciona rota protegida com sessao valida", () => {
    expect(deveRedirecionarParaLogin("/", true)).toBe(false);
  });

  it("nao redireciona rotas de cron, mesmo sem sessao de usuario", () => {
    // Rotas de cron (ex.: disparo agendado dos modulos futuros) se autenticam
    // sozinhas por segredo proprio (CRON_SECRET), nao por sessao de usuario.
    expect(deveRedirecionarParaLogin("/api/cron/qualquer-coisa", false)).toBe(
      false,
    );
  });

  it("redireciona rotas de api que nao sejam de cron, sem sessao valida", () => {
    expect(deveRedirecionarParaLogin("/api/outra-coisa", false)).toBe(true);
  });
});
