import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

const enviarAvisosLote = vi.fn(
  async (_marco: "D60" | "D7", ids: string[]) => ({ enviados: ids.length }),
);
vi.mock("@/lib/certificados/acoes", () => ({
  enviarAvisosLote: (marco: "D60" | "D7", ids: string[]) => enviarAvisosLote(marco, ids),
}));

import { ModalEnvioLote } from "./ModalEnvioLote";

afterEach(() => {
  cleanup();
  enviarAvisosLote.mockClear();
});

const destinatarios = [
  { certificadoId: "ct1", clienteId: "cl1", razaoSocial: "Alfa Ltda", email: "alfa@example.com" },
  { certificadoId: "ct2", clienteId: "cl2", razaoSocial: "Beta Ltda", email: "beta@example.com" },
  { certificadoId: "ct3", clienteId: "cl3", razaoSocial: "Gama Ltda", email: "gama@example.com" },
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

  it("confirmar chama enviarAvisosLote e mostra o painel de sucesso", async () => {
    const aoFechar = vi.fn();
    render(<ModalEnvioLote aberto marco="D60" aoFechar={aoFechar} destinatarios={destinatarios} />);

    fireEvent.click(screen.getByRole("button", { name: /confirmar envio/i }));

    expect(await screen.findByText(/3 avisos enviados/i)).toBeInTheDocument();
    expect(enviarAvisosLote).toHaveBeenCalledWith("D60", ["ct1", "ct2", "ct3"]);

    fireEvent.click(screen.getByRole("button", { name: /concluir/i }));
    expect(aoFechar).toHaveBeenCalledTimes(1);
  });

  it("confirma só os selecionados", async () => {
    render(<ModalEnvioLote aberto marco="D60" aoFechar={() => {}} destinatarios={destinatarios} />);
    fireEvent.click(screen.getAllByRole("checkbox")[1]); // desmarca Beta
    fireEvent.click(screen.getByRole("button", { name: /confirmar envio/i }));

    expect(await screen.findByText(/2 avisos enviados/i)).toBeInTheDocument();
    expect(enviarAvisosLote).toHaveBeenCalledWith("D60", ["ct1", "ct3"]);
  });
});
