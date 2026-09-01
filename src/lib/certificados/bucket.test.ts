import { describe, expect, it } from "vitest";
import {
  calcularBucket,
  diasRestantes,
  textoDias,
  transicaoGeraNotificacao,
} from "./bucket";

describe("calcularBucket", () => {
  it.each([
    [-1, "VENCIDO"],
    [0, "D3"],
    [3, "D3"],
    [4, "D7"],
    [7, "D7"],
    [8, "D60"],
    [60, "D60"],
    [61, "OK"],
    [400, "OK"],
  ] as const)("dias=%i sem renovacao -> %s", (dias, esperado) => {
    expect(calcularBucket(dias, { renovado: false })).toBe(esperado);
  });

  it("renovado vence qualquer faixa de dias", () => {
    expect(calcularBucket(-100, { renovado: true })).toBe("RENOVADO");
    expect(calcularBucket(5, { renovado: true })).toBe("RENOVADO");
  });
});

describe("transicaoGeraNotificacao", () => {
  it("gera ao entrar em D60 vindo de OK", () => {
    expect(transicaoGeraNotificacao("OK", "D60")).toBe("D60_ENTROU");
  });
  it("gera ao entrar em D7 vindo de D60", () => {
    expect(transicaoGeraNotificacao("D60", "D7")).toBe("D7_ENTROU");
  });
  it("gera ao entrar em D3 vindo de D7", () => {
    expect(transicaoGeraNotificacao("D7", "D3")).toBe("D3_ENTROU");
  });
  it("gera no primeiro calculo (de = null) quando ja esta em D7", () => {
    expect(transicaoGeraNotificacao(null, "D7")).toBe("D7_ENTROU");
  });
  it("nao gera ao ir para OK, VENCIDO ou RENOVADO", () => {
    expect(transicaoGeraNotificacao("D7", "VENCIDO")).toBeNull();
    expect(transicaoGeraNotificacao("D60", "OK")).toBeNull();
    expect(transicaoGeraNotificacao("D7", "RENOVADO")).toBeNull();
  });
  it("nao gera quando o bucket nao mudou", () => {
    expect(transicaoGeraNotificacao("D7", "D7")).toBeNull();
  });
  it("nao gera ao voltar para faixa menos urgente (D7 -> D60)", () => {
    expect(transicaoGeraNotificacao("D7", "D60")).toBeNull();
  });
});

describe("textoDias", () => {
  it("futuro", () => expect(textoDias(5)).toBe("faltam 5d"));
  it("hoje", () => expect(textoDias(0)).toBe("vence hoje"));
  it("passado", () => expect(textoDias(-2)).toBe("vencido há 2d"));
});

describe("diasRestantes", () => {
  const hoje = new Date("2026-09-01T18:00:00Z");
  it("hoje = 0", () =>
    expect(diasRestantes(new Date("2026-09-01T23:00:00Z"), hoje)).toBe(0));
  it("futuro positivo", () =>
    expect(diasRestantes(new Date("2026-10-01T00:00:00Z"), hoje)).toBe(30));
  it("passado negativo", () =>
    expect(diasRestantes(new Date("2026-08-30T00:00:00Z"), hoje)).toBe(-2));
});
