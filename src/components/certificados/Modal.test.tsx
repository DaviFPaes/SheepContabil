import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { Modal } from "./Modal";

// O vitest do repo nao roda com `globals: true`, entao o auto-cleanup do
// testing-library nao esta registrado — desmontamos a mao entre os casos.
afterEach(cleanup);

describe("Modal", () => {
  it("nao renderiza conteudo quando fechado", () => {
    render(
      <Modal aberto={false} aoFechar={() => {}} titulo="T">
        <p>corpo</p>
      </Modal>,
    );
    expect(screen.queryByText("corpo")).not.toBeInTheDocument();
  });

  it("renderiza titulo e conteudo quando aberto", () => {
    render(
      <Modal aberto aoFechar={() => {}} titulo="Perfil do cliente">
        <p>corpo</p>
      </Modal>,
    );
    expect(screen.getByText("Perfil do cliente")).toBeInTheDocument();
    expect(screen.getByText("corpo")).toBeInTheDocument();
  });

  it("chama aoFechar ao clicar no X", () => {
    const aoFechar = vi.fn();
    render(
      <Modal aberto aoFechar={aoFechar} titulo="T">
        <p>corpo</p>
      </Modal>,
    );
    fireEvent.click(screen.getByRole("button", { name: /fechar/i }));
    expect(aoFechar).toHaveBeenCalledTimes(1);
  });

  it("chama aoFechar ao clicar no backdrop, nao ao clicar no conteudo", () => {
    const aoFechar = vi.fn();
    render(
      <Modal aberto aoFechar={aoFechar} titulo="T">
        <p>corpo</p>
      </Modal>,
    );
    fireEvent.click(screen.getByText("corpo"));
    expect(aoFechar).not.toHaveBeenCalled();

    fireEvent.click(screen.getByTestId("modal-backdrop"));
    expect(aoFechar).toHaveBeenCalledTimes(1);
  });
});
