import { afterEach, expect, it } from "vitest";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  within,
} from "@testing-library/react";
import { PainelDocumentos } from "./PainelDocumentos";
import type { DocumentoResumo } from "@/lib/documentos/consultas-sc01";

afterEach(cleanup);

const d = (o: Partial<DocumentoResumo>): DocumentoResumo => ({
  id: "d",
  clienteRazaoSocial: "Alfa",
  tipo: "EXTRATO",
  nomeArquivo: "a.pdf",
  status: "PROCESSADO",
  chegadaEm: new Date("2026-08-10T00:00:00Z"),
  totalLancamentos: 2,
  emRevisao: 0,
  podeBaixarOfx: true,
  bancoRotulo: "Banco Meridiano — ag 1 c/c 1",
  competencia: "2026-08",
  ...o,
});

it("ordena por cliente ao clicar no cabeçalho", () => {
  render(
    <PainelDocumentos
      competenciaInicial="2026-08"
      documentos={[
        d({ id: "z", clienteRazaoSocial: "Zeta" }),
        d({ id: "a", clienteRazaoSocial: "Alfa" }),
      ]}
    />,
  );
  fireEvent.click(screen.getByRole("button", { name: /cliente/i }));
  const linhas = screen.getAllByRole("row").slice(1);
  expect(within(linhas[0]).getByText("Alfa")).toBeInTheDocument();
});

it("a célula do arquivo é um link para a rota /arquivo em nova aba", () => {
  render(
    <PainelDocumentos competenciaInicial="2026-08" documentos={[d({ id: "abc" })]} />,
  );
  const link = screen.getByRole("link", { name: /a\.pdf/i });
  expect(link).toHaveAttribute("href", "/modulos/sc-01/documento/abc/arquivo");
  expect(link).toHaveAttribute("target", "_blank");
});

it("filtra por busca", () => {
  render(
    <PainelDocumentos
      competenciaInicial="2026-08"
      documentos={[
        d({ id: "a", clienteRazaoSocial: "Alfa" }),
        d({ id: "b", clienteRazaoSocial: "Beta" }),
      ]}
    />,
  );
  fireEvent.change(screen.getByLabelText(/buscar/i), {
    target: { value: "beta" },
  });
  expect(screen.queryByText("Alfa")).not.toBeInTheDocument();
  expect(screen.getByText("Beta")).toBeInTheDocument();
});
