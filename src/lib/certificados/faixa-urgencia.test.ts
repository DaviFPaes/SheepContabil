import { describe, expect, it } from "vitest";
import type { FaixaUrgencia as FaixaUrgenciaPrisma } from "@/generated/prisma/client";
import {
  calcularFaixa,
  deveGerarAviso,
  diasRestantes,
  mensagemAviso,
  type FaixaUrgencia,
} from "./faixa-urgencia";

describe("diasRestantes", () => {
  const hoje = new Date("2026-08-29T15:00:00Z");

  it("conta zero quando vence hoje", () => {
    expect(diasRestantes(new Date("2026-08-29T23:59:00Z"), hoje)).toBe(0);
  });

  it("conta positivo para o futuro", () => {
    expect(diasRestantes(new Date("2026-10-13T00:00:00Z"), hoje)).toBe(45);
  });

  it("conta negativo para o passado", () => {
    expect(diasRestantes(new Date("2026-08-26T00:00:00Z"), hoje)).toBe(-3);
  });
});

describe("calcularFaixa", () => {
  it.each([
    [-1, "VENCIDO"],
    [0, "CRITICO"],
    [7, "CRITICO"],
    [8, "ALERTA"],
    [30, "ALERTA"],
    [31, "PROXIMO"],
    [60, "PROXIMO"],
    [61, "OK"],
    [365, "OK"],
  ])("dias=%i -> %s", (dias, esperado) => {
    expect(calcularFaixa(dias)).toBe(esperado);
  });
});

describe("deveGerarAviso", () => {
  it("gera o primeiro aviso quando nunca houve aviso e a faixa nao e OK", () => {
    expect(deveGerarAviso("ALERTA", null)).toBe(true);
  });

  it("nao gera aviso quando a faixa e OK, mesmo sem aviso anterior", () => {
    expect(deveGerarAviso("OK", null)).toBe(false);
  });

  it("nao gera aviso quando a faixa nao mudou", () => {
    expect(deveGerarAviso("CRITICO", "CRITICO")).toBe(false);
  });

  it("gera aviso quando a faixa mudou para uma mais urgente", () => {
    expect(deveGerarAviso("CRITICO", "ALERTA")).toBe(true);
  });
});

describe("ponte FaixaUrgencia (enum Prisma <-> union do dominio)", () => {
  it("mantem os dois tipos mutuamente atribuiveis (guarda de compilacao)", () => {
    // Igualdade exata em nivel de tipo. Se schema.prisma ganhar ou perder uma
    // faixa sem o mesmo ajuste em faixa-urgencia.ts, uma das direcoes deixa de
    // valer, `Exato<>` vira `false` e `const ... = true` para de compilar — o
    // gate `tsc --noEmit` quebra antes do build.
    type Exato<A, B> = [A] extends [B]
      ? [B] extends [A]
        ? true
        : false
      : false;
    const pontesOk: Exato<FaixaUrgencia, FaixaUrgenciaPrisma> = true;
    expect(pontesOk).toBe(true);
  });
});

describe("mensagemAviso", () => {
  it("descreve vencimento futuro", () => {
    expect(mensagemAviso("Alfa Comércio Ltda", 5, "CRITICO")).toBe(
      "O certificado digital de Alfa Comércio Ltda vence em 5 dias (faixa CRÍTICO).",
    );
  });

  it("descreve vencimento hoje", () => {
    expect(mensagemAviso("Alfa Comércio Ltda", 0, "CRITICO")).toBe(
      "O certificado digital de Alfa Comércio Ltda vence hoje (faixa CRÍTICO). Renovação urgente.",
    );
  });

  it("descreve certificado ja vencido no singular", () => {
    expect(mensagemAviso("Alfa Comércio Ltda", -1, "VENCIDO")).toBe(
      "O certificado digital de Alfa Comércio Ltda venceu há 1 dia (faixa VENCIDO). Renovação e revalidação de acessos necessárias.",
    );
  });
});
