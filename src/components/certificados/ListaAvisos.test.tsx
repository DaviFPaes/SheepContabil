import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { ListaAvisos } from "./ListaAvisos";

const AGORA = new Date("2026-08-29T12:00:00Z");

describe("ListaAvisos", () => {
  it("mostra o estado vazio quando nao ha avisos", () => {
    render(<ListaAvisos avisos={[]} />);
    expect(
      screen.getByText(/Nenhum aviso emitido ainda/i),
    ).toBeInTheDocument();
  });

  it("mostra o texto da mensagem de cada aviso", () => {
    render(
      <ListaAvisos
        avisos={[
          {
            id: "a1",
            razaoSocial: "Alfa Comércio Ltda",
            faixa: "CRITICO",
            diasRestantes: 5,
            mensagem:
              "O certificado digital de Alfa Comércio Ltda vence em 5 dias (faixa CRÍTICO).",
            criadoEm: AGORA,
          },
        ]}
      />,
    );
    expect(
      screen.getByText(/vence em 5 dias \(faixa CRÍTICO\)/),
    ).toBeInTheDocument();
    expect(screen.getByText("CRÍTICO")).toBeInTheDocument();
  });
});
