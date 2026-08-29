import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { BadgeFaixa } from "./BadgeFaixa";

describe("BadgeFaixa", () => {
  it("mostra o rotulo com acento da faixa", () => {
    render(<BadgeFaixa faixa="CRITICO" />);
    expect(screen.getByText("CRÍTICO")).toBeInTheDocument();
  });

  it("mostra PROXIMO como PRÓXIMO", () => {
    render(<BadgeFaixa faixa="PROXIMO" />);
    expect(screen.getByText("PRÓXIMO")).toBeInTheDocument();
  });
});
