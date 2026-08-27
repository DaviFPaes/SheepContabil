import { describe, expect, it } from "vitest";
import { cnpjValido, gerarCnpjValido } from "./cnpj";

describe("cnpj", () => {
  it("gera um CNPJ com os digitos verificadores corretos", () => {
    const cnpj = gerarCnpjValido("11222333");
    expect(cnpjValido(cnpj)).toBe(true);
  });

  it("rejeita um CNPJ com digito verificador adulterado", () => {
    const cnpj = gerarCnpjValido("11222333");
    const adulterado = cnpj.slice(0, -1) + (cnpj.endsWith("9") ? "8" : "9");
    expect(cnpjValido(adulterado)).toBe(false);
  });

  it("rejeita string que nao tem 14 digitos", () => {
    expect(cnpjValido("123")).toBe(false);
  });
});
