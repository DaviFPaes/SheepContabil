import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

const enviarDocumentos = vi.fn(async (..._a: unknown[]) => ({ ok: true, enviados: 1 }));
const detectarCabecalho = vi.fn(async (..._a: unknown[]) => ({
  clienteId: "c1",
  contaBancariaId: "cb1",
  cabecalho: {},
}));
vi.mock("@/lib/documentos/acoes-sc01", () => ({
  enviarDocumentos: (...a: unknown[]) => enviarDocumentos(...a),
  detectarCabecalho: (...a: unknown[]) => detectarCabecalho(...a),
}));

import { ModalEnviarExtratos } from "./ModalEnviarExtratos";

afterEach(() => {
  cleanup();
  enviarDocumentos.mockClear();
  detectarCabecalho.mockClear();
});

const props = {
  aberto: true,
  aoFechar: vi.fn(),
  clientes: [{ id: "c1", razaoSocial: "Alfa" }],
  contasPorCliente: { c1: [{ id: "cb1", rotulo: "Banco T — ag 1 c/c 1-1" }] },
};

describe("ModalEnviarExtratos", () => {
  it("começa com 1 bloco e adiciona/remove", () => {
    render(<ModalEnviarExtratos {...props} />);
    expect(screen.getAllByLabelText(/extrato \(pdf/i)).toHaveLength(1);
    fireEvent.click(screen.getByRole("button", { name: /adicionar outro extrato/i }));
    expect(screen.getAllByLabelText(/extrato \(pdf/i)).toHaveLength(2);
    fireEvent.click(screen.getAllByRole("button", { name: /remover/i })[0]);
    expect(screen.getAllByLabelText(/extrato \(pdf/i)).toHaveLength(1);
  });

  it("anexar dispara detectarCabecalho e preenche o cliente do bloco", async () => {
    render(<ModalEnviarExtratos {...props} />);
    fireEvent.change(screen.getByLabelText(/extrato \(pdf/i), {
      target: { files: [new File(["x"], "e.pdf", { type: "application/pdf" })] },
    });
    expect(detectarCabecalho).toHaveBeenCalledOnce();
    // após resolver, o select de cliente reflete "c1"
    expect(await screen.findByDisplayValue("Alfa")).toBeInTheDocument();
  });
});
