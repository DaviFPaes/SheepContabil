import { existsSync } from "node:fs";
import { defineConfig } from "prisma/config";

if (existsSync(".env")) {
  process.loadEnvFile(".env");
}

// O Prisma Client em runtime sempre usa DATABASE_URL (ver src/lib/prisma.ts).
// As ferramentas de CLI (migrate deploy no build, db seed, studio) preferem
// DIRECT_URL quando ela existe: na Vercel, DATABASE_URL e o pooler de transacao
// do Supabase (porta 6543), que nao suporta rodar migracao; DIRECT_URL e a
// conexao direta (porta 5432). Em dev so DATABASE_URL existe e o fallback resolve
// para ela.
export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
    seed: "npx tsx prisma/seed.ts",
  },
  datasource: {
    // `||`, nao `??`: no .env.example DIRECT_URL vem como "" (string vazia), que
    // precisa cair para DATABASE_URL do mesmo jeito que ausente.
    url: process.env.DIRECT_URL || process.env.DATABASE_URL || "",
  },
});
