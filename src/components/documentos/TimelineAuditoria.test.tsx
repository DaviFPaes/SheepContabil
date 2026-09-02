import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { TimelineAuditoria } from "./TimelineAuditoria";
import type { LinhaAuditoriaDocumento } from "@/lib/documentos/historico";

afterEach(cleanup);

const l = (o: Partial<LinhaAuditoriaDocumento>): LinhaAuditoriaDocumento => ({
  id: "1",
  acao: "EXTRATO_ENVIADO",
  descricao: "Extrato a.pdf enviado",
  autorEmail: null,
  criadoEm: new Date("2026-08-10T13:00:00Z"),
  dadosAntes: null,
  dadosDepois: null,
  ...o,
});

describe("TimelineAuditoria", () => {
  it("mostra estado vazio", () => {
    render(<TimelineAuditoria linhas={[]} />);
    expect(screen.getByText(/nada registrado/i)).toBeInTheDocument();
  });

  it("ator nulo aparece como 'Sistema'", () => {
    render(<TimelineAuditoria linhas={[l({})]} />);
    expect(screen.getByText(/sistema/i)).toBeInTheDocument();
  });

  it("mostra o diff campo: antes → depois", () => {
    render(
      <TimelineAuditoria
        linhas={[
          l({
            acao: "LINHA_CONFERIDA",
            dadosAntes: { valor: "100" },
            dadosDepois: { valor: "120" },
          }),
        ]}
      />,
    );
    expect(screen.getByText(/valor:/)).toBeInTheDocument();
    expect(screen.getByText(/100 → 120/)).toBeInTheDocument();
  });
});
