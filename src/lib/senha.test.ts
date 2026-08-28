import { describe, expect, it } from "vitest";
import { hashSenha, senhaConfere } from "./senha";

describe("senha", () => {
  it("gera um hash que confere com a senha original", async () => {
    const hash = await hashSenha("MinhaSenha123");
    await expect(senhaConfere("MinhaSenha123", hash)).resolves.toBe(true);
  });

  it("rejeita uma senha incorreta", async () => {
    const hash = await hashSenha("MinhaSenha123");
    await expect(senhaConfere("SenhaErrada", hash)).resolves.toBe(false);
  });
});
