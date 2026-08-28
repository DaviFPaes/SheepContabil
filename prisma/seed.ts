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

async function main() {
  await seedUsuarios();
  await seedClientes();
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (erro) => {
    console.error(erro);
    await prisma.$disconnect();
    process.exit(1);
  });
