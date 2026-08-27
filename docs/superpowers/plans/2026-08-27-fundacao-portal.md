# Fundação do Portal SheepContabil — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Colocar no ar o esqueleto do portal SheepContabil — projeto Next.js configurado, Postgres local reproduzível, autenticação real com dois papéis, motor de execução compartilhado e uma home com a identidade visual da marca — pronto para os módulos SC-20, SC-18, SC-01 e SC-11 serem plugados um de cada vez em planos seguintes.

**Architecture:** Next.js (App Router, TypeScript) full-stack, Prisma sobre Postgres (Docker local em dev, Supabase em produção — mesmo schema nos dois). Sessão própria via JWT (`jose`) em cookie httpOnly, sem depender do Auth.js (v5 ainda em beta). Motor de execução genérico (`executarModulo`) que qualquer módulo futuro chama para rodar sob demanda ou via cron, sempre gravando em `Execucao`. Catálogo de módulos estático no código, com a flag `implementado` controlando o que a home exibe.

**Tech Stack:** Next.js 16 (App Router, TS) + React 19, Tailwind CSS v4, Prisma 7.10.0 + `@prisma/client` 7.10.0 + `@prisma/adapter-pg` 7.10.0 + `pg` 8.23.0, PostgreSQL 16 (Docker Compose em dev, Supabase em produção), `jose` 6.x (sessão JWT), `bcryptjs` 3.x (hash de senha), `zod` 4.x (validação), Vitest 4.x + `@testing-library/react` 16.x + `jsdom` (testes), `tsx` (rodar o seed).

**Spec:** [docs/superpowers/specs/2026-08-27-portal-sheepcontabil-design.md](../specs/2026-08-27-portal-sheepcontabil-design.md)

## Pré-requisitos do ambiente

- Node.js 24+ e npm 11+ instalados.
- **Docker Desktop rodando.** Confirme com `docker ps`. Se não abrir sozinho, inicie manualmente antes do Task 1.
- **Atenção à porta 5432**: se você já tiver outro projeto com Postgres em Docker usando a porta padrão 5432, ela vai colidir. Este plano usa a porta **5433** no host para o Postgres deste projeto exatamente por isso — confirme com `docker ps` que 5433 está livre antes de continuar.

## Global Constraints

- Prazo de entrega: 2026-09-01.
- Papéis mínimos: `ADMIN` (vê tudo) e `OPERADOR` (vê só módulos do setor dele).
- Toda execução de módulo grava um registro em `Execucao` (status `SUCESSO`/`ERRO`/`PARCIAL`); erro sempre com mensagem legível, nunca stack trace cru na UI principal.
- Segredo real nunca committado; `.env.example` documenta as variáveis necessárias.
- Paleta SheepContabil: `#10505F` petróleo, `#1FA69A` turquesa, `#E8A33D` âmbar, `#0B1A20` tinta, `#5A7078` grafite, `#EEF3F4` névoa, `#C4453D` carmim.
- Tipografia: Archivo (títulos, pesos 600–800), IBM Plex Sans (texto/formulário), IBM Plex Mono (código/valor/log).
- Autenticação própria (jose + bcryptjs), não Auth.js — decisão registrada na spec por causa da instabilidade do Auth.js v5.
- Versões de Prisma travadas em `7.10.0` exatas (`prisma`, `@prisma/client`, `@prisma/adapter-pg`) — a tag `latest` do pacote `prisma` aponta hoje para um release candidate da v8; não use `^`/`latest`.
- Catálogo de módulos é estático no código (`src/lib/modulos-catalogo.ts`), não uma tabela; `Execucao` referencia o módulo por código string; a flag `implementado` controla o que a home lista.
- Commits pequenos, mensagem explicando o porquê.

---

## File Structure

```
docker-compose.yml
.env.example
prisma/
  schema.prisma
  seed.ts
prisma.config.ts
src/
  generated/prisma/        # gerado pelo Prisma — não editar, não commitar
  lib/
    prisma.ts
    formatar.ts
    cnpj.ts
    senha.ts
    sessao.ts
    sessao-servidor.ts
    sessao-acoes.ts
    middleware-logica.ts
    execucao.ts
    modulos-catalogo.ts
  components/
    LogoSheep.tsx
    CabecalhoPortal.tsx
    ModuloCard.tsx
    HistoricoExecucoes.tsx
    ModuloPageLayout.tsx
  app/
    layout.tsx
    globals.css
    page.tsx
    login/
      page.tsx
      FormularioLogin.tsx
      actions.ts
  middleware.ts
vitest.config.ts
vitest.setup.ts
README.md
```

---

### Task 1: Scaffold do projeto + Postgres local via Docker

**Files:**
- Create: todo o scaffold do Next.js (via CLI) na raiz do repositório.
- Create: `docker-compose.yml`
- Create: `.env.example`, `.env` (local, não commitado)
- Modify: `.gitignore` (gerado pelo scaffold)

**Interfaces:**
- Produces: projeto Next.js rodável (`npm run dev`, `npm run build`), Postgres local acessível em `localhost:5433`.

- [ ] **Step 1: Rodar o scaffold do Next.js na raiz do repositório**

```bash
npx --yes create-next-app@latest . --typescript --tailwind --eslint --app --src-dir --import-alias "@/*" --use-npm --no-turbopack
```

Confirmado que isso funciona com a pasta `docs/` e o `.git` já existentes no repositório, sem sobrescrever nada.

- [ ] **Step 2: Remover arquivos de boilerplate desnecessários**

```bash
rm -f AGENTS.md CLAUDE.md
```

- [ ] **Step 3: Corrigir o `.gitignore` para não ignorar o `.env.example`**

O scaffold gera uma linha `.env*` que também ignoraria `.env.example` (que precisamos commitar). Adicione logo abaixo dela:

```
!.env.example
```

Também adicione ao final do arquivo:

```
# prisma
/src/generated
```

- [ ] **Step 4: Criar `docker-compose.yml`**

```yaml
services:
  db:
    image: postgres:16-alpine
    container_name: sheepcontabil-db
    restart: unless-stopped
    environment:
      POSTGRES_USER: sheep
      POSTGRES_PASSWORD: sheep
      POSTGRES_DB: sheepcontabil
    ports:
      - "5433:5432"
    volumes:
      - sheep_db_data:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U sheep -d sheepcontabil"]
      interval: 5s
      timeout: 5s
      retries: 10

volumes:
  sheep_db_data:
```

A porta host é `5433` (não a padrão `5432`) para não colidir com outro Postgres que já possa estar rodando na sua máquina.

- [ ] **Step 5: Criar `.env.example`**

```
# Postgres local (Docker Compose) — mesmas credenciais do docker-compose.yml.
# Em producao (Vercel), troque pela connection string do Supabase.
DATABASE_URL="postgresql://sheep:sheep@localhost:5433/sheepcontabil"

# Gere cada um com: node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
SESSION_SECRET=""
CRON_SECRET=""

# Chave da API da Anthropic (necessaria a partir do modulo SC-01).
ANTHROPIC_API_KEY=""
```

- [ ] **Step 6: Criar o `.env` local com segredos reais**

```bash
cp .env.example .env
SESSION_SECRET=$(node -e "console.log(require('crypto').randomBytes(32).toString('hex'))")
CRON_SECRET=$(node -e "console.log(require('crypto').randomBytes(32).toString('hex'))")
sed -i "s#SESSION_SECRET=\"\"#SESSION_SECRET=\"$SESSION_SECRET\"#" .env
sed -i "s#CRON_SECRET=\"\"#CRON_SECRET=\"$CRON_SECRET\"#" .env
```

- [ ] **Step 7: Subir o Postgres e verificar que está saudável**

```bash
docker compose up -d db
docker compose exec db pg_isready -U sheep -d sheepcontabil
```

Esperado: `accepting connections`.

- [ ] **Step 8: Verificar que o scaffold builda**

```bash
npm run build
```

Esperado: build concluído sem erros.

- [ ] **Step 9: Commit**

```bash
git add -A
git commit -m "chore: scaffold do Next.js e Postgres local via Docker

Base do portal: Next.js 16 (App Router, TS) + Tailwind v4. Postgres
local em Docker na porta 5433 (nao a 5432 padrao, para nao colidir com
outros projetos), mesmo schema que sera aplicado no Supabase em
producao."
git push
```

---

### Task 2: Configurar Vitest + utilitário de formatação

**Files:**
- Create: `vitest.config.ts`, `vitest.setup.ts`
- Create: `src/lib/formatar.ts`
- Test: `src/lib/formatar.test.ts`
- Modify: `package.json` (scripts `test`, `test:watch`)

**Interfaces:**
- Produces: `formatarDataHora(data: Date): string`, `formatarDuracao(inicio: Date, fim: Date | null): string` — usadas depois pelo componente `HistoricoExecucoes` (Task 7).

- [ ] **Step 1: Instalar dependências de teste**

```bash
npm install --save-dev vitest@4.1.11 @vitejs/plugin-react@6.1.0 jsdom@30.0.1 @testing-library/react@16.3.3 @testing-library/jest-dom@7.0.1 @testing-library/dom@10.4.1
```

- [ ] **Step 2: Criar `vitest.config.ts`**

```ts
import path from "node:path";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

export default defineConfig({
  plugins: [react()],
  test: {
    environment: "jsdom",
    setupFiles: ["./vitest.setup.ts"],
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
});
```

- [ ] **Step 3: Criar `vitest.setup.ts`**

```ts
import "@testing-library/jest-dom/vitest";
import { existsSync } from "node:fs";

if (existsSync(".env")) {
  process.loadEnvFile(".env");
}
```

`process.loadEnvFile` é nativo do Node 20.6+/24 — não precisa do pacote `dotenv`.

- [ ] **Step 4: Adicionar scripts ao `package.json`**

Dentro de `"scripts"`:

```json
"test": "vitest run",
"test:watch": "vitest"
```

- [ ] **Step 5: Escrever o teste que falha — `src/lib/formatar.test.ts`**

```ts
import { describe, expect, it } from "vitest";
import { formatarDuracao } from "./formatar";

describe("formatarDuracao", () => {
  it("mostra em andamento quando ainda nao finalizou", () => {
    expect(formatarDuracao(new Date(), null)).toBe("em andamento");
  });

  it("mostra segundos quando dura menos de um minuto", () => {
    const inicio = new Date("2026-08-27T10:00:00Z");
    const fim = new Date("2026-08-27T10:00:45Z");
    expect(formatarDuracao(inicio, fim)).toBe("45s");
  });

  it("mostra minutos e segundos quando dura mais de um minuto", () => {
    const inicio = new Date("2026-08-27T10:00:00Z");
    const fim = new Date("2026-08-27T10:02:05Z");
    expect(formatarDuracao(inicio, fim)).toBe("2min 5s");
  });
});
```

- [ ] **Step 6: Rodar e verificar que falha**

```bash
npm test
```

Esperado: FALHA — `Cannot find module './formatar'` (o arquivo ainda não existe). A primeira rodada do Vitest pode demorar dezenas de segundos (pré-empacotamento de dependências); é normal.

- [ ] **Step 7: Implementar `src/lib/formatar.ts`**

```ts
export function formatarDataHora(data: Date): string {
  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeStyle: "medium",
    timeZone: "America/Sao_Paulo",
  }).format(data);
}

export function formatarDuracao(inicio: Date, fim: Date | null): string {
  if (!fim) return "em andamento";

  const segundosTotais = Math.max(
    0,
    Math.round((fim.getTime() - inicio.getTime()) / 1000),
  );
  const minutos = Math.floor(segundosTotais / 60);
  const segundos = segundosTotais % 60;

  if (minutos === 0) return `${segundos}s`;
  return `${minutos}min ${segundos}s`;
}
```

- [ ] **Step 8: Rodar e verificar que passa**

```bash
npm test
```

Esperado: 3 testes passando.

- [ ] **Step 9: Commit**

```bash
git add -A
git commit -m "test: configurar Vitest e adicionar utilitarios de formatacao de data/duracao"
git push
```

---

### Task 3: Prisma — schema, CNPJ sintético, cliente e seed

**Files:**
- Create: `prisma.config.ts`
- Create: `prisma/schema.prisma`
- Create: `src/lib/prisma.ts`
- Create: `src/lib/cnpj.ts`
- Test: `src/lib/cnpj.test.ts`
- Create: `prisma/seed.ts`
- Modify: `.gitignore` (já feito no Task 1 — confirmar que `/src/generated` está lá)

**Interfaces:**
- Produces: `prisma` (cliente Prisma singleton, `src/lib/prisma.ts`), `gerarCnpjValido(baseNumerica: string): string`, `cnpjValido(cnpjFormatado: string): boolean` (`src/lib/cnpj.ts`).
- Consumes: `DATABASE_URL` do `.env` (Task 1).

> **Nota sobre a versão do Prisma:** o Prisma 7 mudou a forma de configurar o datasource e de instanciar o `PrismaClient` em relação a versões anteriores — não use `url` dentro de `datasource` no schema, e o `PrismaClient` agora exige um `adapter` explícito (`@prisma/adapter-pg`). Os passos abaixo já refletem isso, verificado rodando de ponta a ponta antes de escrever este plano.

- [ ] **Step 1: Instalar as dependências do Prisma (versões exatas)**

```bash
npm install --save-exact prisma@7.10.0 @prisma/client@7.10.0 @prisma/adapter-pg@7.10.0 pg@8.23.0
npm install --save-dev @types/pg tsx@4.23.12
```

- [ ] **Step 2: Escrever o teste que falha — `src/lib/cnpj.test.ts`**

```ts
import { describe, expect, it } from "vitest";
import { cnpjValido, gerarCnpjValido } from "./cnpj";

describe("cnpj", () => {
  it("gera um CNPJ com os digitos verificadores corretos", () => {
    const cnpj = gerarCnpjValido("11222333");
    expect(cnpjValido(cnpj)).toBe(true);
  });

  it("rejeita um CNPJ com digito verificador adulterado", () => {
    const cnpj = gerarCnpjValido("11222333");
    const adulterado = cnpj.slice(0, -1) + (cnpj.endsWith("9") ? "8" : "9");
    expect(cnpjValido(adulterado)).toBe(false);
  });

  it("rejeita string que nao tem 14 digitos", () => {
    expect(cnpjValido("123")).toBe(false);
  });
});
```

- [ ] **Step 3: Rodar e verificar que falha**

```bash
npm test -- cnpj
```

Esperado: FALHA — `Cannot find module './cnpj'`.

- [ ] **Step 4: Implementar `src/lib/cnpj.ts`**

```ts
const PESOS_PRIMEIRO_DIGITO = [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
const PESOS_SEGUNDO_DIGITO = [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];

function calcularDigito(numeros: number[], pesos: number[]): number {
  const soma = numeros.reduce(
    (total, numero, indice) => total + numero * pesos[indice],
    0,
  );
  const resto = soma % 11;
  return resto < 2 ? 0 : 11 - resto;
}

function apenasNumeros(valor: string): string {
  return valor.replace(/\D/g, "");
}

function formatarCnpj(numero: string): string {
  return `${numero.slice(0, 2)}.${numero.slice(2, 5)}.${numero.slice(5, 8)}/${numero.slice(8, 12)}-${numero.slice(12, 14)}`;
}

export function gerarCnpjValido(baseNumerica: string): string {
  const raiz = apenasNumeros(baseNumerica).padStart(8, "0").slice(0, 8);
  const base12 = `${raiz}0001`;
  const digitos = base12.split("").map(Number);

  const primeiroDigito = calcularDigito(digitos, PESOS_PRIMEIRO_DIGITO);
  const segundoDigito = calcularDigito(
    [...digitos, primeiroDigito],
    PESOS_SEGUNDO_DIGITO,
  );

  return formatarCnpj(`${base12}${primeiroDigito}${segundoDigito}`);
}

export function cnpjValido(cnpjFormatado: string): boolean {
  const numero = apenasNumeros(cnpjFormatado);
  if (numero.length !== 14) return false;

  const base12 = numero.slice(0, 12);
  const digitosInformados = numero.slice(12, 14);
  const digitos = base12.split("").map(Number);

  const primeiroDigito = calcularDigito(digitos, PESOS_PRIMEIRO_DIGITO);
  const segundoDigito = calcularDigito(
    [...digitos, primeiroDigito],
    PESOS_SEGUNDO_DIGITO,
  );

  return digitosInformados === `${primeiroDigito}${segundoDigito}`;
}
```

- [ ] **Step 5: Rodar e verificar que passa**

```bash
npm test -- cnpj
```

Esperado: 3 testes passando.

- [ ] **Step 6: Escrever `prisma/schema.prisma`**

```prisma
generator client {
  provider = "prisma-client"
  output   = "../src/generated/prisma"
}

datasource db {
  provider = "postgresql"
}

enum PapelUsuario {
  ADMIN
  OPERADOR
}

enum StatusExecucao {
  PENDENTE
  SUCESSO
  ERRO
  PARCIAL
}

model Usuario {
  id        String       @id @default(cuid())
  email     String       @unique
  nome      String
  senhaHash String
  papel     PapelUsuario
  setor     String?
  criadoEm  DateTime     @default(now())
}

model Cliente {
  id          String   @id @default(cuid())
  razaoSocial String
  cnpj        String   @unique
  atividade   String
  criadoEm    DateTime @default(now())
}

model Execucao {
  id           String         @id @default(cuid())
  moduloCodigo String
  disparadoPor String
  status       StatusExecucao @default(PENDENTE)
  iniciadoEm   DateTime       @default(now())
  finalizadoEm DateTime?
  resumo       String?
  erro         String?

  @@index([moduloCodigo, iniciadoEm])
}
```

Note que **não há** `url = env("DATABASE_URL")` dentro de `datasource` — no Prisma 7 essa URL vive em `prisma.config.ts`, não no schema.

- [ ] **Step 7: Escrever `prisma.config.ts`** (raiz do projeto)

```ts
import { existsSync } from "node:fs";
import { defineConfig, env } from "prisma/config";

if (existsSync(".env")) {
  process.loadEnvFile(".env");
}

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
    seed: "npx tsx prisma/seed.ts",
  },
  datasource: {
    url: env("DATABASE_URL"),
  },
});
```

- [ ] **Step 8: Rodar a primeira migração**

```bash
npx prisma migrate dev --name init
```

Esperado: `Your database is now in sync with your schema.` e a pasta `prisma/migrations/` criada.

- [ ] **Step 9: Criar o cliente Prisma singleton — `src/lib/prisma.ts`**

```ts
import { PrismaClient } from "@/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

function criarPrismaClient() {
  const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
  return new PrismaClient({ adapter });
}

export const prisma = globalForPrisma.prisma ?? criarPrismaClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
```

Note o import **sem extensão** (`@/generated/prisma/client`, não `client.js`) — com extensão o build do Next quebra.

- [ ] **Step 10: Criar `prisma/seed.ts`**

```ts
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
```

(`hashSenha` vem do Task 5 — como o Task 5 ainda não existe, este step fica pendente de implementação até lá. Prossiga para o Step 11 mesmo assim: o arquivo é escrito agora, mas só roda depois do Task 5.)

- [ ] **Step 11: Commit (sem rodar o seed ainda — `hashSenha` só existe a partir do Task 5)**

```bash
git add -A
git commit -m "feat: schema Prisma (Usuario, Cliente, Execucao), cliente singleton e utilitario de CNPJ sintetico

Prisma 7 muda a configuracao de datasource (agora em prisma.config.ts,
nao no schema) e exige adapter explicito no PrismaClient
(@prisma/adapter-pg) — documentado no comentario dos arquivos.
gerarCnpjValido produz CNPJ sintetico com digito verificador valido
para popular o seed sem inventar numero por numero a mao."
git push
```

---

### Task 4: Identidade visual — tema, fontes, logo e cabeçalho

**Files:**
- Modify: `src/app/globals.css`
- Modify: `src/app/layout.tsx`
- Create: `src/components/LogoSheep.tsx`
- Create: `src/components/CabecalhoPortal.tsx`
- Test: `src/components/CabecalhoPortal.test.tsx`

**Interfaces:**
- Produces: classes utilitárias Tailwind `bg-petroleo`, `text-turquesa`, `bg-ambar`, `bg-tinta`, `text-grafite`, `bg-nevoa`, `text-carmim` (e variantes `border-*`), `font-titulo`, `font-texto`, `font-codigo`. Componente `<CabecalhoPortal nomeUsuario={string} papel={"ADMIN"|"OPERADOR"} acaoSair={ReactNode?} />`.

- [ ] **Step 1: Escrever o teste que falha — `src/components/CabecalhoPortal.test.tsx`**

```tsx
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { CabecalhoPortal } from "./CabecalhoPortal";

describe("CabecalhoPortal", () => {
  it("mostra a marca e os dados do usuario logado", () => {
    render(<CabecalhoPortal nomeUsuario="Ana Souza" papel="ADMIN" />);

    expect(screen.getByTestId("marca-sheepcontabil")).toHaveTextContent(
      "SheepContabil",
    );
    expect(screen.getByText(/Ana Souza/)).toBeInTheDocument();
    expect(screen.getByText(/Administrador/)).toBeInTheDocument();
  });

  it("mostra Operador quando o papel e OPERADOR", () => {
    render(<CabecalhoPortal nomeUsuario="Bruno Lima" papel="OPERADOR" />);
    expect(screen.getByText(/Operador/)).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Rodar e verificar que falha**

```bash
npm test -- CabecalhoPortal
```

Esperado: FALHA — `Cannot find module './CabecalhoPortal'`.

- [ ] **Step 3: Implementar `src/components/LogoSheep.tsx`**

```tsx
export function LogoSheep({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 48 48"
      className={className}
      role="img"
      aria-label="SheepContabil"
    >
      <circle cx="24" cy="24" r="24" fill="currentColor" />
      <path
        d="M15 21c0-3.3 2.7-6 6-6h6c3.3 0 6 2.7 6 6v6c0 3.3-2.7 6-6 6h-6c-3.3 0-6-2.7-6-6v-6z"
        fill="white"
      />
      <circle cx="13" cy="19" r="3.5" fill="white" />
      <circle cx="35" cy="19" r="3.5" fill="white" />
      <circle cx="19" cy="27" r="1.6" fill="currentColor" />
      <circle cx="29" cy="27" r="1.6" fill="currentColor" />
    </svg>
  );
}
```

Ícone próprio (o arquivo original da marca não foi fornecido no desafio, só a imagem do mockup) — simples, mas segue a proporção circular descrita na seção 06.

- [ ] **Step 4: Implementar `src/components/CabecalhoPortal.tsx`**

```tsx
import type { PapelUsuario } from "@/generated/prisma/client";
import { LogoSheep } from "./LogoSheep";
import type { ReactNode } from "react";

type CabecalhoPortalProps = {
  nomeUsuario: string;
  papel: PapelUsuario;
  acaoSair?: ReactNode;
};

export function CabecalhoPortal({
  nomeUsuario,
  papel,
  acaoSair,
}: CabecalhoPortalProps) {
  return (
    <header className="flex items-center justify-between bg-petroleo px-6 py-4 text-nevoa">
      <div className="flex items-center gap-3">
        <LogoSheep className="h-8 w-8 text-turquesa" />
        <span
          data-testid="marca-sheepcontabil"
          className="font-titulo text-lg font-bold"
        >
          Sheep<span className="text-turquesa">Contabil</span>
        </span>
      </div>
      <div className="flex items-center gap-4 font-texto text-sm">
        <span>
          {nomeUsuario} · {papel === "ADMIN" ? "Administrador" : "Operador"}
        </span>
        {acaoSair}
      </div>
    </header>
  );
}
```

- [ ] **Step 5: Rodar e verificar que passa**

```bash
npm test -- CabecalhoPortal
```

Esperado: 2 testes passando.

- [ ] **Step 6: Substituir o tema em `src/app/globals.css`**

```css
@import "tailwindcss";

@theme {
  --color-petroleo: #10505f;
  --color-turquesa: #1fa69a;
  --color-ambar: #e8a33d;
  --color-tinta: #0b1a20;
  --color-grafite: #5a7078;
  --color-nevoa: #eef3f4;
  --color-carmim: #c4453d;

  --font-titulo: var(--font-archivo), "Archivo", sans-serif;
  --font-texto: var(--font-plex-sans), "IBM Plex Sans", sans-serif;
  --font-codigo: var(--font-plex-mono), "IBM Plex Mono", monospace;
}

body {
  background: var(--color-nevoa);
  color: var(--color-tinta);
  font-family: var(--font-texto);
}
```

- [ ] **Step 7: Substituir `src/app/layout.tsx` com carregamento de fontes**

```tsx
import type { Metadata } from "next";
import { Archivo, IBM_Plex_Sans, IBM_Plex_Mono } from "next/font/google";
import "./globals.css";

const archivo = Archivo({
  subsets: ["latin"],
  weight: ["600", "700", "800"],
  variable: "--font-archivo",
});

const plexSans = IBM_Plex_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  variable: "--font-plex-sans",
});

const plexMono = IBM_Plex_Mono({
  subsets: ["latin"],
  weight: ["400", "500"],
  variable: "--font-plex-mono",
});

export const metadata: Metadata = {
  title: "Portal SheepContabil",
  description: "Portal de automações da SheepContabil",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="pt-BR">
      <body
        className={`${archivo.variable} ${plexSans.variable} ${plexMono.variable} antialiased`}
      >
        {children}
      </body>
    </html>
  );
}
```

- [ ] **Step 8: Rodar o build e verificar que compila**

```bash
npm run build
```

Esperado: build concluído sem erros. `next/font/google` baixa os arquivos de fonte na hora do build — se a rede oscilar e o build falhar por timeout de download, rode de novo (é transitório, não um erro de código).

- [ ] **Step 9: Commit**

```bash
git add -A
git commit -m "feat: aplicar identidade visual da SheepContabil (paleta, tipografia, cabecalho)"
git push
```

---

### Task 5: Sessão própria (jose + bcrypt), login e middleware

**Files:**
- Create: `src/lib/senha.ts`
- Test: `src/lib/senha.test.ts`
- Create: `src/lib/sessao.ts`
- Test: `src/lib/sessao.test.ts`
- Create: `src/lib/middleware-logica.ts`
- Test: `src/lib/middleware-logica.test.ts`
- Create: `src/middleware.ts`
- Create: `src/lib/sessao-servidor.ts`
- Create: `src/lib/sessao-acoes.ts`
- Create: `src/app/login/actions.ts`
- Create: `src/app/login/FormularioLogin.tsx`
- Create: `src/app/login/page.tsx`

**Interfaces:**
- Consumes: `PapelUsuario` de `@/generated/prisma/client` (Task 3); `prisma` de `@/lib/prisma` (Task 3).
- Produces: `hashSenha(senhaPura: string): Promise<string>`, `senhaConfere(senhaPura: string, hash: string): Promise<boolean>` (`src/lib/senha.ts`) — consumido pelo `prisma/seed.ts` do Task 3. `COOKIE_SESSAO: string`, `type PayloadSessao = { usuarioId: string; email: string; nome: string; papel: PapelUsuario; setor: string | null }`, `criarTokenSessao(payload: PayloadSessao): Promise<string>`, `verificarTokenSessao(token: string): Promise<PayloadSessao | null>` (`src/lib/sessao.ts`). `obterSessao(): Promise<PayloadSessao | null>` (`src/lib/sessao-servidor.ts`) — consumido pela home (Task 7).

- [ ] **Step 1: Instalar dependências**

```bash
npm install --save-exact jose@6.2.10 bcryptjs@3.0.3 zod@4.4.3
npm install --save-dev @types/bcryptjs@3.0.0
```

- [ ] **Step 2: Escrever o teste que falha — `src/lib/senha.test.ts`**

```ts
import { describe, expect, it } from "vitest";
import { hashSenha, senhaConfere } from "./senha";

describe("senha", () => {
  it("gera um hash que confere com a senha original", async () => {
    const hash = await hashSenha("MinhaSenha123");
    await expect(senhaConfere("MinhaSenha123", hash)).resolves.toBe(true);
  });

  it("rejeita uma senha incorreta", async () => {
    const hash = await hashSenha("MinhaSenha123");
    await expect(senhaConfere("SenhaErrada", hash)).resolves.toBe(false);
  });
});
```

- [ ] **Step 3: Rodar e verificar que falha**

```bash
npm test -- senha.test
```

- [ ] **Step 4: Implementar `src/lib/senha.ts`**

```ts
import bcrypt from "bcryptjs";

const CUSTO_HASH = 10;

export async function hashSenha(senhaPura: string): Promise<string> {
  return bcrypt.hash(senhaPura, CUSTO_HASH);
}

export async function senhaConfere(
  senhaPura: string,
  hash: string,
): Promise<boolean> {
  return bcrypt.compare(senhaPura, hash);
}
```

- [ ] **Step 5: Rodar e verificar que passa**

```bash
npm test -- senha.test
```

- [ ] **Step 6: Rodar o seed do Task 3 agora que `hashSenha` existe**

```bash
npx prisma db seed
npx prisma db seed
```

Rodar duas vezes de propósito: a segunda deve terminar sem erro e sem duplicar registros (upsert idempotente).

- [ ] **Step 7: Escrever o teste que falha — `src/lib/sessao.test.ts`**

```ts
import { beforeAll, describe, expect, it } from "vitest";
import { criarTokenSessao, verificarTokenSessao } from "./sessao";

beforeAll(() => {
  process.env.SESSION_SECRET =
    "segredo-de-teste-com-pelo-menos-32-caracteres";
});

describe("sessao", () => {
  it("cria um token que verifica de volta para o mesmo payload", async () => {
    const payload = {
      usuarioId: "abc123",
      email: "ana@sheepcontabil.com.br",
      nome: "Ana Souza",
      papel: "ADMIN" as const,
      setor: null,
    };

    const token = await criarTokenSessao(payload);
    const resultado = await verificarTokenSessao(token);

    expect(resultado).toEqual(payload);
  });

  it("retorna null para um token invalido", async () => {
    const resultado = await verificarTokenSessao("token-invalido");
    expect(resultado).toBeNull();
  });
});
```

- [ ] **Step 8: Rodar e verificar que falha**

```bash
npm test -- sessao.test
```

- [ ] **Step 9: Implementar `src/lib/sessao.ts`**

```ts
import { SignJWT, jwtVerify } from "jose";
import type { PapelUsuario } from "@/generated/prisma/client";

export const COOKIE_SESSAO = "sheep_sessao";

export type PayloadSessao = {
  usuarioId: string;
  email: string;
  nome: string;
  papel: PapelUsuario;
  setor: string | null;
};

function obterChaveSecreta(): Uint8Array {
  const segredo = process.env.SESSION_SECRET;
  if (!segredo) {
    throw new Error("SESSION_SECRET não configurado.");
  }
  return new TextEncoder().encode(segredo);
}

export async function criarTokenSessao(
  payload: PayloadSessao,
): Promise<string> {
  return new SignJWT({ ...payload })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("8h")
    .sign(obterChaveSecreta());
}

export async function verificarTokenSessao(
  token: string,
): Promise<PayloadSessao | null> {
  try {
    const { payload } = await jwtVerify(token, obterChaveSecreta());
    return {
      usuarioId: String(payload.usuarioId),
      email: String(payload.email),
      nome: String(payload.nome),
      papel: payload.papel as PapelUsuario,
      setor: (payload.setor as string | null) ?? null,
    };
  } catch {
    return null;
  }
}
```

- [ ] **Step 10: Rodar e verificar que passa**

```bash
npm test -- sessao.test
```

- [ ] **Step 11: Escrever o teste que falha — `src/lib/middleware-logica.test.ts`**

```ts
import { describe, expect, it } from "vitest";
import { deveRedirecionarParaLogin } from "./middleware-logica";

describe("deveRedirecionarParaLogin", () => {
  it("nao redireciona a pagina de login mesmo sem sessao", () => {
    expect(deveRedirecionarParaLogin("/login", false)).toBe(false);
  });

  it("redireciona rota protegida sem sessao valida", () => {
    expect(deveRedirecionarParaLogin("/", false)).toBe(true);
  });

  it("nao redireciona rota protegida com sessao valida", () => {
    expect(deveRedirecionarParaLogin("/", true)).toBe(false);
  });

  it("nao redireciona rotas de api, mesmo sem sessao de usuario", () => {
    // Rotas de api (ex.: disparo de cron dos modulos futuros) se autenticam
    // sozinhas por segredo proprio (CRON_SECRET), nao por sessao de usuario.
    expect(deveRedirecionarParaLogin("/api/qualquer-coisa", false)).toBe(
      false,
    );
  });
});
```

- [ ] **Step 12: Rodar e verificar que falha, depois implementar `src/lib/middleware-logica.ts`**

```bash
npm test -- middleware-logica
```

```ts
const CAMINHOS_PUBLICOS = ["/login"];
const PREFIXOS_PUBLICOS = ["/api/"];

export function ehCaminhoPublico(pathname: string): boolean {
  if (CAMINHOS_PUBLICOS.some((caminho) => pathname === caminho)) {
    return true;
  }
  return PREFIXOS_PUBLICOS.some((prefixo) => pathname.startsWith(prefixo));
}

export function deveRedirecionarParaLogin(
  pathname: string,
  sessaoValida: boolean,
): boolean {
  if (ehCaminhoPublico(pathname)) {
    return false;
  }
  return !sessaoValida;
}
```

Rotas sob `/api/` ficam de fora do redirecionamento de sessão do middleware de propósito: os módulos com agendamento (a partir do SC-20) terão uma rota `/api/cron/...` chamada pelo Vercel Cron, que não tem cookie de sessão — ela se protege sozinha comparando um header com `CRON_SECRET`. Rotas de API que precisarem de sessão de usuário (se algum módulo futuro precisar) devem checar `obterSessao()` explicitamente dentro da própria rota.

- [ ] **Step 13: Rodar e verificar que passa**

```bash
npm test -- middleware-logica
```

- [ ] **Step 14: Implementar `src/middleware.ts`**

```ts
import { NextRequest, NextResponse } from "next/server";
import { COOKIE_SESSAO, verificarTokenSessao } from "@/lib/sessao";
import { deveRedirecionarParaLogin } from "@/lib/middleware-logica";

export async function middleware(request: NextRequest) {
  const token = request.cookies.get(COOKIE_SESSAO)?.value;
  const sessao = token ? await verificarTokenSessao(token) : null;

  if (deveRedirecionarParaLogin(request.nextUrl.pathname, sessao !== null)) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
```

- [ ] **Step 15: Implementar `src/lib/sessao-servidor.ts`**

```ts
import { cookies } from "next/headers";
import { COOKIE_SESSAO, verificarTokenSessao, type PayloadSessao } from "@/lib/sessao";

export async function obterSessao(): Promise<PayloadSessao | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(COOKIE_SESSAO)?.value;
  if (!token) return null;
  return verificarTokenSessao(token);
}
```

- [ ] **Step 16: Implementar `src/lib/sessao-acoes.ts`**

```ts
"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { COOKIE_SESSAO } from "@/lib/sessao";

export async function sair(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.delete(COOKIE_SESSAO);
  redirect("/login");
}
```

- [ ] **Step 17: Implementar `src/app/login/actions.ts`**

```ts
"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { senhaConfere } from "@/lib/senha";
import { COOKIE_SESSAO, criarTokenSessao } from "@/lib/sessao";

const esquemaLogin = z.object({
  email: z.string().email("E-mail inválido"),
  senha: z.string().min(1, "Informe a senha"),
});

export type EstadoLogin = { erro: string } | null;

export async function entrar(
  _estadoAnterior: EstadoLogin,
  formData: FormData,
): Promise<EstadoLogin> {
  const dados = esquemaLogin.safeParse({
    email: formData.get("email"),
    senha: formData.get("senha"),
  });

  if (!dados.success) {
    return { erro: "Preencha e-mail e senha válidos." };
  }

  const usuario = await prisma.usuario.findUnique({
    where: { email: dados.data.email },
  });

  if (!usuario) {
    return { erro: "E-mail ou senha incorretos." };
  }

  const senhaOk = await senhaConfere(dados.data.senha, usuario.senhaHash);

  if (!senhaOk) {
    return { erro: "E-mail ou senha incorretos." };
  }

  const token = await criarTokenSessao({
    usuarioId: usuario.id,
    email: usuario.email,
    nome: usuario.nome,
    papel: usuario.papel,
    setor: usuario.setor,
  });

  const cookieStore = await cookies();
  cookieStore.set(COOKIE_SESSAO, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 8,
  });

  redirect("/");
}
```

- [ ] **Step 18: Implementar `src/app/login/FormularioLogin.tsx`**

```tsx
"use client";

import { useActionState } from "react";
import { entrar, type EstadoLogin } from "./actions";

export function FormularioLogin() {
  const [estado, acaoFormulario, pendente] = useActionState<
    EstadoLogin,
    FormData
  >(entrar, null);

  return (
    <form action={acaoFormulario} className="flex flex-col gap-4 font-texto">
      <label className="flex flex-col gap-1 text-sm text-grafite">
        E-mail
        <input
          type="email"
          name="email"
          required
          className="rounded border border-grafite/40 px-3 py-2 text-tinta outline-none focus:border-turquesa"
        />
      </label>
      <label className="flex flex-col gap-1 text-sm text-grafite">
        Senha
        <input
          type="password"
          name="senha"
          required
          className="rounded border border-grafite/40 px-3 py-2 text-tinta outline-none focus:border-turquesa"
        />
      </label>
      {estado?.erro ? (
        <p className="text-sm text-carmim" role="alert">
          {estado.erro}
        </p>
      ) : null}
      <button
        type="submit"
        disabled={pendente}
        className="mt-2 rounded bg-petroleo px-4 py-2 font-semibold text-nevoa transition hover:bg-turquesa disabled:opacity-60"
      >
        {pendente ? "Entrando..." : "Entrar"}
      </button>
    </form>
  );
}
```

- [ ] **Step 19: Implementar `src/app/login/page.tsx`**

```tsx
import { LogoSheep } from "@/components/LogoSheep";
import { FormularioLogin } from "./FormularioLogin";

export default function PaginaLogin() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-tinta px-4">
      <div className="w-full max-w-sm rounded-lg bg-nevoa p-8 shadow-lg">
        <div className="mb-6 flex items-center justify-center gap-2">
          <LogoSheep className="h-10 w-10 text-petroleo" />
          <span className="font-titulo text-xl font-bold text-petroleo">
            Sheep<span className="text-turquesa">Contabil</span>
          </span>
        </div>
        <FormularioLogin />
      </div>
    </main>
  );
}
```

- [ ] **Step 20: Verificação manual**

```bash
docker compose up -d db
npm run dev
```

No navegador: acesse `http://localhost:3000/` deslogado → deve redirecionar para `/login`. Entre com `admin@sheepcontabil.com.br` / `AdminSheep#2026` → deve ir para `/` (que ainda mostrará erro 404/página vazia, pois a home só é implementada no Task 7 — o importante aqui é confirmar o redirecionamento e o cookie de sessão sendo criado, visível em DevTools → Application → Cookies). Tente uma senha errada → deve mostrar "E-mail ou senha incorretos." sem stack trace.

- [ ] **Step 21: Rodar toda a suíte e o build**

```bash
npm test
npm run build
```

- [ ] **Step 22: Commit**

```bash
git add -A
git commit -m "feat: sessao propria (jose + bcrypt), login e middleware de protecao de rotas

Auth.js v5 segue em beta; sessao JWT propria com cookie httpOnly
entrega a mesma garantia sem depender de pacote instavel (decisao
registrada na spec)."
git push
```

---

### Task 6: Motor de execução (`executarModulo`)

**Files:**
- Create: `src/lib/execucao.ts`
- Test: `src/lib/execucao.test.ts`

**Interfaces:**
- Consumes: `prisma` de `@/lib/prisma` (Task 3).
- Produces: `type ResultadoExecucao = { status: "SUCESSO" | "PARCIAL"; resumo: string }`, `type ExecucaoRegistrada` (alias do model `Execucao` do Prisma), `executarModulo(moduloCodigo: string, disparadoPor: string, executar: () => Promise<ResultadoExecucao>): Promise<ExecucaoRegistrada>`, `listarHistorico(moduloCodigo: string, limite?: number): Promise<ExecucaoRegistrada[]>` — usados a partir do Task 7 (home/shell) e por todo módulo futuro (SC-20, SC-18, SC-01, SC-11).

- [ ] **Step 1: Escrever o teste que falha — `src/lib/execucao.test.ts`**

```ts
import { afterEach, describe, expect, it } from "vitest";
import { prisma } from "@/lib/prisma";
import { executarModulo, listarHistorico } from "./execucao";

const MODULO_TESTE = "TESTE-FAKE";

afterEach(async () => {
  await prisma.execucao.deleteMany({ where: { moduloCodigo: MODULO_TESTE } });
});

describe("executarModulo", () => {
  it("grava SUCESSO quando a funcao termina bem", async () => {
    const resultado = await executarModulo(
      MODULO_TESTE,
      "teste@sheepcontabil.com.br",
      async () => ({ status: "SUCESSO", resumo: "3 itens processados" }),
    );

    expect(resultado.status).toBe("SUCESSO");
    expect(resultado.resumo).toBe("3 itens processados");
    expect(resultado.finalizadoEm).not.toBeNull();
  });

  it("grava ERRO com mensagem legivel quando a funcao lanca excecao", async () => {
    const resultado = await executarModulo(
      MODULO_TESTE,
      "teste@sheepcontabil.com.br",
      async () => {
        throw new Error("Arquivo em formato inesperado.");
      },
    );

    expect(resultado.status).toBe("ERRO");
    expect(resultado.erro).toBe("Arquivo em formato inesperado.");
  });

  it("lista o historico mais recente primeiro", async () => {
    await executarModulo(MODULO_TESTE, "a@sheepcontabil.com.br", async () => ({
      status: "SUCESSO",
      resumo: "primeira",
    }));
    await executarModulo(MODULO_TESTE, "b@sheepcontabil.com.br", async () => ({
      status: "SUCESSO",
      resumo: "segunda",
    }));

    const historico = await listarHistorico(MODULO_TESTE);

    expect(historico[0].resumo).toBe("segunda");
    expect(historico[1].resumo).toBe("primeira");
  });
});
```

- [ ] **Step 2: Rodar e verificar que falha**

```bash
npm test -- execucao.test
```

- [ ] **Step 3: Implementar `src/lib/execucao.ts`**

```ts
import { prisma } from "@/lib/prisma";
import type { Execucao } from "@/generated/prisma/client";

export type ResultadoExecucao = {
  status: "SUCESSO" | "PARCIAL";
  resumo: string;
};

export type ExecucaoRegistrada = Execucao;

export async function executarModulo(
  moduloCodigo: string,
  disparadoPor: string,
  executar: () => Promise<ResultadoExecucao>,
): Promise<ExecucaoRegistrada> {
  const execucao = await prisma.execucao.create({
    data: { moduloCodigo, disparadoPor, status: "PENDENTE" },
  });

  try {
    const resultado = await executar();

    return await prisma.execucao.update({
      where: { id: execucao.id },
      data: {
        status: resultado.status,
        resumo: resultado.resumo,
        finalizadoEm: new Date(),
      },
    });
  } catch (erro) {
    const mensagem =
      erro instanceof Error ? erro.message : "Falha inesperada na execução.";

    return await prisma.execucao.update({
      where: { id: execucao.id },
      data: {
        status: "ERRO",
        erro: mensagem,
        finalizadoEm: new Date(),
      },
    });
  }
}

export async function listarHistorico(
  moduloCodigo: string,
  limite = 20,
): Promise<ExecucaoRegistrada[]> {
  return prisma.execucao.findMany({
    where: { moduloCodigo },
    orderBy: { iniciadoEm: "desc" },
    take: limite,
  });
}
```

- [ ] **Step 4: Rodar e verificar que passa**

```bash
npm test -- execucao.test
```

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat: motor de execucao generico (executarModulo) com historico

Todo modulo futuro (SC-20, SC-18, SC-01, SC-11) chama executarModulo em
vez de escrever direto na tabela Execucao: garante que status,
resumo e erro legivel sejam gravados de forma consistente, com sucesso
ou falha."
git push
```

---

### Task 7: Home, catálogo de módulos, shell e README

**Files:**
- Create: `src/lib/modulos-catalogo.ts`
- Test: `src/lib/modulos-catalogo.test.ts`
- Create: `src/components/ModuloCard.tsx`
- Test: `src/components/ModuloCard.test.tsx`
- Create: `src/components/HistoricoExecucoes.tsx`
- Test: `src/components/HistoricoExecucoes.test.tsx`
- Create: `src/components/ModuloPageLayout.tsx`
- Modify: `src/app/page.tsx`
- Modify: `README.md`

**Interfaces:**
- Consumes: `PapelUsuario` de `@/generated/prisma/client`; `obterSessao` de `@/lib/sessao-servidor`; `sair` de `@/lib/sessao-acoes`; `CabecalhoPortal` de `@/components/CabecalhoPortal`; `ExecucaoRegistrada` de `@/lib/execucao`; `formatarDataHora`/`formatarDuracao` de `@/lib/formatar`.
- Produces: `type NaturezaModulo = "RPA" | "AGENTE_IA" | "CONTROLE"`, `type ModuloCatalogo`, `CATALOGO_MODULOS: ModuloCatalogo[]`, `NOMES_NATUREZA: Record<NaturezaModulo, string>`, `obterModulo(codigo: string): ModuloCatalogo | undefined`, `filtrarModulosVisiveis(papel: PapelUsuario, setor: string | null, catalogo?: ModuloCatalogo[]): ModuloCatalogo[]` — todos usados pelos planos de cada módulo (SC-20 em diante).

- [ ] **Step 1: Escrever o teste que falha — `src/lib/modulos-catalogo.test.ts`**

```ts
import { describe, expect, it } from "vitest";
import { filtrarModulosVisiveis, type ModuloCatalogo } from "./modulos-catalogo";

const catalogoFicticio: ModuloCatalogo[] = [
  {
    codigo: "X-1",
    nome: "Modulo do setor Fiscal",
    natureza: "CONTROLE",
    setorDono: "Fiscal",
    descricao: "teste",
    implementado: true,
  },
  {
    codigo: "X-2",
    nome: "Modulo do setor Processos",
    natureza: "RPA",
    setorDono: "Processos",
    descricao: "teste",
    implementado: true,
  },
  {
    codigo: "X-3",
    nome: "Modulo ainda nao implementado",
    natureza: "AGENTE_IA",
    setorDono: "Fiscal",
    descricao: "teste",
    implementado: false,
  },
];

describe("filtrarModulosVisiveis", () => {
  it("admin ve todos os modulos implementados, de qualquer setor", () => {
    const visiveis = filtrarModulosVisiveis("ADMIN", null, catalogoFicticio);
    expect(visiveis.map((m) => m.codigo)).toEqual(["X-1", "X-2"]);
  });

  it("operador so ve os modulos implementados do proprio setor", () => {
    const visiveis = filtrarModulosVisiveis(
      "OPERADOR",
      "Processos",
      catalogoFicticio,
    );
    expect(visiveis.map((m) => m.codigo)).toEqual(["X-2"]);
  });

  it("modulo nao implementado nunca aparece, nem para o admin", () => {
    const visiveis = filtrarModulosVisiveis("ADMIN", null, catalogoFicticio);
    expect(visiveis.map((m) => m.codigo)).not.toContain("X-3");
  });
});
```

- [ ] **Step 2: Rodar e verificar que falha**

```bash
npm test -- modulos-catalogo
```

- [ ] **Step 3: Implementar `src/lib/modulos-catalogo.ts`**

```ts
import type { PapelUsuario } from "@/generated/prisma/client";

export type NaturezaModulo = "RPA" | "AGENTE_IA" | "CONTROLE";

export type ModuloCatalogo = {
  codigo: string;
  nome: string;
  natureza: NaturezaModulo;
  setorDono: string;
  descricao: string;
  implementado: boolean;
};

export const CATALOGO_MODULOS: ModuloCatalogo[] = [
  {
    codigo: "SC-01",
    nome: "Conversão de extrato bancário para OFX",
    natureza: "AGENTE_IA",
    setorDono: "Contábil",
    descricao:
      "Lê extratos em PDF ou foto e gera um arquivo OFX pronto para importar.",
    implementado: false,
  },
  {
    codigo: "SC-11",
    nome: "Presunção correta nas notas de serviço da área médica",
    natureza: "AGENTE_IA",
    setorDono: "BPO Saúde",
    descricao:
      "Classifica cada item de nota fiscal de serviço médico na alíquota de presunção correta.",
    implementado: false,
  },
  {
    codigo: "SC-18",
    nome: "Tarefas encadeadas por tipo de processo",
    natureza: "RPA",
    setorDono: "Processos",
    descricao:
      "Cria automaticamente as próximas tarefas de um fluxo quando uma etapa é concluída.",
    implementado: false,
  },
  {
    codigo: "SC-20",
    nome: "Vencimento de certificado digital",
    natureza: "CONTROLE",
    setorDono: "Processos",
    descricao:
      "Painel e aviso de certificados digitais de clientes perto do vencimento.",
    implementado: false,
  },
];

export function obterModulo(codigo: string): ModuloCatalogo | undefined {
  return CATALOGO_MODULOS.find((modulo) => modulo.codigo === codigo);
}

export function filtrarModulosVisiveis(
  papel: PapelUsuario,
  setor: string | null,
  catalogo: ModuloCatalogo[] = CATALOGO_MODULOS,
): ModuloCatalogo[] {
  return catalogo.filter((modulo) => {
    if (!modulo.implementado) return false;
    if (papel === "ADMIN") return true;
    return modulo.setorDono === setor;
  });
}

export const NOMES_NATUREZA: Record<NaturezaModulo, string> = {
  RPA: "RPA",
  AGENTE_IA: "Agente de IA",
  CONTROLE: "Controle sistematizado",
};
```

Os 4 módulos começam com `implementado: false` — cada plano seguinte (SC-20, SC-18, SC-01, SC-11) vira essa flag para `true` quando entrega o módulo de verdade, e só então ele aparece na home.

- [ ] **Step 4: Rodar e verificar que passa**

```bash
npm test -- modulos-catalogo
```

- [ ] **Step 5: Escrever o teste que falha — `src/components/HistoricoExecucoes.test.tsx`**

```tsx
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { HistoricoExecucoes } from "./HistoricoExecucoes";
import type { ExecucaoRegistrada } from "@/lib/execucao";

describe("HistoricoExecucoes", () => {
  it("mostra mensagem vazia quando nao ha execucoes", () => {
    render(<HistoricoExecucoes execucoes={[]} />);
    expect(
      screen.getByText("Nenhuma execução registrada ainda."),
    ).toBeInTheDocument();
  });

  it("mostra o erro de forma legivel quando a execucao falhou", () => {
    const execucoes: ExecucaoRegistrada[] = [
      {
        id: "1",
        moduloCodigo: "SC-20",
        disparadoPor: "ana@sheepcontabil.com.br",
        status: "ERRO",
        iniciadoEm: new Date("2026-08-27T10:00:00Z"),
        finalizadoEm: new Date("2026-08-27T10:00:05Z"),
        resumo: null,
        erro: "Certificado com data inválida.",
      },
    ];

    render(<HistoricoExecucoes execucoes={execucoes} />);

    expect(screen.getByText("Erro")).toBeInTheDocument();
    expect(
      screen.getByText("Certificado com data inválida."),
    ).toBeInTheDocument();
  });
});
```

- [ ] **Step 6: Rodar e verificar que falha**

```bash
npm test -- HistoricoExecucoes
```

- [ ] **Step 7: Implementar `src/components/HistoricoExecucoes.tsx`**

```tsx
import { formatarDataHora, formatarDuracao } from "@/lib/formatar";
import type { ExecucaoRegistrada } from "@/lib/execucao";

const ROTULO_STATUS: Record<string, string> = {
  PENDENTE: "Em andamento",
  SUCESSO: "Sucesso",
  ERRO: "Erro",
  PARCIAL: "Parcial",
};

const COR_STATUS: Record<string, string> = {
  PENDENTE: "text-grafite",
  SUCESSO: "text-turquesa",
  ERRO: "text-carmim",
  PARCIAL: "text-ambar",
};

export function HistoricoExecucoes({
  execucoes,
}: {
  execucoes: ExecucaoRegistrada[];
}) {
  if (execucoes.length === 0) {
    return (
      <p className="font-texto text-sm text-grafite">
        Nenhuma execução registrada ainda.
      </p>
    );
  }

  return (
    <table className="w-full border-collapse font-texto text-sm">
      <thead>
        <tr className="border-b border-grafite/20 text-left text-grafite">
          <th className="py-2 pr-4">Data</th>
          <th className="py-2 pr-4">Duração</th>
          <th className="py-2 pr-4">Disparado por</th>
          <th className="py-2 pr-4">Resultado</th>
        </tr>
      </thead>
      <tbody>
        {execucoes.map((execucao) => (
          <tr key={execucao.id} className="border-b border-grafite/10">
            <td className="py-2 pr-4 font-codigo">
              {formatarDataHora(execucao.iniciadoEm)}
            </td>
            <td className="py-2 pr-4 font-codigo">
              {formatarDuracao(execucao.iniciadoEm, execucao.finalizadoEm)}
            </td>
            <td className="py-2 pr-4">{execucao.disparadoPor}</td>
            <td
              className={`py-2 pr-4 font-medium ${COR_STATUS[execucao.status]}`}
            >
              {ROTULO_STATUS[execucao.status]}
              {execucao.status === "ERRO" && execucao.erro ? (
                <span className="block font-texto text-xs font-normal text-grafite">
                  {execucao.erro}
                </span>
              ) : null}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
```

- [ ] **Step 8: Rodar e verificar que passa**

```bash
npm test -- HistoricoExecucoes
```

- [ ] **Step 9: Escrever o teste e implementar `src/components/ModuloCard.tsx`**

```tsx
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { ModuloCard } from "./ModuloCard";
import type { ModuloCatalogo } from "@/lib/modulos-catalogo";

const moduloTeste: ModuloCatalogo = {
  codigo: "SC-99",
  nome: "Modulo de teste",
  natureza: "CONTROLE",
  setorDono: "Processos",
  descricao: "Descricao de teste",
  implementado: true,
};

describe("ModuloCard", () => {
  it("mostra codigo, nome e natureza do modulo", () => {
    render(<ModuloCard modulo={moduloTeste} />);
    expect(screen.getByText("SC-99")).toBeInTheDocument();
    expect(screen.getByText("Modulo de teste")).toBeInTheDocument();
    expect(screen.getByText("Controle sistematizado")).toBeInTheDocument();
  });
});
```

Salve como `src/components/ModuloCard.test.tsx`, rode `npm test -- ModuloCard` (deve falhar), depois implemente:

```tsx
import Link from "next/link";
import type { ModuloCatalogo } from "@/lib/modulos-catalogo";
import { NOMES_NATUREZA } from "@/lib/modulos-catalogo";

export function ModuloCard({ modulo }: { modulo: ModuloCatalogo }) {
  return (
    <Link
      href={`/modulos/${modulo.codigo.toLowerCase()}`}
      className="flex flex-col gap-2 rounded-lg border border-grafite/20 bg-white p-5 shadow-sm transition hover:border-turquesa hover:shadow-md"
    >
      <span className="font-codigo text-xs uppercase tracking-wide text-grafite">
        {modulo.codigo}
      </span>
      <span className="font-titulo text-base font-bold text-tinta">
        {modulo.nome}
      </span>
      <span className="font-texto text-sm text-grafite">
        {modulo.descricao}
      </span>
      <span className="mt-2 inline-block w-fit rounded-full bg-turquesa/10 px-3 py-1 font-texto text-xs font-medium text-turquesa">
        {NOMES_NATUREZA[modulo.natureza]}
      </span>
    </Link>
  );
}
```

Rode `npm test -- ModuloCard` de novo e confirme que passa.

- [ ] **Step 10: Implementar `src/components/ModuloPageLayout.tsx`** (shell reutilizável pelos módulos futuros — sem teste dedicado, é composição de peças já testadas; será exercitado manualmente quando o SC-20 o consumir)

```tsx
import Link from "next/link";
import type { ReactNode } from "react";
import type { ModuloCatalogo } from "@/lib/modulos-catalogo";
import { NOMES_NATUREZA } from "@/lib/modulos-catalogo";
import { HistoricoExecucoes } from "@/components/HistoricoExecucoes";
import type { ExecucaoRegistrada } from "@/lib/execucao";

export function ModuloPageLayout({
  modulo,
  execucoes,
  acoes,
  conteudo,
}: {
  modulo: ModuloCatalogo;
  execucoes: ExecucaoRegistrada[];
  acoes?: ReactNode;
  conteudo?: ReactNode;
}) {
  return (
    <main className="mx-auto flex max-w-4xl flex-col gap-8 px-6 py-10">
      <div>
        <Link
          href="/"
          className="font-texto text-sm text-turquesa hover:underline"
        >
          ← Voltar para a home
        </Link>
        <div className="mt-3 flex items-center justify-between">
          <div>
            <span className="font-codigo text-xs uppercase tracking-wide text-grafite">
              {modulo.codigo}
            </span>
            <h1 className="font-titulo text-2xl font-bold text-tinta">
              {modulo.nome}
            </h1>
            <p className="mt-1 font-texto text-sm text-grafite">
              {modulo.descricao}
            </p>
          </div>
          <span className="rounded-full bg-turquesa/10 px-3 py-1 font-texto text-xs font-medium text-turquesa">
            {NOMES_NATUREZA[modulo.natureza]}
          </span>
        </div>
      </div>

      {acoes ? (
        <section className="flex flex-wrap gap-3">{acoes}</section>
      ) : null}

      {conteudo}

      <section>
        <h2 className="mb-3 font-titulo text-lg font-bold text-tinta">
          Histórico de execução
        </h2>
        <HistoricoExecucoes execucoes={execucoes} />
      </section>
    </main>
  );
}
```

- [ ] **Step 11: Substituir `src/app/page.tsx` (home)**

```tsx
import { redirect } from "next/navigation";
import { obterSessao } from "@/lib/sessao-servidor";
import { sair } from "@/lib/sessao-acoes";
import { CabecalhoPortal } from "@/components/CabecalhoPortal";
import { ModuloCard } from "@/components/ModuloCard";
import { filtrarModulosVisiveis } from "@/lib/modulos-catalogo";

export default async function PaginaHome() {
  const sessao = await obterSessao();

  if (!sessao) {
    redirect("/login");
  }

  const modulos = filtrarModulosVisiveis(sessao.papel, sessao.setor);

  return (
    <>
      <CabecalhoPortal
        nomeUsuario={sessao.nome}
        papel={sessao.papel}
        acaoSair={
          <form action={sair}>
            <button className="font-texto text-sm underline underline-offset-2">
              Sair
            </button>
          </form>
        }
      />
      <main className="mx-auto max-w-5xl px-6 py-10">
        <h1 className="mb-6 font-titulo text-2xl font-bold text-tinta">
          Módulos disponíveis
        </h1>
        {modulos.length === 0 ? (
          <p className="font-texto text-sm text-grafite">
            Nenhum módulo disponível para o seu perfil ainda.
          </p>
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {modulos.map((modulo) => (
              <ModuloCard key={modulo.codigo} modulo={modulo} />
            ))}
          </div>
        )}
      </main>
    </>
  );
}
```

- [ ] **Step 12: Reescrever o `README.md`**

```markdown
# Portal SheepContabil

Portal de automações da SheepContabil — desafio técnico de processo seletivo (Sheep Technology). Caso e empresa fictícios; dados sintéticos.

## Rodando localmente

Pré-requisitos: Node.js 24+, Docker Desktop rodando.

```bash
npm install
cp .env.example .env
# gere os dois segredos abaixo e cole no .env:
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"

docker compose up -d db
npx prisma migrate dev
npx prisma db seed
npm run dev
```

Abra `http://localhost:3000`.

## Credenciais de demonstração

| Perfil | E-mail | Senha |
|---|---|---|
| Administrador | admin@sheepcontabil.com.br | AdminSheep#2026 |
| Operador (setor Processos) | operador.processos@sheepcontabil.com.br | OperadorSheep#2026 |

## Testes

```bash
npm test
```

## Suposições registradas

- Extratos bancários (SC-01) chegam em PDF nativo ou em foto (JPEG/PNG) — não em PDF escaneado sem OCR embutido; a leitura usa a API multimodal da Anthropic diretamente sobre o documento, sem etapa separada de OCR.
- NFS-e (SC-11) chega em XML.
- "Sistema de tarefas" e "sistema contábil" citados no catálogo do desafio são inteiramente mockados dentro deste portal — não há integração externa real em nenhum dos 4 módulos escolhidos.
- O papel `OPERADOR` do seed está vinculado a um único setor, para demonstrar a segregação de visão.

## Onde entraria o acesso real

- `ANTHROPIC_API_KEY` no `.env` — chave real da Anthropic, usada pelos módulos SC-01 e SC-11 quando forem implementados.
- `DATABASE_URL` em produção aponta para o Supabase, não para o Postgres local.
- `CRON_SECRET` protege as rotas de disparo agendado (Vercel Cron) contra chamadas externas não autorizadas.

## Documentação de design

- [Spec de design](docs/superpowers/specs/2026-08-27-portal-sheepcontabil-design.md)
- [Plano de implementação — fundação](docs/superpowers/plans/2026-08-27-fundacao-portal.md)
```

- [ ] **Step 13: Rodar a suíte inteira e o build**

```bash
npm test
npm run build
```

Esperado: todos os testes passando, build sem erros.

- [ ] **Step 14: Verificação manual de ponta a ponta**

```bash
docker compose up -d db
npm run dev
```

Checklist no navegador:
- Acessar `/` deslogado → redireciona para `/login`.
- Logar como `admin@sheepcontabil.com.br` → vai para `/`, cabeçalho mostra "Ana Souza · Administrador", lista mostra "Nenhum módulo disponível para o seu perfil ainda." (correto: nenhum módulo tem `implementado: true` ainda).
- Clicar em "Sair" → volta para `/login` e o cookie de sessão desaparece.
- Logar como `operador.processos@sheepcontabil.com.br` → mesmo comportamento (nenhum módulo implementado ainda).

- [ ] **Step 15: Commit e push final da fundação**

```bash
git add -A
git commit -m "feat: home com catalogo de modulos, shell de modulo generico e README final

Fundacao completa: com nenhum modulo real implementado ainda, a home
mostra corretamente o estado vazio para os dois papeis — prova de que
o encanamento (sessao, filtro por setor, motor de execucao) funciona
antes de plugar o primeiro modulo (SC-20, no proximo plano)."
git push
```

---

## Depois deste plano

**Antes de começar o próximo módulo:** este plano não inclui deploy. A spec exige URL pública no ar continuamente, então, assim que a fundação estiver executada e revisada, fazemos um deploy inicial (ainda com a home vazia) — criar o projeto no Supabase, rodar `prisma migrate deploy` contra ele, linkar o repositório na Vercel, configurar as variáveis de ambiente e publicar. Isso valida o pipeline de deploy cedo, antes de qualquer módulo real existir, em vez de deixar essa parte pra última hora.

Depois disso, o próximo plano é o **SC-20** (mais simples dos quatro): schema próprio (`Certificado`, `AvisoCertificado`), rota `/modulos/sc-20`, botão "rodar agora" chamando `executarModulo`, cron mensal, e a flag `implementado: true` no catálogo. Ele será escrito depois que este plano estiver executado e revisado, para partir de interfaces reais em vez de supostas.
