import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { BlocoUploadExtrato, type BlocoValor } from "./BlocoUploadExtrato";

afterEach(cleanup);

const clientes = [{ id: "c1", razaoSocial: "Alfa" }, { id: "c2", razaoSocial: "Beta" }];
const contas = { c1: [{ id: "cb1", rotulo: "Banco T — ag 1 c/c 1-1" }] };
const base: BlocoValor = { clienteId: "", contaBancariaId: "", nomeArquivo: null, deteccao: "idle" };

describe("BlocoUploadExtrato", () => {
  it("dispara aoArquivo ao anexar e mostra o nome do arquivo", () => {
    const aoArquivo = vi.fn();
    render(
      <BlocoUploadExtrato
        indice={0} clientes={clientes} contasPorCliente={contas}
        valor={{ ...base, nomeArquivo: "extrato.pdf", deteccao: "ok" }}
        aoMudar={() => {}} aoArquivo={aoArquivo}
      />,
    );
    const input = screen.getByLabelText(/extrato/i);
    fireEvent.change(input, {
      target: { files: [new File(["x"], "extrato.pdf", { type: "application/pdf" })] },
    });
    expect(aoArquivo).toHaveBeenCalledOnce();
    expect(screen.getByText("extrato.pdf")).toBeInTheDocument();
  });

  it("mostra 'Identificando…' enquanto deteccao === 'lendo'", () => {
    render(
      <BlocoUploadExtrato indice={0} clientes={clientes} contasPorCliente={contas}
        valor={{ ...base, deteccao: "lendo" }} aoMudar={() => {}} aoArquivo={() => {}} />,
    );
    expect(screen.getByText(/identificando/i)).toBeInTheDocument();
  });

  it("exibe o erro do bloco", () => {
    render(
      <BlocoUploadExtrato indice={1} clientes={clientes} contasPorCliente={contas}
        valor={base} aoMudar={() => {}} aoArquivo={() => {}} erro="Identifique o cliente e a conta deste extrato." />,
    );
    expect(screen.getByRole("alert")).toHaveTextContent(/identifique o cliente/i);
  });
});
