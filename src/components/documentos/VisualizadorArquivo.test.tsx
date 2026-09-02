// Brief usa @testing-library/user-event; ele não está instalado neste repo —
// os cliques vão por `fireEvent` e `afterEach(cleanup)` desmonta entre casos.
import { afterEach, expect, it } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { VisualizadorArquivo } from "./VisualizadorArquivo";

afterEach(cleanup);

it("PDF vira <iframe> apontando para o src", () => {
  const { container } = render(
    <VisualizadorArquivo src="/x/arquivo" mimeType="application/pdf" nomeArquivo="e.pdf" />,
  );
  const iframe = container.querySelector("iframe");
  expect(iframe?.getAttribute("src")).toContain("/x/arquivo");
});

it("imagem vira <img> e o zoom aumenta a escala", () => {
  render(<VisualizadorArquivo src="/x/arquivo" mimeType="image/jpeg" nomeArquivo="e.jpg" />);
  const img = screen.getByRole("img", { name: /e\.jpg/i });
  const antes = img.style.transform;
  fireEvent.click(screen.getByRole("button", { name: /aproximar/i }));
  expect(img.style.transform).not.toBe(antes);
});
