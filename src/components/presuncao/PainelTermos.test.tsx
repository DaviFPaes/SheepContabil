import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { PainelTermos } from "./PainelTermos";
import type { TermoView } from "@/lib/presuncao/consultas-sc11";

vi.mock("@/lib/presuncao/acoes-sc11", () => ({
  editarTermo: vi.fn(),
  removerTermo: vi.fn(),
}));

afterEach(cleanup);

const termo = (o: Partial<TermoView>): TermoView => ({
  id: "1",
  termo: "tomografia",
  aliquota: "P8",
  ...o,
});

describe("PainelTermos", () => {
  it("estado vazio quando não há termos", () => {
    render(<PainelTermos termos={[]} />);
    expect(screen.getByText(/nenhum termo cadastrado/i)).toBeInTheDocument();
  });

  it("agrupa termos nas colunas certas por base", () => {
    render(
      <PainelTermos
        termos={[
          termo({ id: "1", termo: "tomografia", aliquota: "P8" }),
          termo({ id: "2", termo: "consulta médica", aliquota: "P32" }),
        ]}
      />,
    );
    expect(screen.getByText("Base 8%")).toBeInTheDocument();
    expect(screen.getByText("Base 32%")).toBeInTheDocument();
    expect(screen.getByText("tomografia")).toBeInTheDocument();
    expect(screen.getByText("consulta médica")).toBeInTheDocument();
  });

  it("mostra aviso na coluna sem termos daquela base", () => {
    render(<PainelTermos termos={[termo({ aliquota: "P8" })]} />);
    expect(screen.getByText(/nenhum termo nesta base ainda/i)).toBeInTheDocument();
  });

  it("botão de reclassificar aponta para a outra base", () => {
    render(<PainelTermos termos={[termo({ aliquota: "P8" })]} />);
    expect(screen.getByRole("button", { name: "→ 32%" })).toBeInTheDocument();
  });

  it("botão de remover pede confirmação e não envia se recusado", () => {
    const confirmSpy = vi.spyOn(window, "confirm").mockReturnValue(false);
    render(<PainelTermos termos={[termo({ termo: "tomografia" })]} />);
    screen.getByRole("button", { name: /remover termo tomografia/i }).click();
    expect(confirmSpy).toHaveBeenCalledWith('Remover o termo "tomografia"?');
    confirmSpy.mockRestore();
  });
});
