import { afterEach, describe, expect, it } from "vitest";
import { prisma } from "@/lib/prisma";
import type { Prisma } from "@/generated/prisma/client";
import {
  contarNaoAvisados,
  estadoContato,
  listarCertificados,
  listarClientesParaSelecao,
  listarHistorico,
  listarNotificacoes,
  montarColunasKanban,
  obterPerfilCliente,
  type CertificadoLinha,
} from "./consultas";

const CNPJ_TESTE = "88.888.888/0001-88";

function dataDaqui(dias: number): Date {
  const d = new Date();
  d.setUTCHours(0, 0, 0, 0);
  d.setUTCDate(d.getUTCDate() + dias);
  return d;
}

afterEach(async () => {
  await prisma.registroAuditoria.deleteMany({ where: { cliente: { cnpj: CNPJ_TESTE } } });
  await prisma.notificacaoInApp.deleteMany({ where: { cliente: { cnpj: CNPJ_TESTE } } });
  await prisma.avisoCertificado.deleteMany({ where: { cliente: { cnpj: CNPJ_TESTE } } });
  await prisma.certificado.deleteMany({ where: { cliente: { cnpj: CNPJ_TESTE } } });
  await prisma.cliente.deleteMany({ where: { cnpj: CNPJ_TESTE } });
});

async function clienteTeste() {
  return prisma.cliente.create({
    data: {
      razaoSocial: "Cliente Consultas SC-20",
      cnpj: CNPJ_TESTE,
      atividade: "Teste",
      email: "cliente-consultas-sc20@example.com",
    },
  });
}

function dadosCert(clienteId: string, dataValidade: Date, extra: Partial<Prisma.CertificadoUncheckedCreateInput> = {}) {
  return {
    clienteId,
    dataValidade,
    tipo: "ECNPJ" as const,
    titular: "Cliente Consultas SC-20",
    emitidoEm: dataDaqui(-365),
    ...extra,
  };
}

// --- puro: montarColunasKanban / contarNaoAvisados -----------------------

const HOJE = new Date("2026-09-01T12:00:00Z");

function linha(over: Partial<CertificadoLinha> = {}): CertificadoLinha {
  return {
    id: "c1",
    clienteId: "cl1",
    razaoSocial: "Alfa Ltda",
    clienteEmail: "alfa@example.com",
    clienteTelefone: "+55 51 99999-0001",
    titular: "Alfa Ltda",
    tipo: "ECNPJ",
    dataValidade: new Date("2026-09-20T00:00:00Z"),
    emitidoEm: new Date("2025-09-20T00:00:00Z"),
    diasRestantes: 19,
    bucket: "D60",
    ativo: true,
    renovadoEm: null,
    avisoD3Em: null,
    avisoD60: null,
    avisoD7: null,
    ...over,
  };
}

describe("montarColunasKanban (puro)", () => {
  it("D60 — avisado ou nao — cai na coluna unica 'd60'", () => {
    const c = montarColunasKanban([
      linha({ id: "a", bucket: "D60", avisoD60: null }),
      linha({ id: "b", bucket: "D60", avisoD60: { status: "SENT", enviadoEm: HOJE } }),
      linha({ id: "c", bucket: "D60", avisoD60: { status: "BOUNCED", enviadoEm: HOJE } }),
    ]);
    expect(c.d60).toHaveLength(3);
  });

  it("D7 cai na coluna unica 'd7'", () => {
    const c = montarColunasKanban([
      linha({ id: "a", bucket: "D7", avisoD7: null }),
      linha({ id: "b", bucket: "D7", avisoD7: { status: "DELIVERED", enviadoEm: HOJE } }),
    ]);
    expect(c.d7).toHaveLength(2);
  });

  it("D3 vai para 'confirmar3'", () => {
    const c = montarColunasKanban([linha({ bucket: "D3" })]);
    expect(c.confirmar3).toHaveLength(1);
  });

  it("VENCIDO vai para 'vencido'", () => {
    const c = montarColunasKanban([linha({ bucket: "VENCIDO", diasRestantes: -1 })]);
    expect(c.vencido).toHaveLength(1);
  });

  it("RENOVADO e OK nao aparecem em nenhuma coluna do Kanban", () => {
    const c = montarColunasKanban([
      linha({ bucket: "RENOVADO", renovadoEm: new Date("2026-08-29T12:00:00Z") }),
      linha({ bucket: "OK", diasRestantes: 90 }),
    ]);
    const total =
      c.d60.length + c.d7.length + c.confirmar3.length + c.vencido.length;
    expect(total).toBe(0);
  });

  it("ordena os cards: 'recentes' = quem tem mais dias restantes primeiro; 'antigos' inverte", () => {
    const cards = [
      linha({ id: "a", bucket: "D7", diasRestantes: 4 }),
      linha({ id: "b", bucket: "D7", diasRestantes: 7 }),
      linha({ id: "c", bucket: "D7", diasRestantes: 5 }),
    ];
    expect(montarColunasKanban(cards, "recentes").d7.map((l) => l.id)).toEqual([
      "b",
      "c",
      "a",
    ]);
    expect(montarColunasKanban(cards, "antigos").d7.map((l) => l.id)).toEqual([
      "a",
      "c",
      "b",
    ]);
  });
});

describe("estadoContato (puro)", () => {
  it("D60 sem aviso = pendente; com SENT = avisado; com BOUNCED = falhou", () => {
    expect(estadoContato(linha({ bucket: "D60", avisoD60: null }))).toBe("pendente");
    expect(
      estadoContato(linha({ bucket: "D60", avisoD60: { status: "SENT", enviadoEm: HOJE } })),
    ).toBe("avisado");
    expect(
      estadoContato(linha({ bucket: "D60", avisoD60: { status: "BOUNCED", enviadoEm: HOJE } })),
    ).toBe("falhou");
  });

  it("D7 usa avisoD7", () => {
    expect(
      estadoContato(linha({ bucket: "D7", avisoD7: { status: "DELIVERED", enviadoEm: HOJE } })),
    ).toBe("avisado");
    expect(estadoContato(linha({ bucket: "D7", avisoD7: null }))).toBe("pendente");
  });

  it("D3 usa avisoD3Em", () => {
    expect(estadoContato(linha({ bucket: "D3", avisoD3Em: null }))).toBe("pendente");
    expect(estadoContato(linha({ bucket: "D3", avisoD3Em: HOJE }))).toBe("avisado");
  });

  it("buckets sem contato (VENCIDO, RENOVADO, OK) devolvem null", () => {
    expect(estadoContato(linha({ bucket: "VENCIDO" }))).toBeNull();
    expect(estadoContato(linha({ bucket: "RENOVADO" }))).toBeNull();
    expect(estadoContato(linha({ bucket: "OK" }))).toBeNull();
  });
});

describe("contarNaoAvisados", () => {
  it("conta em d60/d7 os cards ainda nao avisados (pendente ou falhou)", () => {
    const c = montarColunasKanban([
      linha({ id: "a", bucket: "D60", avisoD60: null }),
      linha({ id: "b", bucket: "D60", avisoD60: { status: "SENT", enviadoEm: HOJE } }),
      linha({ id: "c", bucket: "D60", avisoD60: { status: "BOUNCED", enviadoEm: HOJE } }),
      linha({ id: "d", bucket: "D7", avisoD7: null }),
    ]);
    expect(contarNaoAvisados(c)).toEqual({ d60: 2, d7: 1 });
  });
});

// --- integracao (Postgres local) ------------------------------------------

describe("listarCertificados", () => {
  it("devolve dias restantes e bucket calculados ao vivo", async () => {
    const cliente = await clienteTeste();
    await prisma.certificado.create({ data: dadosCert(cliente.id, dataDaqui(10)) });

    const lista = await listarCertificados();
    const alvo = lista.find((c) => c.razaoSocial === "Cliente Consultas SC-20");

    expect(alvo).toBeDefined();
    expect(alvo?.diasRestantes).toBe(10);
    expect(alvo?.bucket).toBe("D60");
  });

  it("recalcula ao vivo mesmo que o campo bucket gravado esteja desatualizado", async () => {
    const cliente = await clienteTeste();
    await prisma.certificado.create({
      data: dadosCert(cliente.id, dataDaqui(2), { bucket: "OK" }),
    });

    const lista = await listarCertificados();
    const alvo = lista.find((c) => c.razaoSocial === "Cliente Consultas SC-20");
    expect(alvo?.bucket).toBe("D3");
  });
});

describe("obterPerfilCliente", () => {
  it("devolve dados do cliente, certificados e historico filtrado", async () => {
    const cliente = await clienteTeste();
    await prisma.certificado.create({ data: dadosCert(cliente.id, dataDaqui(5)) });
    await prisma.registroAuditoria.create({
      data: {
        entidade: "Certificado",
        entidadeId: cliente.id,
        acao: "CRIADO",
        descricao: "Certificado criado",
        clienteId: cliente.id,
      },
    });

    const perfil = await obterPerfilCliente(cliente.id);

    expect(perfil?.cliente.razaoSocial).toBe("Cliente Consultas SC-20");
    expect(perfil?.certificados).toHaveLength(1);
    expect(perfil?.historico.length).toBeGreaterThanOrEqual(1);
  });

  it("devolve null para cliente inexistente", async () => {
    expect(await obterPerfilCliente("id-que-nao-existe")).toBeNull();
  });
});

describe("listarHistorico", () => {
  it("filtra por cliente e pagina", async () => {
    const cliente = await clienteTeste();
    for (let i = 0; i < 3; i++) {
      await prisma.registroAuditoria.create({
        data: {
          entidade: "Certificado",
          entidadeId: cliente.id,
          acao: "CRIADO",
          descricao: `evento ${i}`,
          clienteId: cliente.id,
        },
      });
    }

    const pagina1 = await listarHistorico({ clienteId: cliente.id, pagina: 1, porPagina: 2 });
    expect(pagina1.total).toBe(3);
    expect(pagina1.linhas).toHaveLength(2);

    const pagina2 = await listarHistorico({ clienteId: cliente.id, pagina: 2, porPagina: 2 });
    expect(pagina2.linhas).toHaveLength(1);
  });

  it("filtra por tipo de evento", async () => {
    const cliente = await clienteTeste();
    await prisma.registroAuditoria.create({
      data: { entidade: "Certificado", entidadeId: cliente.id, acao: "CRIADO", descricao: "a", clienteId: cliente.id },
    });
    await prisma.registroAuditoria.create({
      data: { entidade: "Certificado", entidadeId: cliente.id, acao: "EDITADO", descricao: "b", clienteId: cliente.id },
    });

    const resultado = await listarHistorico({ clienteId: cliente.id, acao: "EDITADO" });
    expect(resultado.linhas.every((l) => l.acao === "EDITADO")).toBe(true);
  });
});

describe("listarNotificacoes", () => {
  it("devolve so as nao lidas do usuario", async () => {
    const cliente = await clienteTeste();
    const certificado = await prisma.certificado.create({ data: dadosCert(cliente.id, dataDaqui(5)) });
    const usuario = await prisma.usuario.findFirstOrThrow({ where: { papel: "ADMIN" } });

    const lida = await prisma.notificacaoInApp.create({
      data: { usuarioId: usuario.id, tipo: "D60_ENTROU", certificadoId: certificado.id, clienteId: cliente.id, lidaEm: new Date() },
    });
    const naoLida = await prisma.notificacaoInApp.create({
      data: { usuarioId: usuario.id, tipo: "D7_ENTROU", certificadoId: certificado.id, clienteId: cliente.id },
    });

    const lista = await listarNotificacoes(usuario.id);
    const ids = lista.map((n) => n.id);

    expect(ids).toContain(naoLida.id);
    expect(ids).not.toContain(lida.id);

    await prisma.notificacaoInApp.deleteMany({ where: { id: { in: [lida.id, naoLida.id] } } });
  });
});

describe("listarClientesParaSelecao", () => {
  it("inclui o e-mail do cliente", async () => {
    await clienteTeste();
    const lista = await listarClientesParaSelecao();
    const alvo = lista.find((c) => c.razaoSocial === "Cliente Consultas SC-20");
    expect(alvo?.email).toBe("cliente-consultas-sc20@example.com");
  });
});
