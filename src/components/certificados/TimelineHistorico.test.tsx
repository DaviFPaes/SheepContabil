import { render, screen, cleanup } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { TimelineHistorico } from "./TimelineHistorico";

afterEach(cleanup);

const base = { id: "1", criadoEm: new Date("2026-09-01T12:00:00Z") };

describe("TimelineHistorico", () => {
  it("mostra 'Sistema' quando nao ha autor e um diff quando ha mudanca", () => {
    render(
      <TimelineHistorico
        linhas={[
          {
            ...base,
            acao: "TRANSICAO_BUCKET",
            autorEmail: null,
            descricao: "Bucket de Alfa: 60 dias -> 7 dias",
            dadosAntes: { bucket: "D60" },
            dadosDepois: { bucket: "D7" },
          },
        ]}
      />,
    );
    expect(screen.getByText("Sistema")).toBeInTheDocument();
    const cartao = screen.getByText(/Bucket de Alfa/).closest("li");
    expect(cartao?.textContent).toContain("bucket: D60 → D7");
  });

  it("mostra o e-mail do autor quando existe", () => {
    render(
      <TimelineHistorico
        linhas={[
          {
            ...base,
            acao: "EDITADO",
            autorEmail: "ana@x.com",
            descricao: "Certificado editado",
            dadosAntes: null,
            dadosDepois: null,
          },
        ]}
      />,
    );
    expect(screen.getByText("ana@x.com")).toBeInTheDocument();
  });

  it("estado vazio com frase de carater", () => {
    render(<TimelineHistorico linhas={[]} />);
    expect(screen.getByText(/nada registrado ainda/i)).toBeInTheDocument();
  });
});
