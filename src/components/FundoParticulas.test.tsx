import { render, cleanup } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import FundoParticulas from "./FundoParticulas";

afterEach(cleanup);

describe("FundoParticulas", () => {
  // jsdom não tem WebGL: o componente precisa degradar sem montar canvas nem
  // lançar erro — é a rede de segurança que substitui o DarkVeil.
  it("sem WebGL, renderiza um container aria-hidden e nenhum canvas", () => {
    const { container } = render(<FundoParticulas />);

    const fundo = container.querySelector("[aria-hidden]");
    expect(fundo).toBeInTheDocument();
    expect(fundo?.querySelector("canvas")).toBeNull();
  });

  it("não quebra ao desmontar", () => {
    const { unmount } = render(<FundoParticulas seguirMouse />);
    expect(() => unmount()).not.toThrow();
  });
});
