# SC-01 — Controle de entrega mensal (Plano B) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Transformar a SC-01 num painel de controle da entrega dos extratos — para cada cliente × conta bancária, dizer se o extrato do período em fechamento chegou, se cobre o mês inteiro (e quais dias faltam) e se tem linhas em conferência —, com configuração de periodicidade por cliente e cobrança por WhatsApp.

**Architecture:** Prisma 7 ganha `enum PeriodicidadeExtrato`, dois campos em `Cliente` e o model `CobrancaExtrato` (migração 100% aditiva). Três módulos puros novos em `src/lib/documentos/` (dias úteis com feriados móveis, cobertura de intervalos, derivação de status) alimentam uma consulta `listarControleEntrega` e a aba **Controle** (nova, padrão) na página da SC-01, no padrão da SC-20 (selo de status, agrupamento, ações por linha, WhatsApp). Reaproveita `RegistroAuditoria`, `Modal`, `SpecularButton` e o desenho do `ModalAvisarWhatsApp` da SC-20.

**Tech Stack:** Next 16.3.3, React 19, Prisma 7.10, Zod 4, Tailwind 4, Vitest 4, `@testing-library/react` 16.

**Spec:** [../specs/2026-09-02-sc-01-controle-entrega-design.md](../specs/2026-09-02-sc-01-controle-entrega-design.md) — este plano implementa §4.1, §4.2, §4.4; §5.1, §5.2, §5.3; §8 (aba Controle + KPIs); §9; §13; §14; §20 (cenário dos 4 status).

**Pré-requisito:** o **Plano A** ([2026-09-02-sc-01-reconstrucao-upload-auditoria.md](2026-09-02-sc-01-reconstrucao-upload-auditoria.md)) já está implementado e mergeado (ou na mesma branch). Deste plano dependem, do Plano A: `historico.ts` (a união já inclui `EXTRATO_COBRADO` e `CLIENTE_CONFIGURADO`), `listarHistoricoDocumentos` (já escopa `entidade` para incluir `"Cliente"` e `"CobrancaExtrato"`), a página `src/app/modulos/sc-01/page.tsx` no shell com `<nav>` de abas, `DocumentoResumo` com `competencia`, e a rota `/documento/[id]/arquivo`.

## Global Constraints

- **Paleta — só estes 7 tokens Tailwind:** `petroleo`, `turquesa`, `ambar`, `tinta`, `grafite`, `nevoa`, `carmim` (**carmim exclusivo de erro/falha** — aqui: status `ATRASADO` e validação).
- **Status → cor:** `EM_DIA` turquesa · `AGUARDANDO` âmbar · `CONFERENCIA` âmbar · `ATRASADO` carmim · `NAO_CONFIGURADO` grafite.
- **Tipografia:** `font-titulo` (títulos/números), `font-texto` (texto/form), `font-codigo` (datas, agência/conta, contadores).
- **PT-BR** em toda a UI, cópia e mensagens.
- **Import do Prisma Client:** `@/generated/prisma/client`.
- **Migração:** 100% aditiva, segura sobre banco não-vazio, **sem** backfill que dependa de estado. `periodicidadeExtrato` é `NULL`-ável — `NULL` = "não configurado" e é um estado renderizado, não um bug.
- **Datas** ancoradas em **meia-noite UTC**; toda comparação e formatação de dia/período em UTC. `hoje` entra como parâmetro nas funções puras para o teste fixar o relógio.
- **Precedência de status (fonte única, em `periodicidade.ts`):** `NAO_CONFIGURADO` (periodicidade null) → `CONFERENCIA` (há linha `PENDENTE_REVISAO`) → `ATRASADO` (`hoje > dataEntrega` e faltam dias) → `AGUARDANDO` (`hoje == dataEntrega` e faltam dias) → `EM_DIA` (resto).
- **Rótulos de status:** `NAO_CONFIGURADO` → "Configurar" · `CONFERENCIA` → "Conferência" · `ATRASADO` → "Atrasado" · `AGUARDANDO` → "Aguardando envio" · `EM_DIA` → "Em dia".
- **Granularidade:** uma linha por `ContaBancaria`, agrupada por cliente. Periodicidade é do cliente; cobertura é da conta.
- **Dias faltantes** vêm do **período declarado no cabeçalho** (`DocumentoEntrada.periodoInicio`/`periodoFim`), nunca de contagem de lançamentos.
- **WhatsApp:** o modal monta a mensagem e abre `https://wa.me/<digitos>?text=<encoded>`; **não** há disparo real. O que persiste é `CobrancaExtrato` + auditoria.
- **Dia útil:** seg–sex menos feriados nacionais (fixos + móveis calculados a partir da Páscoa). Sem feriados regionais/municipais.
- **Simplificação deliberada (SEMANAL):** o período de referência é a última semana ISO (seg–dom) inteira encerrada antes da semana de `hoje`; o seletor de competência (mês) só orienta clientes `MENSAL`. Cliente `SEMANAL` com várias semanas em aberto mostra a mais antiga não resolvida + sufixo `"+N semanas"`.
- **TDD, Vitest, commits frequentes.** `npm test` = `vitest run`. Rodar um arquivo: `npx vitest run <path>`.
- **Antes de escrever cada componente de UI novo**, invocar a skill `frontend-design`.
- **Escopo de arquivos:** só `src/app/modulos/sc-01/**`, `src/lib/documentos/**`, `src/components/documentos/**`, `prisma/**` — nada fora disso.

---

## File Structure

**Criar:**
- `src/lib/documentos/dias-uteis.ts` — feriados nacionais + primeiro dia útil (puro).
- `src/lib/documentos/dias-uteis.test.ts`
- `src/lib/documentos/cobertura.ts` — união de intervalos, dias faltantes, rótulo (puro).
- `src/lib/documentos/cobertura.test.ts`
- `src/lib/documentos/periodicidade.ts` — `periodoReferencia`, `dataEntrega`, `derivarStatus`, rótulos, acento (puro).
- `src/lib/documentos/periodicidade.test.ts`
- `src/components/documentos/SeloStatusExtrato.tsx`
- `src/components/documentos/SeloStatusExtrato.test.tsx`
- `src/components/documentos/TabelaControleEntrega.tsx`
- `src/components/documentos/PainelControleSc01.tsx`
- `src/components/documentos/PainelControleSc01.test.tsx`
- `src/components/documentos/ModalConfigurarCliente.tsx`
- `src/components/documentos/ModalConfigurarCliente.test.tsx`
- `src/components/documentos/ModalCobrarExtrato.tsx`
- `src/components/documentos/ModalCobrarExtrato.test.tsx`
- `prisma/migrations/<timestamp>_sc01_controle_cliente/migration.sql`

**Modificar:**
- `prisma/schema.prisma` — enum, campos de `Cliente`, model `CobrancaExtrato`, relações inversas.
- `src/lib/documentos/consultas-sc01.ts` — `listarControleEntrega`; `listarClientesConfig` (leve, para o filtro/modal).
- `src/lib/documentos/consultas-sc01.test.ts` — cobre os 4 status + `NAO_CONFIGURADO`.
- `src/lib/documentos/acoes-sc01.ts` — `configurarCliente`, `cobrarExtratoWhatsapp`.
- `src/lib/documentos/acoes-sc01.test.ts` — cobre as duas ações + auditoria.
- `src/app/modulos/sc-01/page.tsx` — aba **Controle** (nova, padrão), KPIs de controle clicáveis, `searchParams` `status`.
- `prisma/seed.ts` — `periodicidadeExtrato` nos 8 clientes + cenário com um cliente em cada status.

---

## Task 1: Migração — `PeriodicidadeExtrato`, campos de `Cliente`, `CobrancaExtrato`

**Files:**
- Modify: `prisma/schema.prisma`
- Create: `prisma/migrations/<timestamp>_sc01_controle_cliente/migration.sql`
- Test: suíte inteira depois.

**Interfaces:**
- Produces: `enum PeriodicidadeExtrato { MENSAL SEMANAL }`; `Cliente.periodicidadeExtrato: PeriodicidadeExtrato?`; `Cliente.diaEntregaExtrato: Int?`; model `CobrancaExtrato` (ver código).

- [ ] **Step 1: Editar o schema**

Adicionar o enum perto dos outros de documento (após `enum StatusLancamento`):

```prisma
enum PeriodicidadeExtrato {
  MENSAL
  SEMANAL
}
```

No model `Cliente`, após `telefone String?`:

```prisma
  periodicidadeExtrato PeriodicidadeExtrato?
  diaEntregaExtrato    Int?
```

E na lista de relações inversas do `Cliente`:

```prisma
  cobrancasExtrato   CobrancaExtrato[]
```

No model `ContaBancaria`, adicionar a relação inversa:

```prisma
  cobrancas  CobrancaExtrato[]
```

Novo model (junto dos outros de documento):

```prisma
model CobrancaExtrato {
  id               String        @id @default(cuid())
  clienteId        String
  cliente          Cliente       @relation(fields: [clienteId], references: [id], onDelete: Cascade)
  contaBancariaId  String
  contaBancaria    ContaBancaria @relation(fields: [contaBancariaId], references: [id], onDelete: Cascade)
  referenciaInicio DateTime
  referenciaFim    DateTime
  canal            String        @default("WHATSAPP")
  autorEmail       String
  enviadoEm        DateTime      @default(now())

  @@index([contaBancariaId, referenciaFim])
  @@index([clienteId, enviadoEm])
}
```

- [ ] **Step 2: Gerar sem aplicar e revisar o SQL**

Run: `npx prisma migrate dev --name sc01_controle_cliente --create-only`
Abrir a `migration.sql` e confirmar: `CREATE TYPE "PeriodicidadeExtrato"`, `ALTER TABLE "Cliente" ADD COLUMN "periodicidadeExtrato" "PeriodicidadeExtrato"` (nullable), `ADD COLUMN "diaEntregaExtrato" INTEGER`, `CREATE TABLE "CobrancaExtrato"` + FKs + índices. **Nenhum** `DROP`, `UPDATE` ou `NOT NULL` em coluna existente.

- [ ] **Step 3: Aplicar e regenerar**

Run: `npx prisma migrate dev && npx prisma generate`
Expected: aplicada, client regenerado.

- [ ] **Step 4: Suíte**

Run: `npm test`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add prisma/schema.prisma prisma/migrations src/generated/prisma
git commit -m "feat(sc-01): periodicidade no Cliente + model CobrancaExtrato"
```

---

## Task 2: `dias-uteis.ts` — feriados nacionais + primeiro dia útil

**Files:**
- Create: `src/lib/documentos/dias-uteis.ts`
- Test: `src/lib/documentos/dias-uteis.test.ts`

**Interfaces:**
- Produces:
  - `pascoa(ano: number): Date` (domingo de Páscoa, UTC).
  - `feriadosNacionais(ano: number): Date[]`
  - `ehFeriado(d: Date): boolean`
  - `ehDiaUtil(d: Date): boolean`
  - `proximoDiaUtil(d: Date): Date` — se `d` já é dia útil, devolve `d` (mesma data, meia-noite UTC).
  - `primeiroDiaUtilDoMes(ano: number, mes0: number): Date` — `mes0` 0–11.
  - `primeiroDiaUtilDaSemana(d: Date): Date` — segunda-feira ISO da semana de `d`, avançando se cair em feriado.

- [ ] **Step 1: Escrever os testes**

```ts
// src/lib/documentos/dias-uteis.test.ts
import { describe, expect, it } from "vitest";
import {
  ehDiaUtil,
  ehFeriado,
  pascoa,
  primeiroDiaUtilDaSemana,
  primeiroDiaUtilDoMes,
  proximoDiaUtil,
} from "./dias-uteis";

const d = (iso: string) => new Date(`${iso}T00:00:00.000Z`);

describe("pascoa", () => {
  it("calcula o domingo de Páscoa de anos conhecidos", () => {
    expect(pascoa(2026).toISOString().slice(0, 10)).toBe("2026-04-05");
    expect(pascoa(2025).toISOString().slice(0, 10)).toBe("2025-04-20");
    expect(pascoa(2024).toISOString().slice(0, 10)).toBe("2024-03-31");
  });
});

describe("ehFeriado", () => {
  it("pega fixos e móveis de 2026", () => {
    expect(ehFeriado(d("2026-01-01"))).toBe(true); // Confraternização
    expect(ehFeriado(d("2026-04-21"))).toBe(true); // Tiradentes
    expect(ehFeriado(d("2026-12-25"))).toBe(true); // Natal
    expect(ehFeriado(d("2026-04-03"))).toBe(true); // Sexta-feira Santa (Páscoa -2)
    expect(ehFeriado(d("2026-02-17"))).toBe(true); // Carnaval terça (Páscoa -47)
    expect(ehFeriado(d("2026-06-04"))).toBe(true); // Corpus Christi (Páscoa +60)
    expect(ehFeriado(d("2026-08-12"))).toBe(false);
  });
});

describe("ehDiaUtil", () => {
  it("falso em fim de semana e feriado", () => {
    expect(ehDiaUtil(d("2026-08-15"))).toBe(false); // sábado
    expect(ehDiaUtil(d("2026-08-16"))).toBe(false); // domingo
    expect(ehDiaUtil(d("2026-01-01"))).toBe(false); // feriado (quinta)
    expect(ehDiaUtil(d("2026-08-13"))).toBe(true); // quinta comum
  });
});

describe("primeiroDiaUtilDoMes", () => {
  it("setembro/2026 começa numa terça (01/09)", () => {
    expect(primeiroDiaUtilDoMes(2026, 8).toISOString().slice(0, 10)).toBe("2026-09-01");
  });
  it("agosto/2026 cai no sábado 01 → primeiro útil é 03", () => {
    expect(primeiroDiaUtilDoMes(2026, 7).toISOString().slice(0, 10)).toBe("2026-08-03");
  });
  it("novembro/2026: 01 é domingo, 02 é feriado (Finados) → 03", () => {
    expect(primeiroDiaUtilDoMes(2026, 10).toISOString().slice(0, 10)).toBe("2026-11-03");
  });
});

describe("primeiroDiaUtilDaSemana", () => {
  it("de uma quarta devolve a segunda da mesma semana ISO", () => {
    expect(primeiroDiaUtilDaSemana(d("2026-08-12")).toISOString().slice(0, 10)).toBe("2026-08-10");
  });
  it("se a segunda for feriado, avança para o próximo útil", () => {
    // 2026-11-16 é segunda; 2026-11-15 (dom) Proclamação cai no dom, então a segunda 16 é útil.
    // Usar a semana do Carnaval: segunda 2026-02-16, terça 17 feriado → segunda 16 ainda é útil.
    expect(primeiroDiaUtilDaSemana(d("2026-02-18")).toISOString().slice(0, 10)).toBe("2026-02-16");
  });
});

describe("proximoDiaUtil", () => {
  it("devolve o mesmo dia quando já é útil", () => {
    expect(proximoDiaUtil(d("2026-08-13")).toISOString().slice(0, 10)).toBe("2026-08-13");
  });
  it("de sexta-feira santa (03/04/2026) pula o fim de semana → 06/04", () => {
    expect(proximoDiaUtil(d("2026-04-03")).toISOString().slice(0, 10)).toBe("2026-04-06");
  });
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npx vitest run src/lib/documentos/dias-uteis.test.ts`
Expected: FAIL — módulo não existe.

- [ ] **Step 3: Implementar**

```ts
// src/lib/documentos/dias-uteis.ts
const DIA = 24 * 60 * 60 * 1000;

function utc(ano: number, mes0: number, dia: number): Date {
  return new Date(Date.UTC(ano, mes0, dia));
}
function meiaNoite(d: Date): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
}
function somaDias(d: Date, n: number): Date {
  return new Date(meiaNoite(d).getTime() + n * DIA);
}

/** Domingo de Páscoa (algoritmo de Meeus/Butcher), em UTC. */
export function pascoa(ano: number): Date {
  const a = ano % 19;
  const b = Math.floor(ano / 100);
  const c = ano % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const mes = Math.floor((h + l - 7 * m + 114) / 31); // 3 = março, 4 = abril
  const dia = ((h + l - 7 * m + 114) % 31) + 1;
  return utc(ano, mes - 1, dia);
}

export function feriadosNacionais(ano: number): Date[] {
  const p = pascoa(ano);
  return [
    utc(ano, 0, 1), // Confraternização Universal
    somaDias(p, -47), // Carnaval (terça)
    somaDias(p, -2), // Sexta-feira Santa
    utc(ano, 3, 21), // Tiradentes
    utc(ano, 4, 1), // Dia do Trabalho
    somaDias(p, 60), // Corpus Christi
    utc(ano, 8, 7), // Independência
    utc(ano, 9, 12), // N. Sra. Aparecida
    utc(ano, 10, 2), // Finados
    utc(ano, 10, 15), // Proclamação da República
    utc(ano, 11, 25), // Natal
  ];
}

export function ehFeriado(d: Date): boolean {
  const alvo = meiaNoite(d).getTime();
  return feriadosNacionais(d.getUTCFullYear()).some((f) => f.getTime() === alvo);
}

export function ehDiaUtil(d: Date): boolean {
  const dow = meiaNoite(d).getUTCDay();
  if (dow === 0 || dow === 6) return false;
  return !ehFeriado(d);
}

export function proximoDiaUtil(d: Date): Date {
  let atual = meiaNoite(d);
  while (!ehDiaUtil(atual)) atual = somaDias(atual, 1);
  return atual;
}

export function primeiroDiaUtilDoMes(ano: number, mes0: number): Date {
  return proximoDiaUtil(utc(ano, mes0, 1));
}

export function primeiroDiaUtilDaSemana(d: Date): Date {
  const base = meiaNoite(d);
  const dow = base.getUTCDay(); // 0 = domingo
  const desloc = dow === 0 ? -6 : 1 - dow;
  return proximoDiaUtil(somaDias(base, desloc));
}
```

- [ ] **Step 4: Rodar e ver passar**

Run: `npx vitest run src/lib/documentos/dias-uteis.test.ts`
Expected: PASS. (Se algum ano conhecido de Páscoa divergir, revisar a transcrição do algoritmo, não os testes.)

- [ ] **Step 5: Commit**

```bash
git add src/lib/documentos/dias-uteis.ts src/lib/documentos/dias-uteis.test.ts
git commit -m "feat(sc-01): calendario de dias uteis com feriados nacionais moveis"
```

---

## Task 3: `cobertura.ts` — união de intervalos e dias faltantes

**Files:**
- Create: `src/lib/documentos/cobertura.ts`
- Test: `src/lib/documentos/cobertura.test.ts`

**Interfaces:**
- Produces:
  - `type Intervalo = { inicio: Date; fim: Date }` — ambos meia-noite UTC, ambos inclusivos.
  - `unir(intervalos: Intervalo[]): Intervalo[]` — ordenado, funde sobreposições e encostados (fim + 1 dia === próximo início).
  - `diasFaltantes(esperado: Intervalo, cobertos: Intervalo[]): Intervalo[]` — trechos de `esperado` não cobertos.
  - `rotularFaltantes(faltantes: Intervalo[]): string` — ex.: `"dia 31/08"`, `"30/08 a 31/08"`, `"05/08 a 09/08 e 22/08"`.

- [ ] **Step 1: Escrever os testes**

```ts
// src/lib/documentos/cobertura.test.ts
import { describe, expect, it } from "vitest";
import { diasFaltantes, rotularFaltantes, unir, type Intervalo } from "./cobertura";

const iv = (a: string, b: string): Intervalo => ({
  inicio: new Date(`${a}T00:00:00.000Z`),
  fim: new Date(`${b}T00:00:00.000Z`),
});
const par = (r: Intervalo) => [r.inicio.toISOString().slice(0, 10), r.fim.toISOString().slice(0, 10)];

describe("unir", () => {
  it("funde sobrepostos e encostados, ordena", () => {
    const r = unir([iv("2026-08-10", "2026-08-15"), iv("2026-08-01", "2026-08-05"), iv("2026-08-16", "2026-08-20"), iv("2026-08-14", "2026-08-14")]);
    expect(r.map(par)).toEqual([
      ["2026-08-01", "2026-08-05"],
      ["2026-08-10", "2026-08-20"],
    ]);
  });
  it("lista vazia → vazio", () => {
    expect(unir([])).toEqual([]);
  });
});

describe("diasFaltantes", () => {
  it("nada coberto → o esperado inteiro falta", () => {
    expect(diasFaltantes(iv("2026-08-01", "2026-08-31"), []).map(par)).toEqual([["2026-08-01", "2026-08-31"]]);
  });
  it("coberto até 29 → faltam 30 e 31", () => {
    expect(diasFaltantes(iv("2026-08-01", "2026-08-31"), [iv("2026-08-01", "2026-08-29")]).map(par)).toEqual([
      ["2026-08-30", "2026-08-31"],
    ]);
  });
  it("buraco no meio", () => {
    expect(
      diasFaltantes(iv("2026-08-01", "2026-08-31"), [iv("2026-08-01", "2026-08-09"), iv("2026-08-15", "2026-08-31")]).map(par),
    ).toEqual([["2026-08-10", "2026-08-14"]]);
  });
  it("totalmente coberto → vazio", () => {
    expect(diasFaltantes(iv("2026-08-01", "2026-08-31"), [iv("2026-07-20", "2026-09-05")])).toEqual([]);
  });
});

describe("rotularFaltantes", () => {
  it("um dia", () => {
    expect(rotularFaltantes([iv("2026-08-31", "2026-08-31")])).toBe("dia 31/08");
  });
  it("um intervalo", () => {
    expect(rotularFaltantes([iv("2026-08-30", "2026-08-31")])).toBe("30/08 a 31/08");
  });
  it("vários trechos", () => {
    expect(rotularFaltantes([iv("2026-08-05", "2026-08-09"), iv("2026-08-22", "2026-08-22")])).toBe(
      "05/08 a 09/08 e dia 22/08",
    );
  });
  it("nada faltando → string vazia", () => {
    expect(rotularFaltantes([])).toBe("");
  });
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npx vitest run src/lib/documentos/cobertura.test.ts`
Expected: FAIL — módulo não existe.

- [ ] **Step 3: Implementar**

```ts
// src/lib/documentos/cobertura.ts
const DIA = 24 * 60 * 60 * 1000;

export type Intervalo = { inicio: Date; fim: Date };

function meiaNoite(d: Date): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
}
function ddmm(d: Date): string {
  return `${String(d.getUTCDate()).padStart(2, "0")}/${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

export function unir(intervalos: Intervalo[]): Intervalo[] {
  if (intervalos.length === 0) return [];
  const orden = intervalos
    .map((i) => ({ inicio: meiaNoite(i.inicio), fim: meiaNoite(i.fim) }))
    .sort((a, b) => a.inicio.getTime() - b.inicio.getTime());
  const saida: Intervalo[] = [{ ...orden[0] }];
  for (const cur of orden.slice(1)) {
    const ultimo = saida[saida.length - 1];
    if (cur.inicio.getTime() <= ultimo.fim.getTime() + DIA) {
      if (cur.fim.getTime() > ultimo.fim.getTime()) ultimo.fim = cur.fim;
    } else {
      saida.push({ ...cur });
    }
  }
  return saida;
}

export function diasFaltantes(esperado: Intervalo, cobertos: Intervalo[]): Intervalo[] {
  const ini = meiaNoite(esperado.inicio).getTime();
  const fim = meiaNoite(esperado.fim).getTime();
  const cobre = unir(cobertos);
  const faltas: Intervalo[] = [];
  let cursor = ini;
  for (const c of cobre) {
    const cIni = c.inicio.getTime();
    const cFim = c.fim.getTime();
    if (cFim < cursor || cIni > fim) continue;
    if (cIni > cursor) {
      faltas.push({ inicio: new Date(cursor), fim: new Date(Math.min(cIni - DIA, fim)) });
    }
    cursor = Math.max(cursor, cFim + DIA);
    if (cursor > fim) break;
  }
  if (cursor <= fim) faltas.push({ inicio: new Date(cursor), fim: new Date(fim) });
  return faltas;
}

export function rotularFaltantes(faltantes: Intervalo[]): string {
  if (faltantes.length === 0) return "";
  const partes = faltantes.map((f) =>
    f.inicio.getTime() === f.fim.getTime() ? `dia ${ddmm(f.inicio)}` : `${ddmm(f.inicio)} a ${ddmm(f.fim)}`,
  );
  if (partes.length === 1) return partes[0];
  return `${partes.slice(0, -1).join(", ")} e ${partes[partes.length - 1]}`;
}
```

- [ ] **Step 4: Rodar e ver passar**

Run: `npx vitest run src/lib/documentos/cobertura.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/documentos/cobertura.ts src/lib/documentos/cobertura.test.ts
git commit -m "feat(sc-01): cobertura de periodo — uniao de intervalos e dias faltantes"
```

---

## Task 4: `periodicidade.ts` — período de referência, dia de entrega, status

**Files:**
- Create: `src/lib/documentos/periodicidade.ts`
- Test: `src/lib/documentos/periodicidade.test.ts`

**Interfaces:**
- Consumes: `primeiroDiaUtilDoMes`, `primeiroDiaUtilDaSemana`, `proximoDiaUtil` (Task 2); `Intervalo` (Task 3).
- Produces:
  - `type Periodicidade = "MENSAL" | "SEMANAL"` (espelha o enum Prisma).
  - `type StatusEntrega = "NAO_CONFIGURADO" | "CONFERENCIA" | "ATRASADO" | "AGUARDANDO" | "EM_DIA"`
  - `periodoReferencia(periodicidade: Periodicidade, hoje: Date, competencia?: string): Intervalo`
  - `dataEntrega(periodicidade: Periodicidade, ref: Intervalo, diaEntregaExtrato: number | null): Date`
  - `derivarStatus(args: { periodicidade: Periodicidade | null; hoje: Date; dataEntrega: Date; faltantes: Intervalo[]; temRevisao: boolean }): { status: StatusEntrega; faltantes: Intervalo[] }`
  - `ROTULO_STATUS: Record<StatusEntrega, string>`
  - `ACENTO_STATUS: Record<StatusEntrega, "turquesa" | "ambar" | "carmim" | "grafite">`

- [ ] **Step 1: Escrever os testes**

```ts
// src/lib/documentos/periodicidade.test.ts
import { describe, expect, it } from "vitest";
import { dataEntrega, derivarStatus, periodoReferencia } from "./periodicidade";
import type { Intervalo } from "./cobertura";

const d = (iso: string) => new Date(`${iso}T00:00:00.000Z`);
const iv = (a: string, b: string): Intervalo => ({ inicio: d(a), fim: d(b) });
const dia10 = (r: Intervalo) => [r.inicio.toISOString().slice(0, 10), r.fim.toISOString().slice(0, 10)];

describe("periodoReferencia", () => {
  it("MENSAL sem competência → mês anterior a hoje", () => {
    expect(dia10(periodoReferencia("MENSAL", d("2026-09-10")))).toEqual(["2026-08-01", "2026-08-31"]);
  });
  it("MENSAL com competência → o mês pedido", () => {
    expect(dia10(periodoReferencia("MENSAL", d("2026-09-10"), "2026-07"))).toEqual(["2026-07-01", "2026-07-31"]);
  });
  it("SEMANAL → a última semana seg–dom encerrada antes da semana de hoje", () => {
    // hoje quarta 2026-09-09; semana de hoje começa seg 07; anterior: 31/08 a 06/09
    expect(dia10(periodoReferencia("SEMANAL", d("2026-09-09")))).toEqual(["2026-08-31", "2026-09-06"]);
  });
});

describe("dataEntrega", () => {
  it("MENSAL default → 1º dia útil do mês seguinte ao da referência", () => {
    // referência agosto/2026 → setembro; 01/09/2026 é terça útil
    expect(dataEntrega("MENSAL", periodoReferencia("MENSAL", d("2026-09-10")), null).toISOString().slice(0, 10)).toBe(
      "2026-09-01",
    );
  });
  it("MENSAL com diaEntregaExtrato = 5 → dia 5 do mês seguinte, ajustado a dia útil", () => {
    // 05/09/2026 é sábado → próximo útil 07/09 é feriado (Independência, segunda) → 08/09
    expect(dataEntrega("MENSAL", periodoReferencia("MENSAL", d("2026-09-10")), 5).toISOString().slice(0, 10)).toBe(
      "2026-09-08",
    );
  });
  it("SEMANAL default → 1º dia útil da semana seguinte à referência", () => {
    const ref = periodoReferencia("SEMANAL", d("2026-09-09")); // 31/08–06/09
    // segunda seguinte = 07/09 (Independência, feriado) → 08/09
    expect(dataEntrega("SEMANAL", ref, null).toISOString().slice(0, 10)).toBe("2026-09-08");
  });
});

describe("derivarStatus (precedência)", () => {
  const base = {
    periodicidade: "MENSAL" as const,
    hoje: d("2026-09-10"),
    dataEntrega: d("2026-09-01"),
    faltantes: [] as Intervalo[],
    temRevisao: false,
  };
  it("periodicidade null → NAO_CONFIGURADO", () => {
    expect(derivarStatus({ ...base, periodicidade: null }).status).toBe("NAO_CONFIGURADO");
  });
  it("linha em revisão → CONFERENCIA (mesmo com dias faltando)", () => {
    expect(derivarStatus({ ...base, temRevisao: true, faltantes: [iv("2026-08-30", "2026-08-31")] }).status).toBe(
      "CONFERENCIA",
    );
  });
  it("passou a entrega e faltam dias → ATRASADO", () => {
    expect(derivarStatus({ ...base, faltantes: [iv("2026-08-30", "2026-08-31")] }).status).toBe("ATRASADO");
  });
  it("é o dia da entrega e faltam dias → AGUARDANDO", () => {
    expect(
      derivarStatus({ ...base, hoje: d("2026-09-01"), faltantes: [iv("2026-08-30", "2026-08-31")] }).status,
    ).toBe("AGUARDANDO");
  });
  it("antes da entrega, mesmo faltando → EM_DIA", () => {
    expect(
      derivarStatus({ ...base, hoje: d("2026-08-25"), faltantes: [iv("2026-08-30", "2026-08-31")] }).status,
    ).toBe("EM_DIA");
  });
  it("coberto e sem revisão → EM_DIA", () => {
    expect(derivarStatus(base).status).toBe("EM_DIA");
  });
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npx vitest run src/lib/documentos/periodicidade.test.ts`
Expected: FAIL — módulo não existe.

- [ ] **Step 3: Implementar**

```ts
// src/lib/documentos/periodicidade.ts
import type { Intervalo } from "./cobertura";
import { primeiroDiaUtilDaSemana, primeiroDiaUtilDoMes, proximoDiaUtil } from "./dias-uteis";

const DIA = 24 * 60 * 60 * 1000;

export type Periodicidade = "MENSAL" | "SEMANAL";
export type StatusEntrega =
  | "NAO_CONFIGURADO"
  | "CONFERENCIA"
  | "ATRASADO"
  | "AGUARDANDO"
  | "EM_DIA";

function meiaNoite(d: Date): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
}
function ultimoDiaDoMes(ano: number, mes0: number): number {
  return new Date(Date.UTC(ano, mes0 + 1, 0)).getUTCDate();
}

export function periodoReferencia(
  periodicidade: Periodicidade,
  hoje: Date,
  competencia?: string,
): Intervalo {
  if (periodicidade === "MENSAL") {
    let ano: number;
    let mes0: number;
    if (competencia && /^\d{4}-\d{2}$/.test(competencia)) {
      ano = Number(competencia.slice(0, 4));
      mes0 = Number(competencia.slice(5, 7)) - 1;
    } else {
      const h = meiaNoite(hoje);
      ano = h.getUTCFullYear();
      mes0 = h.getUTCMonth() - 1;
      if (mes0 < 0) {
        mes0 = 11;
        ano -= 1;
      }
    }
    return {
      inicio: new Date(Date.UTC(ano, mes0, 1)),
      fim: new Date(Date.UTC(ano, mes0, ultimoDiaDoMes(ano, mes0))),
    };
  }
  // SEMANAL: última semana seg–dom encerrada ANTES da semana de hoje.
  const segundaDestaSemana = primeiroDiaUtilSemanaBruta(meiaNoite(hoje));
  const domingoAnterior = new Date(segundaDestaSemana.getTime() - DIA);
  const segundaAnterior = new Date(domingoAnterior.getTime() - 6 * DIA);
  return { inicio: segundaAnterior, fim: domingoAnterior };
}

// segunda-feira ISO da semana de `d`, SEM ajuste de feriado (só o calendário).
function primeiroDiaUtilSemanaBruta(d: Date): Date {
  const base = meiaNoite(d);
  const dow = base.getUTCDay();
  const desloc = dow === 0 ? -6 : 1 - dow;
  return new Date(base.getTime() + desloc * DIA);
}

export function dataEntrega(
  periodicidade: Periodicidade,
  ref: Intervalo,
  diaEntregaExtrato: number | null,
): Date {
  if (periodicidade === "MENSAL") {
    const fim = meiaNoite(ref.fim);
    let ano = fim.getUTCFullYear();
    let mes0 = fim.getUTCMonth() + 1;
    if (mes0 > 11) {
      mes0 = 0;
      ano += 1;
    }
    if (diaEntregaExtrato && diaEntregaExtrato >= 1 && diaEntregaExtrato <= 28) {
      return proximoDiaUtil(new Date(Date.UTC(ano, mes0, diaEntregaExtrato)));
    }
    return primeiroDiaUtilDoMes(ano, mes0);
  }
  // SEMANAL: semana seguinte à referência.
  const segunda = new Date(meiaNoite(ref.fim).getTime() + DIA); // dia seguinte ao domingo da ref
  if (diaEntregaExtrato && diaEntregaExtrato >= 1 && diaEntregaExtrato <= 5) {
    return proximoDiaUtil(new Date(segunda.getTime() + (diaEntregaExtrato - 1) * DIA));
  }
  return primeiroDiaUtilDaSemana(segunda);
}

export function derivarStatus(args: {
  periodicidade: Periodicidade | null;
  hoje: Date;
  dataEntrega: Date;
  faltantes: Intervalo[];
  temRevisao: boolean;
}): { status: StatusEntrega; faltantes: Intervalo[] } {
  if (args.periodicidade === null) return { status: "NAO_CONFIGURADO", faltantes: [] };
  if (args.temRevisao) return { status: "CONFERENCIA", faltantes: args.faltantes };

  const hojeMs = meiaNoite(args.hoje).getTime();
  const entregaMs = meiaNoite(args.dataEntrega).getTime();
  const faltam = args.faltantes.length > 0;

  if (hojeMs > entregaMs && faltam) return { status: "ATRASADO", faltantes: args.faltantes };
  if (hojeMs === entregaMs && faltam) return { status: "AGUARDANDO", faltantes: args.faltantes };
  return { status: "EM_DIA", faltantes: [] };
}

export const ROTULO_STATUS: Record<StatusEntrega, string> = {
  NAO_CONFIGURADO: "Configurar",
  CONFERENCIA: "Conferência",
  ATRASADO: "Atrasado",
  AGUARDANDO: "Aguardando envio",
  EM_DIA: "Em dia",
};

export const ACENTO_STATUS: Record<StatusEntrega, "turquesa" | "ambar" | "carmim" | "grafite"> = {
  EM_DIA: "turquesa",
  AGUARDANDO: "ambar",
  CONFERENCIA: "ambar",
  ATRASADO: "carmim",
  NAO_CONFIGURADO: "grafite",
};
```

- [ ] **Step 4: Rodar e ver passar**

Run: `npx vitest run src/lib/documentos/periodicidade.test.ts`
Expected: PASS. (Conferir os feriados de setembro/2026 nos testes de `dataEntrega`: 07/09 é segunda e feriado — se o teste divergir, ajustar o **teste** para a data correta calculada por `dias-uteis`, não a implementação.)

- [ ] **Step 5: Commit**

```bash
git add src/lib/documentos/periodicidade.ts src/lib/documentos/periodicidade.test.ts
git commit -m "feat(sc-01): periodo de referencia, dia de entrega e derivacao de status"
```

---

## Task 5: `listarControleEntrega` — a consulta da aba Controle

**Files:**
- Modify: `src/lib/documentos/consultas-sc01.ts`
- Modify: `src/lib/documentos/consultas-sc01.test.ts`

**Interfaces:**
- Consumes: `periodoReferencia`, `dataEntrega`, `derivarStatus` (Task 4); `unir`, `diasFaltantes`, `rotularFaltantes`, `Intervalo` (Task 3).
- Produces:
  - `type LinhaControle = { clienteId; razaoSocial; clienteTelefone: string | null; periodicidade: "MENSAL" | "SEMANAL" | null; diaEntregaExtrato: number | null; contaId; bancoRotulo; periodoRefInicio: Date; periodoRefFim: Date; status: StatusEntrega; faltantesRotulo: string | null; semanasEmAtraso: number; ultimoExtratoEm: Date | null; emConferencia: number; cobradoEm: Date | null }`
  - `listarControleEntrega(competencia?: string, hoje?: Date): Promise<LinhaControle[]>`
  - `listarClientesConfig(): Promise<{ id; razaoSocial; telefone: string | null; periodicidadeExtrato: "MENSAL" | "SEMANAL" | null; diaEntregaExtrato: number | null }[]>`

- [ ] **Step 1: Escrever os testes**

```ts
// acrescentar em src/lib/documentos/consultas-sc01.test.ts
import { listarControleEntrega } from "./consultas-sc01";

it("listarControleEntrega classifica cada conta nos status", async () => {
  const hoje = new Date("2026-09-10T00:00:00Z");
  // cenárioControle() cria 4 clientes MENSAL + contas + docs de agosto/2026:
  //  - Em dia: doc cobrindo 01–31/08, todas as linhas CONFIRMADO
  //  - Conferência: doc cobrindo 01–31/08, 1 linha PENDENTE_REVISAO
  //  - Atrasado: doc cobrindo 01–29/08 (faltam 30 e 31), sem revisão
  //  - Não configurado: cliente com periodicidadeExtrato = null
  const { ids } = await cenarioControle();
  const linhas = await listarControleEntrega("2026-08", hoje);
  const porConta = Object.fromEntries(linhas.map((l) => [l.contaId, l]));
  expect(porConta[ids.emDia].status).toBe("EM_DIA");
  expect(porConta[ids.conferencia].status).toBe("CONFERENCIA");
  expect(porConta[ids.atrasado].status).toBe("ATRASADO");
  expect(porConta[ids.atrasado].faltantesRotulo).toBe("30/08 a 31/08");
  expect(porConta[ids.naoConfig].status).toBe("NAO_CONFIGURADO");
});

it("cobradoEm reflete a CobrancaExtrato mais recente da referência", async () => {
  const hoje = new Date("2026-09-10T00:00:00Z");
  const { ids, clienteAtrasadoId } = await cenarioControle();
  await prisma.cobrancaExtrato.create({
    data: {
      clienteId: clienteAtrasadoId,
      contaBancariaId: ids.atrasado,
      referenciaInicio: new Date("2026-08-01T00:00:00Z"),
      referenciaFim: new Date("2026-08-31T00:00:00Z"),
      autorEmail: "op@sheepcontabil.com.br",
    },
  });
  const linhas = await listarControleEntrega("2026-08", hoje);
  expect(linhas.find((l) => l.contaId === ids.atrasado)?.cobradoEm).not.toBeNull();
});
```

(Escrever `cenarioControle()` no `afterEach`/helpers do arquivo, limpando `cobrancaExtrato`, `lancamento`, `documentoEntrada`, `contaBancaria`, `cliente` pelos cnpjs de teste e `registroAuditoria` por `criadoEm >= testStart`.)

- [ ] **Step 2: Rodar e ver falhar**

Run: `npx vitest run src/lib/documentos/consultas-sc01.test.ts -t "listarControleEntrega"`
Expected: FAIL — função não existe.

- [ ] **Step 3: Implementar**

```ts
// em consultas-sc01.ts
import type { Intervalo } from "./cobertura";
import { diasFaltantes, rotularFaltantes } from "./cobertura";
import {
  dataEntrega,
  derivarStatus,
  periodoReferencia,
  type StatusEntrega,
} from "./periodicidade";

export type LinhaControle = {
  clienteId: string;
  razaoSocial: string;
  clienteTelefone: string | null;
  periodicidade: "MENSAL" | "SEMANAL" | null;
  diaEntregaExtrato: number | null;
  contaId: string;
  bancoRotulo: string;
  periodoRefInicio: Date;
  periodoRefFim: Date;
  status: StatusEntrega;
  faltantesRotulo: string | null;
  semanasEmAtraso: number;
  ultimoExtratoEm: Date | null;
  emConferencia: number;
  cobradoEm: Date | null;
};

function meiaNoite(d: Date): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
}
function recortar(iv: Intervalo, limite: Intervalo): Intervalo | null {
  const ini = Math.max(meiaNoite(iv.inicio).getTime(), meiaNoite(limite.inicio).getTime());
  const fim = Math.min(meiaNoite(iv.fim).getTime(), meiaNoite(limite.fim).getTime());
  if (ini > fim) return null;
  return { inicio: new Date(ini), fim: new Date(fim) };
}

export async function listarControleEntrega(
  competencia?: string,
  hoje: Date = new Date(),
): Promise<LinhaControle[]> {
  const contas = await prisma.contaBancaria.findMany({
    include: {
      cliente: {
        select: {
          id: true,
          razaoSocial: true,
          telefone: true,
          periodicidadeExtrato: true,
          diaEntregaExtrato: true,
        },
      },
    },
    orderBy: [{ cliente: { razaoSocial: "asc" } }, { bancoNome: "asc" }],
  });

  const linhas: LinhaControle[] = [];

  for (const conta of contas) {
    const periodicidade = conta.cliente.periodicidadeExtrato;
    const ref =
      periodicidade === null
        ? periodoReferencia("MENSAL", hoje, competencia) // referência informativa quando não configurado
        : periodoReferencia(periodicidade, hoje, competencia);

    const docs = await prisma.documentoEntrada.findMany({
      where: {
        tipo: "EXTRATO",
        contaBancariaId: conta.id,
        OR: [
          { periodoInicio: { lte: ref.fim }, periodoFim: { gte: ref.inicio } },
          { periodoInicio: null, chegadaEm: { gte: ref.inicio, lte: new Date(ref.fim.getTime() + 40 * 864e5) } },
        ],
      },
      include: { lancamentos: { select: { status: true } } },
      orderBy: { chegadaEm: "desc" },
    });

    const cobertos: Intervalo[] = [];
    for (const d of docs) {
      if (d.periodoInicio && d.periodoFim) {
        const r = recortar({ inicio: d.periodoInicio, fim: d.periodoFim }, ref);
        if (r) cobertos.push(r);
      }
    }
    const faltantes = periodicidade === null ? [] : diasFaltantes(ref, cobertos);
    const temRevisao = docs.some((d) => d.lancamentos.some((l) => l.status === "PENDENTE_REVISAO"));
    const emConferencia = docs.reduce(
      (n, d) => n + d.lancamentos.filter((l) => l.status === "PENDENTE_REVISAO").length,
      0,
    );

    const entrega =
      periodicidade === null ? ref.fim : dataEntrega(periodicidade, ref, conta.cliente.diaEntregaExtrato);
    const { status } = derivarStatus({
      periodicidade,
      hoje,
      dataEntrega: entrega,
      faltantes,
      temRevisao,
    });

    const cobranca = await prisma.cobrancaExtrato.findFirst({
      where: {
        contaBancariaId: conta.id,
        referenciaInicio: { lte: ref.fim },
        referenciaFim: { gte: ref.inicio },
      },
      orderBy: { enviadoEm: "desc" },
    });

    linhas.push({
      clienteId: conta.cliente.id,
      razaoSocial: conta.cliente.razaoSocial,
      clienteTelefone: conta.cliente.telefone,
      periodicidade,
      diaEntregaExtrato: conta.cliente.diaEntregaExtrato,
      contaId: conta.id,
      bancoRotulo: `${conta.bancoNome} — ag ${conta.agencia} c/c ${conta.numero}`,
      periodoRefInicio: ref.inicio,
      periodoRefFim: ref.fim,
      status,
      faltantesRotulo: faltantes.length > 0 ? rotularFaltantes(faltantes) : null,
      semanasEmAtraso: 0, // Plano B mantém 0; acumulado de SEMANAL fica como melhoria futura
      ultimoExtratoEm: docs[0]?.chegadaEm ?? null,
      emConferencia,
      cobradoEm: cobranca?.enviadoEm ?? null,
    });
  }

  return linhas;
}

export async function listarClientesConfig() {
  return prisma.cliente.findMany({
    orderBy: { razaoSocial: "asc" },
    select: {
      id: true,
      razaoSocial: true,
      telefone: true,
      periodicidadeExtrato: true,
      diaEntregaExtrato: true,
    },
  });
}
```

- [ ] **Step 4: Rodar e ver passar**

Run: `npx vitest run src/lib/documentos/consultas-sc01.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/documentos/consultas-sc01.ts src/lib/documentos/consultas-sc01.test.ts
git commit -m "feat(sc-01): listarControleEntrega — status de entrega por cliente/conta"
```

---

## Task 6: Ações — `configurarCliente` e `cobrarExtratoWhatsapp`

**Files:**
- Modify: `src/lib/documentos/acoes-sc01.ts`
- Modify: `src/lib/documentos/acoes-sc01.test.ts`

**Interfaces:**
- Produces:
  - `type EstadoConfig = { erro: string } | { ok: true } | null`
  - `configurarCliente(_prev: EstadoConfig, formData: FormData): Promise<EstadoConfig>` — campos `clienteId`, `periodicidade` (`MENSAL|SEMANAL`), `telefone?`, `diaEntrega?`.
  - `cobrarExtratoWhatsapp(args: { clienteId: string; contaBancariaId: string; referenciaInicio: string; referenciaFim: string }): Promise<{ ok: true } | { erro: string }>` — datas ISO `yyyy-mm-dd`.
- Consumes: `exigirAcessoSc01`, `prisma`, `revalidatePath`, `z`, `RegistroAuditoria`.

- [ ] **Step 1: Escrever os testes**

```ts
// acrescentar em src/lib/documentos/acoes-sc01.test.ts
import { cobrarExtratoWhatsapp, configurarCliente } from "./acoes-sc01";

it("configurarCliente grava periodicidade/telefone e registra CLIENTE_CONFIGURADO", async () => {
  const { c } = await cliente();
  const r = await configurarCliente(null, fd({
    clienteId: c.id, periodicidade: "SEMANAL", telefone: "+55 11 90000-0000", diaEntrega: "2",
  }));
  expect(r).toEqual({ ok: true });
  const atual = await prisma.cliente.findUniqueOrThrow({ where: { id: c.id } });
  expect(atual.periodicidadeExtrato).toBe("SEMANAL");
  expect(atual.diaEntregaExtrato).toBe(2);
  const reg = await prisma.registroAuditoria.findFirst({
    where: { entidade: "Cliente", entidadeId: c.id, acao: "CLIENTE_CONFIGURADO" },
  });
  expect(reg).not.toBeNull();
});

it("configurarCliente rejeita diaEntrega fora do range da periodicidade", async () => {
  const { c } = await cliente();
  const r = await configurarCliente(null, fd({ clienteId: c.id, periodicidade: "SEMANAL", diaEntrega: "9" }));
  expect(r).toMatchObject({ erro: expect.stringMatching(/dia/i) });
});

it("cobrarExtratoWhatsapp cria CobrancaExtrato e registra EXTRATO_COBRADO", async () => {
  const { c, conta } = await cliente();
  const r = await cobrarExtratoWhatsapp({
    clienteId: c.id, contaBancariaId: conta.id,
    referenciaInicio: "2026-08-01", referenciaFim: "2026-08-31",
  });
  expect(r).toEqual({ ok: true });
  expect(await prisma.cobrancaExtrato.count({ where: { contaBancariaId: conta.id } })).toBe(1);
  const reg = await prisma.registroAuditoria.findFirst({
    where: { entidade: "CobrancaExtrato", acao: "EXTRATO_COBRADO", clienteId: c.id },
  });
  expect(reg).not.toBeNull();
});
```

(No `afterEach` do arquivo, acrescentar `await prisma.cobrancaExtrato.deleteMany({ where: { cliente: { cnpj: CNPJ } } });` antes de apagar `contaBancaria`/`cliente`.)

- [ ] **Step 2: Rodar e ver falhar**

Run: `npx vitest run src/lib/documentos/acoes-sc01.test.ts -t "configurarCliente"`
Expected: FAIL.

- [ ] **Step 3: Implementar**

```ts
// em acoes-sc01.ts
export type EstadoConfig = { erro: string } | { ok: true } | null;

const esquemaConfig = z.object({
  clienteId: z.string().min(1, "Cliente não informado."),
  periodicidade: z.enum(["MENSAL", "SEMANAL"], { error: "Selecione a periodicidade." }),
  telefone: z
    .string()
    .optional()
    .transform((v) => (v && v.trim() ? v.trim() : null)),
  diaEntrega: z
    .string()
    .optional()
    .transform((v) => (v && v.trim() ? Number(v.trim()) : null)),
});

export async function configurarCliente(
  _prev: EstadoConfig,
  formData: FormData,
): Promise<EstadoConfig> {
  const sessao = await exigirAcessoSc01();
  const dados = esquemaConfig.safeParse({
    clienteId: formData.get("clienteId"),
    periodicidade: formData.get("periodicidade"),
    telefone: formData.get("telefone") ?? undefined,
    diaEntrega: formData.get("diaEntrega") ?? undefined,
  });
  if (!dados.success) return { erro: dados.error.issues[0]?.message ?? "Dados inválidos." };

  const { clienteId, periodicidade, telefone, diaEntrega } = dados.data;
  if (diaEntrega !== null) {
    const ok =
      periodicidade === "MENSAL"
        ? Number.isInteger(diaEntrega) && diaEntrega >= 1 && diaEntrega <= 28
        : Number.isInteger(diaEntrega) && diaEntrega >= 1 && diaEntrega <= 5;
    if (!ok) {
      return {
        erro:
          periodicidade === "MENSAL"
            ? "O dia de entrega mensal deve ser de 1 a 28."
            : "O dia de entrega semanal deve ser de 1 (segunda) a 5 (sexta).",
      };
    }
  }

  const antes = await prisma.cliente.findUnique({ where: { id: clienteId } });
  if (!antes) return { erro: "Cliente não encontrado." };

  await prisma.$transaction(async (tx) => {
    await tx.cliente.update({
      where: { id: clienteId },
      data: {
        periodicidadeExtrato: periodicidade,
        diaEntregaExtrato: diaEntrega,
        ...(telefone !== null ? { telefone } : {}),
      },
    });
    await tx.registroAuditoria.create({
      data: {
        entidade: "Cliente",
        entidadeId: clienteId,
        acao: "CLIENTE_CONFIGURADO",
        descricao: `Entrega de extrato de ${antes.razaoSocial} configurada como ${periodicidade === "MENSAL" ? "mensal" : "semanal"}`,
        autorId: sessao.usuarioId,
        autorEmail: sessao.email,
        clienteId,
        dadosAntes: {
          periodicidade: antes.periodicidadeExtrato,
          diaEntrega: antes.diaEntregaExtrato,
          telefone: antes.telefone,
        },
        dadosDepois: {
          periodicidade,
          diaEntrega,
          telefone: telefone ?? antes.telefone,
        },
      },
    });
  });

  revalidatePath(ROTA);
  return { ok: true };
}

const esquemaCobranca = z.object({
  clienteId: z.string().min(1),
  contaBancariaId: z.string().min(1),
  referenciaInicio: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  referenciaFim: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
});

export async function cobrarExtratoWhatsapp(args: {
  clienteId: string;
  contaBancariaId: string;
  referenciaInicio: string;
  referenciaFim: string;
}): Promise<{ ok: true } | { erro: string }> {
  const sessao = await exigirAcessoSc01();
  const dados = esquemaCobranca.safeParse(args);
  if (!dados.success) return { erro: "Dados da cobrança inválidos." };

  const conta = await prisma.contaBancaria.findFirst({
    where: { id: dados.data.contaBancariaId, clienteId: dados.data.clienteId },
    include: { cliente: { select: { razaoSocial: true } } },
  });
  if (!conta) return { erro: "Conta não encontrada para esse cliente." };

  await prisma.$transaction(async (tx) => {
    await tx.cobrancaExtrato.create({
      data: {
        clienteId: dados.data.clienteId,
        contaBancariaId: dados.data.contaBancariaId,
        referenciaInicio: new Date(`${dados.data.referenciaInicio}T00:00:00Z`),
        referenciaFim: new Date(`${dados.data.referenciaFim}T00:00:00Z`),
        autorEmail: sessao.email,
      },
    });
    await tx.registroAuditoria.create({
      data: {
        entidade: "CobrancaExtrato",
        entidadeId: dados.data.contaBancariaId,
        acao: "EXTRATO_COBRADO",
        descricao: `Cobrança de extrato enviada por WhatsApp para ${conta.cliente.razaoSocial} (${conta.bancoNome})`,
        autorId: sessao.usuarioId,
        autorEmail: sessao.email,
        clienteId: dados.data.clienteId,
      },
    });
  });

  revalidatePath(ROTA);
  return { ok: true };
}
```

- [ ] **Step 4: Rodar e ver passar**

Run: `npx vitest run src/lib/documentos/acoes-sc01.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/documentos/acoes-sc01.ts src/lib/documentos/acoes-sc01.test.ts
git commit -m "feat(sc-01): configurar cliente e registrar cobranca de extrato"
```

---

## Task 7: `SeloStatusExtrato`

**Files:**
- Create: `src/components/documentos/SeloStatusExtrato.tsx`
- Test: `src/components/documentos/SeloStatusExtrato.test.tsx`

**Interfaces:**
- Consumes: `StatusEntrega`, `ROTULO_STATUS`, `ACENTO_STATUS` (Task 4).
- Produces: `SeloStatusExtrato` props: `{ status: StatusEntrega }`.

- [ ] **Step 0: Invocar `frontend-design`.**

- [ ] **Step 1: Teste**

```tsx
// src/components/documentos/SeloStatusExtrato.test.tsx
import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { SeloStatusExtrato } from "./SeloStatusExtrato";

describe("SeloStatusExtrato", () => {
  it("mostra o rótulo de cada status", () => {
    for (const [status, rotulo] of [
      ["EM_DIA", "Em dia"],
      ["AGUARDANDO", "Aguardando envio"],
      ["ATRASADO", "Atrasado"],
      ["CONFERENCIA", "Conferência"],
      ["NAO_CONFIGURADO", "Configurar"],
    ] as const) {
      const { unmount } = render(<SeloStatusExtrato status={status} />);
      expect(screen.getByText(rotulo)).toBeInTheDocument();
      unmount();
    }
  });
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npx vitest run src/components/documentos/SeloStatusExtrato.test.tsx`
Expected: FAIL.

- [ ] **Step 3: Implementar**

No idioma visual do `SeloBucket` da SC-20 (fundo suave + texto no tom + anel interno). Mapear `ACENTO_STATUS` → classes: `turquesa` → `bg-turquesa/10 text-turquesa ring-turquesa/25`; `ambar` → `bg-ambar/15 text-ambar ring-ambar/35`; `carmim` → `bg-carmim/15 text-carmim ring-carmim/30`; `grafite` → `bg-grafite/10 text-grafite ring-grafite/25`. `<span>` com ponto `bg-current` e o `ROTULO_STATUS[status]`.

- [ ] **Step 4: Rodar e ver passar**

Run: `npx vitest run src/components/documentos/SeloStatusExtrato.test.tsx`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/components/documentos/SeloStatusExtrato.tsx src/components/documentos/SeloStatusExtrato.test.tsx
git commit -m "feat(sc-01): selo de status de entrega"
```

---

## Task 8: `ModalConfigurarCliente`

**Files:**
- Create: `src/components/documentos/ModalConfigurarCliente.tsx`
- Test: `src/components/documentos/ModalConfigurarCliente.test.tsx`

**Interfaces:**
- Consumes: `configurarCliente`/`EstadoConfig` (Task 6); `Modal` de `@/components/certificados/Modal`; `SpecularButton`.
- Produces: `ModalConfigurarCliente` props: `{ cliente: { id: string; razaoSocial: string; telefone: string | null; periodicidadeExtrato: "MENSAL" | "SEMANAL" | null; diaEntregaExtrato: number | null } | null; aoFechar(): void }` — aberto quando `cliente !== null`.

- [ ] **Step 0: Invocar `frontend-design`.**

- [ ] **Step 1: Testes**

```tsx
// src/components/documentos/ModalConfigurarCliente.test.tsx
import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

const configurarCliente = vi.fn(async () => ({ ok: true }));
vi.mock("@/lib/documentos/acoes-sc01", () => ({ configurarCliente: (...a: unknown[]) => configurarCliente(...a) }));

import { ModalConfigurarCliente } from "./ModalConfigurarCliente";

const cliente = {
  id: "c1", razaoSocial: "Alfa", telefone: null,
  periodicidadeExtrato: null, diaEntregaExtrato: null,
};

it("o rótulo do dia muda conforme a periodicidade", async () => {
  render(<ModalConfigurarCliente cliente={cliente} aoFechar={() => {}} />);
  await userEvent.selectOptions(screen.getByLabelText(/periodicidade/i), "MENSAL");
  expect(screen.getByLabelText(/dia do mês/i)).toBeInTheDocument();
  await userEvent.selectOptions(screen.getByLabelText(/periodicidade/i), "SEMANAL");
  expect(screen.getByLabelText(/dia da semana/i)).toBeInTheDocument();
});

it("não renderiza quando cliente é null", () => {
  const { container } = render(<ModalConfigurarCliente cliente={null} aoFechar={() => {}} />);
  expect(container).toBeEmptyDOMElement();
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npx vitest run src/components/documentos/ModalConfigurarCliente.test.tsx`
Expected: FAIL.

- [ ] **Step 3: Implementar**

Client. `<Modal aberto={cliente !== null} aoFechar titulo="Configurar cliente">`. `useActionState(configurarCliente, null)`. `<form action>` com `<input type="hidden" name="clienteId" value={cliente.id}>`. Campos:
- **Periodicidade** — `<select name="periodicidade" id="cfg-periodicidade">` ("Mensal" / "Semanal"), `defaultValue={cliente.periodicidadeExtrato ?? ""}` com opção placeholder desabilitada; `onChange` guarda o valor em estado local para alternar o rótulo do dia.
- **Telefone (WhatsApp)** — `<input name="telefone" type="tel" defaultValue={cliente.telefone ?? ""}>`.
- **Dia de entrega (opcional)** — `<input name="diaEntrega" type="number">` com `<label>`: se periodicidade `MENSAL` → "Dia do mês (1–28)"; se `SEMANAL` → "Dia da semana (1 = seg … 5 = sex)"; usar `id="cfg-dia"` e `htmlFor` casando.
- Erro do `estado` em `<p role="alert">` carmim. `useEffect`: `estado?.ok` → `aoFechar()`.
- Rodapé: "Cancelar" + `<SpecularButton type="submit">Salvar</SpecularButton>`.
- **Sem** parágrafo-subtítulo.

- [ ] **Step 4: Rodar e ver passar**

Run: `npx vitest run src/components/documentos/ModalConfigurarCliente.test.tsx`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/components/documentos/ModalConfigurarCliente.tsx src/components/documentos/ModalConfigurarCliente.test.tsx
git commit -m "feat(sc-01): modal de configuracao de periodicidade do cliente"
```

---

## Task 9: `ModalCobrarExtrato`

**Files:**
- Create: `src/components/documentos/ModalCobrarExtrato.tsx`
- Test: `src/components/documentos/ModalCobrarExtrato.test.tsx`

**Interfaces:**
- Consumes: `cobrarExtratoWhatsapp` (Task 6); `LinhaControle` (Task 5); `Modal`; `SpecularButton`; `formatarDataUTC`.
- Produces: `ModalCobrarExtrato` props: `{ linha: LinhaControle | null; aoFechar(): void }` — aberto quando `linha !== null`.

- [ ] **Step 0: Invocar `frontend-design`.**

- [ ] **Step 1: Testes**

```tsx
// src/components/documentos/ModalCobrarExtrato.test.tsx
import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";

const cobrarExtratoWhatsapp = vi.fn(async () => ({ ok: true }));
vi.mock("@/lib/documentos/acoes-sc01", () => ({ cobrarExtratoWhatsapp: (...a: unknown[]) => cobrarExtratoWhatsapp(...a) }));

import { ModalCobrarExtrato } from "./ModalCobrarExtrato";
import type { LinhaControle } from "@/lib/documentos/consultas-sc01";

const linhaBase: LinhaControle = {
  clienteId: "c1", razaoSocial: "Alfa", clienteTelefone: "+55 11 90000-0000",
  periodicidade: "MENSAL", diaEntregaExtrato: null,
  contaId: "cb1", bancoRotulo: "Banco Meridiano — ag 1201 c/c 45678-9",
  periodoRefInicio: new Date("2026-08-01T00:00:00Z"), periodoRefFim: new Date("2026-08-31T00:00:00Z"),
  status: "ATRASADO", faltantesRotulo: "30/08 a 31/08", semanasEmAtraso: 0,
  ultimoExtratoEm: null, emConferencia: 0, cobradoEm: null,
};

it("ATRASADO: mensagem cita os dias que faltam e há link wa.me", () => {
  render(<ModalCobrarExtrato linha={linhaBase} aoFechar={() => {}} />);
  const texto = (screen.getByLabelText(/mensagem/i) as HTMLTextAreaElement).value;
  expect(texto).toMatch(/30\/08 a 31\/08/);
  expect(screen.getByRole("link", { name: /whatsapp/i })).toHaveAttribute(
    "href",
    expect.stringContaining("wa.me/5511900000000"),
  );
});

it("AGUARDANDO: mensagem pede o extrato do período, sem citar dias faltantes", () => {
  render(<ModalCobrarExtrato linha={{ ...linhaBase, status: "AGUARDANDO", faltantesRotulo: null }} aoFechar={() => {}} />);
  const texto = (screen.getByLabelText(/mensagem/i) as HTMLTextAreaElement).value;
  expect(texto).toMatch(/hoje é o dia/i);
});

it("sem telefone: aviso em vez do link", () => {
  render(<ModalCobrarExtrato linha={{ ...linhaBase, clienteTelefone: null }} aoFechar={() => {}} />);
  expect(screen.queryByRole("link", { name: /whatsapp/i })).not.toBeInTheDocument();
  expect(screen.getByText(/sem telefone/i)).toBeInTheDocument();
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npx vitest run src/components/documentos/ModalCobrarExtrato.test.tsx`
Expected: FAIL.

- [ ] **Step 3: Implementar**

Espelha `src/components/certificados/ModalAvisarWhatsApp.tsx`:
- `mensagemPadrao(linha)`: monta o texto conforme `linha.status`:
  - `ATRASADO`: `"Olá, {razaoSocial}. Aqui é da SheepContabil. Ainda não recebemos o extrato de {refRotulo} da conta {bancoRotulo} — faltam {faltantesRotulo}. Consegue enviar hoje? Assim fechamos o mês no prazo. Obrigado!"`
  - `AGUARDANDO` (e qualquer outro): `"Olá, {razaoSocial}. Aqui é da SheepContabil. Hoje é o dia de nos enviar o extrato bancário de {refRotulo} da conta {bancoRotulo}. Pode mandar em PDF ou foto? Obrigado!"`
  - `refRotulo` = `${formatarDataUTC(periodoRefInicio)} a ${formatarDataUTC(periodoRefFim)}`.
- `textarea` editável (`aria-label="Mensagem"`), "Copiar mensagem", link `https://wa.me/${digitos}?text=${encodeURIComponent(mensagem)}` (só com telefone; senão aviso âmbar "Sem telefone cadastrado — configure o cliente").
- "Confirmar cobrança" → `await cobrarExtratoWhatsapp({ clienteId, contaBancariaId: contaId, referenciaInicio: ISO(periodoRefInicio), referenciaFim: ISO(periodoRefFim) })`; no `ok` → `aoFechar()`; no erro → `<p role="alert">`.
- Reset de estado ao trocar de `linha` (padrão do `ModalAvisarWhatsApp`: `idAberto` vs `linha?.contaId`).

- [ ] **Step 4: Rodar e ver passar**

Run: `npx vitest run src/components/documentos/ModalCobrarExtrato.test.tsx`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/components/documentos/ModalCobrarExtrato.tsx src/components/documentos/ModalCobrarExtrato.test.tsx
git commit -m "feat(sc-01): modal de cobranca de extrato por WhatsApp"
```

---

## Task 10: `TabelaControleEntrega`

**Files:**
- Create: `src/components/documentos/TabelaControleEntrega.tsx`
- Test: coberto pelo teste do `PainelControleSc01` (Task 11).

**Interfaces:**
- Consumes: `LinhaControle` (Task 5); `SeloStatusExtrato` (Task 7); `formatarDataUTC`.
- Produces: `TabelaControleEntrega` props: `{ linhas: LinhaControle[]; ordenacao: "cliente-asc" | "cliente-desc" | "status-asc" | "status-desc" | "extrato-asc" | "extrato-desc"; aoOrdenar(coluna: "cliente" | "status" | "extrato"): void; aoConfigurar(linha: LinhaControle): void; aoCobrar(linha: LinhaControle): void }`

- [ ] **Step 1: Implementar** (sem teste isolado; a Task 11 exercita via `PainelControleSc01`)

Tabela agrupada por cliente: quando `razaoSocial` muda em relação à linha anterior, renderiza uma linha-cabeçalho de grupo (`<tr>` com `<td colSpan>` mostrando a razão social em `font-titulo`). Colunas: **Conta** (`bancoRotulo`, `font-codigo text-xs`) · **Periodicidade** (`Mensal`/`Semanal`/`—`) · **Referência** (`${formatarDataUTC(periodoRefInicio)}–${formatarDataUTC(periodoRefFim)}` compacto, `font-codigo text-xs`) · **Status** (`<SeloStatusExtrato>`) · **Faltando** (`faltantesRotulo ?? "—"`; se `semanasEmAtraso > 0`, sufixo `+N sem.`) · **Último extrato** (`ultimoExtratoEm ? formatarDataUTC : "—"`) · **Ações**. Cabeçalhos `cliente`/`status`/`extrato` ordenáveis (▲/▼, `text-petroleo` quando ativo) no padrão do `PainelCertificados`.
Ações por linha (`flex justify-end gap-2`):
- `status === "AGUARDANDO" || status === "ATRASADO"` → `<SpecularButton variante="secundario" tamanho="sm" onClick={() => aoCobrar(linha)}>{linha.cobradoEm ? "Cobrado" : "WhatsApp"}</SpecularButton>` (com `title` "Cobrado em dd/mm" quando `cobradoEm`).
- Sempre → `<SpecularButton variante="fantasma" tamanho="sm" onClick={() => aoConfigurar(linha)}>Configurar</SpecularButton>` (com destaque quando `status === "NAO_CONFIGURADO"` — `variante="secundario"`).
- Sempre → `<a href={`/modulos/sc-01?aba=documentos&cliente=${linha.clienteId}`} className="… text-turquesa hover:underline">Ver extratos</a>`.
Estado vazio: card com frase de caráter ("Nenhuma conta bancária na carteira — cadastre uma conta para começar o controle.").

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`
Expected: sem erro no arquivo novo.

- [ ] **Step 3: Commit**

```bash
git add src/components/documentos/TabelaControleEntrega.tsx
git commit -m "feat(sc-01): tabela de controle de entrega agrupada por cliente"
```

---

## Task 11: `PainelControleSc01`

**Files:**
- Create: `src/components/documentos/PainelControleSc01.tsx`
- Test: `src/components/documentos/PainelControleSc01.test.tsx`

**Interfaces:**
- Consumes: `LinhaControle` (Task 5); `TabelaControleEntrega` (Task 10); `ModalConfigurarCliente` (Task 8); `ModalCobrarExtrato` (Task 9); `ROTULO_STATUS` (Task 4).
- Produces: `PainelControleSc01` props: `{ linhas: LinhaControle[]; statusInicial: StatusEntrega | "TODOS" }`

- [ ] **Step 0: Invocar `frontend-design`.**

- [ ] **Step 1: Testes**

```tsx
// src/components/documentos/PainelControleSc01.test.tsx
import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { PainelControleSc01 } from "./PainelControleSc01";
import type { LinhaControle } from "@/lib/documentos/consultas-sc01";

const linha = (o: Partial<LinhaControle>): LinhaControle => ({
  clienteId: "c1", razaoSocial: "Alfa", clienteTelefone: null,
  periodicidade: "MENSAL", diaEntregaExtrato: null,
  contaId: "cb1", bancoRotulo: "Banco T — ag 1 c/c 1",
  periodoRefInicio: new Date("2026-08-01T00:00:00Z"), periodoRefFim: new Date("2026-08-31T00:00:00Z"),
  status: "EM_DIA", faltantesRotulo: null, semanasEmAtraso: 0,
  ultimoExtratoEm: null, emConferencia: 0, cobradoEm: null, ...o,
});

it("filtra por status pela toolbar", async () => {
  render(<PainelControleSc01 statusInicial="TODOS" linhas={[
    linha({ contaId: "a", razaoSocial: "Alfa", status: "EM_DIA" }),
    linha({ contaId: "b", razaoSocial: "Beta", status: "ATRASADO", faltantesRotulo: "dia 31/08" }),
  ]} />);
  await userEvent.selectOptions(screen.getByLabelText(/status/i), "ATRASADO");
  expect(screen.getByText("Beta")).toBeInTheDocument();
  expect(screen.queryByText("Alfa")).not.toBeInTheDocument();
});

it("'Só atrasados' deixa só as linhas ATRASADO", async () => {
  render(<PainelControleSc01 statusInicial="TODOS" linhas={[
    linha({ contaId: "a", razaoSocial: "Alfa", status: "EM_DIA" }),
    linha({ contaId: "b", razaoSocial: "Beta", status: "ATRASADO" }),
  ]} />);
  await userEvent.click(screen.getByRole("button", { name: /só atrasados/i }));
  expect(screen.queryByText("Alfa")).not.toBeInTheDocument();
  expect(screen.getByText("Beta")).toBeInTheDocument();
});

it("respeita statusInicial vindo da URL", () => {
  render(<PainelControleSc01 statusInicial="ATRASADO" linhas={[
    linha({ contaId: "a", razaoSocial: "Alfa", status: "EM_DIA" }),
    linha({ contaId: "b", razaoSocial: "Beta", status: "ATRASADO" }),
  ]} />);
  expect(screen.queryByText("Alfa")).not.toBeInTheDocument();
  expect(screen.getByText("Beta")).toBeInTheDocument();
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npx vitest run src/components/documentos/PainelControleSc01.test.tsx`
Expected: FAIL.

- [ ] **Step 3: Implementar**

Client. Toolbar: `<input type="search" aria-label="Buscar cliente ou banco">` · `<select aria-label="Status">` (Todos + os 5 `ROTULO_STATUS`) · `<SpecularButton>` toggle **"Só atrasados"** (`aria-pressed`) · pílula de contagem · "Limpar" (quando algum filtro ativo). Estado: `busca`, `status` (init `statusInicial`), `soAtrasados`, `ordenacao` (`"cliente-asc"`). `useMemo` aplica: filtro de busca (normalizado sobre `razaoSocial` + `bancoRotulo`), filtro de status (`soAtrasados` força `ATRASADO`), e ordenação (`cliente` por `localeCompare` pt-BR mantendo o agrupamento; `status` por ordem de urgência `["ATRASADO","AGUARDANDO","CONFERENCIA","NAO_CONFIGURADO","EM_DIA"]`; `extrato` por `ultimoExtratoEm`). Estado de modal: `configurar: LinhaControle | null`, `cobrar: LinhaControle | null`. Renderiza `<TabelaControleEntrega>` + `<ModalConfigurarCliente cliente={configurar ? {…} : null} aoFechar={() => setConfigurar(null)} />` + `<ModalCobrarExtrato linha={cobrar} aoFechar={() => setCobrar(null)} />`. Classe de campo igual à toolbar do `PainelSc20`.

- [ ] **Step 4: Rodar e ver passar**

Run: `npx vitest run src/components/documentos/PainelControleSc01.test.tsx`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/components/documentos/PainelControleSc01.tsx src/components/documentos/PainelControleSc01.test.tsx
git commit -m "feat(sc-01): painel da aba Controle com filtros e modais"
```

---

## Task 12: `page.tsx` — aba Controle (padrão) + KPIs de controle

**Files:**
- Modify: `src/app/modulos/sc-01/page.tsx`

**Interfaces:**
- Consumes: `listarControleEntrega`, `listarClientesConfig` (Task 5); `PainelControleSc01` (Task 11); `ROTULO_STATUS`/`StatusEntrega` (Task 4).
- Produces: página com abas **Controle** (padrão) · **Documentos** · **Auditoria**; `searchParams` ganha `status`.

- [ ] **Step 0: Invocar `frontend-design`** para os KPIs de controle e a nova `<nav>` de 3 abas.

- [ ] **Step 1: Reescrever a página (a partir da versão do Plano A)**

- `searchParams`: acrescentar `status?`. `aba` agora aceita `"controle" | "documentos" | "auditoria"`, **default `"controle"`**.
- `const hoje = new Date();` `const competencia = sp.competencia (/^\d{4}-\d{2}$/) ?? YYYY-MM(hoje UTC)`.
- Carregar sempre: `linhasControle = await listarControleEntrega(competencia, hoje)`. Manter `documentos`, `clientes`, `contasPorCliente` do Plano A (a aba Documentos e o modal de envio continuam).
- `statusInicial: StatusEntrega | "TODOS"` = `sp.status` se for um valor válido, senão `"TODOS"`.
- **KPIs** (faixa `<dl>`), derivados de `linhasControle`:
  - "Atrasados" = `count(status === "ATRASADO")` → `href="/modulos/sc-01?aba=controle&status=ATRASADO"`, destaque quando `> 0`.
  - "Aguardando" = `count("AGUARDANDO")` → `?aba=controle&status=AGUARDANDO`.
  - "Em conferência" = `count("CONFERENCIA")` → `?aba=controle&status=CONFERENCIA`.
  - "Documentos no mês" = `documentos.length` → `?aba=documentos`.
  Cada KPI é um `<Link>` (padrão do `KpiTile` da SC-20).
- `<nav>` de 3 abas: `?aba=controle` · `?aba=documentos` · `?aba=auditoria` (classe `abaClasse` da SC-20).
- `aba === "controle"` → `<PainelControleSc01 linhas={linhasControle} statusInicial={statusInicial} />`.
- `aba === "documentos"` → `<PainelDocumentos …>` (Plano A).
- `aba === "auditoria"` → filtros + timeline + paginação (Plano A).
- Botão "Enviar extratos" (`BotaoNovoExtrato`) permanece no cabeçalho.

- [ ] **Step 2: Typecheck + suíte**

Run: `npx tsc --noEmit && npm test`
Expected: PASS.

- [ ] **Step 3: Verificação visual manual**

`npm run dev` → `/modulos/sc-01`: abre na aba **Controle**; linhas por cliente/conta com selo; KPIs "Atrasados/Aguardando/Em conferência" clicam e filtram; abas Documentos e Auditoria seguem funcionando.

- [ ] **Step 4: Commit**

```bash
git add src/app/modulos/sc-01/page.tsx
git commit -m "feat(sc-01): aba Controle como padrao e KPIs de entrega clicaveis"
```

---

## Task 13: Seed — periodicidade + cenário dos 4 status

**Files:**
- Modify: `prisma/seed.ts`

**Interfaces:** nenhuma.

- [ ] **Step 1: Periodicidade nos clientes**

Em `seedClientes`, no `create`, definir `periodicidadeExtrato` e `telefone` por cliente (usar um `Record<base, {...}>`): 6 `MENSAL`, 1 `SEMANAL` (ex.: `"88999000"` Épsilon), 1 deixado `null` de propósito (ex.: `"66777888"` Gama, se não tiver conta — senão escolher outro). `telefone: "+55 11 9XXXX-XXXX"` em todos os que têm conta bancária. Como o `upsert` atual usa `update: {}`, trocar para `update: { periodicidadeExtrato: …, telefone: … }` para o seed ser reidempotente sobre base já existente.

- [ ] **Step 2: Cenário dos 4 status em `seedDocumentosEntrada`**

Ajustar os 4 fixtures (todos de agosto/2026, `hoje` real ≈ setembro) para que, ao rodar `listarControleEntrega("2026-08")`:
- **Alfa** (`11222333`, MENSAL) → **EM_DIA**: documento `PROCESSADO`, `periodoInicio 2026-08-01`, `periodoFim 2026-08-31`, todas as linhas `CONFIRMADO` (criar 2–3 `Lancamento` com `status: "CONFIRMADO"`, `confianca: 1`).
- **Beta** (`33444555`, MENSAL) → **CONFERENCIA**: documento `PROCESSADO`, período `01–31/08`, com ≥ 1 `Lancamento` `status: "PENDENTE_REVISAO"` (`confianca: 0.7`).
- **Transportadora Rota Certa** (`44555666`, MENSAL) → **ATRASADO**: documento `PROCESSADO`, `periodoInicio 2026-08-01`, `periodoFim 2026-08-29` (faltam 30 e 31), linhas `CONFIRMADO`.
- **Épsilon** (`88999000`, agora SEMANAL) → manter como está (`PENDENTE`), serve de exemplo de conta sem cobertura da referência semanal.
- O cliente com `periodicidadeExtrato = null` aparece como **NAO_CONFIGURADO** automaticamente (sua conta existe, sem doc).

Criar os `Lancamento` no mesmo `create` do documento (`lancamentos: { create: [...] }`) com `data` dentro de agosto/2026.

- [ ] **Step 3: Rodar o seed**

Run: `npx prisma migrate reset --force`
Expected: sem erro. Conferir no `psql`/Prisma Studio: `SELECT "razaoSocial","periodicidadeExtrato" FROM "Cliente"`.

- [ ] **Step 4: Suíte**

Run: `npm test`
Expected: PASS.

- [ ] **Step 5: Verificação visual manual**

`npm run dev` → `/modulos/sc-01` aba Controle com competência `2026-08`: uma conta em **Em dia**, uma em **Conferência**, uma em **Atrasado** (mostrando "30/08 a 31/08"), uma **Configurar**.

- [ ] **Step 6: Commit**

```bash
git add prisma/seed.ts
git commit -m "chore(sc-01): seed com periodicidade e um cliente em cada status de entrega"
```

---

## Task 14: Fechamento — suíte, lint, typecheck, walkthrough, PR

**Files:** nenhum novo.

- [ ] **Step 1: Verificação completa**

Run: `npm test && npx tsc --noEmit && npm run lint`
Expected: tudo verde.

- [ ] **Step 2: Walkthrough manual** (logado como `admin@sheepcontabil.com.br` / `AdminSheep#2026`)

1. `/modulos/sc-01` abre em **Controle**; KPIs "Atrasados / Aguardando / Em conferência / Documentos no mês".
2. Clicar no KPI "Atrasados" → aba Controle filtrada em `ATRASADO`; a linha mostra "faltam 30/08 a 31/08".
3. Linha `ATRASADO`/`AGUARDANDO` → botão **WhatsApp** abre o modal com a mensagem certa e `wa.me` (quando há telefone); "Confirmar cobrança" → linha passa a "Cobrado", evento `EXTRATO_COBRADO` na aba Auditoria.
4. Botão **Configurar** numa linha `NAO_CONFIGURADO` → modal; salvar periodicidade → a linha reclassifica; evento `CLIENTE_CONFIGURADO` na Auditoria.
5. Trocar a competência (`<input type="month">`) → os status recalculam para o mês escolhido.
6. Aba **Documentos** e aba **Auditoria** (Plano A) seguem íntegras; a Auditoria agora também lista `EXTRATO_COBRADO` e `CLIENTE_CONFIGURADO`; o CSV inclui esses eventos.
7. `/modulos/sc-20` aba Histórico — **não** aparecem eventos da SC-01.

- [ ] **Step 3: Atualizar o PR**

```bash
git push
gh pr edit --body "$(cat <<'EOF'
Implementa os Planos A e B de docs/superpowers/plans/2026-09-02-sc-01-*.md.

Plano A — reconstrução, upload multi-bloco, auditoria, régua de confiança 100%.
Plano B — controle de entrega mensal: periodicidade por cliente, dias úteis com
feriados móveis, cobertura por período, aba Controle, cobrança por WhatsApp.

Migrações: <ts>_sc01_periodo_extrato (aditiva) e <ts>_sc01_controle_cliente (aditiva).
Após o deploy, rodar o seed uma vez em produção se quiser repovoar o cenário.
EOF
)"
```

---

## Self-Review

**1. Cobertura da spec (partes do Plano B):**

| Spec | Task |
|---|---|
| §4.1 `enum PeriodicidadeExtrato` | 1 |
| §4.2 `Cliente.periodicidadeExtrato` / `diaEntregaExtrato` | 1 |
| §4.4 model `CobrancaExtrato` | 1 |
| §5.1 `dias-uteis.ts` (fixos + móveis) | 2 |
| §5.2 `cobertura.ts` (união, dias faltantes, rótulo) | 3 |
| §5.3 `periodicidade.ts` (`periodoReferencia`, `dataEntrega`, `derivarStatus`, rótulos, acento; precedência) | 4 |
| §9.1 `listarControleEntrega` / `LinhaControle` | 5 |
| §9.2 toolbar, tabela agrupada, ações condicionais, "Ver extratos" | 10, 11 |
| §9.3 `SeloStatusExtrato` no idioma do `SeloBucket` | 7 |
| §13 `ModalConfigurarCliente` + `configurarCliente` + auditoria `CLIENTE_CONFIGURADO` | 6, 8 |
| §14 `ModalCobrarExtrato` + `cobrarExtratoWhatsapp` + `CobrancaExtrato` + auditoria `EXTRATO_COBRADO` | 6, 9 |
| §8 aba Controle padrão + KPIs de controle clicáveis + `searchParams.status` | 12 |
| §20 seed dos 4 status + periodicidade | 13 |

**Simplificações registradas** (Global Constraints e onde aparecem): SEMANAL ignora o seletor de mês e usa a última semana ISO; `semanasEmAtraso` fica em `0` nesta entrega (campo existe no tipo e na UI, alimentado como melhoria futura); `periodoReferencia` para conta `NAO_CONFIGURADO` usa uma janela mensal só informativa.

**2. Placeholders:** sem "TBD"/"TODO". Todo passo de código traz código real; os únicos textos livres são as mensagens de WhatsApp (dadas na íntegra na Task 9), a cópia dos rótulos (fixada nas Global Constraints) e o cenário do seed (especificado cliente a cliente na Task 13).

**3. Consistência de tipos:**
- `Intervalo` definido na Task 3, consumido por Tasks 4 e 5. ✔
- `StatusEntrega` / `Periodicidade` (Task 4) usados em Tasks 5, 7, 10, 11, 12. ✔
- `periodoReferencia`/`dataEntrega`/`derivarStatus` — assinaturas idênticas entre a Task 4 (definição) e a Task 5 (uso). ✔
- `LinhaControle` (Task 5) consumido por Tasks 9, 10, 11 com os mesmos campos (`contaId`, `bancoRotulo`, `periodoRefInicio/Fim`, `faltantesRotulo`, `cobradoEm`, `status`). ✔
- `EstadoConfig` (Task 6) consumido pela Task 8 (`useActionState`). ✔
- `cobrarExtratoWhatsapp` recebe `{ clienteId, contaBancariaId, referenciaInicio, referenciaFim }` — mesma forma na Task 6 (definição) e Task 9 (chamada). ✔
- `configurarCliente` lê `clienteId`/`periodicidade`/`telefone`/`diaEntrega` do FormData — mesmos `name`s no `<form>` da Task 8. ✔
- Ações de auditoria `CLIENTE_CONFIGURADO`/`EXTRATO_COBRADO` já existem na união `AcaoAuditoriaDocumento` do Plano A (Task 4 do Plano A) e são aceitas por `listarHistoricoDocumentos` (escopo `entidade` inclui `"Cliente"` e `"CobrancaExtrato"`). ✔
- `ROTULO_STATUS` (Task 4) usado por Tasks 7, 11, 12. ✔
