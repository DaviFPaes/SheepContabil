# SC-20 — Vencimento de certificado digital — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Entregar o primeiro módulo do catálogo — um painel de certificados digitais dos clientes que classifica cada um por faixa de urgência de vencimento e emite avisos (com texto pronto) sempre que a faixa muda, disparável sob demanda ou por cron mensal.

**Architecture:** Módulo plugado na fundação já no ar. Lógica de faixa de urgência é uma função pura (`src/lib/certificados/faixa-urgencia.ts`), testada em isolamento. O motor de processamento (`processarAvisosCertificados`) lê os certificados, compara a faixa atual com a do último aviso de cada um e cria `AvisoCertificado` só quando mudou — chamado sempre através do `executarModulo` da fundação (grava `Execucao`). A UI é uma página server component em `/modulos/sc-20` montada sobre o `ModuloPageLayout` existente, com CRUD de certificados via Server Actions e botão "rodar agora". Cron mensal bate numa rota `/api/cron/sc-20` protegida por `CRON_SECRET`.

**Tech Stack:** Next.js 16 (App Router, TS) + React 19, Prisma 7.10.0 + `@prisma/adapter-pg` sobre Postgres (Docker local em dev, Supabase em produção), Tailwind v4, `zod` 4, Vitest 4 (+ `@testing-library/react` para os componentes). Vercel Cron via `vercel.json`.

**Spec:** [docs/superpowers/specs/2026-08-27-portal-sheepcontabil-design.md](../specs/2026-08-27-portal-sheepcontabil-design.md) — seções 4, 5.5, 6, 7, 11, 12.

## Global Constraints

- Prazo de entrega: 2026-09-01.
- Toda execução de módulo grava um registro em `Execucao` via `executarModulo(moduloCodigo, disparadoPor, executar)` — nunca escrever direto na tabela. `disparadoPor` é o e-mail do usuário quando sob demanda, a string `"scheduler"` quando cron.
- Erro conhecido vira mensagem legível; erro desconhecido nunca expõe stack trace cru na UI principal (spec §12).
- Catálogo de módulos é estático (`src/lib/modulos-catalogo.ts`); a home só lista módulos com `implementado: true`. A flag do SC-20 só vira `true` quando o módulo estiver pronto (Task 8).
- Paleta: `petroleo #10505F`, `turquesa #1FA69A`, `ambar #E8A33D`, `tinta #0B1A20`, `grafite #5A7078`, `nevoa #EEF3F4`, `carmim #C4453D` — disponíveis como utilitários Tailwind `bg-*` / `text-*` / `border-*`. Fontes: `font-titulo` (Archivo), `font-texto` (IBM Plex Sans), `font-codigo` (IBM Plex Mono).
- Sessão: `obterSessao()` de `@/lib/sessao-servidor` retorna `PayloadSessao | null` (`{ usuarioId, email, nome, papel, setor }`). `ADMIN` vê tudo; `OPERADOR` vê só módulos do próprio `setor`. SC-20 pertence ao setor `"Processos"`.
- Conexão de banco: runtime usa `DATABASE_URL`; `prisma migrate deploy` (roda no `build`) usa `DIRECT_URL || DATABASE_URL`. Em dev, Docker Postgres em `localhost:5433` (`docker compose up -d db`).
- Import do Prisma Client sem extensão: `@/generated/prisma/client`.
- Commits pequenos, mensagem explicando o porquê. Terminar mensagem de commit com `Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>`.

**Faixas de urgência (decisão de design):**

| Faixa | Condição (dias restantes) | Gera aviso? |
|---|---|---|
| `VENCIDO` | `< 0` | sim |
| `CRITICO` | `0` a `7` | sim |
| `ALERTA` | `8` a `30` | sim |
| `PROXIMO` | `31` a `60` | sim |
| `OK` | `> 60` | não |

Aviso novo só quando a faixa **mudou** desde o último aviso daquele certificado (ou quando nunca houve aviso), e desde que a faixa atual não seja `OK`. O aviso guarda um texto pronto ("O certificado digital de X vence em N dias (faixa CRÍTICO).") — a entrega real por e-mail/sistema de avisos é fronteira mockada.

---

## File Structure

```
prisma/
  schema.prisma                       # + Certificado, AvisoCertificado, enum FaixaUrgencia
  migrations/<novo>_sc20_certificados/ # gerado por prisma migrate dev
  seed.ts                             # + seedCertificados()
vercel.json                          # novo — cron mensal do SC-20
src/
  lib/
    certificados/
      faixa-urgencia.ts               # função pura: calcularFaixa, diasRestantes, deveGerarAviso, mensagemAviso, ROTULO_FAIXA
      faixa-urgencia.test.ts
      processar.ts                    # processarAvisosCertificados(): ResultadoExecucao
      processar.test.ts               # integração (banco local)
      consultas.ts                    # listarCertificadosComStatus, listarAvisos, listarClientes
      consultas.test.ts               # integração (banco local)
      acoes.ts                        # "use server": criarCertificado, editarCertificado, removerCertificado, rodarAgora
    cron-logica.ts                    # cronAutorizado(authHeader, secret) — pura
    cron-logica.test.ts
    modulos-catalogo.ts               # flip SC-20 implementado: true
  components/
    certificados/
      BadgeFaixa.tsx
      BadgeFaixa.test.tsx
      PainelCertificados.tsx
      FormularioCertificado.tsx       # "use client" — cria e edita
      BotaoRemover.tsx                # "use client"
      ListaAvisos.tsx
      ListaAvisos.test.tsx
  app/
    modulos/sc-20/page.tsx            # server component
    api/cron/sc-20/route.ts           # GET protegido por CRON_SECRET
README.md                            # + seção do SC-20
```

---

### Task 1: Schema — `Certificado`, `AvisoCertificado`, enum `FaixaUrgencia`

**Files:**
- Modify: `prisma/schema.prisma`
- Create: `prisma/migrations/<timestamp>_sc20_certificados/migration.sql` (gerado)

**Interfaces:**
- Consumes: model `Cliente` já existente.
- Produces: models `Certificado` (`id`, `clienteId`, `cliente`, `dataValidade: DateTime`, `criadoEm`, `avisos`), `AvisoCertificado` (`id`, `certificadoId`, `certificado`, `faixa: FaixaUrgencia`, `diasRestantes: Int`, `mensagem: String`, `criadoEm`), enum `FaixaUrgencia { VENCIDO CRITICO ALERTA PROXIMO OK }`. Prisma Client regenerado em `src/generated/prisma`.

- [ ] **Step 1: Subir o Postgres local (se não estiver de pé)**

Run: `docker compose up -d db && docker compose exec db pg_isready -U sheep -d sheepcontabil`
Expected: `accepting connections`.

- [ ] **Step 2: Adicionar os models e o enum ao `prisma/schema.prisma`**

No fim do arquivo, depois do model `Execucao`:

```prisma
enum FaixaUrgencia {
  VENCIDO
  CRITICO
  ALERTA
  PROXIMO
  OK
}

model Certificado {
  id           String             @id @default(cuid())
  clienteId    String
  cliente      Cliente            @relation(fields: [clienteId], references: [id], onDelete: Cascade)
  dataValidade DateTime
  criadoEm     DateTime           @default(now())
  avisos       AvisoCertificado[]

  @@index([dataValidade])
}

model AvisoCertificado {
  id            String        @id @default(cuid())
  certificadoId String
  certificado   Certificado   @relation(fields: [certificadoId], references: [id], onDelete: Cascade)
  faixa         FaixaUrgencia
  diasRestantes Int
  mensagem      String
  criadoEm      DateTime      @default(now())

  @@index([certificadoId, criadoEm])
}
```

- [ ] **Step 3: Adicionar a relação inversa no model `Cliente`**

Dentro do model `Cliente`, logo abaixo de `criadoEm`:

```prisma
  certificados Certificado[]
```

- [ ] **Step 4: Rodar a migração**

Run: `npx prisma migrate dev --name sc20_certificados`
Expected: `Your database is now in sync with your schema.`, pasta `prisma/migrations/<timestamp>_sc20_certificados/` criada, e "Generated Prisma Client" no fim.

- [ ] **Step 5: Conferir que o build de tipos ainda passa**

Run: `npx tsc --noEmit`
Expected: sem erros.

- [ ] **Step 6: Commit**

```bash
git add prisma/schema.prisma prisma/migrations
git commit -m "feat(sc-20): schema de Certificado e AvisoCertificado

AvisoCertificado guarda a faixa de urgencia no momento do aviso e um
texto pronto da mensagem — o SC-20 so emite aviso novo quando a faixa
muda, entao precisa saber qual foi a ultima faixa comunicada por
certificado.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 2: Faixa de urgência — função pura

**Files:**
- Create: `src/lib/certificados/faixa-urgencia.ts`
- Test: `src/lib/certificados/faixa-urgencia.test.ts`

**Interfaces:**
- Produces:
  - `type FaixaUrgencia = "VENCIDO" | "CRITICO" | "ALERTA" | "PROXIMO" | "OK"`
  - `diasRestantes(dataValidade: Date, hoje?: Date): number` — diferença em dias de calendário (UTC); hoje = 0, amanhã = 1, ontem = -1.
  - `calcularFaixa(diasRestantes: number): FaixaUrgencia`
  - `deveGerarAviso(faixaAtual: FaixaUrgencia, faixaUltimoAviso: FaixaUrgencia | null): boolean`
  - `mensagemAviso(razaoSocial: string, diasRestantes: number, faixa: FaixaUrgencia): string`
  - `ROTULO_FAIXA: Record<FaixaUrgencia, string>`
  - `ORDEM_FAIXAS: FaixaUrgencia[]` (da mais urgente para a menos)

- [ ] **Step 1: Escrever o teste que falha — `src/lib/certificados/faixa-urgencia.test.ts`**

```ts
import { describe, expect, it } from "vitest";
import {
  calcularFaixa,
  deveGerarAviso,
  diasRestantes,
  mensagemAviso,
} from "./faixa-urgencia";

describe("diasRestantes", () => {
  const hoje = new Date("2026-08-29T15:00:00Z");

  it("conta zero quando vence hoje", () => {
    expect(diasRestantes(new Date("2026-08-29T23:59:00Z"), hoje)).toBe(0);
  });

  it("conta positivo para o futuro", () => {
    expect(diasRestantes(new Date("2026-10-13T00:00:00Z"), hoje)).toBe(45);
  });

  it("conta negativo para o passado", () => {
    expect(diasRestantes(new Date("2026-08-26T00:00:00Z"), hoje)).toBe(-3);
  });
});

describe("calcularFaixa", () => {
  it.each([
    [-1, "VENCIDO"],
    [0, "CRITICO"],
    [7, "CRITICO"],
    [8, "ALERTA"],
    [30, "ALERTA"],
    [31, "PROXIMO"],
    [60, "PROXIMO"],
    [61, "OK"],
    [365, "OK"],
  ])("dias=%i -> %s", (dias, esperado) => {
    expect(calcularFaixa(dias)).toBe(esperado);
  });
});

describe("deveGerarAviso", () => {
  it("gera o primeiro aviso quando nunca houve aviso e a faixa nao e OK", () => {
    expect(deveGerarAviso("ALERTA", null)).toBe(true);
  });

  it("nao gera aviso quando a faixa e OK, mesmo sem aviso anterior", () => {
    expect(deveGerarAviso("OK", null)).toBe(false);
  });

  it("nao gera aviso quando a faixa nao mudou", () => {
    expect(deveGerarAviso("CRITICO", "CRITICO")).toBe(false);
  });

  it("gera aviso quando a faixa mudou para uma mais urgente", () => {
    expect(deveGerarAviso("CRITICO", "ALERTA")).toBe(true);
  });
});

describe("mensagemAviso", () => {
  it("descreve vencimento futuro", () => {
    expect(mensagemAviso("Alfa Comércio Ltda", 5, "CRITICO")).toBe(
      "O certificado digital de Alfa Comércio Ltda vence em 5 dias (faixa CRÍTICO).",
    );
  });

  it("descreve vencimento hoje", () => {
    expect(mensagemAviso("Alfa Comércio Ltda", 0, "CRITICO")).toBe(
      "O certificado digital de Alfa Comércio Ltda vence hoje (faixa CRÍTICO). Renovação urgente.",
    );
  });

  it("descreve certificado ja vencido no singular", () => {
    expect(mensagemAviso("Alfa Comércio Ltda", -1, "VENCIDO")).toBe(
      "O certificado digital de Alfa Comércio Ltda venceu há 1 dia (faixa VENCIDO). Renovação e revalidação de acessos necessárias.",
    );
  });
});
```

- [ ] **Step 2: Rodar e verificar que falha**

Run: `npm test -- faixa-urgencia`
Expected: FALHA — `Cannot find module './faixa-urgencia'`.

- [ ] **Step 3: Implementar `src/lib/certificados/faixa-urgencia.ts`**

```ts
export type FaixaUrgencia =
  | "VENCIDO"
  | "CRITICO"
  | "ALERTA"
  | "PROXIMO"
  | "OK";

const DIA_MS = 24 * 60 * 60 * 1000;

function inicioDoDiaUTC(data: Date): number {
  return Date.UTC(
    data.getUTCFullYear(),
    data.getUTCMonth(),
    data.getUTCDate(),
  );
}

export function diasRestantes(
  dataValidade: Date,
  hoje: Date = new Date(),
): number {
  return Math.round(
    (inicioDoDiaUTC(dataValidade) - inicioDoDiaUTC(hoje)) / DIA_MS,
  );
}

export function calcularFaixa(diasRestantes: number): FaixaUrgencia {
  if (diasRestantes < 0) return "VENCIDO";
  if (diasRestantes <= 7) return "CRITICO";
  if (diasRestantes <= 30) return "ALERTA";
  if (diasRestantes <= 60) return "PROXIMO";
  return "OK";
}

export function deveGerarAviso(
  faixaAtual: FaixaUrgencia,
  faixaUltimoAviso: FaixaUrgencia | null,
): boolean {
  if (faixaAtual === "OK") return false;
  return faixaAtual !== faixaUltimoAviso;
}

export const ROTULO_FAIXA: Record<FaixaUrgencia, string> = {
  VENCIDO: "VENCIDO",
  CRITICO: "CRÍTICO",
  ALERTA: "ALERTA",
  PROXIMO: "PRÓXIMO",
  OK: "OK",
};

export const ORDEM_FAIXAS: FaixaUrgencia[] = [
  "VENCIDO",
  "CRITICO",
  "ALERTA",
  "PROXIMO",
  "OK",
];

export function mensagemAviso(
  razaoSocial: string,
  diasRestantes: number,
  faixa: FaixaUrgencia,
): string {
  const rotulo = ROTULO_FAIXA[faixa];

  if (diasRestantes < 0) {
    const dias = Math.abs(diasRestantes);
    const plural = dias === 1 ? "dia" : "dias";
    return `O certificado digital de ${razaoSocial} venceu há ${dias} ${plural} (faixa ${rotulo}). Renovação e revalidação de acessos necessárias.`;
  }

  if (diasRestantes === 0) {
    return `O certificado digital de ${razaoSocial} vence hoje (faixa ${rotulo}). Renovação urgente.`;
  }

  const plural = diasRestantes === 1 ? "dia" : "dias";
  return `O certificado digital de ${razaoSocial} vence em ${diasRestantes} ${plural} (faixa ${rotulo}).`;
}
```

- [ ] **Step 4: Rodar e verificar que passa**

Run: `npm test -- faixa-urgencia`
Expected: todos os testes passando.

- [ ] **Step 5: Commit**

```bash
git add src/lib/certificados/faixa-urgencia.ts src/lib/certificados/faixa-urgencia.test.ts
git commit -m "feat(sc-20): faixa de urgencia de certificado como funcao pura

calcularFaixa e deveGerarAviso concentram a regra citada no catalogo
(so avisar de novo quando a faixa muda) num ponto testavel sem banco.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 3: Motor de processamento — `processarAvisosCertificados`

**Files:**
- Create: `src/lib/certificados/processar.ts`
- Test: `src/lib/certificados/processar.test.ts`

**Interfaces:**
- Consumes: `prisma` de `@/lib/prisma`; `ResultadoExecucao` de `@/lib/execucao` (`{ status: "SUCESSO" | "PARCIAL"; resumo: string }`); tudo de `./faixa-urgencia`.
- Produces: `processarAvisosCertificados(): Promise<ResultadoExecucao>` — varre todos os certificados, ignora os com `diasRestantes > 60`, e para cada um dos demais cria um `AvisoCertificado` quando `deveGerarAviso(faixaAtual, faixaDoUltimoAviso)` é `true`. Nunca lança para fluxo normal; se `prisma` lançar, deixa propagar (o `executarModulo` que a chama registra `ERRO`).

- [ ] **Step 1: Escrever o teste que falha — `src/lib/certificados/processar.test.ts`**

```ts
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { prisma } from "@/lib/prisma";
import { processarAvisosCertificados } from "./processar";

const CNPJ_TESTE = "99.999.999/0001-99";

async function criarClienteTeste() {
  return prisma.cliente.create({
    data: {
      razaoSocial: "Cliente Teste SC-20",
      cnpj: CNPJ_TESTE,
      atividade: "Teste",
    },
  });
}

function dataDaqui(dias: number): Date {
  const d = new Date();
  d.setUTCHours(0, 0, 0, 0);
  d.setUTCDate(d.getUTCDate() + dias);
  return d;
}

afterEach(async () => {
  await prisma.avisoCertificado.deleteMany({
    where: { certificado: { cliente: { cnpj: CNPJ_TESTE } } },
  });
  await prisma.certificado.deleteMany({
    where: { cliente: { cnpj: CNPJ_TESTE } },
  });
  await prisma.cliente.deleteMany({ where: { cnpj: CNPJ_TESTE } });
});

describe("processarAvisosCertificados", () => {
  it("cria um aviso CRITICO para certificado vencendo em 5 dias", async () => {
    const cliente = await criarClienteTeste();
    const certificado = await prisma.certificado.create({
      data: { clienteId: cliente.id, dataValidade: dataDaqui(5) },
    });

    const resultado = await processarAvisosCertificados();
    expect(resultado.status).toBe("SUCESSO");

    const avisos = await prisma.avisoCertificado.findMany({
      where: { certificadoId: certificado.id },
    });
    expect(avisos).toHaveLength(1);
    expect(avisos[0].faixa).toBe("CRITICO");
    expect(avisos[0].diasRestantes).toBe(5);
    expect(avisos[0].mensagem).toContain("vence em 5 dias");
  });

  it("nao cria aviso repetido quando a faixa nao mudou", async () => {
    const cliente = await criarClienteTeste();
    const certificado = await prisma.certificado.create({
      data: { clienteId: cliente.id, dataValidade: dataDaqui(5) },
    });

    await processarAvisosCertificados();
    await processarAvisosCertificados();

    const avisos = await prisma.avisoCertificado.findMany({
      where: { certificadoId: certificado.id },
    });
    expect(avisos).toHaveLength(1);
  });

  it("cria um novo aviso quando a faixa piora", async () => {
    const cliente = await criarClienteTeste();
    const certificado = await prisma.certificado.create({
      data: { clienteId: cliente.id, dataValidade: dataDaqui(20) },
    });

    await processarAvisosCertificados(); // ALERTA

    await prisma.certificado.update({
      where: { id: certificado.id },
      data: { dataValidade: dataDaqui(3) },
    });
    await processarAvisosCertificados(); // CRITICO

    const avisos = await prisma.avisoCertificado.findMany({
      where: { certificadoId: certificado.id },
      orderBy: { criadoEm: "asc" },
    });
    expect(avisos.map((a) => a.faixa)).toEqual(["ALERTA", "CRITICO"]);
  });

  it("ignora certificado fora da janela de 60 dias", async () => {
    const cliente = await criarClienteTeste();
    const certificado = await prisma.certificado.create({
      data: { clienteId: cliente.id, dataValidade: dataDaqui(90) },
    });

    await processarAvisosCertificados();

    const avisos = await prisma.avisoCertificado.findMany({
      where: { certificadoId: certificado.id },
    });
    expect(avisos).toHaveLength(0);
  });
});
```

- [ ] **Step 2: Rodar e verificar que falha**

Run: `npm test -- processar`
Expected: FALHA — `Cannot find module './processar'`.

- [ ] **Step 3: Implementar `src/lib/certificados/processar.ts`**

```ts
import { prisma } from "@/lib/prisma";
import type { ResultadoExecucao } from "@/lib/execucao";
import {
  calcularFaixa,
  deveGerarAviso,
  diasRestantes,
  mensagemAviso,
  ROTULO_FAIXA,
  type FaixaUrgencia,
} from "./faixa-urgencia";

const JANELA_DIAS = 60;

export async function processarAvisosCertificados(): Promise<ResultadoExecucao> {
  const certificados = await prisma.certificado.findMany({
    include: {
      cliente: true,
      avisos: { orderBy: { criadoEm: "desc" }, take: 1 },
    },
    orderBy: { dataValidade: "asc" },
  });

  const hoje = new Date();
  let avisosNovos = 0;
  const contagemPorFaixa = new Map<FaixaUrgencia, number>();

  for (const certificado of certificados) {
    const dias = diasRestantes(certificado.dataValidade, hoje);
    if (dias > JANELA_DIAS) continue;

    const faixaAtual = calcularFaixa(dias);
    const faixaUltimoAviso =
      (certificado.avisos[0]?.faixa as FaixaUrgencia | undefined) ?? null;

    if (!deveGerarAviso(faixaAtual, faixaUltimoAviso)) continue;

    await prisma.avisoCertificado.create({
      data: {
        certificadoId: certificado.id,
        faixa: faixaAtual,
        diasRestantes: dias,
        mensagem: mensagemAviso(
          certificado.cliente.razaoSocial,
          dias,
          faixaAtual,
        ),
      },
    });

    avisosNovos += 1;
    contagemPorFaixa.set(
      faixaAtual,
      (contagemPorFaixa.get(faixaAtual) ?? 0) + 1,
    );
  }

  if (avisosNovos === 0) {
    return {
      status: "SUCESSO",
      resumo: `${certificados.length} certificados avaliados, nenhum aviso novo.`,
    };
  }

  const detalhe = [...contagemPorFaixa.entries()]
    .map(([faixa, n]) => `${n} ${ROTULO_FAIXA[faixa]}`)
    .join(", ");

  return {
    status: "SUCESSO",
    resumo: `${certificados.length} certificados avaliados, ${avisosNovos} aviso(s) novo(s): ${detalhe}.`,
  };
}
```

- [ ] **Step 4: Rodar e verificar que passa**

Run: `npm test -- processar`
Expected: 4 testes passando.

- [ ] **Step 5: Rodar a suíte inteira (garantir que nada quebrou)**

Run: `npm test`
Expected: tudo verde.

- [ ] **Step 6: Commit**

```bash
git add src/lib/certificados/processar.ts src/lib/certificados/processar.test.ts
git commit -m "feat(sc-20): motor que emite aviso so quando a faixa do certificado muda

Guarda a faixa em cada AvisoCertificado e compara com a do ultimo
aviso do mesmo certificado — evita repetir a lista inteira todo mes e
virar ruido, como pede o catalogo.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 4: Consultas do painel

**Files:**
- Create: `src/lib/certificados/consultas.ts`
- Test: `src/lib/certificados/consultas.test.ts`

**Interfaces:**
- Consumes: `prisma` de `@/lib/prisma`; `calcularFaixa`, `diasRestantes`, `FaixaUrgencia` de `./faixa-urgencia`.
- Produces:
  - `type CertificadoComStatus = { id: string; clienteId: string; razaoSocial: string; dataValidade: Date; diasRestantes: number; faixa: FaixaUrgencia }`
  - `listarCertificadosComStatus(hoje?: Date): Promise<CertificadoComStatus[]>` — ordenado por `dataValidade` asc.
  - `type AvisoComCliente = { id: string; razaoSocial: string; faixa: FaixaUrgencia; diasRestantes: number; mensagem: string; criadoEm: Date }`
  - `listarAvisos(limite?: number): Promise<AvisoComCliente[]>` — mais recentes primeiro, default 50.
  - `listarClientesParaSelecao(): Promise<{ id: string; razaoSocial: string }[]>` — ordenado por `razaoSocial`.

- [ ] **Step 1: Escrever o teste que falha — `src/lib/certificados/consultas.test.ts`**

```ts
import { afterEach, describe, expect, it } from "vitest";
import { prisma } from "@/lib/prisma";
import {
  listarAvisos,
  listarCertificadosComStatus,
} from "./consultas";

const CNPJ_TESTE = "88.888.888/0001-88";

function dataDaqui(dias: number): Date {
  const d = new Date();
  d.setUTCHours(0, 0, 0, 0);
  d.setUTCDate(d.getUTCDate() + dias);
  return d;
}

afterEach(async () => {
  await prisma.avisoCertificado.deleteMany({
    where: { certificado: { cliente: { cnpj: CNPJ_TESTE } } },
  });
  await prisma.certificado.deleteMany({
    where: { cliente: { cnpj: CNPJ_TESTE } },
  });
  await prisma.cliente.deleteMany({ where: { cnpj: CNPJ_TESTE } });
});

describe("listarCertificadosComStatus", () => {
  it("devolve dias restantes e faixa calculados para cada certificado", async () => {
    const cliente = await prisma.cliente.create({
      data: {
        razaoSocial: "Cliente Consultas SC-20",
        cnpj: CNPJ_TESTE,
        atividade: "Teste",
      },
    });
    await prisma.certificado.create({
      data: { clienteId: cliente.id, dataValidade: dataDaqui(10) },
    });

    const lista = await listarCertificadosComStatus();
    const alvo = lista.find((c) => c.razaoSocial === "Cliente Consultas SC-20");

    expect(alvo).toBeDefined();
    expect(alvo?.diasRestantes).toBe(10);
    expect(alvo?.faixa).toBe("ALERTA");
  });
});

describe("listarAvisos", () => {
  it("devolve os avisos com a razao social do cliente e o texto da mensagem", async () => {
    const cliente = await prisma.cliente.create({
      data: {
        razaoSocial: "Cliente Consultas SC-20",
        cnpj: CNPJ_TESTE,
        atividade: "Teste",
      },
    });
    const certificado = await prisma.certificado.create({
      data: { clienteId: cliente.id, dataValidade: dataDaqui(3) },
    });
    await prisma.avisoCertificado.create({
      data: {
        certificadoId: certificado.id,
        faixa: "CRITICO",
        diasRestantes: 3,
        mensagem: "mensagem de teste",
      },
    });

    const avisos = await listarAvisos();
    const alvo = avisos.find((a) => a.mensagem === "mensagem de teste");

    expect(alvo).toBeDefined();
    expect(alvo?.razaoSocial).toBe("Cliente Consultas SC-20");
    expect(alvo?.faixa).toBe("CRITICO");
  });
});
```

- [ ] **Step 2: Rodar e verificar que falha**

Run: `npm test -- consultas`
Expected: FALHA — `Cannot find module './consultas'`.

- [ ] **Step 3: Implementar `src/lib/certificados/consultas.ts`**

```ts
import { prisma } from "@/lib/prisma";
import {
  calcularFaixa,
  diasRestantes,
  type FaixaUrgencia,
} from "./faixa-urgencia";

export type CertificadoComStatus = {
  id: string;
  clienteId: string;
  razaoSocial: string;
  dataValidade: Date;
  diasRestantes: number;
  faixa: FaixaUrgencia;
};

export async function listarCertificadosComStatus(
  hoje: Date = new Date(),
): Promise<CertificadoComStatus[]> {
  const certificados = await prisma.certificado.findMany({
    include: { cliente: true },
    orderBy: { dataValidade: "asc" },
  });

  return certificados.map((certificado) => {
    const dias = diasRestantes(certificado.dataValidade, hoje);
    return {
      id: certificado.id,
      clienteId: certificado.clienteId,
      razaoSocial: certificado.cliente.razaoSocial,
      dataValidade: certificado.dataValidade,
      diasRestantes: dias,
      faixa: calcularFaixa(dias),
    };
  });
}

export type AvisoComCliente = {
  id: string;
  razaoSocial: string;
  faixa: FaixaUrgencia;
  diasRestantes: number;
  mensagem: string;
  criadoEm: Date;
};

export async function listarAvisos(
  limite = 50,
): Promise<AvisoComCliente[]> {
  const avisos = await prisma.avisoCertificado.findMany({
    include: { certificado: { include: { cliente: true } } },
    orderBy: { criadoEm: "desc" },
    take: limite,
  });

  return avisos.map((aviso) => ({
    id: aviso.id,
    razaoSocial: aviso.certificado.cliente.razaoSocial,
    faixa: aviso.faixa as FaixaUrgencia,
    diasRestantes: aviso.diasRestantes,
    mensagem: aviso.mensagem,
    criadoEm: aviso.criadoEm,
  }));
}

export async function listarClientesParaSelecao(): Promise<
  { id: string; razaoSocial: string }[]
> {
  return prisma.cliente.findMany({
    orderBy: { razaoSocial: "asc" },
    select: { id: true, razaoSocial: true },
  });
}
```

- [ ] **Step 4: Rodar e verificar que passa**

Run: `npm test -- consultas`
Expected: 2 testes passando.

- [ ] **Step 5: Commit**

```bash
git add src/lib/certificados/consultas.ts src/lib/certificados/consultas.test.ts
git commit -m "feat(sc-20): consultas do painel de certificados

Calcula dias restantes e faixa na leitura, nao no banco — a faixa e
derivada da data e do dia de hoje, entao nao faz sentido persistir no
Certificado (so no AvisoCertificado, que e um registro historico).

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 5: Server Actions — CRUD de certificado e "rodar agora"

**Files:**
- Create: `src/lib/certificados/acoes.ts`

**Interfaces:**
- Consumes: `prisma`, `obterSessao`, `filtrarModulosVisiveis` de `@/lib/modulos-catalogo`, `executarModulo` de `@/lib/execucao`, `processarAvisosCertificados` de `./processar`, `revalidatePath` de `next/cache`, `redirect` de `next/navigation`, `z` de `zod`.
- Produces:
  - `type EstadoFormCertificado = { erro: string } | null`
  - `criarCertificado(_estadoAnterior: EstadoFormCertificado, formData: FormData): Promise<EstadoFormCertificado>` — em sucesso, `redirect("/modulos/sc-20")`.
  - `editarCertificado(_estadoAnterior: EstadoFormCertificado, formData: FormData): Promise<EstadoFormCertificado>` — lê `id` de `formData`; em sucesso, `redirect("/modulos/sc-20")`.
  - `removerCertificado(formData: FormData): Promise<void>` — lê `id`; `revalidatePath` no fim.
  - `rodarAgora(): Promise<void>` — chama `executarModulo("SC-20", sessao.email, processarAvisosCertificados)`; `revalidatePath` no fim.

- [ ] **Step 1: Implementar `src/lib/certificados/acoes.ts`**

```ts
"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { obterSessao } from "@/lib/sessao-servidor";
import { filtrarModulosVisiveis } from "@/lib/modulos-catalogo";
import { executarModulo } from "@/lib/execucao";
import { processarAvisosCertificados } from "./processar";

const ROTA = "/modulos/sc-20";

async function exigirAcessoSc20() {
  const sessao = await obterSessao();
  const podeVer =
    sessao !== null &&
    filtrarModulosVisiveis(sessao.papel, sessao.setor).some(
      (modulo) => modulo.codigo === "SC-20",
    );

  if (!sessao || !podeVer) {
    throw new Error("Sem acesso ao módulo SC-20.");
  }
  return sessao;
}

const esquemaCertificado = z.object({
  clienteId: z.string().min(1, "Selecione o cliente."),
  dataValidade: z.coerce.date({ message: "Informe uma data de validade válida." }),
});

export type EstadoFormCertificado = { erro: string } | null;

function normalizarValidade(data: Date): Date {
  const normalizada = new Date(data);
  normalizada.setUTCHours(0, 0, 0, 0);
  return normalizada;
}

export async function criarCertificado(
  _estadoAnterior: EstadoFormCertificado,
  formData: FormData,
): Promise<EstadoFormCertificado> {
  await exigirAcessoSc20();

  const dados = esquemaCertificado.safeParse({
    clienteId: formData.get("clienteId"),
    dataValidade: formData.get("dataValidade"),
  });
  if (!dados.success) {
    return { erro: dados.error.issues[0]?.message ?? "Dados inválidos." };
  }

  const cliente = await prisma.cliente.findUnique({
    where: { id: dados.data.clienteId },
  });
  if (!cliente) {
    return { erro: "Cliente não encontrado." };
  }

  await prisma.certificado.create({
    data: {
      clienteId: dados.data.clienteId,
      dataValidade: normalizarValidade(dados.data.dataValidade),
    },
  });

  revalidatePath(ROTA);
  redirect(ROTA);
}

export async function editarCertificado(
  _estadoAnterior: EstadoFormCertificado,
  formData: FormData,
): Promise<EstadoFormCertificado> {
  await exigirAcessoSc20();

  const id = String(formData.get("id") ?? "");
  if (!id) {
    return { erro: "Certificado não informado." };
  }

  const dados = esquemaCertificado.safeParse({
    clienteId: formData.get("clienteId"),
    dataValidade: formData.get("dataValidade"),
  });
  if (!dados.success) {
    return { erro: dados.error.issues[0]?.message ?? "Dados inválidos." };
  }

  const certificado = await prisma.certificado.findUnique({ where: { id } });
  if (!certificado) {
    return { erro: "Certificado não encontrado." };
  }

  await prisma.certificado.update({
    where: { id },
    data: {
      clienteId: dados.data.clienteId,
      dataValidade: normalizarValidade(dados.data.dataValidade),
    },
  });

  revalidatePath(ROTA);
  redirect(ROTA);
}

export async function removerCertificado(formData: FormData): Promise<void> {
  await exigirAcessoSc20();

  const id = String(formData.get("id") ?? "");
  if (id) {
    await prisma.certificado.deleteMany({ where: { id } });
  }
  revalidatePath(ROTA);
}

export async function rodarAgora(): Promise<void> {
  const sessao = await exigirAcessoSc20();
  await executarModulo("SC-20", sessao.email, processarAvisosCertificados);
  revalidatePath(ROTA);
}
```

- [ ] **Step 2: Conferir tipos**

Run: `npx tsc --noEmit`
Expected: sem erros.

- [ ] **Step 3: Commit**

```bash
git add src/lib/certificados/acoes.ts
git commit -m "feat(sc-20): server actions de CRUD de certificado e disparo sob demanda

rodarAgora sempre passa pelo executarModulo, entao o disparo manual
cai no mesmo historico de Execucao que o cron. exigirAcessoSc20
recusa quem nao enxerga o modulo pelo filtro de papel/setor.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 6: Componentes do painel

**Files:**
- Create: `src/components/certificados/BadgeFaixa.tsx`
- Test: `src/components/certificados/BadgeFaixa.test.tsx`
- Create: `src/components/certificados/ListaAvisos.tsx`
- Test: `src/components/certificados/ListaAvisos.test.tsx`
- Create: `src/components/certificados/PainelCertificados.tsx`
- Create: `src/components/certificados/FormularioCertificado.tsx`
- Create: `src/components/certificados/BotaoRemover.tsx`

**Interfaces:**
- Consumes: `FaixaUrgencia`, `ROTULO_FAIXA` de `@/lib/certificados/faixa-urgencia`; `CertificadoComStatus`, `AvisoComCliente` de `@/lib/certificados/consultas`; `criarCertificado`, `editarCertificado`, `removerCertificado`, `EstadoFormCertificado` de `@/lib/certificados/acoes`.
- Produces:
  - `<BadgeFaixa faixa={FaixaUrgencia} />`
  - `<ListaAvisos avisos={AvisoComCliente[]} />`
  - `<PainelCertificados certificados={CertificadoComStatus[]} />` (server; cada linha tem link `?editar=<id>` e `<BotaoRemover>`)
  - `<FormularioCertificado clientes={{ id: string; razaoSocial: string }[]} certificado={CertificadoComStatus | null} />` (client)
  - `<BotaoRemover id={string} />` (client)

- [ ] **Step 1: Teste que falha — `src/components/certificados/BadgeFaixa.test.tsx`**

```tsx
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { BadgeFaixa } from "./BadgeFaixa";

describe("BadgeFaixa", () => {
  it("mostra o rotulo com acento da faixa", () => {
    render(<BadgeFaixa faixa="CRITICO" />);
    expect(screen.getByText("CRÍTICO")).toBeInTheDocument();
  });

  it("mostra PROXIMO como PRÓXIMO", () => {
    render(<BadgeFaixa faixa="PROXIMO" />);
    expect(screen.getByText("PRÓXIMO")).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Rodar e ver falhar** — `npm test -- BadgeFaixa` → `Cannot find module './BadgeFaixa'`.

- [ ] **Step 3: Implementar `src/components/certificados/BadgeFaixa.tsx`**

```tsx
import {
  ROTULO_FAIXA,
  type FaixaUrgencia,
} from "@/lib/certificados/faixa-urgencia";

const CLASSE_POR_FAIXA: Record<FaixaUrgencia, string> = {
  VENCIDO: "bg-carmim/15 text-carmim",
  CRITICO: "bg-carmim/10 text-carmim",
  ALERTA: "bg-ambar/15 text-ambar",
  PROXIMO: "bg-turquesa/10 text-turquesa",
  OK: "bg-grafite/10 text-grafite",
};

export function BadgeFaixa({ faixa }: { faixa: FaixaUrgencia }) {
  return (
    <span
      className={`inline-block rounded-full px-2 py-0.5 font-texto text-xs font-medium ${CLASSE_POR_FAIXA[faixa]}`}
    >
      {ROTULO_FAIXA[faixa]}
    </span>
  );
}
```

- [ ] **Step 4: Rodar e ver passar** — `npm test -- BadgeFaixa`.

- [ ] **Step 5: Teste que falha — `src/components/certificados/ListaAvisos.test.tsx`**

```tsx
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { ListaAvisos } from "./ListaAvisos";

const AGORA = new Date("2026-08-29T12:00:00Z");

describe("ListaAvisos", () => {
  it("mostra o estado vazio quando nao ha avisos", () => {
    render(<ListaAvisos avisos={[]} />);
    expect(
      screen.getByText(/Nenhum aviso emitido ainda/i),
    ).toBeInTheDocument();
  });

  it("mostra o texto da mensagem de cada aviso", () => {
    render(
      <ListaAvisos
        avisos={[
          {
            id: "a1",
            razaoSocial: "Alfa Comércio Ltda",
            faixa: "CRITICO",
            diasRestantes: 5,
            mensagem:
              "O certificado digital de Alfa Comércio Ltda vence em 5 dias (faixa CRÍTICO).",
            criadoEm: AGORA,
          },
        ]}
      />,
    );
    expect(
      screen.getByText(/vence em 5 dias \(faixa CRÍTICO\)/),
    ).toBeInTheDocument();
    expect(screen.getByText("CRÍTICO")).toBeInTheDocument();
  });
});
```

- [ ] **Step 6: Rodar e ver falhar** — `npm test -- ListaAvisos`.

- [ ] **Step 7: Implementar `src/components/certificados/ListaAvisos.tsx`**

```tsx
import type { AvisoComCliente } from "@/lib/certificados/consultas";
import { BadgeFaixa } from "./BadgeFaixa";

function formatarDataUTC(data: Date): string {
  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeZone: "UTC",
  }).format(data);
}

export function ListaAvisos({ avisos }: { avisos: AvisoComCliente[] }) {
  if (avisos.length === 0) {
    return (
      <p className="font-texto text-sm text-grafite">
        Nenhum aviso emitido ainda. Rode o módulo para gerar os avisos dos
        certificados dentro da janela de 60 dias.
      </p>
    );
  }

  return (
    <ul className="flex flex-col gap-3">
      {avisos.map((aviso) => (
        <li
          key={aviso.id}
          className="rounded-lg border border-grafite/20 bg-white p-4"
        >
          <div className="mb-1 flex items-center justify-between gap-3">
            <span className="font-titulo text-sm font-bold text-tinta">
              {aviso.razaoSocial}
            </span>
            <span className="flex items-center gap-2">
              <BadgeFaixa faixa={aviso.faixa} />
              <span className="font-codigo text-xs text-grafite">
                {formatarDataUTC(aviso.criadoEm)}
              </span>
            </span>
          </div>
          <p className="font-texto text-sm text-tinta">{aviso.mensagem}</p>
        </li>
      ))}
    </ul>
  );
}
```

- [ ] **Step 8: Rodar e ver passar** — `npm test -- ListaAvisos`.

- [ ] **Step 9: Implementar `src/components/certificados/BotaoRemover.tsx`** (sem teste dedicado — só dispara uma server action já coberta)

```tsx
"use client";

import { removerCertificado } from "@/lib/certificados/acoes";

export function BotaoRemover({ id }: { id: string }) {
  return (
    <form
      action={removerCertificado}
      onSubmit={(evento) => {
        if (!confirm("Remover este certificado?")) {
          evento.preventDefault();
        }
      }}
    >
      <input type="hidden" name="id" value={id} />
      <button
        type="submit"
        className="font-texto text-xs text-carmim hover:underline"
      >
        Remover
      </button>
    </form>
  );
}
```

- [ ] **Step 10: Implementar `src/components/certificados/PainelCertificados.tsx`**

```tsx
import Link from "next/link";
import type { CertificadoComStatus } from "@/lib/certificados/consultas";
import { BadgeFaixa } from "./BadgeFaixa";
import { BotaoRemover } from "./BotaoRemover";

function formatarDataUTC(data: Date): string {
  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeZone: "UTC",
  }).format(data);
}

function textoDias(dias: number): string {
  if (dias < 0) return `vencido há ${Math.abs(dias)} d`;
  if (dias === 0) return "vence hoje";
  return `faltam ${dias} d`;
}

export function PainelCertificados({
  certificados,
}: {
  certificados: CertificadoComStatus[];
}) {
  if (certificados.length === 0) {
    return (
      <p className="font-texto text-sm text-grafite">
        Nenhum certificado cadastrado. Use o formulário acima para adicionar.
      </p>
    );
  }

  return (
    <table className="w-full border-collapse font-texto text-sm">
      <thead>
        <tr className="border-b border-grafite/20 text-left text-grafite">
          <th className="py-2 pr-4">Cliente</th>
          <th className="py-2 pr-4">Validade</th>
          <th className="py-2 pr-4">Situação</th>
          <th className="py-2 pr-4">Faixa</th>
          <th className="py-2 pr-4"></th>
        </tr>
      </thead>
      <tbody>
        {certificados.map((certificado) => (
          <tr
            key={certificado.id}
            className="border-b border-grafite/10 align-middle"
          >
            <td className="py-2 pr-4 text-tinta">{certificado.razaoSocial}</td>
            <td className="py-2 pr-4 font-codigo">
              {formatarDataUTC(certificado.dataValidade)}
            </td>
            <td className="py-2 pr-4 text-grafite">
              {textoDias(certificado.diasRestantes)}
            </td>
            <td className="py-2 pr-4">
              <BadgeFaixa faixa={certificado.faixa} />
            </td>
            <td className="py-2 pr-4">
              <span className="flex gap-3">
                <Link
                  href={`/modulos/sc-20?editar=${certificado.id}`}
                  className="text-xs text-turquesa hover:underline"
                >
                  Editar
                </Link>
                <BotaoRemover id={certificado.id} />
              </span>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
```

- [ ] **Step 11: Implementar `src/components/certificados/FormularioCertificado.tsx`**

```tsx
"use client";

import { useActionState } from "react";
import {
  criarCertificado,
  editarCertificado,
  type EstadoFormCertificado,
} from "@/lib/certificados/acoes";
import type { CertificadoComStatus } from "@/lib/certificados/consultas";

type Cliente = { id: string; razaoSocial: string };

function paraInputDate(data: Date): string {
  return data.toISOString().slice(0, 10);
}

export function FormularioCertificado({
  clientes,
  certificado,
}: {
  clientes: Cliente[];
  certificado: CertificadoComStatus | null;
}) {
  const emEdicao = certificado !== null;
  const acao = emEdicao ? editarCertificado : criarCertificado;
  const [estado, acaoFormulario, pendente] = useActionState<
    EstadoFormCertificado,
    FormData
  >(acao, null);

  return (
    <form
      action={acaoFormulario}
      className="flex flex-wrap items-end gap-4 font-texto"
    >
      {emEdicao ? (
        <input type="hidden" name="id" value={certificado.id} />
      ) : null}

      <label className="flex flex-col gap-1 text-sm text-grafite">
        Cliente
        <select
          name="clienteId"
          required
          defaultValue={certificado?.clienteId ?? ""}
          className="rounded border border-grafite/40 px-3 py-2 text-tinta outline-none focus:border-turquesa"
        >
          <option value="" disabled>
            Selecione…
          </option>
          {clientes.map((cliente) => (
            <option key={cliente.id} value={cliente.id}>
              {cliente.razaoSocial}
            </option>
          ))}
        </select>
      </label>

      <label className="flex flex-col gap-1 text-sm text-grafite">
        Validade
        <input
          type="date"
          name="dataValidade"
          required
          defaultValue={
            certificado ? paraInputDate(certificado.dataValidade) : ""
          }
          className="rounded border border-grafite/40 px-3 py-2 text-tinta outline-none focus:border-turquesa"
        />
      </label>

      <button
        type="submit"
        disabled={pendente}
        className="rounded bg-petroleo px-4 py-2 text-sm font-semibold text-nevoa transition hover:bg-turquesa disabled:opacity-60"
      >
        {emEdicao ? "Salvar" : "Adicionar"}
      </button>

      {emEdicao ? (
        <a
          href="/modulos/sc-20"
          className="text-sm text-grafite underline underline-offset-2"
        >
          Cancelar
        </a>
      ) : null}

      {estado?.erro ? (
        <p className="w-full text-sm text-carmim" role="alert">
          {estado.erro}
        </p>
      ) : null}
    </form>
  );
}
```

- [ ] **Step 12: Rodar a suíte + tipos**

Run: `npm test && npx tsc --noEmit`
Expected: tudo verde, sem erros de tipo.

- [ ] **Step 13: Commit**

```bash
git add src/components/certificados
git commit -m "feat(sc-20): componentes do painel de certificados

BadgeFaixa e ListaAvisos sao puros e testados; PainelCertificados e
FormularioCertificado montam o CRUD sobre as server actions. Datas
formatadas em UTC para bater com a normalizacao de validade (meia-noite
UTC), sem deslocar um dia no fuso de Sao Paulo.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 7: Página `/modulos/sc-20`

**Files:**
- Create: `src/app/modulos/sc-20/page.tsx`

**Interfaces:**
- Consumes: `obterSessao`, `sair`, `CabecalhoPortal`, `ModuloPageLayout`, `obterModulo` + `filtrarModulosVisiveis` de `@/lib/modulos-catalogo`, `listarHistorico` de `@/lib/execucao`, `listarCertificadosComStatus` + `listarAvisos` + `listarClientesParaSelecao` de `@/lib/certificados/consultas`, `rodarAgora` de `@/lib/certificados/acoes`, os componentes da Task 6.
- Produces: rota `/modulos/sc-20` (server component). Redireciona para `/login` sem sessão e para `/` se o usuário não enxerga o SC-20.

- [ ] **Step 1: Implementar `src/app/modulos/sc-20/page.tsx`**

```tsx
import { redirect } from "next/navigation";
import { obterSessao } from "@/lib/sessao-servidor";
import { sair } from "@/lib/sessao-acoes";
import { CabecalhoPortal } from "@/components/CabecalhoPortal";
import { ModuloPageLayout } from "@/components/ModuloPageLayout";
import {
  filtrarModulosVisiveis,
  obterModulo,
} from "@/lib/modulos-catalogo";
import { listarHistorico } from "@/lib/execucao";
import {
  listarAvisos,
  listarCertificadosComStatus,
  listarClientesParaSelecao,
} from "@/lib/certificados/consultas";
import { rodarAgora } from "@/lib/certificados/acoes";
import { PainelCertificados } from "@/components/certificados/PainelCertificados";
import { FormularioCertificado } from "@/components/certificados/FormularioCertificado";
import { ListaAvisos } from "@/components/certificados/ListaAvisos";

export default async function PaginaSc20({
  searchParams,
}: {
  searchParams: Promise<{ editar?: string }>;
}) {
  const sessao = await obterSessao();
  if (!sessao) {
    redirect("/login");
  }

  const modulo = obterModulo("SC-20");
  const podeVer =
    modulo !== undefined &&
    filtrarModulosVisiveis(sessao.papel, sessao.setor).some(
      (m) => m.codigo === "SC-20",
    );
  if (!modulo || !podeVer) {
    redirect("/");
  }

  const { editar } = await searchParams;
  const [execucoes, certificados, avisos, clientes] = await Promise.all([
    listarHistorico("SC-20"),
    listarCertificadosComStatus(),
    listarAvisos(),
    listarClientesParaSelecao(),
  ]);

  const certificadoEmEdicao = editar
    ? (certificados.find((c) => c.id === editar) ?? null)
    : null;

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
      <ModuloPageLayout
        modulo={modulo}
        execucoes={execucoes}
        acoes={
          <form action={rodarAgora}>
            <button className="rounded bg-petroleo px-4 py-2 font-texto text-sm font-semibold text-nevoa transition hover:bg-turquesa">
              Rodar agora
            </button>
          </form>
        }
        conteudo={
          <div className="flex flex-col gap-8">
            <section>
              <h2 className="mb-3 font-titulo text-lg font-bold text-tinta">
                {certificadoEmEdicao
                  ? "Editar certificado"
                  : "Novo certificado"}
              </h2>
              <FormularioCertificado
                clientes={clientes}
                certificado={certificadoEmEdicao}
              />
            </section>

            <section>
              <h2 className="mb-3 font-titulo text-lg font-bold text-tinta">
                Certificados da carteira
              </h2>
              <PainelCertificados certificados={certificados} />
            </section>

            <section>
              <h2 className="mb-3 font-titulo text-lg font-bold text-tinta">
                Avisos emitidos
              </h2>
              <ListaAvisos avisos={avisos} />
            </section>
          </div>
        }
      />
    </>
  );
}
```

- [ ] **Step 2: Conferir build e tipos**

Run: `npx tsc --noEmit`
Expected: sem erros. (A rota ainda não aparece na home porque `implementado` do SC-20 continua `false` — isso muda na Task 8.)

- [ ] **Step 3: Commit**

```bash
git add src/app/modulos/sc-20/page.tsx
git commit -m "feat(sc-20): pagina do modulo em /modulos/sc-20

Monta sobre o ModuloPageLayout da fundacao: acoes = botao rodar agora,
conteudo = formulario de certificado, painel da carteira e avisos
emitidos. Query ?editar=<id> reaproveita o mesmo formulario para edicao.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 8: Cron mensal + ligar o módulo na home

**Files:**
- Create: `src/lib/cron-logica.ts`
- Test: `src/lib/cron-logica.test.ts`
- Create: `src/app/api/cron/sc-20/route.ts`
- Create: `vercel.json`
- Modify: `src/lib/modulos-catalogo.ts`

**Interfaces:**
- Produces: `cronAutorizado(authHeader: string | null, secret: string | undefined): boolean` (`src/lib/cron-logica.ts`); rota `GET /api/cron/sc-20`; `vercel.json` com o cron; flag `implementado: true` no SC-20 do catálogo.

- [ ] **Step 1: Teste que falha — `src/lib/cron-logica.test.ts`**

```ts
import { describe, expect, it } from "vitest";
import { cronAutorizado } from "./cron-logica";

describe("cronAutorizado", () => {
  it("aceita o header Bearer com o segredo correto", () => {
    expect(cronAutorizado("Bearer s3gr3d0", "s3gr3d0")).toBe(true);
  });

  it("recusa header ausente", () => {
    expect(cronAutorizado(null, "s3gr3d0")).toBe(false);
  });

  it("recusa segredo errado", () => {
    expect(cronAutorizado("Bearer outro", "s3gr3d0")).toBe(false);
  });

  it("recusa quando o segredo do ambiente nao esta configurado", () => {
    expect(cronAutorizado("Bearer undefined", undefined)).toBe(false);
    expect(cronAutorizado("Bearer ", "")).toBe(false);
  });
});
```

- [ ] **Step 2: Rodar e ver falhar** — `npm test -- cron-logica`.

- [ ] **Step 3: Implementar `src/lib/cron-logica.ts`**

```ts
export function cronAutorizado(
  authHeader: string | null,
  secret: string | undefined,
): boolean {
  if (!secret) return false;
  return authHeader === `Bearer ${secret}`;
}
```

- [ ] **Step 4: Rodar e ver passar** — `npm test -- cron-logica`.

- [ ] **Step 5: Implementar `src/app/api/cron/sc-20/route.ts`**

```ts
import { NextRequest, NextResponse } from "next/server";
import { cronAutorizado } from "@/lib/cron-logica";
import { executarModulo } from "@/lib/execucao";
import { processarAvisosCertificados } from "@/lib/certificados/processar";

export async function GET(request: NextRequest) {
  if (
    !cronAutorizado(
      request.headers.get("authorization"),
      process.env.CRON_SECRET,
    )
  ) {
    return NextResponse.json({ erro: "Não autorizado." }, { status: 401 });
  }

  const execucao = await executarModulo(
    "SC-20",
    "scheduler",
    processarAvisosCertificados,
  );

  return NextResponse.json({
    execucaoId: execucao.id,
    status: execucao.status,
    resumo: execucao.resumo,
    erro: execucao.erro,
  });
}
```

- [ ] **Step 6: Criar `vercel.json`** (raiz do projeto)

```json
{
  "crons": [
    {
      "path": "/api/cron/sc-20",
      "schedule": "0 8 1 * *"
    }
  ]
}
```

Roda no dia 1 de cada mês às 08:00 UTC. A Vercel envia `Authorization: Bearer $CRON_SECRET` automaticamente porque `CRON_SECRET` está nas env vars do projeto.

- [ ] **Step 7: Ligar o módulo na home — `src/lib/modulos-catalogo.ts`**

No objeto do `SC-20` dentro de `CATALOGO_MODULOS`, trocar:

```ts
    implementado: false,
```

por:

```ts
    implementado: true,
```

- [ ] **Step 8: Rodar a suíte inteira + build**

Run: `npm test && npm run build`
Expected: tudo verde; build conclui. `prisma migrate deploy` no build aplica `sc20_certificados` no banco local (ou "No pending migrations" se já aplicada na Task 1).

- [ ] **Step 9: Verificação manual de ponta a ponta**

```bash
docker compose up -d db
npx prisma db seed   # popula os certificados de exemplo (Task 9 implementa; se ainda não, pular)
npm run dev
```

No navegador (`http://localhost:3000`):
- Logar como `admin@sheepcontabil.com.br` / `AdminSheep#2026` → a home agora mostra o card **SC-20**.
- Abrir o SC-20 → painel lista os certificados; "Avisos emitidos" começa vazio.
- Clicar **Rodar agora** → aparecem avisos para os certificados dentro de 60 dias; o **Histórico de execução** ganha uma linha `SUCESSO` disparada pelo seu e-mail.
- Clicar **Rodar agora** de novo → nenhum aviso novo (faixa não mudou); histórico ganha outra linha `SUCESSO` com resumo "nenhum aviso novo".
- Adicionar um certificado pelo formulário (cliente + data ~10 dias) → aparece na tabela como `ALERTA`. Rodar agora → gera aviso `ALERTA` para ele.
- Editar esse certificado para uma data ~3 dias → vira `CRÍTICO`. Rodar agora → novo aviso `CRÍTICO`.
- Remover o certificado → some da tabela.
- Logar como `operador.processos@sheepcontabil.com.br` / `OperadorSheep#2026` → também vê o SC-20 (setor Processos) e consegue rodar.
- `curl -i http://localhost:3000/api/cron/sc-20` → `401`. `curl -i -H "authorization: Bearer $(grep CRON_SECRET .env | cut -d= -f2 | tr -d '\"')" http://localhost:3000/api/cron/sc-20` → `200` com JSON de execução; histórico ganha linha disparada por `scheduler`.

- [ ] **Step 10: Commit**

```bash
git add src/lib/cron-logica.ts src/lib/cron-logica.test.ts src/app/api/cron/sc-20/route.ts vercel.json src/lib/modulos-catalogo.ts
git commit -m "feat(sc-20): cron mensal e SC-20 visivel na home

Rota /api/cron/sc-20 se protege sozinha comparando o header com
CRON_SECRET (cronAutorizado, testada isolada) — fica fora do
middleware de sessao por design. vercel.json agenda dia 1 as 08:00 UTC.
implementado: true liga o card do SC-20 na home.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 9: Seed dos certificados de exemplo + README + deploy

**Files:**
- Modify: `prisma/seed.ts`
- Modify: `README.md`

**Interfaces:**
- Consumes: `prisma`, `gerarCnpjValido` (já importados no seed).
- Produces: `seedCertificados()` idempotente, chamada em `main()`; certificados cobrindo as faixas VENCIDO, CRÍTICO, ALERTA, PRÓXIMO e OK.

- [ ] **Step 1: Adicionar `seedCertificados()` ao `prisma/seed.ts`**

Depois de `seedClientes()` (antes de `main`):

```ts
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
```

- [ ] **Step 2: Chamar no `main()`**

```ts
async function main() {
  await seedUsuarios();
  await seedClientes();
  await seedCertificados();
}
```

- [ ] **Step 3: Rodar o seed duas vezes (idempotência)**

Run: `npx prisma db seed && npx prisma db seed`
Expected: as duas execuções terminam sem erro; a segunda não duplica certificados (um por cliente).

- [ ] **Step 4: Atualizar o `README.md`**

Depois da seção `## Deploy`, adicionar:

```markdown
## Módulos

### SC-20 — Vencimento de certificado digital

Painel dos certificados digitais da carteira, classificados por faixa de urgência de vencimento:

| Faixa | Dias para vencer |
|---|---|
| `VENCIDO` | já venceu |
| `CRÍTICO` | 0 a 7 |
| `ALERTA` | 8 a 30 |
| `PRÓXIMO` | 31 a 60 |
| `OK` | mais de 60 (sem aviso) |

Ao rodar (botão **Rodar agora** ou cron mensal `/api/cron/sc-20`, dia 1 às 08:00 UTC), o módulo varre os certificados dentro de 60 dias e cria um `AvisoCertificado` — com o texto pronto da mensagem — **só quando a faixa mudou** desde o último aviso daquele certificado. Isso evita repetir a lista inteira todo mês.

CRUD de certificados na própria página (cliente + data de validade). Visível para o `ADMIN` e para operadores do setor **Processos**.

Fronteira mockada: o `AvisoCertificado` guarda a mensagem, mas **não há envio real** — aqui entraria a integração com e-mail / sistema de avisos. A rota de cron é protegida por `CRON_SECRET` no header `Authorization: Bearer`.
```

- [ ] **Step 5: Rodar a suíte + build**

Run: `npm test && npm run build`
Expected: tudo verde.

- [ ] **Step 6: Commit**

```bash
git add prisma/seed.ts README.md
git commit -m "feat(sc-20): seed de certificados cobrindo todas as faixas + doc

Seed popula um certificado por cliente cobrindo VENCIDO/CRITICO/ALERTA/
PROXIMO/OK, para a demo mostrar o painel completo sem esperar tempo
real passar. Idempotente: atualiza a validade do certificado existente
em vez de criar outro.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

- [ ] **Step 7: Push e deploy**

```bash
git push origin master
```

Acompanhar o deploy na Vercel:
- O `build` roda `prisma migrate deploy` → aplica `sc20_certificados` no Supabase.
- Depois do deploy **Ready**, rodar o seed uma vez contra o Supabase (conexão direta, como no deploy inicial): apontar `DATABASE_URL` para a string direta do Supabase num shell local e `npx prisma db seed`. Reverter o `.env` local para `localhost` em seguida.
- Verificar em `https://sheep-contabil.vercel.app`: logar como admin → card SC-20 na home → abrir → **Rodar agora** → avisos aparecem, histórico registra a execução.

---

## Self-Review

**1. Spec coverage (§5.5 e relacionadas):**

| Requisito da spec | Task |
|---|---|
| `Certificado` (cliente, dataValidade) | 1 |
| `AvisoCertificado` (certificadoId, dataAviso, faixa no momento) | 1 (campo `criadoEm` = dataAviso; + `mensagem`, `diasRestantes`) |
| Cron mensal + botão sob demanda | 8 (cron), 5 (`rodarAgora`), 7 (botão) |
| Busca certificados vencendo em até 60 dias | 3 (`JANELA_DIAS = 60`) |
| Só gera aviso novo quando a faixa de urgência mudou | 2 (`deveGerarAviso`), 3 (comparação com último aviso) |
| Painel com certificados por cliente, dias restantes e badge de urgência | 6 (`PainelCertificados`, `BadgeFaixa`), 7 |
| Seed cobrindo todas as faixas (vencido, 5, 20, 45, 90 dias) | 9 |
| Toda execução grava `Execucao` via `executarModulo` | 5 e 8 (ambos os disparos passam por `executarModulo`) |
| Erro conhecido vira mensagem legível, sem stack trace | herdado do `executarModulo` da fundação; rota de cron devolve JSON com `erro` |
| `ADMIN` vê tudo, `OPERADOR` vê só do setor | 7 (`filtrarModulosVisiveis` na página), 5 (`exigirAcessoSc20` nas actions) |
| Catálogo estático, flag `implementado` controla a home | 8 (Step 7) |
| Teste: cálculo de mudança de faixa de urgência | 2 (`faixa-urgencia.test.ts`), 3 (`processar.test.ts`) |
| URL pública contínua no ar | 9 (Step 7) |

Sem lacunas identificadas. O "5º processo" e demais módulos ficam fora deste plano (spec §1).

**2. Placeholder scan:** sem "TBD"/"TODO"/"fill in". Todo step de código tem o código real. O único "se ainda não" é no Step 9 da Task 8 (verificação manual antes da Task 9 existir) — é uma nota de ordem de execução, não um placeholder de conteúdo.

**3. Type consistency:**
- `FaixaUrgencia` definido na Task 2, reusado nas Tasks 3, 4, 6 com os mesmos 5 valores; o enum Prisma da Task 1 tem exatamente os mesmos nomes na mesma ordem. Ponte Prisma→domínio feita com `as FaixaUrgencia` nas Tasks 3 e 4 (leitura de `aviso.faixa`).
- `ResultadoExecucao` (`{ status: "SUCESSO" | "PARCIAL"; resumo: string }`) — `processarAvisosCertificados` sempre devolve `status: "SUCESSO"`, compatível.
- `EstadoFormCertificado` definido na Task 5, importado na Task 6 (`FormularioCertificado`).
- `CertificadoComStatus` / `AvisoComCliente` definidos na Task 4, consumidos nas Tasks 6 e 7.
- `executarModulo(moduloCodigo, disparadoPor, executar)` — assinatura da fundação, respeitada nas Tasks 5 e 8.
- `cronAutorizado(authHeader, secret)` — Task 8, usado só na rota da própria Task 8.
- Rota `/modulos/sc-20` — `ModuloCard` da fundação já linka para `/modulos/${codigo.toLowerCase()}` = `/modulos/sc-20`. Bate.

Sem inconsistências.
