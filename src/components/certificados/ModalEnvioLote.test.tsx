import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ModalEnvioLote } from "./ModalEnvioLote";

afterEach(cleanup);

const destinatarios = [
  { clienteId: "cl1", razaoSocial: "Alfa Ltda", email: "alfa@example.com" },
  { clienteId: "cl2", razaoSocial: "Beta Ltda", email: "beta@example.com" },
  { clienteId: "cl3", razaoSocial: "Gama Ltda", email: "gama@example.com" },
];

describe("ModalEnvioLote", () => {
  it("lista os destinatarios com todos os checkboxes marcados", () => {
    render(<ModalEnvioLote aberto marco="D60" aoFechar={() => {}} destinatarios={destinatarios} />);
    const checks = screen.getAllByRole("checkbox");
    expect(checks).toHaveLength(3);
    checks.forEach((c) => expect(c).toBeChecked());
    expect(screen.getByText(/3 de 3 selecionados/i)).toBeInTheDocument();
  });

  it("desmarcar um atualiza o contador", () => {
    render(<ModalEnvioLote aberto marco="D7" aoFechar={() => {}} destinatarios={destinatarios} />);
    fireEvent.click(screen.getAllByRole("checkbox")[0]);
    expect(screen.getByText(/2 de 3 selecionados/i)).toBeInTheDocument();
  });

  it("confirmar avisa que nao esta disponivel e fecha, sem persistir", () => {
    const aoFechar = vi.fn();
    const alertSpy = vi.spyOn(window, "alert").mockImplementation(() => {});
    render(<ModalEnvioLote aberto marco="D60" aoFechar={aoFechar} destinatarios={destinatarios} />);
    fireEvent.click(screen.getByRole("button", { name: /confirmar envio/i }));
    expect(alertSpy).toHaveBeenCalledWith(expect.stringMatching(/não disponível nesta etapa/i));
    expect(aoFechar).toHaveBeenCalledTimes(1);
    alertSpy.mockRestore();
  });
});
