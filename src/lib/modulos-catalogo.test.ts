import { describe, expect, it } from "vitest";
import { filtrarModulosVisiveis, type ModuloCatalogo } from "./modulos-catalogo";
import type { PermissoesUsuario } from "./permissoes/regra";

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
  it("admin ve todos os modulos implementados, de qualquer setor, sem depender de permissoes", () => {
    const visiveis = filtrarModulosVisiveis("ADMIN", null, catalogoFicticio);
    expect(visiveis.map((m) => m.codigo)).toEqual(["X-1", "X-2"]);
  });

  it("modulo nao implementado nunca aparece, nem para o admin", () => {
    const visiveis = filtrarModulosVisiveis("ADMIN", null, catalogoFicticio);
    expect(visiveis.map((m) => m.codigo)).not.toContain("X-3");
  });

  it("operador sem permissoes buscadas nao ve nenhum modulo (falha fechada)", () => {
    const visiveis = filtrarModulosVisiveis("OPERADOR", "Processos", catalogoFicticio);
    expect(visiveis).toEqual([]);
  });

  it("operador com permissoes mas sem nada ligado nao ve nenhum modulo", () => {
    const permissoes: PermissoesUsuario = {
      modulosLigados: new Set(),
      subAreasDesligadas: new Set(),
    };
    const visiveis = filtrarModulosVisiveis(
      "OPERADOR",
      "Processos",
      catalogoFicticio,
      permissoes,
    );
    expect(visiveis).toEqual([]);
  });

  it("operador so ve os modulos do proprio setor que estao ligados", () => {
    const permissoes: PermissoesUsuario = {
      modulosLigados: new Set(["X-1", "X-2"]), // X-1 e de outro setor
      subAreasDesligadas: new Set(),
    };
    const visiveis = filtrarModulosVisiveis(
      "OPERADOR",
      "Processos",
      catalogoFicticio,
      permissoes,
    );
    expect(visiveis.map((m) => m.codigo)).toEqual(["X-2"]);
  });
});
