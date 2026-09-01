import { afterEach, describe, expect, it } from "vitest";
import { prisma } from "@/lib/prisma";
import type { Prisma } from "@/generated/prisma/client";
import {
  contarNaoAvisados,
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
    titular: "Alfa Ltda",
    tipo: "ECNPJ",
    dataValidade: new Date("2026-09-20T00:00:00Z"),
    emitidoEm: new Date("2025-09-20T00:00:00Z"),
    diasRestantes: 19,
    bucket: "D60",
    ativo: true,
    renovadoEm: null,
    avisoD60: null,
    avisoD7: null,
    ...over,
  };
}

describe("montarColunasKanban (puro)", () => {
  it("D60 sem avisoD60 vai para 'a avisar 60'", () => {
    const c = montarColunasKanban([linha({ bucket: "D60", avisoD60: null })], HOJE);
    expect(c.aAvisar60).toHaveLength(1);
    expect(c.avisado60).toHaveLength(0);
  });

  it("D60 com avisoD60 SENT vai para 'avisado 60'", () => {
    const c = montarColunasKanban(
      [linha({ bucket: "D60", avisoD60: { status: "SENT", enviadoEm: HOJE } })],
      HOJE,
    );
    expect(c.avisado60).toHaveLength(1);
    expect(c.aAvisar60).toHaveLength(0);
  });

  it("D60 com avisoD60 BOUNCED continua em 'a avisar 60'", () => {
    const c = montarColunasKanban(
      [linha({ bucket: "D60", avisoD60: { status: "BOUNCED", enviadoEm: HOJE } })],
      HOJE,
    );
    expect(c.aAvisar60).toHaveLength(1);
  });

  it("D7 sem avisoD7 vai para 'a avisar 7'; com DELIVERED vai para 'avisado 7'", () => {
    const semAviso = montarColunasKanban([linha({ bucket: "D7", avisoD7: null })], HOJE);
    expect(semAviso.aAvisar7).toHaveLength(1);

    const comAviso = montarColunasKanban(
      [linha({ bucket: "D7", avisoD7: { status: "DELIVERED", enviadoEm: HOJE } })],
      HOJE,
    );
    expect(comAviso.avisado7).toHaveLength(1);
  });

  it("D3 vai para 'confirmar3'", () => {
    const c = montarColunasKanban([linha({ bucket: "D3" })], HOJE);
    expect(c.confirmar3).toHaveLength(1);
  });

  it("VENCIDO vai para 'vencido'", () => {
    const c = montarColunasKanban([linha({ bucket: "VENCIDO", diasRestantes: -1 })], HOJE);
    expect(c.vencido).toHaveLength(1);
  });

  it("RENOVADO com renovadoEm ha 3 dias aparece; ha 10 dias nao", () => {
    const recente = montarColunasKanban(
      [linha({ bucket: "RENOVADO", renovadoEm: new Date("2026-08-29T12:00:00Z") })],
      HOJE,
    );
    expect(recente.renovado).toHaveLength(1);

    const antigo = montarColunasKanban(
      [linha({ bucket: "RENOVADO", renovadoEm: new Date("2026-08-20T12:00:00Z") })],
      HOJE,
    );
    expect(antigo.renovado).toHaveLength(0);
  });

  it("OK nao aparece em nenhuma coluna do Kanban", () => {
    const c = montarColunasKanban([linha({ bucket: "OK", diasRestantes: 90 })], HOJE);
    const total =
      c.aAvisar60.length +
      c.avisado60.length +
      c.aAvisar7.length +
      c.avisado7.length +
      c.confirmar3.length +
      c.vencido.length +
      c.renovado.length;
    expect(total).toBe(0);
  });
});

describe("contarNaoAvisados", () => {
  it("conta os cards das colunas 'a avisar'", () => {
    const c = montarColunasKanban(
      [linha({ bucket: "D60", avisoD60: null }), linha({ id: "c2", bucket: "D7", avisoD7: null })],
      HOJE,
    );
    expect(contarNaoAvisados(c)).toEqual({ d60: 1, d7: 1 });
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
