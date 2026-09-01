import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { SeloBucket } from "./SeloBucket";

describe("SeloBucket", () => {
  it("mostra o rotulo do bucket", () => {
    render(<SeloBucket bucket="D7" />);
    expect(screen.getByText("7 dias")).toBeInTheDocument();
  });

  it("mostra 'Vencido' e 'Renovado' com os rotulos legiveis", () => {
    const { rerender } = render(<SeloBucket bucket="VENCIDO" />);
    expect(screen.getByText("Vencido")).toBeInTheDocument();
    rerender(<SeloBucket bucket="RENOVADO" />);
    expect(screen.getByText("Renovado")).toBeInTheDocument();
  });

  it("usa tom de erro (carmim) para VENCIDO e D3", () => {
    const { container: vencido } = render(<SeloBucket bucket="VENCIDO" />);
    expect(vencido.firstChild).toHaveClass(/carmim/);
    const { container: d3 } = render(<SeloBucket bucket="D3" />);
    expect(d3.firstChild).toHaveClass(/carmim/);
  });
});
