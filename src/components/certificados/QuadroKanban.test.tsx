import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { QuadroKanban } from "./QuadroKanban";
import type { CertificadoLinha, ColunasKanban } from "@/lib/certificados/consultas";

afterEach(cleanup);

const colunasVazias: ColunasKanban = {
  d60: [],
  d7: [],
  confirmar3: [],
  vencido: [],
};

const noop = () => {};

function linha(over: Partial<CertificadoLinha> = {}): CertificadoLinha {
  return {
    id: "c1",
    clienteId: "cl1",
    razaoSocial: "Alfa Ltda",
    clienteEmail: "alfa@example.com",
    clienteTelefone: "+55 51 99999-0001",
    titular: "Titular Alfa",
    tipo: "ECNPJ",
    dataValidade: new Date("2026-09-20T00:00:00Z"),
    emitidoEm: new Date("2025-09-20T00:00:00Z"),
    diasRestantes: 19,
    bucket: "D60",
    ativo: true,
    renovadoEm: null,
    avisoD3Em: null,
    avisoD60: null,
    avisoD7: null,
    ...over,
  };
}

function montar(over: Partial<Parameters<typeof QuadroKanban>[0]> = {}) {
  return render(
    <QuadroKanban
      colunas={colunasVazias}
      contagem={{ d60: 0, d7: 0 }}
      aoAbrirCliente={noop}
      aoEnviarLote={noop}
      aoRenovar={noop}
      aoAvisar={noop}
      focoInicial={null}
      {...over}
    />,
  );
}

describe("QuadroKanban", () => {
  it("mostra o card e o botao de lote habilitado quando ha pendencia", () => {
    montar({ colunas: { ...colunasVazias, d60: [linha()] }, contagem: { d60: 1, d7: 0 } });
    expect(screen.getByText("Alfa Ltda")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /enviar avisos \(1\)/i })).toBeEnabled();
  });

  it("desabilita o lote com 'Tudo avisado' quando nao ha pendencia", () => {
    montar();
    const botoes = screen.getAllByRole("button", { name: /tudo avisado/i });
    expect(botoes.length).toBe(2);
    botoes.forEach((b) => expect(b).toBeDisabled());
  });

  it("clicar no card chama aoAbrirCliente com o clienteId", () => {
    const aoAbrir = vi.fn();
    montar({
      colunas: { ...colunasVazias, vencido: [linha({ bucket: "VENCIDO", diasRestantes: -1 })] },
      aoAbrirCliente: aoAbrir,
    });
    fireEvent.click(screen.getByRole("button", { name: /abrir perfil de alfa ltda/i }));
    expect(aoAbrir).toHaveBeenCalledWith("cl1");
  });

  it("o botao de lote chama aoEnviarLote com o marco", () => {
    const aoEnviarLote = vi.fn();
    montar({
      colunas: { ...colunasVazias, d7: [linha({ bucket: "D7", diasRestantes: 5 })] },
      contagem: { d60: 0, d7: 1 },
      aoEnviarLote,
    });
    fireEvent.click(screen.getByRole("button", { name: /enviar avisos \(1\)/i }));
    expect(aoEnviarLote).toHaveBeenCalledWith("D7");
  });

  it("card em Vencido tem 'Renovar certificado' e dispara aoRenovar", () => {
    const aoRenovar = vi.fn();
    montar({
      colunas: { ...colunasVazias, vencido: [linha({ bucket: "VENCIDO", diasRestantes: -4 })] },
      aoRenovar,
    });
    fireEvent.click(screen.getByRole("button", { name: /renovar certificado/i }));
    expect(aoRenovar).toHaveBeenCalledWith(expect.objectContaining({ id: "c1" }));
  });

  it("card pendente em 3 dias tem 'Avisar cliente'; card avisado mostra 'Cliente avisado'", () => {
    const aoAvisar = vi.fn();
    const { rerender } = render(
      <QuadroKanban
        colunas={{ ...colunasVazias, confirmar3: [linha({ bucket: "D3", diasRestantes: 2, avisoD3Em: null })] }}
        contagem={{ d60: 0, d7: 0 }}
        aoAbrirCliente={noop}
        aoEnviarLote={noop}
        aoRenovar={noop}
        aoAvisar={aoAvisar}
        focoInicial={null}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: /avisar cliente/i }));
    expect(aoAvisar).toHaveBeenCalledWith(expect.objectContaining({ id: "c1" }));

    rerender(
      <QuadroKanban
        colunas={{ ...colunasVazias, confirmar3: [linha({ bucket: "D3", diasRestantes: 2, avisoD3Em: new Date() })] }}
        contagem={{ d60: 0, d7: 0 }}
        aoAbrirCliente={noop}
        aoEnviarLote={noop}
        aoRenovar={noop}
        aoAvisar={aoAvisar}
        focoInicial={null}
      />,
    );
    expect(screen.queryByRole("button", { name: /avisar cliente/i })).not.toBeInTheDocument();
    expect(screen.getByText(/cliente avisado/i)).toBeInTheDocument();
  });
});
