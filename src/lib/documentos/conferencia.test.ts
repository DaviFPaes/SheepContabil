import { describe, expect, it } from "vitest";
import {
  classificarLancamento,
  documentoPodeBaixarOfx,
  LIMIAR_CONFIANCA,
  motivoBloqueioOfx,
} from "./conferencia";

describe("classificarLancamento", () => {
  it("abaixo do limiar vai para revisao", () => {
    expect(classificarLancamento(0.84)).toBe("PENDENTE_REVISAO");
  });
  it("no limiar ou acima e confirmado", () => {
    expect(classificarLancamento(LIMIAR_CONFIANCA)).toBe("CONFIRMADO");
    expect(classificarLancamento(0.99)).toBe("CONFIRMADO");
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
