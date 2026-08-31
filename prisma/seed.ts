import { readFileSync } from "node:fs";
import { join } from "node:path";
import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { hashSenha } from "../src/lib/senha";
import { gerarCnpjValido } from "../src/lib/cnpj";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

async function seedUsuarios() {
  const senhaAdmin = await hashSenha("AdminSheep#2026");
  const senhaOperador = await hashSenha("OperadorSheep#2026");

  await prisma.usuario.upsert({
    where: { email: "admin@sheepcontabil.com.br" },
    update: {},
    create: {
      email: "admin@sheepcontabil.com.br",
      nome: "Ana Souza",
      senhaHash: senhaAdmin,
      papel: "ADMIN",
      setor: null,
    },
  });

  await prisma.usuario.upsert({
    where: { email: "operador.processos@sheepcontabil.com.br" },
    update: {},
    create: {
      email: "operador.processos@sheepcontabil.com.br",
      nome: "Bruno Lima",
      senhaHash: senhaOperador,
      papel: "OPERADOR",
      setor: "Processos",
    },
  });

  await prisma.usuario.upsert({
    where: { email: "operador.saude@sheepcontabil.com.br" },
    update: {},
    create: {
      email: "operador.saude@sheepcontabil.com.br",
      nome: "Carla Nunes",
      senhaHash: await hashSenha("OperadorSheep#2026"),
      papel: "OPERADOR",
      setor: "BPO Saúde",
    },
  });
}

const CLIENTES = [
  { razaoSocial: "Alfa Comércio de Materiais Ltda", atividade: "Comércio varejista", base: "11222333" },
  { razaoSocial: "Clínica Vida Plena Diagnósticos", atividade: "Serviços médicos", base: "22333444" },
  { razaoSocial: "Beta Consultoria Empresarial Ltda", atividade: "Consultoria", base: "33444555" },
  { razaoSocial: "Transportadora Rota Certa Ltda", atividade: "Transporte de cargas", base: "44555666" },
  { razaoSocial: "Consultório Odontológico Sorriso & Cia", atividade: "Serviços odontológicos", base: "55666777" },
  { razaoSocial: "Gama Indústria de Embalagens Ltda", atividade: "Indústria", base: "66777888" },
  { razaoSocial: "Escritório Delta Advogados Associados", atividade: "Serviços jurídicos", base: "77888999" },
  { razaoSocial: "Épsilon Tecnologia da Informação Ltda", atividade: "Serviços de TI", base: "88999000" },
];

async function seedClientes() {
  for (const cliente of CLIENTES) {
    const cnpj = gerarCnpjValido(cliente.base);
    await prisma.cliente.upsert({
      where: { cnpj },
      update: {},
      create: {
        razaoSocial: cliente.razaoSocial,
        cnpj,
        atividade: cliente.atividade,
      },
    });
  }
}

const CERTIFICADOS = [
  { clienteBase: "22333444", diasAteVencer: -3 }, // Clínica Vida Plena -> VENCIDO
  { clienteBase: "11222333", diasAteVencer: 5 }, // Alfa Comércio -> CRÍTICO
  { clienteBase: "33444555", diasAteVencer: 20 }, // Beta Consultoria -> ALERTA
  { clienteBase: "44555666", diasAteVencer: 45 }, // Transportadora Rota Certa -> PRÓXIMO
  { clienteBase: "55666777", diasAteVencer: 90 }, // Consultório Sorriso -> OK (fora da janela)
];

async function seedCertificados() {
  for (const item of CERTIFICADOS) {
    const cnpj = gerarCnpjValido(item.clienteBase);
    const cliente = await prisma.cliente.findUnique({ where: { cnpj } });
    if (!cliente) continue;

    const dataValidade = new Date();
    dataValidade.setUTCHours(0, 0, 0, 0);
    dataValidade.setUTCDate(dataValidade.getUTCDate() + item.diasAteVencer);

    const existente = await prisma.certificado.findFirst({
      where: { clienteId: cliente.id },
    });

    if (existente) {
      await prisma.certificado.update({
        where: { id: existente.id },
        data: { dataValidade },
      });
    } else {
      await prisma.certificado.create({
        data: { clienteId: cliente.id, dataValidade },
      });
    }
  }
}

// SC-01 — uma conta bancária sintética para ~4 clientes da carteira.
const CONTAS = [
  { clienteBase: "11222333", bancoNome: "Banco Alfa", compe: "001", agencia: "1201", numero: "45678-9" },
  { clienteBase: "33444555", bancoNome: "Banco Beta", compe: "341", agencia: "0455", numero: "10293-8" },
  { clienteBase: "44555666", bancoNome: "Banco Gama", compe: "033", agencia: "3390", numero: "77712-1" },
  { clienteBase: "88999000", bancoNome: "Banco Delta", compe: "260", agencia: "0001", numero: "55501-0" },
];

async function seedContasBancarias() {
  for (const c of CONTAS) {
    const cnpj = gerarCnpjValido(c.clienteBase);
    const cliente = await prisma.cliente.findUnique({ where: { cnpj } });
    if (!cliente) continue;

    const existente = await prisma.contaBancaria.findFirst({
      where: { clienteId: cliente.id, numero: c.numero },
    });
    if (existente) continue;

    await prisma.contaBancaria.create({
      data: {
        clienteId: cliente.id,
        bancoNome: c.bancoNome,
        compe: c.compe,
        agencia: c.agencia,
        numero: c.numero,
      },
    });
  }
}

// SC-01 — carrega os fixtures de `prisma/fixtures/` como DocumentoEntrada
// EXTRATO PENDENTE, com a chegada espalhada ao longo do mês. Gere os arquivos
// antes com `npm run fixtures`.
const FIXTURES = [
  { arquivo: "extrato-alfa.pdf", mime: "application/pdf", clienteBase: "11222333", diaChegada: 3 },
  { arquivo: "extrato-beta.pdf", mime: "application/pdf", clienteBase: "33444555", diaChegada: 9 },
  { arquivo: "extrato-gama.pdf", mime: "application/pdf", clienteBase: "44555666", diaChegada: 17 },
  { arquivo: "extrato-foto.jpg", mime: "image/jpeg", clienteBase: "88999000", diaChegada: 24 },
];

// Lê um fixture como Uint8Array (o tipo que o campo Bytes do Prisma espera).
// Devolve null se o arquivo ainda não foi gerado.
function lerFixture(nomeArquivo: string) {
  try {
    return new Uint8Array(
      readFileSync(join(process.cwd(), "prisma", "fixtures", nomeArquivo)),
    );
  } catch {
    return null;
  }
}

async function seedDocumentosEntrada() {
  for (const f of FIXTURES) {
    const cnpj = gerarCnpjValido(f.clienteBase);
    const cliente = await prisma.cliente.findUnique({ where: { cnpj } });
    if (!cliente) continue;

    const conta = await prisma.contaBancaria.findFirst({
      where: { clienteId: cliente.id },
    });

    const jaExiste = await prisma.documentoEntrada.findFirst({
      where: { clienteId: cliente.id, nomeArquivo: f.arquivo },
    });
    if (jaExiste) continue;

    const bytes = lerFixture(f.arquivo);
    if (!bytes) {
      console.warn(`[seed] fixture ausente: ${f.arquivo} — rode 'npm run fixtures'`);
      continue;
    }

    const chegadaEm = new Date();
    chegadaEm.setUTCHours(9, 0, 0, 0);
    chegadaEm.setUTCDate(f.diaChegada);

    await prisma.documentoEntrada.create({
      data: {
        tipo: "EXTRATO",
        clienteId: cliente.id,
        contaBancariaId: conta?.id ?? null,
        nomeArquivo: f.arquivo,
        mimeType: f.mime,
        arquivo: bytes,
        chegadaEm,
      },
    });
  }
}

// SC-11 — termos iniciais da base de presunção (editáveis pelo admin em
// /modulos/sc-11/termos). Upsert por `termo` (único) mantém o seed idempotente.
const TERMOS_PRESUNCAO: { termo: string; aliquota: "P8" | "P32" }[] = [
  { termo: "exame de imagem", aliquota: "P8" },
  { termo: "raio-x", aliquota: "P8" },
  { termo: "radiografia", aliquota: "P8" },
  { termo: "tomografia", aliquota: "P8" },
  { termo: "ressonância magnética", aliquota: "P8" },
  { termo: "ultrassonografia", aliquota: "P8" },
  { termo: "ecografia", aliquota: "P8" },
  { termo: "densitometria óssea", aliquota: "P8" },
  { termo: "mamografia", aliquota: "P8" },
  { termo: "eletrocardiograma", aliquota: "P8" },
  { termo: "endoscopia", aliquota: "P8" },
  { termo: "colonoscopia", aliquota: "P8" },
  { termo: "hemograma", aliquota: "P8" },
  { termo: "análises clínicas", aliquota: "P8" },
  { termo: "patologia clínica", aliquota: "P8" },
  { termo: "hemodiálise", aliquota: "P8" },
  { termo: "quimioterapia", aliquota: "P8" },
  { termo: "radioterapia", aliquota: "P8" },
  { termo: "fisioterapia", aliquota: "P8" },
];

async function seedTermosPresuncao() {
  for (const t of TERMOS_PRESUNCAO) {
    await prisma.termoPresuncao.upsert({
      where: { termo: t.termo },
      update: { aliquota: t.aliquota },
      create: t,
    });
  }
}

async function seedNotasNfse() {
  const cliente = await prisma.cliente.findFirstOrThrow({
    where: { razaoSocial: { contains: "Vida Plena" } },
  });
  const arquivos = [
    { nome: "nfse-pequena.xml", dia: 5 },
    { nome: "nfse-media.xml", dia: 12 },
    { nome: "nfse-grande.xml", dia: 20 },
  ];
  for (const a of arquivos) {
    const existe = await prisma.documentoEntrada.findFirst({
      where: { tipo: "NFSE", nomeArquivo: a.nome },
    });
    if (existe) continue;
    let conteudo: Uint8Array<ArrayBuffer>;
    try {
      // Mesmo padrão do seedDocumentosEntrada (SC-01): resolve por process.cwd().
      conteudo = readFileSync(join(process.cwd(), "prisma", "fixtures", a.nome));
    } catch {
      console.warn(`[seed] fixture ausente: ${a.nome} — rode 'npm run fixtures:nfse'`);
      continue;
    }
    await prisma.documentoEntrada.create({
      data: {
        tipo: "NFSE",
        clienteId: cliente.id,
        nomeArquivo: a.nome,
        mimeType: "application/xml",
        arquivo: conteudo,
        chegadaEm: new Date(Date.UTC(2026, 7, a.dia, 9, 0, 0)),
      },
    });
  }
}

async function main() {
  await seedUsuarios();
  await seedClientes();
  await seedTermosPresuncao();
  await seedNotasNfse();
  await seedContasBancarias();
  await seedDocumentosEntrada();
  await seedCertificados();
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (erro) => {
    console.error(erro);
    await prisma.$disconnect();
    process.exit(1);
  });
