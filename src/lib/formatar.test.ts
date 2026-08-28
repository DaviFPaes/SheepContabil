import { describe, expect, it } from "vitest";
import { formatarDuracao } from "./formatar";

describe("formatarDuracao", () => {
  it("mostra em andamento quando ainda nao finalizou", () => {
    expect(formatarDuracao(new Date(), null)).toBe("em andamento");
  });

  it("mostra segundos quando dura menos de um minuto", () => {
    const inicio = new Date("2026-08-27T10:00:00Z");
    const fim = new Date("2026-08-27T10:00:45Z");
    expect(formatarDuracao(inicio, fim)).toBe("45s");
  });

  it("mostra minutos e segundos quando dura mais de um minuto", () => {
    const inicio = new Date("2026-08-27T10:00:00Z");
    const fim = new Date("2026-08-27T10:02:05Z");
    expect(formatarDuracao(inicio, fim)).toBe("2min 5s");
  });
});
