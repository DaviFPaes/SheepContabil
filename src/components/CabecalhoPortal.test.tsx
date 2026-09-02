import { render, screen, cleanup } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { CabecalhoPortal } from "./CabecalhoPortal";

afterEach(cleanup);

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

  it("mostra o link de gestao de usuarios so para ADMIN", () => {
    render(<CabecalhoPortal nomeUsuario="Ana Souza" papel="ADMIN" />);
    expect(
      screen.getByRole("link", { name: /gerenciar usuários/i }),
    ).toHaveAttribute("href", "/admin/usuarios");
  });

  it("nao mostra o link de gestao de usuarios para OPERADOR", () => {
    render(<CabecalhoPortal nomeUsuario="Bruno Lima" papel="OPERADOR" />);
    expect(
      screen.queryByRole("link", { name: /gerenciar usuários/i }),
    ).not.toBeInTheDocument();
  });
});
