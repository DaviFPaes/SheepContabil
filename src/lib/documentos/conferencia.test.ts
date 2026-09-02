import { describe, expect, it } from "vitest";
import {
  classificarLancamento,
  documentoPodeBaixarOfx,
  LIMIAR_CONFIANCA,
  motivoBloqueioOfx,
} from "./conferencia";

describe("classificarLancamento", () => {
  it("abaixo de 100% vai para revisao", () => {
    expect(classificarLancamento(0.999)).toBe("PENDENTE_REVISAO");
    expect(classificarLancamento(0.85)).toBe("PENDENTE_REVISAO");
    expect(classificarLancamento(0)).toBe("PENDENTE_REVISAO");
  });
  it("exatamente 100% e confirmado", () => {
    expect(classificarLancamento(1)).toBe("CONFIRMADO");
    expect(classificarLancamento(LIMIAR_CONFIANCA)).toBe("CONFIRMADO");
  });
});

describe("documentoPodeBaixarOfx", () => {
  it("false quando nao ha lancamento", () => {
    expect(documentoPodeBaixarOfx([])).toBe(false);
  });
  it("false quando ha linha pendente de revisao", () => {
    expect(
      documentoPodeBaixarOfx([
        { status: "CONFIRMADO" },
        { status: "PENDENTE_REVISAO" },
      ]),
    ).toBe(false);
  });
  it("true quando todas confirmadas", () => {
    expect(
      documentoPodeBaixarOfx([{ status: "CONFIRMADO" }, { status: "CONFIRMADO" }]),
    ).toBe(true);
  });
});

describe("motivoBloqueioOfx", () => {
  it("null quando pode baixar", () => {
    expect(motivoBloqueioOfx([{ status: "CONFIRMADO" }])).toBeNull();
  });
  it("conta as linhas em revisao", () => {
    expect(
      motivoBloqueioOfx([
        { status: "PENDENTE_REVISAO" },
        { status: "PENDENTE_REVISAO" },
        { status: "CONFIRMADO" },
      ]),
    ).toBe("2 linhas ainda em conferência");
  });
  it("mensagem propria quando nao ha lancamento", () => {
    expect(motivoBloqueioOfx([])).toBe("Nenhum lançamento extraído");
  });
});
