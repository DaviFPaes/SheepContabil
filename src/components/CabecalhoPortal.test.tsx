import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { CabecalhoPortal } from "./CabecalhoPortal";

describe("CabecalhoPortal", () => {
  it("mostra a marca e os dados do usuario logado", () => {
    render(<CabecalhoPortal nomeUsuario="Ana Souza" papel="ADMIN" />);

    expect(screen.getByTestId("marca-sheepcontabil")).toHaveTextContent(
      "SheepContabil",
    );
    expect(screen.getByText(/Ana Souza/)).toBeInTheDocument();
    expect(screen.getByText(/Administrador/)).toBeInTheDocument();
  });

  it("mostra Operador quando o papel e OPERADOR", () => {
    render(<CabecalhoPortal nomeUsuario="Bruno Lima" papel="OPERADOR" />);
    expect(screen.getByText(/Operador/)).toBeInTheDocument();
  });
});
