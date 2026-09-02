import { describe, expect, it } from "vitest";
import { casarCabecalho, criarDetectorFake, type CabecalhoExtrato } from "./deteccao-cabecalho";

const CLIENTES = [
  { id: "c-alfa", razaoSocial: "Alfa Comércio de Materiais Ltda" },
  { id: "c-beta", razaoSocial: "Beta Consultoria Empresarial Ltda" },
];
const CONTAS = {
  "c-alfa": [
    { id: "cb-1", bancoNome: "Banco Meridiano", agencia: "1201", numero: "45678-9" },
    { id: "cb-2", bancoNome: "Banco Sul", agencia: "0007", numero: "11111-1" },
  ],
  "c-beta": [{ id: "cb-3", bancoNome: "Cooperativa Sul-Campos", agencia: "0455", numero: "10293-8" }],
};

const BASE: CabecalhoExtrato = {
  razaoSocial: null, banco: null, agencia: null, conta: null,
  periodoInicio: null, periodoFim: null, confianca: 0.9,
};

describe("casarCabecalho", () => {
  it("casa cliente por razão social sem acento/caixa e conta por agência+número", () => {
    const r = casarCabecalho(
      { ...BASE, razaoSocial: "ALFA COMERCIO DE MATERIAIS LTDA", agencia: "1201", conta: "45678-9" },
      CLIENTES,
      CONTAS,
    );
    expect(r).toEqual({ clienteId: "c-alfa", contaBancariaId: "cb-1" });
  });

  it("casa conta por nome do banco quando agência/número não batem", () => {
    const r = casarCabecalho(
      { ...BASE, razaoSocial: "Alfa Comércio de Materiais Ltda", banco: "meridiano" },
      CLIENTES,
      CONTAS,
    );
    expect(r).toEqual({ clienteId: "c-alfa", contaBancariaId: "cb-1" });
  });

  it("cliente sem match confiável devolve nulos", () => {
    expect(casarCabecalho({ ...BASE, razaoSocial: "Empresa Desconhecida SA" }, CLIENTES, CONTAS)).toEqual({
      clienteId: null,
      contaBancariaId: null,
    });
  });

  it("cliente único mas conta ambígua devolve clienteId e conta null", () => {
    expect(
      casarCabecalho({ ...BASE, razaoSocial: "Alfa Comércio de Materiais Ltda" }, CLIENTES, CONTAS),
    ).toEqual({ clienteId: "c-alfa", contaBancariaId: null });
  });
});

describe("criarDetectorFake", () => {
  it("devolve o cabeçalho fixo", async () => {
    const det = criarDetectorFake({ ...BASE, razaoSocial: "X" });
    expect((await det({ mimeType: "image/jpeg", base64: "z" })).razaoSocial).toBe("X");
  });
});
