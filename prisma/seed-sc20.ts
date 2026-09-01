import type { Prisma, PrismaClient } from "../src/generated/prisma/client";
import { gerarCnpjValido } from "../src/lib/cnpj";
import { calcularBucket, diasRestantes } from "../src/lib/certificados/bucket";

// Marcador de limpeza: todos os clientes deste seed usam CNPJ com raiz
// "100000XX", entao o prefixo "10.000.0" isola o SC-20 sem tocar nos
// clientes do SC-01/SC-11.
const PREFIXO_CNPJ_SC20 = "10.000.0";
const DOMINIO = "@example.com";

const DIA_MS = 24 * 60 * 60 * 1000;

function meiaNoiteHoje(): Date {
  const d = new Date();
  d.setUTCHours(0, 0, 0, 0);
  return d;
}

function dias(n: number, base = meiaNoiteHoje()): Date {
  return new Date(base.getTime() + n * DIA_MS);
}

function slug(texto: string): string {
  return texto
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

const RAMOS = [
  "Comércio",
  "Consultoria",
  "Logística",
  "Engenharia",
  "Serviços Médicos",
  "Tecnologia",
  "Construtora",
  "Agropecuária",
  "Indústria",
  "Contabilidade",
  "Transportes",
  "Alimentos",
];
const NUCLEOS = [
  "Aurora",
  "Boreal",
  "Cedro",
  "Delta",
  "Everest",
  "Fênix",
  "Girassol",
  "Horizonte",
  "Ígneo",
  "Jaçanã",
  "Kairós",
  "Lumen",
  "Marés",
  "Nórdica",
  "Orion",
  "Prisma",
  "Quartzo",
  "Rocha",
  "Solaris",
  "Trilha",
];
const FORMAS = ["Ltda", "S.A.", "ME", "EIRELI"];
const TITULARES_PF = [
  "Marina Alves",
  "Rafael Teixeira",
  "Camila Duarte",
  "Bruno Sales",
  "Letícia Moraes",
  "Diego Farias",
  "Patrícia Nunes",
  "André Lopes",
];

function nomeCliente(i: number): string {
  const nucleo = NUCLEOS[i % NUCLEOS.length];
  const ramo = RAMOS[(i * 7) % RAMOS.length];
  const forma = FORMAS[(i * 3) % FORMAS.length];
  return `${nucleo} ${ramo} ${forma}`;
}

const TIPOS = ["ECNPJ", "ECPF", "NFE"] as const;

type SpecCert = {
  diasAteVencer: number;
  tipoIdx: number;
  aviso?: { marco: "D60" | "D7"; bounce: boolean };
};

// 35 OK, 20 D60 (10 avisados), 12 D7 (6 avisados), 5 D3, 8 VENCIDO.
// Os 10 RENOVADO entram como par a parte (antigo + substituto).
function montarSpecs(): SpecCert[] {
  const specs: SpecCert[] = [];
  const add = (n: number, faixaDias: () => number, aviso?: (k: number) => SpecCert["aviso"]) => {
    for (let k = 0; k < n; k++) {
      specs.push({ diasAteVencer: faixaDias(), tipoIdx: specs.length % 3, aviso: aviso?.(k) });
    }
  };

  add(35, () => 70 + Math.floor(Math.random() * 330));
  add(
    20,
    () => 8 + Math.floor(Math.random() * 53),
    (k) => (k < 10 ? { marco: "D60", bounce: k < 3 } : undefined),
  );
  add(
    12,
    () => 4 + Math.floor(Math.random() * 4),
    (k) => (k < 6 ? { marco: "D7", bounce: k < 2 } : undefined),
  );
  add(5, () => Math.floor(Math.random() * 4));
  add(8, () => -1 - Math.floor(Math.random() * 40));
  return specs;
}

export async function seedSc20(prisma: PrismaClient): Promise<void> {
  // --- reset idempotente (só o SC-20) ---
  await prisma.certificado.updateMany({
    where: { cliente: { cnpj: { startsWith: PREFIXO_CNPJ_SC20 } } },
    data: { substituidoPorId: null },
  });
  await prisma.registroAuditoria.deleteMany({
    where: {
      OR: [
        { cliente: { cnpj: { startsWith: PREFIXO_CNPJ_SC20 } } },
        { entidade: "Execucao", acao: "ATUALIZAR_EXECUTADO" },
      ],
    },
  });
  await prisma.notificacaoInApp.deleteMany({
    where: { cliente: { cnpj: { startsWith: PREFIXO_CNPJ_SC20 } } },
  });
  await prisma.avisoCertificado.deleteMany({
    where: { cliente: { cnpj: { startsWith: PREFIXO_CNPJ_SC20 } } },
  });
  await prisma.certificado.deleteMany({
    where: { cliente: { cnpj: { startsWith: PREFIXO_CNPJ_SC20 } } },
  });
  await prisma.cliente.deleteMany({
    where: { cnpj: { startsWith: PREFIXO_CNPJ_SC20 } },
  });

  // --- 60 clientes ---
  const clientes: { id: string; razaoSocial: string }[] = [];
  for (let i = 0; i < 60; i++) {
    const razaoSocial = nomeCliente(i);
    const cnpj = gerarCnpjValido(String(10_000_001 + i));
    const c = await prisma.cliente.create({
      data: {
        razaoSocial,
        cnpj,
        atividade: RAMOS[(i * 7) % RAMOS.length],
        email: `${slug(razaoSocial)}${DOMINIO}`,
        ativo: i % 12 !== 0, // ~5 inativos
      },
    });
    clientes.push({ id: c.id, razaoSocial });
  }

  const auditoria: Prisma.RegistroAuditoriaCreateManyInput[] = [];

  async function criarCert(
    clienteIdx: number,
    diasAteVencer: number,
    tipoIdx: number,
    extra: { renovado?: boolean; renovadoEm?: Date; ativo?: boolean } = {},
  ) {
    const cliente = clientes[clienteIdx % clientes.length];
    const validade = dias(diasAteVencer);
    const emissao = dias(diasAteVencer - 365);
    const renovado = extra.renovado ?? false;
    const cert = await prisma.certificado.create({
      data: {
        clienteId: cliente.id,
        tipo: TIPOS[tipoIdx],
        titular: TIPOS[tipoIdx] === "ECPF" ? TITULARES_PF[clienteIdx % TITULARES_PF.length] : cliente.razaoSocial,
        emitidoEm: emissao,
        dataValidade: validade,
        ativo: extra.ativo ?? true,
        renovadoEm: extra.renovadoEm ?? null,
        bucket: renovado ? "RENOVADO" : calcularBucket(diasRestantes(validade), { renovado: false }),
      },
    });
    auditoria.push({
      entidade: "Certificado",
      entidadeId: cert.id,
      acao: "CRIADO",
      descricao: `Certificado ${TIPOS[tipoIdx]} de ${cliente.razaoSocial} criado`,
      autorEmail: "operador.processos@sheepcontabil.com.br",
      clienteId: cliente.id,
      criadoEm: dias(diasAteVencer - 365 + 2),
    });
    return { cert, cliente };
  }

  // --- certificados "normais" ---
  const specs = montarSpecs();
  const avisosACriar: { certId: string; clienteId: string; email: string; marco: "D60" | "D7"; bounce: boolean; enviadoEm: Date }[] = [];

  for (let i = 0; i < specs.length; i++) {
    const spec = specs[i];
    const { cert, cliente } = await criarCert(i, spec.diasAteVencer, spec.tipoIdx);
    if (spec.aviso) {
      const c = await prisma.cliente.findUniqueOrThrow({ where: { id: cliente.id } });
      avisosACriar.push({
        certId: cert.id,
        clienteId: cliente.id,
        email: spec.aviso.bounce ? `bounce+${slug(cliente.razaoSocial)}${DOMINIO}` : c.email,
        marco: spec.aviso.marco,
        bounce: spec.aviso.bounce,
        enviadoEm: dias(-2 - Math.floor(Math.random() * 20)),
      });
      auditoria.push({
        entidade: "Certificado",
        entidadeId: cert.id,
        acao: "TRANSICAO_BUCKET",
        descricao: `Bucket de ${cliente.razaoSocial}: Em dia → ${spec.aviso.marco === "D60" ? "60 dias" : "7 dias"}`,
        autorEmail: null,
        clienteId: cliente.id,
        dadosAntes: { bucket: "OK" },
        dadosDepois: { bucket: spec.aviso.marco },
        criadoEm: dias(-3 - Math.floor(Math.random() * 25)),
      });
    }
  }

  // --- 10 pares de renovação ---
  for (let k = 0; k < 10; k++) {
    const clienteIdx = 5 + k * 5;
    const novo = await criarCert(clienteIdx, 300 + k * 5, k % 3);
    const renovadoEm = dias(-1 - k * 2); // metade dentro dos 7 dias, metade fora
    const antigo = await criarCert(clienteIdx, -5 + k, k % 3, {
      renovado: true,
      renovadoEm,
      ativo: false,
    });
    await prisma.certificado.update({
      where: { id: antigo.cert.id },
      data: { substituidoPorId: novo.cert.id },
    });
    auditoria.push(
      {
        entidade: "Certificado",
        entidadeId: antigo.cert.id,
        acao: "RENOVACAO",
        descricao: `Certificado de ${antigo.cliente.razaoSocial} renovado — substituído pelo novo registro`,
        autorEmail: "operador.processos@sheepcontabil.com.br",
        clienteId: antigo.cliente.id,
        dadosDepois: { substituidoPorId: novo.cert.id },
        criadoEm: renovadoEm,
      },
      {
        entidade: "Certificado",
        entidadeId: antigo.cert.id,
        acao: "DESATIVADO",
        descricao: `Certificado de ${antigo.cliente.razaoSocial} desativado pela renovação`,
        autorEmail: "operador.processos@sheepcontabil.com.br",
        clienteId: antigo.cliente.id,
        criadoEm: renovadoEm,
      },
    );
  }

  // --- avisos (metade de D60 e de D7 já avisada; 5 com bounce) ---
  for (const a of avisosACriar) {
    await prisma.avisoCertificado.create({
      data: {
        certificadoId: a.certId,
        clienteId: a.clienteId,
        marco: a.marco,
        destinatarioEmail: a.email,
        status: a.bounce ? "BOUNCED" : Math.random() < 0.5 ? "SENT" : "DELIVERED",
        enviadoEm: a.enviadoEm,
        providerMessageId: a.bounce ? null : `seed-${a.certId.slice(0, 8)}`,
        criadoEm: a.enviadoEm,
      },
    });
    if (a.bounce) {
      auditoria.push({
        entidade: "AvisoCertificado",
        entidadeId: a.certId,
        acao: "AVISO_BOUNCE",
        descricao: `E-mail para ${a.email} voltou (bounce)`,
        autorEmail: null,
        clienteId: a.clienteId,
        criadoEm: dias(-1 - Math.floor(Math.random() * 10)),
      });
    } else {
      auditoria.push({
        entidade: "AvisoCertificado",
        entidadeId: a.certId,
        acao: "AVISO_ENVIADO",
        descricao: `Aviso ${a.marco} enviado para ${a.email}`,
        autorEmail: "operador.processos@sheepcontabil.com.br",
        clienteId: a.clienteId,
        criadoEm: a.enviadoEm,
      });
    }
  }

  // --- ~10 execuções de "Atualizar" espalhadas nos últimos 6 meses ---
  for (let k = 0; k < 10; k++) {
    auditoria.push({
      entidade: "Execucao",
      entidadeId: "",
      acao: "ATUALIZAR_EXECUTADO",
      descricao: `${80 + k} certificados reavaliados, ${k} transições`,
      autorEmail: k % 3 === 0 ? "operador.processos@sheepcontabil.com.br" : null,
      criadoEm: dias(-180 + k * 18),
    });
  }

  await prisma.registroAuditoria.createMany({ data: auditoria });

  // --- notificações in-app não lidas para admin + operador de Processos ---
  const destinatarios = await prisma.usuario.findMany({
    where: {
      OR: [{ papel: "ADMIN" }, { AND: [{ papel: "OPERADOR" }, { setor: "Processos" }] }],
    },
    select: { id: true },
  });
  const emFaixa = await prisma.certificado.findMany({
    where: { cliente: { cnpj: { startsWith: PREFIXO_CNPJ_SC20 } }, bucket: { in: ["D60", "D7", "D3"] } },
    select: { id: true, clienteId: true, bucket: true },
    take: 12,
  });
  const tipoPorBucket: Record<string, "D60_ENTROU" | "D7_ENTROU" | "D3_ENTROU"> = {
    D60: "D60_ENTROU",
    D7: "D7_ENTROU",
    D3: "D3_ENTROU",
  };
  const notifs: Prisma.NotificacaoInAppCreateManyInput[] = [];
  emFaixa.forEach((cert, idx) => {
    for (const u of destinatarios) {
      notifs.push({
        usuarioId: u.id,
        tipo: tipoPorBucket[cert.bucket],
        certificadoId: cert.id,
        clienteId: cert.clienteId,
        criadoEm: dias(-(idx % 3)),
      });
    }
  });
  await prisma.notificacaoInApp.createMany({ data: notifs });
}
