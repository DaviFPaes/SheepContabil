import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { QuadroKanban } from "./QuadroKanban";
import type { CertificadoLinha, ColunasKanban } from "@/lib/certificados/consultas";

afterEach(cleanup);

const colunasVazias: ColunasKanban = {
  aAvisar60: [],
  avisado60: [],
  aAvisar7: [],
  avisado7: [],
  confirmar3: [],
  vencido: [],
  renovado: [],
};

function linha(over: Partial<CertificadoLinha> = {}): CertificadoLinha {
  return {
    id: "c1",
    clienteId: "cl1",
    razaoSocial: "Alfa Ltda",
    clienteEmail: "alfa@example.com",
    titular: "Titular Alfa",
    tipo: "ECNPJ",
    dataValidade: new Date("2026-09-20T00:00:00Z"),
    emitidoEm: new Date("2025-09-20T00:00:00Z"),
    diasRestantes: 19,
    bucket: "D60",
    ativo: true,
    renovadoEm: null,
    avisoD60: null,
    avisoD7: null,
    ...over,
  };
}

describe("QuadroKanban", () => {
  it("mostra o card e o contador na coluna, com botao de lote habilitado", () => {
    render(
      <QuadroKanban
        colunas={{ ...colunasVazias, aAvisar60: [linha()] }}
        contagem={{ d60: 1, d7: 0 }}
        aoAbrirCliente={() => {}}
        aoEnviarLote={() => {}}
        focoInicial={null}
      />,
    );
    expect(screen.getByText("Alfa Ltda")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /enviar avisos \(1\)/i }),
    ).toBeEnabled();
  });

  it("desabilita o botao de lote com 'Nada a enviar' quando a coluna esta vazia", () => {
    render(
      <QuadroKanban
        colunas={colunasVazias}
        contagem={{ d60: 0, d7: 0 }}
        aoAbrirCliente={() => {}}
        aoEnviarLote={() => {}}
        focoInicial={null}
      />,
    );
    const botoes = screen.getAllByRole("button", { name: /nada a enviar/i });
    expect(botoes.length).toBeGreaterThanOrEqual(2);
    botoes.forEach((b) => expect(b).toBeDisabled());
  });

  it("clicar num card chama aoAbrirCliente com o clienteId", () => {
    const aoAbrir = vi.fn();
    render(
      <QuadroKanban
        colunas={{ ...colunasVazias, vencido: [linha({ bucket: "VENCIDO", diasRestantes: -1 })] }}
        contagem={{ d60: 0, d7: 0 }}
        aoAbrirCliente={aoAbrir}
        aoEnviarLote={() => {}}
        focoInicial={null}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: /Alfa Ltda/ }));
    expect(aoAbrir).toHaveBeenCalledWith("cl1");
  });

  it("o botao de lote chama aoEnviarLote com o marco", () => {
    const aoEnviarLote = vi.fn();
    render(
      <QuadroKanban
        colunas={{ ...colunasVazias, aAvisar7: [linha({ bucket: "D7", diasRestantes: 5 })] }}
        contagem={{ d60: 0, d7: 1 }}
        aoAbrirCliente={() => {}}
        aoEnviarLote={aoEnviarLote}
        focoInicial={null}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: /enviar avisos \(1\)/i }));
    expect(aoEnviarLote).toHaveBeenCalledWith("D7");
  });
});
