import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { ModuloCard } from "./ModuloCard";
import type { ModuloCatalogo } from "@/lib/modulos-catalogo";

const moduloTeste: ModuloCatalogo = {
  codigo: "SC-99",
  nome: "Modulo de teste",
  natureza: "CONTROLE",
  setorDono: "Processos",
  descricao: "Descricao de teste",
  implementado: true,
};

describe("ModuloCard", () => {
  it("mostra codigo, nome e natureza do modulo", () => {
    render(<ModuloCard modulo={moduloTeste} />);
    expect(screen.getByText("SC-99")).toBeInTheDocument();
    expect(screen.getByText("Modulo de teste")).toBeInTheDocument();
    expect(screen.getByText("Controle sistematizado")).toBeInTheDocument();
  });
});
