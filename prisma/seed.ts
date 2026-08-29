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

async function main() {
  await seedUsuarios();
  await seedClientes();
  await seedCertificados();
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (erro) => {
    console.error(erro);
    await prisma.$disconnect();
    process.exit(1);
  });
