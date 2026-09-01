import { existsSync } from "node:fs";
import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { seedSc20 } from "./seed-sc20";

// Rodado direto por `npm run seed:sc20:reset` (fora do `prisma db seed`),
// entao carrega o .env por conta propria.
if (existsSync(".env")) {
  process.loadEnvFile(".env");
}

const adapter = new PrismaPg({
  connectionString: process.env.DIRECT_URL || process.env.DATABASE_URL,
});
const prisma = new PrismaClient({ adapter });

// seedSc20 ja limpa e recria apenas as entidades do SC-20 (clientes com
// CNPJ raiz "100000XX" + cascata), sem tocar SC-01/SC-11.
seedSc20(prisma)
  .then(async () => {
    console.log("SC-20: carteira sintetica recriada.");
    await prisma.$disconnect();
  })
  .catch(async (erro) => {
    console.error(erro);
    await prisma.$disconnect();
    process.exit(1);
  });
