import { describe, expect, it } from "vitest";
import { cronAutorizado } from "./cron-logica";

describe("cronAutorizado", () => {
  it("aceita o header Bearer com o segredo correto", () => {
    expect(cronAutorizado("Bearer s3gr3d0", "s3gr3d0")).toBe(true);
  });

  it("recusa header ausente", () => {
    expect(cronAutorizado(null, "s3gr3d0")).toBe(false);
  });

  it("recusa segredo errado", () => {
    expect(cronAutorizado("Bearer outro", "s3gr3d0")).toBe(false);
  });

  it("recusa quando o segredo do ambiente nao esta configurado", () => {
    expect(cronAutorizado("Bearer undefined", undefined)).toBe(false);
    expect(cronAutorizado("Bearer ", "")).toBe(false);
  });
});
