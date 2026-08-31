import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { BadgeStatusDocumento } from "./BadgeStatusDocumento";

describe("BadgeStatusDocumento", () => {
  it.each([
    ["PENDENTE", "Pendente"],
    ["PROCESSADO", "Processado"],
    ["ERRO", "Erro"],
  ] as const)("%s -> %s", (status, rotulo) => {
    render(<BadgeStatusDocumento status={status} />);
    expect(screen.getByText(rotulo)).toBeInTheDocument();
  });
});
