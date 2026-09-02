import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { prisma } from "@/lib/prisma";

let sessao: unknown = null;
vi.mock("@/lib/sessao-servidor", () => ({ obterSessao: async () => sessao }));

import { GET } from "./route";

const CNPJ = "99.999.999/0001-99";
beforeEach(() => {
  sessao = { usuarioId: "u", email: "admin@sheepcontabil.com.br", nome: "A", papel: "ADMIN", setor: null };
});
afterEach(async () => {
  sessao = null;
  await prisma.documentoEntrada.deleteMany({ where: { cliente: { cnpj: CNPJ } } });
  await prisma.cliente.deleteMany({ where: { cnpj: CNPJ } });
});

async function doc(over: { mimeType?: string; nomeArquivo?: string; corpo?: string } = {}) {
  const c = await prisma.cliente.create({
    data: { razaoSocial: "Arquivo SC-01", cnpj: CNPJ, atividade: "T", email: "arquivo-sc01@example.com" },
  });
  return prisma.documentoEntrada.create({
    data: {
      tipo: "EXTRATO", clienteId: c.id,
      nomeArquivo: over.nomeArquivo ?? "e.pdf",
      mimeType: over.mimeType ?? "application/pdf",
      arquivo: Buffer.from(over.corpo ?? "%PDF-1.4 teste"),
      chegadaEm: new Date(),
    },
  });
}
const req = () => new Request("http://localhost/x");

describe("GET arquivo", () => {
  it("200 com o Content-Type do documento", async () => {
    const d = await doc();
    const res = await GET(req(), { params: Promise.resolve({ documentoId: d.id }) });
    expect(res.status).toBe(200);
    expect(res.headers.get("Content-Type")).toBe("application/pdf");
    expect(res.headers.get("Content-Disposition")).toContain("inline");
    expect(res.headers.get("X-Content-Type-Options")).toBe("nosniff");
  });
  it("força download (attachment/octet-stream) para mimeType não visualizável", async () => {
    const d = await doc({
      mimeType: "text/html",
      nomeArquivo: "x.html",
      corpo: "<script>alert(1)</script>",
    });
    const res = await GET(req(), { params: Promise.resolve({ documentoId: d.id }) });
    expect(res.status).toBe(200);
    expect(res.headers.get("Content-Type")).toBe("application/octet-stream");
    expect(res.headers.get("Content-Disposition")).toContain("attachment");
    expect(res.headers.get("X-Content-Type-Options")).toBe("nosniff");
  });
  it("401 sem sessão", async () => {
    const d = await doc();
    sessao = null;
    const res = await GET(req(), { params: Promise.resolve({ documentoId: d.id }) });
    expect(res.status).toBe(401);
  });
  it("404 para id inexistente", async () => {
    const res = await GET(req(), { params: Promise.resolve({ documentoId: "nao-existe" }) });
    expect(res.status).toBe(404);
  });
});
