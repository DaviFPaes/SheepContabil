import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { HistoricoExecucoes } from "./HistoricoExecucoes";
import type { ExecucaoRegistrada } from "@/lib/execucao";

describe("HistoricoExecucoes", () => {
  it("mostra mensagem vazia quando nao ha execucoes", () => {
    render(<HistoricoExecucoes execucoes={[]} />);
    expect(
      screen.getByText("Nenhuma execução registrada ainda."),
    ).toBeInTheDocument();
  });

  it("mostra o erro de forma legivel quando a execucao falhou", () => {
    const execucoes: ExecucaoRegistrada[] = [
      {
        id: "1",
        moduloCodigo: "SC-20",
        disparadoPor: "ana@sheepcontabil.com.br",
        status: "ERRO",
        iniciadoEm: new Date("2026-08-27T10:00:00Z"),
        finalizadoEm: new Date("2026-08-27T10:00:05Z"),
        resumo: null,
        erro: "Certificado com data inválida.",
      },
    ];

    render(<HistoricoExecucoes execucoes={execucoes} />);

    expect(screen.getByText("Erro")).toBeInTheDocument();
    expect(
      screen.getByText("Certificado com data inválida."),
    ).toBeInTheDocument();
  });
});
