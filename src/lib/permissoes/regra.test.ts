import { describe, expect, it } from "vitest";
import { moduloVisivel, subAreaVisivel, type PermissoesUsuario } from "./regra";
import type { ModuloCatalogo } from "../modulos-catalogo";

const MODULO: ModuloCatalogo = {
  codigo: "X-1",
  nome: "Módulo de teste",
  natureza: "CONTROLE",
  setorDono: "Processos",
  descricao: "teste",
  implementado: true,
};

describe("moduloVisivel", () => {
  it("admin sempre ve, mesmo sem permissoes", () => {
    expect(moduloVisivel("ADMIN", null, MODULO)).toBe(true);
  });

  it("operador de outro setor nao ve, mesmo com o modulo ligado", () => {
    const permissoes: PermissoesUsuario = {
      modulosLigados: new Set(["X-1"]),
      subAreasDesligadas: new Set(),
    };
    expect(moduloVisivel("OPERADOR", "BPO Saúde", MODULO, permissoes)).toBe(false);
  });

  it("operador do setor certo sem permissoes nao ve (falha fechada)", () => {
    expect(moduloVisivel("OPERADOR", "Processos", MODULO)).toBe(false);
  });

  it("operador do setor certo com permissoes mas sem o modulo ligado nao ve", () => {
    const permissoes: PermissoesUsuario = {
      modulosLigados: new Set(),
      subAreasDesligadas: new Set(),
    };
    expect(moduloVisivel("OPERADOR", "Processos", MODULO, permissoes)).toBe(false);
  });

  it("operador do setor certo com o modulo ligado ve", () => {
    const permissoes: PermissoesUsuario = {
      modulosLigados: new Set(["X-1"]),
      subAreasDesligadas: new Set(),
    };
    expect(moduloVisivel("OPERADOR", "Processos", MODULO, permissoes)).toBe(true);
  });
});

describe("subAreaVisivel", () => {
  it("admin sempre ve, mesmo sem permissoes", () => {
    expect(subAreaVisivel("ADMIN", "SC-20", "aba_historico")).toBe(true);
  });

  it("operador ve quando nao ha permissoes buscadas (ausencia = visivel)", () => {
    expect(subAreaVisivel("OPERADOR", "SC-20", "aba_historico")).toBe(true);
  });

  it("operador ve quando ha permissoes mas nenhuma linha pra essa sub-area", () => {
    const permissoes: PermissoesUsuario = {
      modulosLigados: new Set(["SC-20"]),
      subAreasDesligadas: new Set(),
    };
    expect(subAreaVisivel("OPERADOR", "SC-20", "aba_historico", permissoes)).toBe(true);
  });

  it("operador nao ve com override explicito desligado", () => {
    const permissoes: PermissoesUsuario = {
      modulosLigados: new Set(["SC-20"]),
      subAreasDesligadas: new Set(["SC-20:aba_historico"]),
    };
    expect(subAreaVisivel("OPERADOR", "SC-20", "aba_historico", permissoes)).toBe(false);
  });

  it("override de uma sub-area nao afeta outra", () => {
    const permissoes: PermissoesUsuario = {
      modulosLigados: new Set(["SC-20"]),
      subAreasDesligadas: new Set(["SC-20:aba_historico"]),
    };
    expect(subAreaVisivel("OPERADOR", "SC-20", "sino_avisos", permissoes)).toBe(true);
  });
});
