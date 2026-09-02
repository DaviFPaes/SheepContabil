import { render, screen, fireEvent, cleanup, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/permissoes/acoes", () => ({
  alternarPermissaoModulo: vi.fn(async () => ({ ok: true })),
  alternarPermissaoSubArea: vi.fn(async () => ({ ok: true })),
}));
vi.mock("@/lib/permissoes/catalogo", () => ({
  SUBAREAS_MODULO: {
    "SC-20": [
      { chave: "aba_historico", rotulo: "Aba Histórico" },
      { chave: "sino_avisos", rotulo: "Sino de avisos" },
    ],
  },
}));

import { alternarPermissaoModulo } from "@/lib/permissoes/acoes";
import { PainelGestaoUsuarios, type OperadorGestaoView } from "./PainelGestaoUsuarios";

afterEach(cleanup);

const OPERADORES: OperadorGestaoView[] = [
  {
    id: "op-1",
    nome: "Bruno Lima",
    email: "bruno@sheepcontabil.com.br",
    setor: "Processos",
    modulosElegiveis: [{ codigo: "SC-20", nome: "Vencimento de certificado digital" }],
    modulosLigados: [],
    subAreasDesligadas: [],
  },
  {
    id: "op-2",
    nome: "Carla Nunes",
    email: "carla@sheepcontabil.com.br",
    setor: "BPO Saúde",
    modulosElegiveis: [],
    modulosLigados: [],
    subAreasDesligadas: [],
  },
];

const BOTAO_MODULO = "SC-20 · Vencimento de certificado digital: desligado";

describe("PainelGestaoUsuarios", () => {
  it("comeca com o primeiro operador selecionado", () => {
    render(<PainelGestaoUsuarios operadores={OPERADORES} />);
    expect(screen.getByRole("heading", { name: "Bruno Lima" })).toBeInTheDocument();
  });

  it("troca o operador selecionado ao clicar na lista", () => {
    render(<PainelGestaoUsuarios operadores={OPERADORES} />);
    fireEvent.click(screen.getByText("Carla Nunes"));
    expect(screen.getByRole("heading", { name: "Carla Nunes" })).toBeInTheDocument();
  });

  it("sub-area comeca desabilitada porque o modulo esta desligado", () => {
    render(<PainelGestaoUsuarios operadores={OPERADORES} />);
    expect(screen.getByRole("button", { name: "Aba Histórico: ligado" })).toBeDisabled();
  });

  it("liga o modulo, chama a acao e libera a sub-area", async () => {
    render(<PainelGestaoUsuarios operadores={OPERADORES} />);
    fireEvent.click(screen.getByRole("button", { name: BOTAO_MODULO }));

    expect(alternarPermissaoModulo).toHaveBeenCalledWith("op-1", "SC-20", true);
    await waitFor(() =>
      expect(screen.getByRole("button", { name: "Aba Histórico: ligado" })).not.toBeDisabled(),
    );
  });

  it("reverte e mostra erro quando a acao falha", async () => {
    vi.mocked(alternarPermissaoModulo).mockResolvedValueOnce({ erro: "falhou" });
    render(<PainelGestaoUsuarios operadores={OPERADORES} />);
    fireEvent.click(screen.getByRole("button", { name: BOTAO_MODULO }));

    await waitFor(() => expect(screen.getByText("falhou")).toBeInTheDocument());
    expect(screen.getByRole("button", { name: BOTAO_MODULO })).toBeInTheDocument();
  });
});
