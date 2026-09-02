import { readFileSync } from "node:fs";
import { join } from "node:path";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { SpecularButton } from "./SpecularButton";

const css = readFileSync(join(__dirname, "SpecularButton.css"), "utf8");

afterEach(cleanup);

describe("SpecularButton — brilho contido", () => {
  it("o CSS prende o brilho no botão e não usa máscara de anel", () => {
    expect(css).toMatch(/\.sb\s*{[^}]*overflow:\s*hidden/);
    expect(css).not.toMatch(/mask-composite/);
    expect(css).not.toMatch(/inset:\s*calc\(-1 \* var\(--sb-bleed\)\)/);
  });
});

describe("SpecularButton", () => {
  it("renderiza um <button> com o rótulo e a classe da variante/tom/tamanho", () => {
    render(
      <SpecularButton variante="secundario" tom="escuro" tamanho="lg">
        Novo certificado
      </SpecularButton>,
    );
    const btn = screen.getByRole("button", { name: /novo certificado/i });
    expect(btn.className).toContain("sb--secundario");
    expect(btn.className).toContain("sb--escuro");
    expect(btn.className).toContain("sb--lg");
  });

  it("dispara onClick e respeita disabled", () => {
    const onClick = vi.fn();
    const { rerender } = render(
      <SpecularButton onClick={onClick}>Ação</SpecularButton>,
    );
    fireEvent.click(screen.getByRole("button", { name: "Ação" }));
    expect(onClick).toHaveBeenCalledTimes(1);

    rerender(
      <SpecularButton onClick={onClick} disabled>
        Ação
      </SpecularButton>,
    );
    fireEvent.click(screen.getByRole("button", { name: "Ação" }));
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it("encaminha type e outros atributos nativos", () => {
    render(
      <SpecularButton type="submit" aria-label="enviar">
        x
      </SpecularButton>,
    );
    expect(screen.getByRole("button", { name: "enviar" })).toHaveAttribute(
      "type",
      "submit",
    );
  });
});
