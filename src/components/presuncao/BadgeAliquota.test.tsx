import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { BadgeAliquota } from "./BadgeAliquota";

describe("BadgeAliquota", () => {
  it.each([
    ["P8", "8%"],
    ["P32", "32%"],
  ] as const)("%s -> %s", (aliquota, rotulo) => {
    render(<BadgeAliquota aliquota={aliquota} />);
    expect(screen.getByText(rotulo)).toBeInTheDocument();
  });
});
