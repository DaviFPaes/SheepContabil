import { describe, expect, it } from "vitest";
import {
  bancosDisponiveis,
  filtrarDocumentos,
  ordenarDocumentos,
} from "./filtros-documentos";
import type { DocumentoResumo } from "./consultas-sc01";

function doc(over: Partial<DocumentoResumo>): DocumentoResumo {
  return {
    id: "d",
    clienteRazaoSocial: "Alfa Comércio de Materiais Ltda",
    tipo: "EXTRATO",
    nomeArquivo: "extrato.pdf",
    status: "PROCESSADO",
    chegadaEm: new Date("2026-08-10T00:00:00Z"),
    totalLancamentos: 3,
    emRevisao: 0,
    podeBaixarOfx: true,
    bancoRotulo: "Banco Meridiano — ag 1201 c/c 45678-9",
    competencia: "2026-08",
    ...over,
  };
}

describe("filtrarDocumentos", () => {
  it("busca casa cliente e nome do arquivo, sem acento e sem caixa", () => {
    const docs = [
      doc({ id: "a", clienteRazaoSocial: "Épsilon Tecnologia" }),
      doc({ id: "b", nomeArquivo: "AGOSTO-conta.jpg" }),
      doc({ id: "c", clienteRazaoSocial: "Outra" }),
    ];
    const r = filtrarDocumentos(docs, {
      busca: "epsilon",
      status: "TODOS",
      banco: "TODOS",
      competencia: "",
    });
    expect(r.map((d) => d.id)).toEqual(["a"]);
    expect(
      filtrarDocumentos(docs, { busca: "agosto", status: "TODOS", banco: "TODOS", competencia: "" }).map((d) => d.id),
    ).toEqual(["b"]);
  });

  it("filtra por status, banco e competencia combinados", () => {
    const docs = [
      doc({ id: "a", status: "ERRO" }),
      doc({ id: "b", status: "PROCESSADO", bancoRotulo: "Banco X" }),
      doc({ id: "c", status: "PROCESSADO", competencia: "2026-07" }),
    ];
    expect(
      filtrarDocumentos(docs, { busca: "", status: "PROCESSADO", banco: "TODOS", competencia: "2026-08" }).map((d) => d.id),
    ).toEqual(["b"]);
  });
});

describe("ordenarDocumentos", () => {
  it("chegada-desc põe o mais recente primeiro", () => {
    const docs = [
      doc({ id: "velho", chegadaEm: new Date("2026-08-01T00:00:00Z") }),
      doc({ id: "novo", chegadaEm: new Date("2026-08-20T00:00:00Z") }),
    ];
    expect(ordenarDocumentos(docs, "chegada-desc").map((d) => d.id)).toEqual(["novo", "velho"]);
    expect(ordenarDocumentos(docs, "chegada-asc").map((d) => d.id)).toEqual(["velho", "novo"]);
  });

  it("status-asc ordena PENDENTE < PROCESSADO < ERRO", () => {
    const docs = [
      doc({ id: "e", status: "ERRO" }),
      doc({ id: "p", status: "PENDENTE" }),
      doc({ id: "ok", status: "PROCESSADO" }),
    ];
    expect(ordenarDocumentos(docs, "status-asc").map((d) => d.id)).toEqual(["p", "ok", "e"]);
  });

  it("cliente-asc usa localeCompare pt-BR e não muta a entrada", () => {
    const docs = [doc({ id: "z", clienteRazaoSocial: "Zeta" }), doc({ id: "a", clienteRazaoSocial: "Alfa" })];
    const copia = [...docs];
    expect(ordenarDocumentos(docs, "cliente-asc").map((d) => d.id)).toEqual(["a", "z"]);
    expect(docs).toEqual(copia);
  });
});

describe("bancosDisponiveis", () => {
  it("devolve rótulos distintos e ordenados, ignorando null", () => {
    const docs = [
      doc({ bancoRotulo: "Banco B" }),
      doc({ bancoRotulo: "Banco A" }),
      doc({ bancoRotulo: "Banco B" }),
      doc({ bancoRotulo: null }),
    ];
    expect(bancosDisponiveis(docs)).toEqual(["Banco A", "Banco B"]);
  });
});
