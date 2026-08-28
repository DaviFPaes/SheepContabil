import { describe, expect, it } from "vitest";
import { filtrarModulosVisiveis, type ModuloCatalogo } from "./modulos-catalogo";

const catalogoFicticio: ModuloCatalogo[] = [
  {
    codigo: "X-1",
    nome: "Modulo do setor Fiscal",
    natureza: "CONTROLE",
    setorDono: "Fiscal",
    descricao: "teste",
    implementado: true,
  },
  {
    codigo: "X-2",
    nome: "Modulo do setor Processos",
    natureza: "RPA",
    setorDono: "Processos",
    descricao: "teste",
    implementado: true,
  },
  {
    codigo: "X-3",
    nome: "Modulo ainda nao implementado",
    natureza: "AGENTE_IA",
    setorDono: "Fiscal",
    descricao: "teste",
    implementado: false,
  },
];

describe("filtrarModulosVisiveis", () => {
  it("admin ve todos os modulos implementados, de qualquer setor", () => {
    const visiveis = filtrarModulosVisiveis("ADMIN", null, catalogoFicticio);
    expect(visiveis.map((m) => m.codigo)).toEqual(["X-1", "X-2"]);
  });

  it("operador so ve os modulos implementados do proprio setor", () => {
    const visiveis = filtrarModulosVisiveis(
      "OPERADOR",
      "Processos",
      catalogoFicticio,
    );
    expect(visiveis.map((m) => m.codigo)).toEqual(["X-2"]);
  });

  it("modulo nao implementado nunca aparece, nem para o admin", () => {
    const visiveis = filtrarModulosVisiveis("ADMIN", null, catalogoFicticio);
    expect(visiveis.map((m) => m.codigo)).not.toContain("X-3");
  });
});
