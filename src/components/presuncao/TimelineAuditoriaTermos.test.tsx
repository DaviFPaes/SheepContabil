import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { TimelineAuditoriaTermos } from "./TimelineAuditoriaTermos";
import type { AuditoriaView } from "@/lib/presuncao/consultas-sc11";

afterEach(cleanup);

const linha = (o: Partial<AuditoriaView>): AuditoriaView => ({
  id: "1",
  termoTexto: "tomografia",
  acao: "CRIACAO",
  aliquotaAnterior: null,
  aliquotaNova: "P8",
  autorEmail: "admin@teste.com",
  criadoEm: new Date("2026-08-10T13:00:00Z"),
  ...o,
});

describe("TimelineAuditoriaTermos", () => {
  it("mostra estado vazio", () => {
    render(<TimelineAuditoriaTermos linhas={[]} />);
    expect(screen.getByText(/nenhuma alteração ainda/i)).toBeInTheDocument();
  });

  it("descreve criação", () => {
    render(<TimelineAuditoriaTermos linhas={[linha({ acao: "CRIACAO", aliquotaNova: "P8" })]} />);
    expect(screen.getByText(/criado como 8%/i)).toBeInTheDocument();
  });

  it("descreve reclassificação com antes → depois", () => {
    render(
      <TimelineAuditoriaTermos
        linhas={[
          linha({ acao: "RECLASSIFICACAO", aliquotaAnterior: "P8", aliquotaNova: "P32" }),
        ]}
      />,
    );
    expect(screen.getByText("8% → 32%")).toBeInTheDocument();
  });

  it("descreve remoção com a base anterior", () => {
    render(
      <TimelineAuditoriaTermos
        linhas={[linha({ acao: "REMOCAO", aliquotaAnterior: "P32", aliquotaNova: null })]}
      />,
    );
    expect(screen.getByText(/removido \(era 32%\)/i)).toBeInTheDocument();
  });

  it("mostra o autor e o termo", () => {
    render(<TimelineAuditoriaTermos linhas={[linha({ autorEmail: "fulano@sheepcontabil.com.br" })]} />);
    expect(screen.getByText("fulano@sheepcontabil.com.br")).toBeInTheDocument();
    expect(screen.getByText("tomografia")).toBeInTheDocument();
  });
});
