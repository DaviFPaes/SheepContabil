import { describe, expect, it } from "vitest";
import { camposAlterados, rotuloAtor } from "./historico";

describe("rotuloAtor", () => {
  it("usa o e-mail quando ha autor", () =>
    expect(rotuloAtor("ana@x.com")).toBe("ana@x.com"));
  it("usa 'Sistema' quando autor e null", () =>
    expect(rotuloAtor(null)).toBe("Sistema"));
});

describe("camposAlterados", () => {
  it("lista so o que mudou", () => {
    expect(
      camposAlterados(
        { titular: "A", dataValidade: "2026-01-01" },
        { titular: "B", dataValidade: "2026-01-01" },
      ),
    ).toEqual([{ campo: "titular", de: "A", para: "B" }]);
  });
  it("devolve vazio quando nada mudou", () => {
    expect(camposAlterados({ a: 1 }, { a: 1 })).toEqual([]);
  });
  it("tolera null dos dois lados", () => {
    expect(camposAlterados(null, null)).toEqual([]);
  });
  it("ignora chaves ausentes de um dos lados", () => {
    expect(camposAlterados({ a: 1 }, { a: 1, b: 2 })).toEqual([]);
  });
});
