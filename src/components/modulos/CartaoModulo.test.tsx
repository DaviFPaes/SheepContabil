import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { CartaoModulo } from "./CartaoModulo";
import type { ModuloCatalogo } from "@/lib/modulos-catalogo";
import type { KpiModulo } from "@/lib/home/kpis-modulos";

const moduloTeste: ModuloCatalogo = {
  codigo: "SC-99",
  nome: "Modulo de teste",
  natureza: "CONTROLE",
  setorDono: "Processos",
  descricao: "Descricao de teste",
  implementado: true,
};

const kpiTeste: KpiModulo = {
  valor: 4,
  rotulo: "itens em conferência",
  tom: "atencao",
  detalhe: "2 notas pendentes",
};

afterEach(cleanup);

describe("CartaoModulo", () => {
  it("mostra codigo, nome e natureza do modulo", () => {
    render(<CartaoModulo modulo={moduloTeste} kpi={kpiTeste} />);
    expect(screen.getByText("SC-99")).toBeInTheDocument();
    expect(screen.getByText("Modulo de teste")).toBeInTheDocument();
    expect(screen.getByText("Controle sistematizado")).toBeInTheDocument();
  });

  it("mostra o numero e o rotulo do KPI, com o detalhe", () => {
    render(<CartaoModulo modulo={moduloTeste} kpi={kpiTeste} />);
    expect(screen.getByText("4")).toBeInTheDocument();
    expect(screen.getByText("itens em conferência")).toBeInTheDocument();
    expect(screen.getByText("2 notas pendentes")).toBeInTheDocument();
  });

  it("aponta para a rota do modulo", () => {
    render(<CartaoModulo modulo={moduloTeste} kpi={null} />);
    expect(screen.getByRole("link")).toHaveAttribute("href", "/modulos/sc-99");
  });
});
