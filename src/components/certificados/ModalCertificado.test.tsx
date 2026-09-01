import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/certificados/acoes", () => ({
  criarCertificado: vi.fn(async () => ({ ok: true })),
  editarCertificado: vi.fn(async () => ({ ok: true })),
}));

import { ModalCertificado } from "./ModalCertificado";
import type { CertificadoLinha } from "@/lib/certificados/consultas";

afterEach(cleanup);

const clientes = [
  { id: "cl1", razaoSocial: "Alfa Ltda" },
  { id: "cl2", razaoSocial: "Beta Ltda" },
];
const certificadosPorCliente = {
  cl1: [{ id: "cert-antigo", titular: "Alfa Ltda", dataValidade: new Date("2026-09-10T00:00:00Z") }],
};

function abrir(certificado: CertificadoLinha | null = null) {
  return render(
    <ModalCertificado
      aberto
      aoFechar={() => {}}
      clientes={clientes}
      certificadosPorCliente={certificadosPorCliente}
      certificado={certificado}
    />,
  );
}

describe("ModalCertificado", () => {
  it("modo novo: campos vazios e sem o select de renovacao", () => {
    abrir();
    expect(screen.getByLabelText(/titular/i)).toHaveValue("");
    expect(screen.queryByLabelText(/certificado anterior/i)).not.toBeInTheDocument();
  });

  it("marcar 'e renovacao' revela o select de certificado anterior", () => {
    abrir();
    fireEvent.click(screen.getByLabelText(/é renovação de um certificado existente/i));
    expect(screen.getByLabelText(/certificado anterior/i)).toBeInTheDocument();
  });

  it("mostra aviso nao-bloqueante quando a validade esta a menos de 60 dias", () => {
    abrir();
    const perto = new Date();
    perto.setUTCDate(perto.getUTCDate() + 20);
    fireEvent.change(screen.getByLabelText(/validade/i), {
      target: { value: perto.toISOString().slice(0, 10) },
    });
    expect(screen.getByText(/já está dentro da janela de 60 dias/i)).toBeInTheDocument();
  });

  it("modo editar: preenche titular e tipo a partir do certificado", () => {
    abrir({
      id: "c9",
      clienteId: "cl2",
      razaoSocial: "Beta Ltda",
      titular: "Beta Titular",
      tipo: "ECPF",
      dataValidade: new Date("2027-01-01T00:00:00Z"),
      emitidoEm: new Date("2026-01-01T00:00:00Z"),
      diasRestantes: 200,
      bucket: "OK",
      ativo: true,
      renovadoEm: null,
      avisoD60: null,
      avisoD7: null,
    });
    expect(screen.getByLabelText(/titular/i)).toHaveValue("Beta Titular");
    expect(screen.getByLabelText(/tipo/i)).toHaveValue("ECPF");
  });
});
