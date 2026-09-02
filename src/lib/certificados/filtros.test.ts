import { describe, expect, it } from "vitest";
import type { CertificadoLinha } from "./consultas";
import { filtrarCertificados, ordenarCertificados } from "./filtros";

function linha(over: Partial<CertificadoLinha> = {}): CertificadoLinha {
  return {
    id: Math.random().toString(36).slice(2),
    clienteId: "cl1",
    razaoSocial: "Alfa Comércio Ltda",
    clienteEmail: "alfa@example.com",
    clienteTelefone: null,
    titular: "Alfa Comércio Ltda",
    tipo: "ECNPJ",
    dataValidade: new Date("2026-10-01T00:00:00Z"),
    emitidoEm: new Date("2025-10-01T00:00:00Z"),
    diasRestantes: 30,
    bucket: "D60",
    ativo: true,
    renovadoEm: null,
    avisoD3Em: null,
    avisoD60: null,
    avisoD7: null,
    ...over,
  };
}

const SEM_FILTRO = { busca: "", tipo: "TODOS", faixa: "TODAS" } as const;

describe("filtrarCertificados", () => {
  it("busca por razão social ou titular, ignorando acento e caixa", () => {
    const dados = [
      linha({ razaoSocial: "Órion Logística ME", titular: "Órion Logística ME" }),
      linha({ razaoSocial: "Beta Consultoria", titular: "Marina Alves" }),
    ];
    expect(filtrarCertificados(dados, { ...SEM_FILTRO, busca: "orion" })).toHaveLength(1);
    expect(filtrarCertificados(dados, { ...SEM_FILTRO, busca: "MARINA" })).toHaveLength(1);
    expect(filtrarCertificados(dados, { ...SEM_FILTRO, busca: "zzz" })).toHaveLength(0);
  });

  it("filtra por tipo", () => {
    const dados = [linha({ tipo: "ECNPJ" }), linha({ tipo: "ECPF" }), linha({ tipo: "NFE" })];
    expect(filtrarCertificados(dados, { ...SEM_FILTRO, tipo: "ECPF" })).toHaveLength(1);
  });

  it("filtra por faixa (bucket)", () => {
    const dados = [linha({ bucket: "VENCIDO" }), linha({ bucket: "D7" }), linha({ bucket: "OK" })];
    expect(filtrarCertificados(dados, { ...SEM_FILTRO, faixa: "VENCIDO" })).toHaveLength(1);
    expect(filtrarCertificados(dados, { ...SEM_FILTRO, faixa: "OK" })).toHaveLength(1);
  });

  it("combina filtros (E lógico)", () => {
    const dados = [
      linha({ tipo: "ECPF", bucket: "VENCIDO", razaoSocial: "Alfa" }),
      linha({ tipo: "ECPF", bucket: "D60", razaoSocial: "Alfa" }),
      linha({ tipo: "ECNPJ", bucket: "VENCIDO", razaoSocial: "Alfa" }),
    ];
    const r = filtrarCertificados(dados, { busca: "alfa", tipo: "ECPF", faixa: "VENCIDO" });
    expect(r).toHaveLength(1);
  });
});

describe("ordenarCertificados", () => {
  const a = linha({ razaoSocial: "Alfa", diasRestantes: 5, tipo: "ECNPJ", dataValidade: new Date("2026-09-10T00:00:00Z") });
  const b = linha({ razaoSocial: "Zeta", diasRestantes: -3, tipo: "NFE", dataValidade: new Date("2026-08-01T00:00:00Z") });
  const c = linha({ razaoSocial: "Meta", diasRestantes: 40, tipo: "ECPF", dataValidade: new Date("2026-12-01T00:00:00Z") });

  it("não muta o array original", () => {
    const arr = [a, b, c];
    ordenarCertificados(arr, "validade-asc");
    expect(arr[0]).toBe(a);
  });

  it("valida ascendente e descendente por data", () => {
    expect(ordenarCertificados([a, b, c], "validade-asc").map((l) => l.razaoSocial)).toEqual([
      "Zeta",
      "Alfa",
      "Meta",
    ]);
    expect(ordenarCertificados([a, b, c], "validade-desc").map((l) => l.razaoSocial)).toEqual([
      "Meta",
      "Alfa",
      "Zeta",
    ]);
  });

  it("ordena por cliente A–Z e por dias restantes", () => {
    expect(ordenarCertificados([c, a, b], "cliente-asc").map((l) => l.razaoSocial)).toEqual([
      "Alfa",
      "Meta",
      "Zeta",
    ]);
    expect(ordenarCertificados([a, b, c], "dias-asc").map((l) => l.diasRestantes)).toEqual([
      -3, 5, 40,
    ]);
  });
});
