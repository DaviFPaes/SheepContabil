import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AlternadorVisao } from "./AlternadorVisao";

afterEach(cleanup);
beforeEach(() => localStorage.clear());

describe("AlternadorVisao", () => {
  it("sem ?visao e sem localStorage, comeca em 'kanban'", () => {
    render(<AlternadorVisao visaoUrl={null} aoMudar={() => {}} />);
    expect(screen.getByRole("button", { name: /kanban/i })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
  });

  it("sem ?visao, respeita o localStorage", () => {
    localStorage.setItem("sc20:visao", "kanban");
    render(<AlternadorVisao visaoUrl={null} aoMudar={() => {}} />);
    expect(screen.getByRole("button", { name: /kanban/i })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
  });

  it("persiste a escolha no localStorage e avisa via aoMudar", () => {
    const aoMudar = vi.fn();
    render(<AlternadorVisao visaoUrl={null} aoMudar={aoMudar} />);
    fireEvent.click(screen.getByRole("button", { name: /tabela/i }));
    expect(localStorage.getItem("sc20:visao")).toBe("tabela");
    expect(aoMudar).toHaveBeenCalledWith("tabela");
  });

  it("?visao vence o localStorage e o reescreve", () => {
    localStorage.setItem("sc20:visao", "tabela");
    render(<AlternadorVisao visaoUrl="kanban" aoMudar={() => {}} />);
    expect(screen.getByRole("button", { name: /kanban/i })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    expect(localStorage.getItem("sc20:visao")).toBe("kanban");
  });
});
