# SC-01 — Conversão de extrato bancário para OFX — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Entregar o 2º módulo: o operador sobe um extrato bancário (PDF **ou** foto) numa caixa de entrada, o Claude lê as linhas com confiança por linha tolerando qualquer leiaute, as de baixa confiança caem numa fila de conferência, e — só depois que todas estão confirmadas — o módulo gera um arquivo OFX 1.0.2 válido para download.

**Architecture:** Módulo plugado na fundação já no ar, seguindo o padrão estabelecido pelo SC-20 (função `run()` → `executarModulo` → `Execucao`; catálogo estático com flag `implementado`; `ModuloPageLayout`; rota de cron sob `/api/` protegida por `CRON_SECRET`). Introduz a "caixa de entrada" (`DocumentoEntrada`) — infra compartilhada com o SC-11 no futuro. A leitura do extrato é uma chamada **real** à API da Anthropic (multimodal, sem OCR separado); a lógica pura testável é o **gerador de OFX** e o **motor de conferência**. Bytes dos arquivos ficam no Postgres (`Bytes`).

**Tech Stack:** Next.js 16 (App Router, TS) + React 19, Prisma 7.10.0 + `@prisma/adapter-pg` sobre Postgres (Docker local, Supabase em produção), Tailwind v4, `zod` 4, `@anthropic-ai/sdk` (novo — modelo `claude-opus-5`), Vitest 4 (+ `@testing-library/react`). Vercel Cron via `vercel.json`. `pdfkit` + `@napi-rs/canvas` como devDeps só para gerar os fixtures de seed.

**Spec:** [docs/superpowers/specs/2026-08-27-portal-sheepcontabil-design.md](../specs/2026-08-27-portal-sheepcontabil-design.md) — seções 4, 5.1, 5.2, 6, 7, 11, 12.

## Global Constraints

- Prazo de entrega: 2026-09-01.
- Toda execução de módulo passa por `executarModulo(moduloCodigo, disparadoPor, executar)` de `@/lib/execucao` — nunca escrever direto em `Execucao`. `disparadoPor` = e-mail do usuário sob demanda, `"scheduler"` no cron. `ResultadoExecucao = { status: "SUCESSO" | "PARCIAL"; resumo: string }`; `ERRO` só via exceção que escapa do `run()`.
- Erro conhecido (arquivo ilegível, IA indisponível, rate limit) vira **mensagem legível**; nunca stack trace cru na UI (spec §12).
- Processamento é **granular por documento** (spec §5.1): falha num documento marca só aquele como `ERRO` e não derruba os outros do lote. Status `PARCIAL` quando parte do lote falhou.
- Catálogo estático em `src/lib/modulos-catalogo.ts`; a home só lista `implementado: true`. A flag do SC-01 só vira `true` na Task 10.
- **Download do OFX trava** enquanto o documento tiver qualquer `Lancamento` com status `PENDENTE_REVISAO` (spec §5.2 — "antes de considerar o item pronto para importar").
- Limiar de confiança: `Lancamento` com `confianca < 0.85` nasce `PENDENTE_REVISAO`; `>= 0.85` nasce `CONFIRMADO`.
- Chamada à Anthropic: `@anthropic-ai/sdk`, modelo **`claude-opus-5`**, `client.messages.stream(...)` + `.finalMessage()` (não bloquear em `max_tokens` alto), `thinking: { type: "adaptive" }`. PDF entra como content block `document`/`base64`; foto como `image`/`base64`. Sem `ANTHROPIC_API_KEY` → lança `IaIndisponivelError` com mensagem legível; **não quebra o processo**.
- Paleta: `petroleo #10505F`, `turquesa #1FA69A`, `ambar #E8A33D`, `tinta #0B1A20`, `grafite #5A7078`, `nevoa #EEF3F4`, `carmim #C4453D` — só via utilitários `bg-/text-/border-` (e `ring-/outline-` com esses tokens). Fontes `font-titulo` (Archivo), `font-texto` (IBM Plex Sans), `font-codigo` (IBM Plex Mono). Sem dependência de UI nova.
- Sessão: `obterSessao()` de `@/lib/sessao-servidor` → `PayloadSessao | null` (`{ usuarioId, email, nome, papel, setor }`). SC-01 é do setor **`Contábil`**; `ADMIN` vê tudo, `OPERADOR` vê só módulos do próprio setor.
- Conexão de banco: runtime usa `DATABASE_URL`; `prisma migrate deploy` (no `build`) usa `DIRECT_URL || DATABASE_URL`. Dev: Docker Postgres em `localhost:5433` (`docker compose up -d db`).
- Import do Prisma Client sem extensão: `@/generated/prisma/client`.
- `vitest.config.ts` já roda os arquivos em série (`fileParallelism: false`) — os testes de integração deste módulo também falam com o Postgres local. Testes de integração fazem snapshot de `new Date()` no `beforeEach` e limpam por `criadoEm >= testStart` no `afterEach` (padrão estabelecido no SC-20).
- Commits pequenos, mensagem explica o porquê, termina com `Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>`.

---

## File Structure

```
prisma/
  schema.prisma                          # + ContaBancaria, DocumentoEntrada, Lancamento + 3 enums
  migrations/<novo>_sc01_caixa_entrada/
  fixtures/                              # NOVO — arquivos de extrato sintéticos (commitados)
    gerar-fixtures.ts                    #   script one-shot que produz os fixtures
    extrato-alfa.pdf  extrato-beta.pdf  extrato-gama.pdf  extrato-foto.jpg
  seed.ts                               # + seedContasBancarias(), seedDocumentosEntrada()
vercel.json                             # + cron do SC-01
src/
  lib/
    documentos/
      ofx.ts                            # gerarOfx(conta, transacoes, geradoEm?) — puro
      ofx.test.ts
      conferencia.ts                    # LIMIAR_CONFIANCA, classificarLancamento, documentoPodeBaixarOfx — puro
      conferencia.test.ts
      extrator-extrato.ts               # ExtratorExtrato, extrairExtratoComClaude, IaIndisponivelError, criarExtratorFake
      extrator-extrato.test.ts
      processar-sc01.ts                 # processarExtratos({extrator?}), processarDocumento(id, extrator?)
      processar-sc01.test.ts            # integração (banco local)
      consultas-sc01.ts                 # listarDocumentos, obterDocumentoComLancamentos, listarContas
      consultas-sc01.test.ts            # integração
      acoes-sc01.ts                     # "use server": enviarDocumento, processarPendentes, processarUm, confirmarLancamento, excluirDocumento
      formato-documentos.ts            # formatarBytes, formatarDataUTC (reuso local)
  components/
    documentos/
      BadgeStatusDocumento.tsx  BadgeStatusDocumento.test.tsx
      FormularioUploadDocumento.tsx     # "use client"
      TabelaDocumentos.tsx
      PainelLancamentos.tsx             # resultado + fila de conferência
      LinhaConferencia.tsx              # "use client" — confirmar/editar uma linha
      BotaoProcessar.tsx               # "use client" — useFormStatus
      BotaoBaixarOfx.tsx               # link ou botão desabilitado com motivo
      ListaAvisos… (n/a)
  app/
    modulos/sc-01/
      page.tsx
      documento/[documentoId]/
        page.tsx                        # detalhe: lançamentos + conferência + baixar OFX
        ofx/route.ts                    # GET — gera e baixa o .ofx (403 se travado)
    api/cron/sc-01/route.ts             # GET protegido por CRON_SECRET
README.md                              # + seção SC-01
```

---

### Task 1: Schema — caixa de entrada, conta bancária, lançamento

**Files:**
- Modify: `prisma/schema.prisma`
- Create: `prisma/migrations/<timestamp>_sc01_caixa_entrada/migration.sql` (gerado)

**Interfaces:**
- Consumes: model `Cliente`.
- Produces: enums `TipoDocumento { EXTRATO NFSE }`, `StatusDocumento { PENDENTE PROCESSADO ERRO }`, `StatusLancamento { CONFIRMADO PENDENTE_REVISAO }`; models `ContaBancaria`, `DocumentoEntrada` (com `arquivo Bytes`, `mimeType`, `nomeArquivo`, `status`, `chegadaEm`, `processadoEm?`, `erro?`), `Lancamento` (`data`, `historico`, `valor Decimal(14,2)`, `confianca Float`, `trechoOriginal?`, `status`). Prisma Client regenerado.

- [ ] **Step 1: Subir o Postgres local**

Run: `docker compose up -d db && docker compose exec db pg_isready -U sheep -d sheepcontabil`
Expected: `accepting connections`.

- [ ] **Step 2: Adicionar ao fim de `prisma/schema.prisma`**

```prisma
enum TipoDocumento {
  EXTRATO
  NFSE
}

enum StatusDocumento {
  PENDENTE
  PROCESSADO
  ERRO
}

enum StatusLancamento {
  CONFIRMADO
  PENDENTE_REVISAO
}

model ContaBancaria {
  id         String             @id @default(cuid())
  clienteId  String
  cliente    Cliente            @relation(fields: [clienteId], references: [id], onDelete: Cascade)
  bancoNome  String
  compe      String             // código COMPE de 3 dígitos (ex. "341")
  agencia    String
  numero     String
  documentos DocumentoEntrada[]
  criadoEm   DateTime           @default(now())

  @@index([clienteId])
}

model DocumentoEntrada {
  id              String          @id @default(cuid())
  tipo            TipoDocumento
  clienteId       String
  cliente         Cliente         @relation(fields: [clienteId], references: [id], onDelete: Cascade)
  contaBancariaId String?
  contaBancaria   ContaBancaria?  @relation(fields: [contaBancariaId], references: [id])
  nomeArquivo     String
  mimeType        String
  arquivo         Bytes
  status          StatusDocumento @default(PENDENTE)
  chegadaEm       DateTime
  processadoEm    DateTime?
  erro            String?
  lancamentos     Lancamento[]
  criadoEm        DateTime        @default(now())

  @@index([tipo, status])
}

model Lancamento {
  id                 String           @id @default(cuid())
  documentoEntradaId String
  documentoEntrada   DocumentoEntrada @relation(fields: [documentoEntradaId], references: [id], onDelete: Cascade)
  data               DateTime
  historico          String
  valor              Decimal          @db.Decimal(14, 2)
  confianca          Float
  trechoOriginal     String?
  status             StatusLancamento @default(CONFIRMADO)
  criadoEm           DateTime         @default(now())

  @@index([documentoEntradaId])
}
```

- [ ] **Step 3: Relações inversas no model `Cliente`** — logo abaixo de `certificados Certificado[]`:

```prisma
  contasBancarias   ContaBancaria[]
  documentosEntrada DocumentoEntrada[]
```

- [ ] **Step 4: Migração**

Run: `npx prisma migrate dev --name sc01_caixa_entrada`
Expected: `Your database is now in sync with your schema.`, pasta de migração criada, "Generated Prisma Client".

- [ ] **Step 5: Type-check**

Run: `npx tsc --noEmit`
Expected: sem erros.

- [ ] **Step 6: Commit**

```bash
git add prisma/schema.prisma prisma/migrations
git commit -m "feat(sc-01): schema da caixa de entrada (DocumentoEntrada, ContaBancaria, Lancamento)

DocumentoEntrada guarda os bytes do arquivo (Bytes) e a data de chegada
simulada; e infra compartilhada com o SC-11 (tipo EXTRATO | NFSE). Cada
Lancamento carrega a confianca da leitura da IA e o trecho original, pra
sustentar a fila de conferencia.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 2: Gerador de OFX 1.0.2 (puro, TDD)

**Files:**
- Create: `src/lib/documentos/ofx.ts`
- Test: `src/lib/documentos/ofx.test.ts`

**Interfaces:**
- Produces:
  - `type ContaOfx = { bancoNome: string; compe: string; agencia: string; numero: string }`
  - `type TransacaoOfx = { data: Date; historico: string; valor: number }` (valor negativo = débito)
  - `gerarOfx(conta: ContaOfx, transacoes: TransacaoOfx[], geradoEm?: Date): string` — devolve o arquivo OFX 1.0.2 SGML completo (cabeçalho `OFXHEADER:100 … VERSION:102 …` + `<OFX>…</OFX>`).

- [ ] **Step 1: Teste que falha — `src/lib/documentos/ofx.test.ts`**

```ts
import { describe, expect, it } from "vitest";
import { gerarOfx, type ContaOfx, type TransacaoOfx } from "./ofx";

const CONTA: ContaOfx = {
  bancoNome: "Banco Exemplo",
  compe: "341",
  agencia: "1234",
  numero: "56789-0",
};

const GERADO_EM = new Date("2026-08-30T12:00:00Z");

const TX: TransacaoOfx[] = [
  { data: new Date("2026-08-03T00:00:00Z"), historico: "PAGAMENTO FORNECEDOR", valor: -150.5 },
  { data: new Date("2026-08-10T00:00:00Z"), historico: "RECEBIMENTO CLIENTE A & B", valor: 2300 },
  { data: new Date("2026-08-21T00:00:00Z"), historico: "TARIFA BANCARIA", valor: -29.9 },
];

describe("gerarOfx", () => {
  const ofx = gerarOfx(CONTA, TX, GERADO_EM);

  it("abre com o cabecalho OFX 1.0.2 SGML", () => {
    expect(ofx.startsWith("OFXHEADER:100")).toBe(true);
    expect(ofx).toContain("VERSION:102");
    expect(ofx).toContain("DATA:OFXSGML");
  });

  it("inclui banco e conta em BANKACCTFROM", () => {
    expect(ofx).toContain("<BANKID>341");
    expect(ofx).toContain("<ACCTID>56789-0");
    expect(ofx).toContain("<ACCTTYPE>CHECKING");
    expect(ofx).toContain("<CURDEF>BRL");
  });

  it("gera um STMTTRN por transacao, com sinal e 2 casas", () => {
    const blocos = ofx.split("<STMTTRN>").length - 1;
    expect(blocos).toBe(3);
    expect(ofx).toContain("<TRNAMT>-150.50");
    expect(ofx).toContain("<TRNAMT>2300.00");
    expect(ofx).toContain("<TRNAMT>-29.90");
  });

  it("classifica DEBIT/CREDIT pelo sinal", () => {
    expect(ofx).toContain("<TRNTYPE>DEBIT");
    expect(ofx).toContain("<TRNTYPE>CREDIT");
  });

  it("escapa & < > no MEMO", () => {
    expect(ofx).toContain("<MEMO>RECEBIMENTO CLIENTE A &amp; B");
  });

  it("gera FITID unico por transacao", () => {
    const fitids = [...ofx.matchAll(/<FITID>([^\n]+)/g)].map((m) => m[1]);
    expect(new Set(fitids).size).toBe(fitids.length);
    expect(fitids.length).toBe(3);
  });

  it("DTSTART/DTEND cobrem a faixa das transacoes", () => {
    expect(ofx).toContain("<DTSTART>20260803");
    expect(ofx).toContain("<DTEND>20260821");
  });

  it("LEDGERBAL e a soma dos valores", () => {
    // -150.50 + 2300 - 29.90 = 2119.60
    expect(ofx).toContain("<BALAMT>2119.60");
  });

  it("fecha todas as tags de agregado", () => {
    for (const tag of ["OFX", "BANKMSGSRSV1", "STMTTRNRS", "STMTRS", "BANKTRANLIST", "BANKACCTFROM"]) {
      expect(ofx).toContain(`</${tag}>`);
    }
  });
});
```

- [ ] **Step 2: Rodar e ver falhar** — `npm test -- ofx` → `Cannot find module './ofx'`.

- [ ] **Step 3: Implementar `src/lib/documentos/ofx.ts`**

```ts
export type ContaOfx = {
  bancoNome: string;
  compe: string;
  agencia: string;
  numero: string;
};

export type TransacaoOfx = {
  data: Date;
  historico: string;
  valor: number;
};

function dataOfx(data: Date): string {
  const p = (n: number, c = 2) => String(n).padStart(c, "0");
  return (
    `${data.getUTCFullYear()}${p(data.getUTCMonth() + 1)}${p(data.getUTCDate())}` +
    `${p(data.getUTCHours())}${p(data.getUTCMinutes())}${p(data.getUTCSeconds())}[-3:BRT]`
  );
}

function valorOfx(valor: number): string {
  return valor.toFixed(2);
}

function escaparSgml(texto: string): string {
  return texto
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function fitId(data: Date, indice: number): string {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${data.getUTCFullYear()}${p(data.getUTCMonth() + 1)}${p(data.getUTCDate())}-${indice + 1}`;
}

export function gerarOfx(
  conta: ContaOfx,
  transacoes: TransacaoOfx[],
  geradoEm: Date = new Date(),
): string {
  const ordenadas = [...transacoes].sort(
    (a, b) => a.data.getTime() - b.data.getTime(),
  );
  const inicio = ordenadas[0]?.data ?? geradoEm;
  const fim = ordenadas[ordenadas.length - 1]?.data ?? geradoEm;
  const saldo = ordenadas.reduce((s, t) => s + t.valor, 0);

  const cabecalho = [
    "OFXHEADER:100",
    "DATA:OFXSGML",
    "VERSION:102",
    "SECURITY:NONE",
    "ENCODING:USASCII",
    "CHARSET:1252",
    "COMPRESSION:NONE",
    "OLDFILEUID:NONE",
    "NEWFILEUID:NONE",
    "",
    "",
  ].join("\n");

  const linhasTrn = ordenadas
    .map((t, i) =>
      [
        "<STMTTRN>",
        `<TRNTYPE>${t.valor < 0 ? "DEBIT" : "CREDIT"}`,
        `<DTPOSTED>${dataOfx(t.data)}`,
        `<TRNAMT>${valorOfx(t.valor)}`,
        `<FITID>${fitId(t.data, i)}`,
        `<MEMO>${escaparSgml(t.historico)}`,
        "</STMTTRN>",
      ].join("\n"),
    )
    .join("\n");

  const corpo = [
    "<OFX>",
    "<SIGNONMSGSRSV1>",
    "<SONRS>",
    "<STATUS>",
    "<CODE>0",
    "<SEVERITY>INFO",
    "</STATUS>",
    `<DTSERVER>${dataOfx(geradoEm)}`,
    "<LANGUAGE>POR",
    "</SONRS>",
    "</SIGNONMSGSRSV1>",
    "<BANKMSGSRSV1>",
    "<STMTTRNRS>",
    "<TRNUID>1",
    "<STATUS>",
    "<CODE>0",
    "<SEVERITY>INFO",
    "</STATUS>",
    "<STMTRS>",
    "<CURDEF>BRL",
    "<BANKACCTFROM>",
    `<BANKID>${conta.compe}`,
    `<ACCTID>${conta.numero}`,
    "<ACCTTYPE>CHECKING",
    "</BANKACCTFROM>",
    "<BANKTRANLIST>",
    `<DTSTART>${dataOfx(inicio)}`,
    `<DTEND>${dataOfx(fim)}`,
    linhasTrn,
    "</BANKTRANLIST>",
    "<LEDGERBAL>",
    `<BALAMT>${valorOfx(saldo)}`,
    `<DTASOF>${dataOfx(fim)}`,
    "</LEDGERBAL>",
    "</STMTRS>",
    "</STMTTRNRS>",
    "</BANKMSGSRSV1>",
    "</OFX>",
    "",
  ].join("\n");

  return cabecalho + corpo;
}
```

- [ ] **Step 4: Rodar e ver passar** — `npm test -- ofx`.

- [ ] **Step 5: Commit**

```bash
git add src/lib/documentos/ofx.ts src/lib/documentos/ofx.test.ts
git commit -m "feat(sc-01): gerador de OFX 1.0.2 SGML a partir de transacoes estruturadas

Formato que o software contabil BR importa. Funcao pura: recebe conta +
transacoes, monta o envelope, classifica DEBIT/CREDIT pelo sinal, gera
FITID unico e escapa & < > no MEMO. Testado sem banco (spec §11).

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 3: Motor de conferência (puro, TDD)

**Files:**
- Create: `src/lib/documentos/conferencia.ts`
- Test: `src/lib/documentos/conferencia.test.ts`

**Interfaces:**
- Produces:
  - `LIMIAR_CONFIANCA = 0.85`
  - `type StatusConferencia = "CONFIRMADO" | "PENDENTE_REVISAO"` (mesmos valores do enum Prisma `StatusLancamento`)
  - `classificarLancamento(confianca: number): StatusConferencia` — `< 0.85` → `PENDENTE_REVISAO`, senão `CONFIRMADO`.
  - `documentoPodeBaixarOfx(lancamentos: { status: StatusConferencia }[]): boolean` — `true` só se houver ≥1 lançamento e nenhum `PENDENTE_REVISAO`.
  - `motivoBloqueioOfx(lancamentos: { status: StatusConferencia }[]): string | null` — `null` se pode baixar; senão texto legível ("2 linhas ainda em conferência" / "Nenhum lançamento extraído").

- [ ] **Step 1: Teste que falha — `src/lib/documentos/conferencia.test.ts`**

```ts
import { describe, expect, it } from "vitest";
import {
  classificarLancamento,
  documentoPodeBaixarOfx,
  LIMIAR_CONFIANCA,
  motivoBloqueioOfx,
} from "./conferencia";

describe("classificarLancamento", () => {
  it("abaixo do limiar vai para revisao", () => {
    expect(classificarLancamento(0.84)).toBe("PENDENTE_REVISAO");
  });
  it("no limiar ou acima e confirmado", () => {
    expect(classificarLancamento(LIMIAR_CONFIANCA)).toBe("CONFIRMADO");
    expect(classificarLancamento(0.99)).toBe("CONFIRMADO");
  });
});

describe("documentoPodeBaixarOfx", () => {
  it("false quando nao ha lancamento", () => {
    expect(documentoPodeBaixarOfx([])).toBe(false);
  });
  it("false quando ha linha pendente de revisao", () => {
    expect(
      documentoPodeBaixarOfx([
        { status: "CONFIRMADO" },
        { status: "PENDENTE_REVISAO" },
      ]),
    ).toBe(false);
  });
  it("true quando todas confirmadas", () => {
    expect(
      documentoPodeBaixarOfx([{ status: "CONFIRMADO" }, { status: "CONFIRMADO" }]),
    ).toBe(true);
  });
});

describe("motivoBloqueioOfx", () => {
  it("null quando pode baixar", () => {
    expect(motivoBloqueioOfx([{ status: "CONFIRMADO" }])).toBeNull();
  });
  it("conta as linhas em revisao", () => {
    expect(
      motivoBloqueioOfx([
        { status: "PENDENTE_REVISAO" },
        { status: "PENDENTE_REVISAO" },
        { status: "CONFIRMADO" },
      ]),
    ).toBe("2 linhas ainda em conferência");
  });
  it("mensagem propria quando nao ha lancamento", () => {
    expect(motivoBloqueioOfx([])).toBe("Nenhum lançamento extraído");
  });
});
```

- [ ] **Step 2: Rodar e ver falhar** — `npm test -- conferencia`.

- [ ] **Step 3: Implementar `src/lib/documentos/conferencia.ts`**

```ts
export const LIMIAR_CONFIANCA = 0.85;

export type StatusConferencia = "CONFIRMADO" | "PENDENTE_REVISAO";

export function classificarLancamento(confianca: number): StatusConferencia {
  return confianca < LIMIAR_CONFIANCA ? "PENDENTE_REVISAO" : "CONFIRMADO";
}

export function documentoPodeBaixarOfx(
  lancamentos: { status: StatusConferencia }[],
): boolean {
  if (lancamentos.length === 0) return false;
  return lancamentos.every((l) => l.status === "CONFIRMADO");
}

export function motivoBloqueioOfx(
  lancamentos: { status: StatusConferencia }[],
): string | null {
  if (lancamentos.length === 0) return "Nenhum lançamento extraído";
  const emRevisao = lancamentos.filter(
    (l) => l.status === "PENDENTE_REVISAO",
  ).length;
  if (emRevisao === 0) return null;
  return `${emRevisao} ${emRevisao === 1 ? "linha ainda em conferência" : "linhas ainda em conferência"}`;
}
```

- [ ] **Step 4: Rodar e ver passar** — `npm test -- conferencia`.

- [ ] **Step 5: Commit**

```bash
git add src/lib/documentos/conferencia.ts src/lib/documentos/conferencia.test.ts
git commit -m "feat(sc-01): motor de conferencia (limiar de confianca e trava do OFX)

classificarLancamento decide CONFIRMADO vs PENDENTE_REVISAO no limiar
0.85; documentoPodeBaixarOfx so libera o download quando nao ha nenhuma
linha em revisao (spec §5.2). Puro, testado sem banco.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 4: Extrator via Claude (API real da Anthropic)

**Files:**
- Create: `src/lib/documentos/extrator-extrato.ts`
- Test: `src/lib/documentos/extrator-extrato.test.ts`
- Modify: `package.json` (dep `@anthropic-ai/sdk`)

**Interfaces:**
- Produces:
  - `class IaIndisponivelError extends Error` (name `"IaIndisponivelError"`).
  - `type LinhaExtraida = { data: string; historico: string; valor: number; confianca: number; trechoOriginal?: string }`
  - `type ExtratorExtrato = (arquivo: { mimeType: string; base64: string }) => Promise<LinhaExtraida[]>`
  - `extrairExtratoComClaude: ExtratorExtrato` — a implementação real.
  - `criarExtratorFake(linhas: LinhaExtraida[]): ExtratorExtrato` — helper síncrono para os testes das Tasks 5/6.

- [ ] **Step 1: Instalar o SDK**

Run: `npm install --save-exact @anthropic-ai/sdk@0.70.0`
(Se a versão exata não resolver, use a `latest` e registre a versão instalada no report.)

- [ ] **Step 2: Teste que falha — `src/lib/documentos/extrator-extrato.test.ts`**

```ts
import { afterEach, describe, expect, it } from "vitest";
import {
  criarExtratorFake,
  extrairExtratoComClaude,
  IaIndisponivelError,
  type LinhaExtraida,
} from "./extrator-extrato";

const CHAVE_ORIGINAL = process.env.ANTHROPIC_API_KEY;
afterEach(() => {
  if (CHAVE_ORIGINAL === undefined) delete process.env.ANTHROPIC_API_KEY;
  else process.env.ANTHROPIC_API_KEY = CHAVE_ORIGINAL;
});

describe("extrairExtratoComClaude", () => {
  it("lanca IaIndisponivelError quando ANTHROPIC_API_KEY nao esta setada", async () => {
    delete process.env.ANTHROPIC_API_KEY;
    await expect(
      extrairExtratoComClaude({ mimeType: "application/pdf", base64: "AAAA" }),
    ).rejects.toBeInstanceOf(IaIndisponivelError);
  });
});

describe("criarExtratorFake", () => {
  it("devolve exatamente as linhas passadas", async () => {
    const linhas: LinhaExtraida[] = [
      { data: "2026-08-03", historico: "PAG", valor: -10, confianca: 0.9 },
    ];
    const extrator = criarExtratorFake(linhas);
    await expect(
      extrator({ mimeType: "application/pdf", base64: "x" }),
    ).resolves.toEqual(linhas);
  });
});
```

- [ ] **Step 3: Rodar e ver falhar** — `npm test -- extrator-extrato`.

- [ ] **Step 4: Implementar `src/lib/documentos/extrator-extrato.ts`**

```ts
import Anthropic from "@anthropic-ai/sdk";

const MODELO = "claude-opus-5";

export class IaIndisponivelError extends Error {
  constructor(
    mensagem = "IA indisponível. Configure ANTHROPIC_API_KEY para processar documentos.",
  ) {
    super(mensagem);
    this.name = "IaIndisponivelError";
  }
}

export type LinhaExtraida = {
  data: string; // ISO yyyy-mm-dd
  historico: string;
  valor: number; // negativo = débito/saída
  confianca: number; // 0..1
  trechoOriginal?: string;
};

export type ExtratorExtrato = (arquivo: {
  mimeType: string;
  base64: string;
}) => Promise<LinhaExtraida[]>;

export function criarExtratorFake(linhas: LinhaExtraida[]): ExtratorExtrato {
  return async () => linhas;
}

const FERRAMENTA = {
  name: "registrar_lancamentos",
  description:
    "Registra todas as linhas de movimentação encontradas no extrato bancário.",
  input_schema: {
    type: "object" as const,
    properties: {
      linhas: {
        type: "array",
        items: {
          type: "object",
          properties: {
            data: {
              type: "string",
              description: "Data do lançamento em ISO yyyy-mm-dd.",
            },
            historico: { type: "string" },
            valor: {
              type: "number",
              description:
                "Valor em reais. Negativo para débito/saída, positivo para crédito/entrada.",
            },
            confianca: {
              type: "number",
              description: "Sua confiança nesta linha, de 0 a 1.",
            },
            trechoOriginal: {
              type: "string",
              description: "O trecho literal do extrato de onde a linha foi lida.",
            },
          },
          required: ["data", "historico", "valor", "confianca"],
        },
      },
    },
    required: ["linhas"],
  },
};

const INSTRUCAO = `Você recebe um extrato bancário brasileiro (PDF ou foto). Extraia TODOS os lançamentos, um por linha de movimentação. Para cada um:
- data em ISO yyyy-mm-dd
- historico: a descrição do lançamento
- valor em reais: NEGATIVO para débito/saída, POSITIVO para crédito/entrada
- confianca de 0 a 1: quão seguro você está da leitura DAQUELA linha (leiaute ambíguo, dígito borrado na foto, valor cortado → reduza a confiança)
- trechoOriginal: o texto literal de onde leu

Ignore saldos, cabeçalhos e totais — só as movimentações. Chame a ferramenta registrar_lancamentos uma vez, com todas as linhas.`;

export const extrairExtratoComClaude: ExtratorExtrato = async ({
  mimeType,
  base64,
}) => {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new IaIndisponivelError();

  const client = new Anthropic({ apiKey });

  const blocoArquivo =
    mimeType === "application/pdf"
      ? {
          type: "document" as const,
          source: {
            type: "base64" as const,
            media_type: "application/pdf" as const,
            data: base64,
          },
        }
      : {
          type: "image" as const,
          source: {
            type: "base64" as const,
            media_type: mimeType as "image/jpeg" | "image/png",
            data: base64,
          },
        };

  let mensagem;
  try {
    const stream = client.messages.stream({
      model: MODELO,
      max_tokens: 32000,
      thinking: { type: "adaptive" },
      tools: [FERRAMENTA],
      messages: [
        {
          role: "user",
          content: [blocoArquivo, { type: "text", text: INSTRUCAO }],
        },
      ],
    });
    mensagem = await stream.finalMessage();
  } catch (erro) {
    if (erro instanceof Anthropic.AuthenticationError) {
      throw new IaIndisponivelError("Chave da Anthropic inválida.");
    }
    if (erro instanceof Anthropic.RateLimitError) {
      throw new Error(
        "A IA está sobrecarregada no momento. Tente processar de novo em alguns minutos.",
      );
    }
    if (erro instanceof Anthropic.APIError) {
      throw new Error(
        `A IA não conseguiu processar o documento (erro ${erro.status}). Verifique se o arquivo está legível.`,
      );
    }
    throw erro;
  }

  const toolUse = mensagem.content.find((b) => b.type === "tool_use");
  if (toolUse && toolUse.type === "tool_use") {
    const input = toolUse.input as { linhas?: LinhaExtraida[] };
    return input.linhas ?? [];
  }

  // Fallback: tenta achar um JSON com "linhas" no texto.
  const texto = mensagem.content
    .filter((b): b is Anthropic.TextBlock => b.type === "text")
    .map((b) => b.text)
    .join("\n");
  const match = texto.match(/\{[\s\S]*"linhas"[\s\S]*\}/);
  if (match) {
    try {
      const obj = JSON.parse(match[0]) as { linhas?: LinhaExtraida[] };
      return obj.linhas ?? [];
    } catch {
      /* cai no erro abaixo */
    }
  }
  throw new Error(
    "A IA não retornou os lançamentos de forma estruturada para este documento.",
  );
};
```

Notas para o implementador:
- `tool_choice` fica em `"auto"` (não force um tool específico) — força de tool + `thinking` pode dar 400 em alguns modelos; a instrução já é explícita o suficiente.
- Se o `import Anthropic from "@anthropic-ai/sdk"` não expuser `Anthropic.TextBlock` / `Anthropic.APIError` com esses nomes na versão instalada, ajuste os nomes conforme o erro do `tsc` (ver `node_modules/@anthropic-ai/sdk`); a forma da chamada permanece.

- [ ] **Step 5: Rodar e ver passar** — `npm test -- extrator-extrato` (2 testes).

- [ ] **Step 6: `tsc` + suíte cheia** — `npx tsc --noEmit && npm test`.

- [ ] **Step 7: Commit**

```bash
git add src/lib/documentos/extrator-extrato.ts src/lib/documentos/extrator-extrato.test.ts package.json package-lock.json
git commit -m "feat(sc-01): extrator de extrato via API multimodal da Anthropic

Manda o PDF/foto direto pro claude-opus-5 (sem OCR separado), pede as
linhas {data, historico, valor, confianca} via tool use. Sem
ANTHROPIC_API_KEY -> IaIndisponivelError legivel, nao quebra. Erros de
auth/rate-limit/API viram mensagem tratada (spec §12). criarExtratorFake
injeta linhas deterministicas nos testes dos motores.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 5: Motor de processamento (integração, TDD)

**Files:**
- Create: `src/lib/documentos/processar-sc01.ts`
- Test: `src/lib/documentos/processar-sc01.test.ts`

**Interfaces:**
- Consumes: `prisma`; `ResultadoExecucao` de `@/lib/execucao`; `classificarLancamento` de `./conferencia`; `ExtratorExtrato`, `LinhaExtraida`, `extrairExtratoComClaude`, `IaIndisponivelError` de `./extrator-extrato`.
- Produces:
  - `processarDocumento(documentoId: string, extrator?: ExtratorExtrato): Promise<void>` — processa um `DocumentoEntrada`. Em sucesso: cria os `Lancamento` (classificados) numa transação, marca o doc `PROCESSADO` + `processadoEm`. Em falha conhecida: marca `ERRO` + `erro` legível, **não lança**. Idempotente: se o doc não está `PENDENTE`, não faz nada.
  - `processarExtratos(opts?: { extrator?: ExtratorExtrato }): Promise<ResultadoExecucao>` — varre `DocumentoEntrada` `tipo: EXTRATO, status: PENDENTE`, chama `processarDocumento` em cada um, agrega. `status: "PARCIAL"` se ≥1 falhou; senão `"SUCESSO"`. `resumo` conta processados/falhos/linhas em revisão.
- Default do `extrator` = `extrairExtratoComClaude`.

- [ ] **Step 1: Teste que falha — `src/lib/documentos/processar-sc01.test.ts`**

```ts
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { prisma } from "@/lib/prisma";
import { criarExtratorFake, type LinhaExtraida } from "./extrator-extrato";
import { processarDocumento, processarExtratos } from "./processar-sc01";

const MARCADOR = "sc01-teste";
let testStart: Date;

beforeEach(() => {
  testStart = new Date();
});

afterEach(async () => {
  await prisma.lancamento.deleteMany({
    where: { documentoEntrada: { nomeArquivo: { startsWith: MARCADOR } } },
  });
  await prisma.documentoEntrada.deleteMany({
    where: { nomeArquivo: { startsWith: MARCADOR } },
  });
  await prisma.cliente.deleteMany({ where: { cnpj: "77.777.777/0001-77" } });
});

async function clienteTeste() {
  return prisma.cliente.upsert({
    where: { cnpj: "77.777.777/0001-77" },
    update: {},
    create: {
      razaoSocial: "Cliente SC-01 Teste",
      cnpj: "77.777.777/0001-77",
      atividade: "Teste",
    },
  });
}

async function docTeste(nome: string) {
  const cliente = await clienteTeste();
  return prisma.documentoEntrada.create({
    data: {
      tipo: "EXTRATO",
      clienteId: cliente.id,
      nomeArquivo: `${MARCADOR}-${nome}.pdf`,
      mimeType: "application/pdf",
      arquivo: Buffer.from("fake-pdf-bytes"),
      chegadaEm: new Date(),
    },
  });
}

const LINHAS_OK: LinhaExtraida[] = [
  { data: "2026-08-03", historico: "PAG A", valor: -10, confianca: 0.95 },
  { data: "2026-08-05", historico: "REC B", valor: 200, confianca: 0.6 }, // baixa confiança
];

describe("processarDocumento", () => {
  it("cria os lancamentos classificados e marca PROCESSADO", async () => {
    const doc = await docTeste("a");
    await processarDocumento(doc.id, criarExtratorFake(LINHAS_OK));

    const atualizado = await prisma.documentoEntrada.findUniqueOrThrow({
      where: { id: doc.id },
      include: { lancamentos: { orderBy: { data: "asc" } } },
    });
    expect(atualizado.status).toBe("PROCESSADO");
    expect(atualizado.processadoEm).not.toBeNull();
    expect(atualizado.lancamentos).toHaveLength(2);
    expect(atualizado.lancamentos[0].status).toBe("CONFIRMADO");
    expect(atualizado.lancamentos[1].status).toBe("PENDENTE_REVISAO");
  });

  it("marca ERRO com mensagem legivel quando o extrator lanca IaIndisponivelError", async () => {
    const doc = await docTeste("b");
    const extratorQuebrado = async () => {
      const { IaIndisponivelError } = await import("./extrator-extrato");
      throw new IaIndisponivelError();
    };
    await processarDocumento(doc.id, extratorQuebrado);

    const atualizado = await prisma.documentoEntrada.findUniqueOrThrow({
      where: { id: doc.id },
    });
    expect(atualizado.status).toBe("ERRO");
    expect(atualizado.erro).toContain("IA indisponível");
    expect(
      await prisma.lancamento.count({ where: { documentoEntradaId: doc.id } }),
    ).toBe(0);
  });

  it("nao reprocessa um doc que ja saiu de PENDENTE", async () => {
    const doc = await docTeste("c");
    await processarDocumento(doc.id, criarExtratorFake(LINHAS_OK));
    await processarDocumento(doc.id, criarExtratorFake([]));
    expect(
      await prisma.lancamento.count({ where: { documentoEntradaId: doc.id } }),
    ).toBe(2);
  });
});

describe("processarExtratos", () => {
  it("processa o lote e devolve PARCIAL quando um documento falha", async () => {
    const bom = await docTeste("bom");
    const ruim = await docTeste("ruim");
    // marca o "ruim" com um mime invalido pra forcar erro no extrator real? nao —
    // usa um extrator que falha so pro segundo id:
    let n = 0;
    const extrator = async () => {
      n += 1;
      if (n === 2) throw new Error("Arquivo ilegível.");
      return LINHAS_OK;
    };
    const resultado = await processarExtratos({ extrator });

    expect(resultado.status).toBe("PARCIAL");
    expect(resultado.resumo).toMatch(/1 processad|1 com erro/i);

    const idsBom = await prisma.documentoEntrada.findUniqueOrThrow({
      where: { id: bom.id },
    });
    const idsRuim = await prisma.documentoEntrada.findUniqueOrThrow({
      where: { id: ruim.id },
    });
    // um dos dois processou e o outro deu erro (a ordem depende do orderBy)
    expect([idsBom.status, idsRuim.status].sort()).toEqual(["ERRO", "PROCESSADO"]);
  });
});
```

- [ ] **Step 2: Rodar e ver falhar** — `npm test -- processar-sc01`.

- [ ] **Step 3: Implementar `src/lib/documentos/processar-sc01.ts`**

```ts
import { prisma } from "@/lib/prisma";
import type { ResultadoExecucao } from "@/lib/execucao";
import { classificarLancamento } from "./conferencia";
import {
  extrairExtratoComClaude,
  IaIndisponivelError,
  type ExtratorExtrato,
} from "./extrator-extrato";

function mensagemDeErro(erro: unknown): string {
  if (erro instanceof IaIndisponivelError) return erro.message;
  if (erro instanceof Error) return erro.message;
  return "Falha inesperada ao processar o documento.";
}

export async function processarDocumento(
  documentoId: string,
  extrator: ExtratorExtrato = extrairExtratoComClaude,
): Promise<void> {
  const doc = await prisma.documentoEntrada.findUnique({
    where: { id: documentoId },
  });
  if (!doc || doc.status !== "PENDENTE") return;

  try {
    const linhas = await extrator({
      mimeType: doc.mimeType,
      base64: Buffer.from(doc.arquivo).toString("base64"),
    });

    await prisma.$transaction(async (tx) => {
      for (const linha of linhas) {
        await tx.lancamento.create({
          data: {
            documentoEntradaId: doc.id,
            data: new Date(`${linha.data}T00:00:00Z`),
            historico: linha.historico,
            valor: linha.valor,
            confianca: linha.confianca,
            trechoOriginal: linha.trechoOriginal ?? null,
            status: classificarLancamento(linha.confianca),
          },
        });
      }
      await tx.documentoEntrada.update({
        where: { id: doc.id },
        data: { status: "PROCESSADO", processadoEm: new Date(), erro: null },
      });
    });
  } catch (erro) {
    await prisma.documentoEntrada.update({
      where: { id: doc.id },
      data: { status: "ERRO", erro: mensagemDeErro(erro) },
    });
  }
}

export async function processarExtratos(opts?: {
  extrator?: ExtratorExtrato;
}): Promise<ResultadoExecucao> {
  const pendentes = await prisma.documentoEntrada.findMany({
    where: { tipo: "EXTRATO", status: "PENDENTE" },
    orderBy: { chegadaEm: "asc" },
    select: { id: true },
  });

  for (const { id } of pendentes) {
    await processarDocumento(id, opts?.extrator);
  }

  const ids = pendentes.map((p) => p.id);
  const depois = await prisma.documentoEntrada.findMany({
    where: { id: { in: ids } },
    include: { _count: { select: { lancamentos: true } }, lancamentos: { select: { status: true } } },
  });

  const processados = depois.filter((d) => d.status === "PROCESSADO").length;
  const comErro = depois.filter((d) => d.status === "ERRO").length;
  const emRevisao = depois.reduce(
    (n, d) => n + d.lancamentos.filter((l) => l.status === "PENDENTE_REVISAO").length,
    0,
  );

  const resumo =
    `${pendentes.length} documento(s) no lote: ${processados} processado(s), ${comErro} com erro` +
    (emRevisao > 0 ? `; ${emRevisao} linha(s) em conferência` : "");

  return { status: comErro > 0 ? "PARCIAL" : "SUCESSO", resumo };
}
```

- [ ] **Step 4: Rodar e ver passar** — `npm test -- processar-sc01`.

- [ ] **Step 5: Suíte cheia** — `npm test`.

- [ ] **Step 6: Commit**

```bash
git add src/lib/documentos/processar-sc01.ts src/lib/documentos/processar-sc01.test.ts
git commit -m "feat(sc-01): motor de processamento granular por documento

processarDocumento le o extrato pela IA, cria os Lancamento classificados
numa transacao e marca PROCESSADO; falha conhecida marca so aquele doc
como ERRO com mensagem legivel, sem lancar. processarExtratos varre o
lote de pendentes e devolve PARCIAL se algum falhou (spec §5.1/§12).

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 6: Consultas do painel (integração, TDD)

**Files:**
- Create: `src/lib/documentos/consultas-sc01.ts`
- Test: `src/lib/documentos/consultas-sc01.test.ts`

**Interfaces:**
- Produces:
  - `type DocumentoResumo = { id, clienteRazaoSocial, tipo, nomeArquivo, status, chegadaEm: Date, totalLancamentos: number, emRevisao: number, podeBaixarOfx: boolean }`
  - `listarDocumentos(tipo?: "EXTRATO" | "NFSE"): Promise<DocumentoResumo[]>` — ordenado por `chegadaEm desc`.
  - `type DocumentoDetalhe = { id, cliente: {id, razaoSocial}, conta: ContaOfx | null, tipo, nomeArquivo, mimeType, status, erro: string | null, lancamentos: LancamentoDetalhe[], podeBaixarOfx: boolean, motivoBloqueio: string | null }` onde `LancamentoDetalhe = { id, data: Date, historico, valor: number, confianca, trechoOriginal: string | null, status }`.
  - `obterDocumentoComLancamentos(id: string): Promise<DocumentoDetalhe | null>`.
  - `listarContasDoCliente(clienteId: string): Promise<{ id: string; rotulo: string }[]>` — `rotulo` = `"Banco X — ag 1234 c/c 56789-0"`.
  - `listarClientesParaUpload(): Promise<{ id: string; razaoSocial: string }[]>`.

- [ ] **Step 1: Teste que falha — `src/lib/documentos/consultas-sc01.test.ts`**

```ts
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { prisma } from "@/lib/prisma";
import {
  listarDocumentos,
  obterDocumentoComLancamentos,
} from "./consultas-sc01";

const CNPJ = "66.666.666/0001-66";
let testStart: Date;
beforeEach(() => {
  testStart = new Date();
});
afterEach(async () => {
  await prisma.lancamento.deleteMany({
    where: { criadoEm: { gte: testStart } },
  });
  await prisma.documentoEntrada.deleteMany({ where: { cliente: { cnpj: CNPJ } } });
  await prisma.cliente.deleteMany({ where: { cnpj: CNPJ } });
});

async function cenario() {
  const cliente = await prisma.cliente.create({
    data: { razaoSocial: "Consultas SC-01", cnpj: CNPJ, atividade: "T" },
  });
  const doc = await prisma.documentoEntrada.create({
    data: {
      tipo: "EXTRATO",
      clienteId: cliente.id,
      nomeArquivo: "x.pdf",
      mimeType: "application/pdf",
      arquivo: Buffer.from("z"),
      chegadaEm: new Date(),
      status: "PROCESSADO",
      lancamentos: {
        create: [
          { data: new Date("2026-08-01T00:00:00Z"), historico: "A", valor: -10, confianca: 0.95, status: "CONFIRMADO" },
          { data: new Date("2026-08-02T00:00:00Z"), historico: "B", valor: 20, confianca: 0.5, status: "PENDENTE_REVISAO" },
        ],
      },
    },
  });
  return { doc };
}

describe("listarDocumentos", () => {
  it("traz contagem e trava do OFX", async () => {
    const { doc } = await cenario();
    const lista = await listarDocumentos("EXTRATO");
    const alvo = lista.find((d) => d.id === doc.id);
    expect(alvo?.totalLancamentos).toBe(2);
    expect(alvo?.emRevisao).toBe(1);
    expect(alvo?.podeBaixarOfx).toBe(false);
  });
});

describe("obterDocumentoComLancamentos", () => {
  it("devolve o detalhe com valor como number e o motivo do bloqueio", async () => {
    const { doc } = await cenario();
    const d = await obterDocumentoComLancamentos(doc.id);
    expect(d?.lancamentos).toHaveLength(2);
    expect(typeof d?.lancamentos[0].valor).toBe("number");
    expect(d?.podeBaixarOfx).toBe(false);
    expect(d?.motivoBloqueio).toBe("1 linha ainda em conferência");
  });
});
```

- [ ] **Step 2: Rodar e ver falhar** — `npm test -- consultas-sc01`.

- [ ] **Step 3: Implementar `src/lib/documentos/consultas-sc01.ts`**

```ts
import { prisma } from "@/lib/prisma";
import type { ContaOfx } from "./ofx";
import {
  documentoPodeBaixarOfx,
  motivoBloqueioOfx,
  type StatusConferencia,
} from "./conferencia";

export type DocumentoResumo = {
  id: string;
  clienteRazaoSocial: string;
  tipo: "EXTRATO" | "NFSE";
  nomeArquivo: string;
  status: "PENDENTE" | "PROCESSADO" | "ERRO";
  chegadaEm: Date;
  totalLancamentos: number;
  emRevisao: number;
  podeBaixarOfx: boolean;
};

export async function listarDocumentos(
  tipo?: "EXTRATO" | "NFSE",
): Promise<DocumentoResumo[]> {
  const docs = await prisma.documentoEntrada.findMany({
    where: tipo ? { tipo } : undefined,
    orderBy: { chegadaEm: "desc" },
    include: {
      cliente: { select: { razaoSocial: true } },
      lancamentos: { select: { status: true } },
    },
  });
  return docs.map((d) => {
    const emRevisao = d.lancamentos.filter(
      (l) => l.status === "PENDENTE_REVISAO",
    ).length;
    return {
      id: d.id,
      clienteRazaoSocial: d.cliente.razaoSocial,
      tipo: d.tipo,
      nomeArquivo: d.nomeArquivo,
      status: d.status,
      chegadaEm: d.chegadaEm,
      totalLancamentos: d.lancamentos.length,
      emRevisao,
      podeBaixarOfx:
        d.status === "PROCESSADO" &&
        documentoPodeBaixarOfx(
          d.lancamentos as { status: StatusConferencia }[],
        ),
    };
  });
}

export type LancamentoDetalhe = {
  id: string;
  data: Date;
  historico: string;
  valor: number;
  confianca: number;
  trechoOriginal: string | null;
  status: StatusConferencia;
};

export type DocumentoDetalhe = {
  id: string;
  cliente: { id: string; razaoSocial: string };
  conta: ContaOfx | null;
  tipo: "EXTRATO" | "NFSE";
  nomeArquivo: string;
  mimeType: string;
  status: "PENDENTE" | "PROCESSADO" | "ERRO";
  erro: string | null;
  lancamentos: LancamentoDetalhe[];
  podeBaixarOfx: boolean;
  motivoBloqueio: string | null;
};

export async function obterDocumentoComLancamentos(
  id: string,
): Promise<DocumentoDetalhe | null> {
  const d = await prisma.documentoEntrada.findUnique({
    where: { id },
    include: {
      cliente: { select: { id: true, razaoSocial: true } },
      contaBancaria: true,
      lancamentos: { orderBy: { data: "asc" } },
    },
  });
  if (!d) return null;

  const lancamentos: LancamentoDetalhe[] = d.lancamentos.map((l) => ({
    id: l.id,
    data: l.data,
    historico: l.historico,
    valor: Number(l.valor),
    confianca: l.confianca,
    trechoOriginal: l.trechoOriginal,
    status: l.status as StatusConferencia,
  }));

  return {
    id: d.id,
    cliente: d.cliente,
    conta: d.contaBancaria
      ? {
          bancoNome: d.contaBancaria.bancoNome,
          compe: d.contaBancaria.compe,
          agencia: d.contaBancaria.agencia,
          numero: d.contaBancaria.numero,
        }
      : null,
    tipo: d.tipo,
    nomeArquivo: d.nomeArquivo,
    mimeType: d.mimeType,
    status: d.status,
    erro: d.erro,
    lancamentos,
    podeBaixarOfx:
      d.status === "PROCESSADO" && documentoPodeBaixarOfx(lancamentos),
    motivoBloqueio:
      d.status === "PROCESSADO" ? motivoBloqueioOfx(lancamentos) : "Documento ainda não processado",
  };
}

export async function listarContasDoCliente(
  clienteId: string,
): Promise<{ id: string; rotulo: string }[]> {
  const contas = await prisma.contaBancaria.findMany({
    where: { clienteId },
    orderBy: { bancoNome: "asc" },
  });
  return contas.map((c) => ({
    id: c.id,
    rotulo: `${c.bancoNome} — ag ${c.agencia} c/c ${c.numero}`,
  }));
}

export async function listarClientesParaUpload(): Promise<
  { id: string; razaoSocial: string }[]
> {
  return prisma.cliente.findMany({
    orderBy: { razaoSocial: "asc" },
    select: { id: true, razaoSocial: true },
  });
}
```

- [ ] **Step 4: Rodar e ver passar** — `npm test -- consultas-sc01`.

- [ ] **Step 5: Commit**

```bash
git add src/lib/documentos/consultas-sc01.ts src/lib/documentos/consultas-sc01.test.ts
git commit -m "feat(sc-01): consultas do painel de documentos e do detalhe com conferencia

listarDocumentos traz contagem de linhas + se o OFX ja pode ser baixado;
obterDocumentoComLancamentos converte Decimal->number na fronteira e
resolve o motivo do bloqueio pela funcao pura de conferencia.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 7: Server Actions — upload, processar, conferir, excluir

**Files:**
- Create: `src/lib/documentos/acoes-sc01.ts`

**Interfaces:**
- Consumes: `prisma`, `obterSessao`, `filtrarModulosVisiveis`, `executarModulo`, `processarExtratos`/`processarDocumento` de `./processar-sc01`, `classificarLancamento` de `./conferencia`, `revalidatePath`, `redirect`, `z`.
- Produces:
  - `exigirAcessoSc01(): Promise<PayloadSessao>` — lança se não há sessão ou o usuário não enxerga `SC-01`.
  - `type EstadoUpload = { erro: string } | null`
  - `enviarDocumento(_prev: EstadoUpload, formData: FormData): Promise<EstadoUpload>` — campos: `clienteId`, `contaBancariaId` (obrigatório p/ EXTRATO), `arquivo` (File). Valida mime (`application/pdf`, `image/jpeg`, `image/png`) e tamanho (≤ 15 MB). Cria `DocumentoEntrada` `tipo: EXTRATO`, `status: PENDENTE`, `chegadaEm: new Date()`. Em sucesso: `revalidatePath` + `redirect("/modulos/sc-01")`.
  - `processarPendentes(): Promise<void>` — `executarModulo("SC-01", sessao.email, () => processarExtratos())`; `revalidatePath`.
  - `processarUm(formData: FormData): Promise<void>` — lê `documentoId`; `executarModulo("SC-01", sessao.email, async () => { await processarDocumento(id); return { status: "SUCESSO", resumo: \`Documento \${id} reprocessado\` }; })`; `revalidatePath`.
  - `confirmarLancamento(_prev, formData): Promise<{ erro: string } | null>` — lê `lancamentoId` + opcionalmente `data`, `historico`, `valor` editados; atualiza a linha e força `status: "CONFIRMADO"`; `revalidatePath` do detalhe. (Sem `redirect`.)
  - `excluirDocumento(formData): Promise<void>` — lê `documentoId`, `deleteMany`; `revalidatePath` + `redirect("/modulos/sc-01")`.

- [ ] **Step 1: Implementar `src/lib/documentos/acoes-sc01.ts`**

```ts
"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { obterSessao } from "@/lib/sessao-servidor";
import { filtrarModulosVisiveis } from "@/lib/modulos-catalogo";
import { executarModulo } from "@/lib/execucao";
import { processarDocumento, processarExtratos } from "./processar-sc01";

const ROTA = "/modulos/sc-01";
const MIMES_OK = ["application/pdf", "image/jpeg", "image/png"];
const TAMANHO_MAX = 15 * 1024 * 1024;

export async function exigirAcessoSc01() {
  const sessao = await obterSessao();
  const podeVer =
    sessao !== null &&
    filtrarModulosVisiveis(sessao.papel, sessao.setor).some(
      (m) => m.codigo === "SC-01",
    );
  if (!sessao || !podeVer) {
    throw new Error("Sem acesso ao módulo SC-01.");
  }
  return sessao;
}

export type EstadoUpload = { erro: string } | null;

const esquemaUpload = z.object({
  clienteId: z.string().min(1, "Selecione o cliente."),
  contaBancariaId: z.string().min(1, "Selecione a conta bancária."),
});

export async function enviarDocumento(
  _prev: EstadoUpload,
  formData: FormData,
): Promise<EstadoUpload> {
  await exigirAcessoSc01();

  const dados = esquemaUpload.safeParse({
    clienteId: formData.get("clienteId"),
    contaBancariaId: formData.get("contaBancariaId"),
  });
  if (!dados.success) {
    return { erro: dados.error.issues[0]?.message ?? "Dados inválidos." };
  }

  const arquivo = formData.get("arquivo");
  if (!(arquivo instanceof File) || arquivo.size === 0) {
    return { erro: "Anexe o arquivo do extrato (PDF, JPG ou PNG)." };
  }
  if (!MIMES_OK.includes(arquivo.type)) {
    return { erro: "Formato não suportado. Use PDF, JPG ou PNG." };
  }
  if (arquivo.size > TAMANHO_MAX) {
    return { erro: "Arquivo acima de 15 MB." };
  }

  const conta = await prisma.contaBancaria.findFirst({
    where: { id: dados.data.contaBancariaId, clienteId: dados.data.clienteId },
  });
  if (!conta) {
    return { erro: "Conta bancária não encontrada para esse cliente." };
  }

  const bytes = Buffer.from(await arquivo.arrayBuffer());

  await prisma.documentoEntrada.create({
    data: {
      tipo: "EXTRATO",
      clienteId: dados.data.clienteId,
      contaBancariaId: dados.data.contaBancariaId,
      nomeArquivo: arquivo.name,
      mimeType: arquivo.type,
      arquivo: bytes,
      chegadaEm: new Date(),
    },
  });

  revalidatePath(ROTA);
  redirect(ROTA);
}

export async function processarPendentes(): Promise<void> {
  const sessao = await exigirAcessoSc01();
  await executarModulo("SC-01", sessao.email, () => processarExtratos());
  revalidatePath(ROTA);
}

export async function processarUm(formData: FormData): Promise<void> {
  const sessao = await exigirAcessoSc01();
  const documentoId = String(formData.get("documentoId") ?? "");
  if (!documentoId) return;
  await executarModulo("SC-01", sessao.email, async () => {
    await processarDocumento(documentoId);
    return { status: "SUCESSO", resumo: `Documento reprocessado sob demanda.` };
  });
  revalidatePath(ROTA);
  revalidatePath(`${ROTA}/documento/${documentoId}`);
}

const esquemaConferencia = z.object({
  lancamentoId: z.string().min(1),
  data: z.string().optional(),
  historico: z.string().optional(),
  valor: z.string().optional(),
});

export async function confirmarLancamento(
  _prev: { erro: string } | null,
  formData: FormData,
): Promise<{ erro: string } | null> {
  await exigirAcessoSc01();
  const dados = esquemaConferencia.safeParse({
    lancamentoId: formData.get("lancamentoId"),
    data: formData.get("data") ?? undefined,
    historico: formData.get("historico") ?? undefined,
    valor: formData.get("valor") ?? undefined,
  });
  if (!dados.success) return { erro: "Dados inválidos." };

  const lancamento = await prisma.lancamento.findUnique({
    where: { id: dados.data.lancamentoId },
  });
  if (!lancamento) return { erro: "Lançamento não encontrado." };

  const patch: Record<string, unknown> = { status: "CONFIRMADO", confianca: 1 };
  if (dados.data.data) patch.data = new Date(`${dados.data.data}T00:00:00Z`);
  if (dados.data.historico) patch.historico = dados.data.historico;
  if (dados.data.valor !== undefined && dados.data.valor !== "") {
    const n = Number(dados.data.valor.replace(",", "."));
    if (Number.isNaN(n)) return { erro: "Valor inválido." };
    patch.valor = n;
  }

  await prisma.lancamento.update({
    where: { id: dados.data.lancamentoId },
    data: patch,
  });
  revalidatePath(`${ROTA}/documento/${lancamento.documentoEntradaId}`);
  return null;
}

export async function excluirDocumento(formData: FormData): Promise<void> {
  await exigirAcessoSc01();
  const documentoId = String(formData.get("documentoId") ?? "");
  if (documentoId) {
    await prisma.documentoEntrada.deleteMany({ where: { id: documentoId } });
  }
  revalidatePath(ROTA);
  redirect(ROTA);
}
```

- [ ] **Step 2: `tsc` + lint + suíte** — `npx tsc --noEmit && npm run lint && npm test` (todos limpos).

- [ ] **Step 3: Commit**

```bash
git add src/lib/documentos/acoes-sc01.ts
git commit -m "feat(sc-01): server actions de upload, processamento, conferencia e exclusao

Upload valida mime (pdf/jpg/png) e tamanho, guarda os bytes no Postgres.
processarPendentes/processarUm sempre passam pelo executarModulo (mesmo
historico do cron). confirmarLancamento fecha uma linha da fila de
conferencia (opcionalmente com edicao) e forca confianca 1.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 8: Rota de download do OFX (com trava)

**Files:**
- Create: `src/app/modulos/sc-01/documento/[documentoId]/ofx/route.ts`

**Interfaces:**
- Consumes: `obterSessao`, `filtrarModulosVisiveis`, `obterDocumentoComLancamentos` de `@/lib/documentos/consultas-sc01`, `gerarOfx` de `@/lib/documentos/ofx`.
- Produces: `GET` handler. Fluxo: sessão ausente/sem acesso → 401 JSON. Documento inexistente → 404. `podeBaixarOfx === false` → **403** JSON com `{ erro: motivoBloqueio }`. Sucesso → 200, `Content-Type: application/x-ofx`, `Content-Disposition: attachment; filename="extrato-<slug>.ofx"`, corpo = OFX gerado a partir de `conta` + `lancamentos` (todos `CONFIRMADO` nesse ponto).

- [ ] **Step 1: Implementar `src/app/modulos/sc-01/documento/[documentoId]/ofx/route.ts`**

```ts
import { NextResponse } from "next/server";
import { obterSessao } from "@/lib/sessao-servidor";
import { filtrarModulosVisiveis } from "@/lib/modulos-catalogo";
import { obterDocumentoComLancamentos } from "@/lib/documentos/consultas-sc01";
import { gerarOfx } from "@/lib/documentos/ofx";

function slug(texto: string): string {
  return texto
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-zA-Z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "")
    .toLowerCase();
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ documentoId: string }> },
) {
  const sessao = await obterSessao();
  const podeVer =
    sessao !== null &&
    filtrarModulosVisiveis(sessao.papel, sessao.setor).some(
      (m) => m.codigo === "SC-01",
    );
  if (!sessao || !podeVer) {
    return NextResponse.json({ erro: "Não autorizado." }, { status: 401 });
  }

  const { documentoId } = await params;
  const doc = await obterDocumentoComLancamentos(documentoId);
  if (!doc) {
    return NextResponse.json(
      { erro: "Documento não encontrado." },
      { status: 404 },
    );
  }
  if (!doc.podeBaixarOfx || !doc.conta) {
    return NextResponse.json(
      {
        erro:
          doc.motivoBloqueio ??
          "Documento sem conta bancária associada; não é possível gerar o OFX.",
      },
      { status: 403 },
    );
  }

  const ofx = gerarOfx(
    doc.conta,
    doc.lancamentos.map((l) => ({
      data: l.data,
      historico: l.historico,
      valor: l.valor,
    })),
  );

  const nome = `extrato-${slug(doc.cliente.razaoSocial)}-${documentoId.slice(0, 6)}.ofx`;
  return new NextResponse(ofx, {
    status: 200,
    headers: {
      "Content-Type": "application/x-ofx; charset=windows-1252",
      "Content-Disposition": `attachment; filename="${nome}"`,
    },
  });
}
```

- [ ] **Step 2: `tsc` + build** — `npx tsc --noEmit && npm run build` (rota `ƒ /modulos/sc-01/documento/[documentoId]/ofx` aparece).

- [ ] **Step 3: Commit**

```bash
git add src/app/modulos/sc-01/documento
git commit -m "feat(sc-01): rota de download do OFX, travada ate a conferencia terminar

GET gera o .ofx sob demanda a partir do documento; 403 com motivo legivel
enquanto houver linha PENDENTE_REVISAO (spec §5.2), 401 sem sessao/acesso,
404 se o documento nao existe.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 9: Componentes do painel

**Files:**
- Create: `src/components/documentos/BadgeStatusDocumento.tsx` + `.test.tsx`
- Create: `src/components/documentos/FormularioUploadDocumento.tsx` (`"use client"`)
- Create: `src/components/documentos/TabelaDocumentos.tsx`
- Create: `src/components/documentos/PainelLancamentos.tsx`
- Create: `src/components/documentos/LinhaConferencia.tsx` (`"use client"`)
- Create: `src/components/documentos/BotaoProcessar.tsx` (`"use client"`)
- Create: `src/components/documentos/BotaoBaixarOfx.tsx`
- Create: `src/lib/documentos/formato-documentos.ts` (`formatarDataUTC`, `formatarBytes`, `formatarValor`)

**Interfaces:**
- Consumes: tipos de `@/lib/documentos/consultas-sc01`; actions de `@/lib/documentos/acoes-sc01`; `StatusConferencia` de `@/lib/documentos/conferencia`.
- Produces os componentes acima. `BadgeStatusDocumento({ status })` renderiza rótulo ("Pendente" / "Processado" / "Erro"). `BotaoBaixarOfx({ href, bloqueado, motivo })` — `<a>` quando liberado, `<span>` desabilitado com `title={motivo}` quando bloqueado (nunca um link morto). `LinhaConferencia({ lancamento })` — mostra `trechoOriginal`, `confianca`, campos editáveis (data/histórico/valor) e botão "Confirmar" via `confirmarLancamento` (`useActionState`).

- [ ] **Step 1: Aplicar as skills de design** — invoque `ui-ux-pro-max` e `frontend-design`. Baseline: consistência visual com `ModuloCard`, `HistoricoExecucoes`, `PainelCertificados` (do SC-20). Só tokens da paleta + as 3 fontes, sem dep nova, Tailwind v4 + SVG inline. Alvo: painel de operação denso e legível — tabela de documentos com badge de status, formulário de upload compacto, e a **fila de conferência** com o trecho original do extrato lado a lado do valor lido, confiança visível, e edição inline antes de confirmar.

- [ ] **Step 2: TDD `BadgeStatusDocumento`** — teste primeiro:

```tsx
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { BadgeStatusDocumento } from "./BadgeStatusDocumento";

describe("BadgeStatusDocumento", () => {
  it.each([
    ["PENDENTE", "Pendente"],
    ["PROCESSADO", "Processado"],
    ["ERRO", "Erro"],
  ] as const)("%s -> %s", (status, rotulo) => {
    render(<BadgeStatusDocumento status={status} />);
    expect(screen.getByText(rotulo)).toBeInTheDocument();
  });
});
```

Rodar (falha), implementar, rodar (passa).

- [ ] **Step 3: Implementar os demais componentes** à contrato. `formato-documentos.ts`:

```ts
export function formatarDataUTC(data: Date): string {
  return new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeZone: "UTC" }).format(data);
}
export function formatarBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(0)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}
export function formatarValor(v: number): string {
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}
```

Diretrizes por componente:
- `FormularioUploadDocumento({ clientes, contasPorCliente })` — `"use client"`, `useActionState(enviarDocumento)`; select de cliente controla qual lista de contas aparece (as contas vêm pré-carregadas via prop `contasPorCliente: Record<string, {id,rotulo}[]>` para não fazer fetch no client); `<input type="file" accept="application/pdf,image/jpeg,image/png">`; erro em `role="alert"`.
- `TabelaDocumentos({ documentos })` — server; colunas cliente / arquivo / chegada / status / linhas (`total`, `emRevisao`) / ações (link "abrir" → `/modulos/sc-01/documento/<id>`).
- `BotaoProcessar({ acao, rotulo })` — `"use client"`, `useFormStatus`, desabilita + "Processando…" enquanto `pending`. Usado tanto no "processar pendentes" quanto no "reprocessar" do detalhe.
- `PainelLancamentos({ documento })` — server; se `status === "ERRO"` mostra `documento.erro` num bloco carmim; senão a tabela de lançamentos (data / histórico / valor com `formatarValor` / confiança / status). As linhas `PENDENTE_REVISAO` vão para uma seção "Conferência" com `<LinhaConferencia>` para cada.
- `LinhaConferencia({ lancamento })` — `"use client"`, `useActionState(confirmarLancamento)`; mostra `trechoOriginal` em `font-codigo` num bloco névoa; inputs pré-preenchidos com `data`/`historico`/`valor`; botão "Confirmar".
- `BotaoBaixarOfx({ href, bloqueado, motivo })` — liberado: `<a href download>` estilizado como botão petróleo; bloqueado: `<span>` com `bg-grafite/20 text-grafite cursor-not-allowed` e `title={motivo}`, e o texto do motivo visível ao lado.

- [ ] **Step 4: `npm test` + `npm run lint` + `npx tsc --noEmit`** — tudo verde.

- [ ] **Step 5: Commit**

```bash
git add src/components/documentos src/lib/documentos/formato-documentos.ts
git commit -m "feat(sc-01): componentes do painel de documentos e da fila de conferencia

Tabela de documentos com badge de status; formulario de upload compacto;
fila de conferencia mostra o trecho original do extrato ao lado do valor
lido, com edicao inline antes de confirmar. BotaoBaixarOfx nunca vira link
morto — quando travado e um <span> desabilitado com o motivo. Design com
ui-ux-pro-max + frontend-design dentro do sistema visual da SheepContabil.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 10: Página, detalhe, cron e ligar o módulo

**Files:**
- Create: `src/app/modulos/sc-01/page.tsx`
- Create: `src/app/modulos/sc-01/documento/[documentoId]/page.tsx`
- Create: `src/app/api/cron/sc-01/route.ts`
- Modify: `vercel.json`
- Modify: `src/lib/modulos-catalogo.ts`

**Interfaces:**
- Consumes: `obterSessao`, `sair`, `CabecalhoPortal`, `ModuloPageLayout`, `obterModulo` + `filtrarModulosVisiveis`, `listarHistorico`; consultas e actions do SC-01; componentes da Task 9; `cronAutorizado` de `@/lib/cron-logica`; `executarModulo`; `processarExtratos`.
- Produces: rota `/modulos/sc-01` (lista + upload + "processar pendentes"), `/modulos/sc-01/documento/[id]` (detalhe + conferência + baixar OFX), `GET /api/cron/sc-01` (mensal, protegido), entrada no `vercel.json`, `SC-01` com `implementado: true`.

- [ ] **Step 1: `src/app/modulos/sc-01/page.tsx`** — padrão do SC-20 (`page.tsx` do SC-20 é a referência): guarda de sessão → `redirect("/login")`; `obterModulo("SC-01")` sem `!`, sem acesso → `redirect("/")`. `Promise.all([listarHistorico("SC-01"), listarDocumentos("EXTRATO"), listarClientesParaUpload(), <contas por cliente>])`. Monta `<CabecalhoPortal>` + `<ModuloPageLayout>` com `acoes` = `<BotaoProcessar acao={processarPendentes} rotulo="Processar pendentes" />` e `conteudo` = seção "Enviar extrato" (`<FormularioUploadDocumento>`) + seção "Documentos" (`<TabelaDocumentos>`). Para `contasPorCliente`, carregue no server: `Object.fromEntries(await Promise.all(clientes.map(async c => [c.id, await listarContasDoCliente(c.id)])))`.

- [ ] **Step 2: `src/app/modulos/sc-01/documento/[documentoId]/page.tsx`** — server; `searchParams`/`params` como `Promise`; guarda de sessão/acesso; `obterDocumentoComLancamentos(id)` → 404 via `notFound()` se `null`. Renderiza `<CabecalhoPortal>` + um `<main>` com: cabeçalho (cliente, arquivo, `<BadgeStatusDocumento>`, link "voltar"); se `PENDENTE`, um `<BotaoProcessar acao={processarUm...} />` (com `<input type=hidden name=documentoId>`); `<PainelLancamentos documento={...} />`; e o `<BotaoBaixarOfx href={\`/modulos/sc-01/documento/\${id}/ofx\`} bloqueado={!podeBaixarOfx} motivo={motivoBloqueio} />`.

- [ ] **Step 3: `src/lib/cron-logica.ts` já existe** (SC-20). `src/app/api/cron/sc-01/route.ts`:

```ts
import { NextRequest, NextResponse } from "next/server";
import { cronAutorizado } from "@/lib/cron-logica";
import { executarModulo } from "@/lib/execucao";
import { processarExtratos } from "@/lib/documentos/processar-sc01";

export async function GET(request: NextRequest) {
  if (
    !cronAutorizado(request.headers.get("authorization"), process.env.CRON_SECRET)
  ) {
    return NextResponse.json({ erro: "Não autorizado." }, { status: 401 });
  }
  try {
    const execucao = await executarModulo("SC-01", "scheduler", () =>
      processarExtratos(),
    );
    return NextResponse.json({
      execucaoId: execucao.id,
      status: execucao.status,
      resumo: execucao.resumo,
      erro: execucao.erro,
    });
  } catch (erro) {
    console.error("[cron sc-01]", erro);
    return NextResponse.json(
      { erro: "Falha ao executar o módulo." },
      { status: 500 },
    );
  }
}
```

- [ ] **Step 4: `vercel.json`** — adicionar ao array `crons`:

```json
{ "path": "/api/cron/sc-01", "schedule": "0 8 2 * *" }
```

(dia 2 às 08:00 UTC — desencontra do SC-20 que roda dia 1.)

- [ ] **Step 5: `src/lib/modulos-catalogo.ts`** — no objeto `SC-01`, `implementado: false` → `true`.

- [ ] **Step 6: Suíte + build** — `npm test && npm run lint && npx tsc --noEmit && npm run build`. Esperado: verde; rotas `/modulos/sc-01`, `/modulos/sc-01/documento/[documentoId]`, `/modulos/sc-01/documento/[documentoId]/ofx`, `/api/cron/sc-01` no output.

- [ ] **Step 7: Verificação manual — a IA de verdade**

Pré: `ANTHROPIC_API_KEY` real no `.env`; `docker compose up -d db`; seed rodado (Task 11 — se ainda não, pule para lá e volte).

```bash
npm run dev
```

- Logar como `admin@sheepcontabil.com.br` → card **SC-01** na home.
- SC-01 → subir um dos PDFs de `prisma/fixtures/` para um cliente/conta → aparece `PENDENTE` na tabela.
- **Processar pendentes** → aguardar; o documento vira `PROCESSADO`, o histórico ganha uma linha `SUCESSO`/`PARCIAL` disparada pelo seu e-mail.
- Abrir o documento → conferir os lançamentos; se houver linhas em conferência, o botão "Baixar OFX" aparece **desabilitado** com o motivo.
- Confirmar as linhas da fila → o botão libera → baixar o `.ofx` → abrir o arquivo e checar `OFXHEADER:100`, `<BANKID>`, um `<STMTTRN>` por lançamento.
- Repetir com o fixture **de foto** (`extrato-foto.jpg`) → confirmar que o caminho `image/*` também funciona ponta a ponta.
- `curl -i http://localhost:3000/api/cron/sc-01` → 401; com `Authorization: Bearer <CRON_SECRET>` → 200.
- Sem `ANTHROPIC_API_KEY` (comente no `.env`, reinicie): processar → o documento vira `ERRO` com "IA indisponível…", os outros não são afetados.

- [ ] **Step 8: Commit**

```bash
git add src/app/modulos/sc-01 src/app/api/cron/sc-01 vercel.json src/lib/modulos-catalogo.ts
git commit -m "feat(sc-01): pagina, detalhe com conferencia, cron mensal e SC-01 na home

Pagina lista a caixa de entrada + upload + processar pendentes; o detalhe
tem a fila de conferencia e o botao de OFX (travado ate conferir).
/api/cron/sc-01 mensal (dia 2, 08:00 UTC) protegido por CRON_SECRET.
implementado: true liga o card na home.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 11: Fixtures sintéticos + seed + README

**Files:**
- Create: `prisma/fixtures/gerar-fixtures.ts`
- Create (gerados, commitados): `prisma/fixtures/extrato-alfa.pdf`, `extrato-beta.pdf`, `extrato-gama.pdf`, `extrato-foto.jpg`
- Modify: `prisma/seed.ts`
- Modify: `README.md`
- Modify: `package.json` (devDeps `pdfkit`, `@napi-rs/canvas`; script `fixtures`)

**Interfaces:**
- Produces: `seedContasBancarias()` (uma conta para ~4 clientes), `seedDocumentosEntrada()` (carrega os 4 fixtures como `DocumentoEntrada` `EXTRATO` `PENDENTE`, `chegadaEm` espalhado no mês). Ambas chamadas em `main()` após `seedClientes()`. Idempotentes.

- [ ] **Step 1: devDeps**

```bash
npm install --save-dev pdfkit @types/pdfkit @napi-rs/canvas
```

- [ ] **Step 2: `prisma/fixtures/gerar-fixtures.ts`** — script que gera 3 PDFs com **leiautes visivelmente diferentes** (ordem de colunas, fontes, espaçamento, com/sem cabeçalho de saldo) e 1 imagem "fotografada". Conteúdo: ~8-12 lançamentos plausíveis (datas do mês, históricos como "TED RECEBIDA", "PIX ENVIADO", "TARIFA PACOTE", "PAGAMENTO BOLETO"), valores com sinal. O 4º é desenhado num `@napi-rs/canvas` com leve rotação + ruído/gradiente e salvo como JPEG (simula foto). Escreva o script completo — sem placeholders — usando `PDFDocument` do `pdfkit` e `createCanvas` do `@napi-rs/canvas`. Cada arquivo vai para `prisma/fixtures/`.

Adicione ao `package.json`: `"fixtures": "tsx prisma/fixtures/gerar-fixtures.ts"`.

**Fallback:** se `@napi-rs/canvas` não instalar no ambiente, gere o 4º fixture também como PDF via `pdfkit` (com leiaute "torto": rotação de página e fundo cinza) e salve como `extrato-foto.pdf`; ajuste o seed e a verificação da Task 10 para esse nome/mime (`application/pdf`). Registre o desvio no report.

- [ ] **Step 3: Rodar** — `npm run fixtures` → confirmar os 4 arquivos em `prisma/fixtures/`, abrir cada um e checar que parecem extratos e que os 3 PDFs têm leiautes distintos.

- [ ] **Step 4: `prisma/seed.ts`** — adicionar, no estilo das funções existentes:

```ts
import { readFileSync } from "node:fs";
import { join } from "node:path";

const CONTAS = [
  { clienteBase: "11222333", bancoNome: "Banco Alfa",  compe: "001", agencia: "1201", numero: "45678-9" },
  { clienteBase: "33444555", bancoNome: "Banco Beta",  compe: "341", agencia: "0455", numero: "10293-8" },
  { clienteBase: "44555666", bancoNome: "Banco Gama",  compe: "033", agencia: "3390", numero: "77712-1" },
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

const FIXTURES = [
  { arquivo: "extrato-alfa.pdf", mime: "application/pdf", clienteBase: "11222333", diaChegada: 3 },
  { arquivo: "extrato-beta.pdf", mime: "application/pdf", clienteBase: "33444555", diaChegada: 9 },
  { arquivo: "extrato-gama.pdf", mime: "application/pdf", clienteBase: "44555666", diaChegada: 17 },
  { arquivo: "extrato-foto.jpg", mime: "image/jpeg",     clienteBase: "88999000", diaChegada: 24 },
];

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

    let bytes: Buffer;
    try {
      bytes = readFileSync(join(process.cwd(), "prisma", "fixtures", f.arquivo));
    } catch {
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
```

E em `main()`:

```ts
await seedContasBancarias();
await seedDocumentosEntrada();
```

- [ ] **Step 5: Rodar o seed 2x** — `npx prisma db seed && npx prisma db seed` → sem erro, sem duplicar contas/documentos.

- [ ] **Step 6: `README.md`** — nova subseção sob `## Módulos`:

```markdown
### SC-01 — Conversão de extrato bancário para OFX

Caixa de entrada de documentos (`DocumentoEntrada`, compartilhada com o SC-11). O operador sobe um extrato em **PDF ou foto** (JPG/PNG) para um cliente + conta bancária; o botão **Processar pendentes** (ou o cron mensal `/api/cron/sc-01`, dia 2 às 08:00 UTC) manda cada documento para a **API multimodal da Anthropic** (`claude-opus-5`, sem OCR separado), que devolve os lançamentos `{data, histórico, valor}` com **confiança por linha**.

Linhas com confiança `< 0.85` entram numa **fila de conferência** — com o trecho original ao lado — e precisam ser confirmadas (ou corrigidas) manualmente. **O download do OFX só libera quando não há mais nenhuma linha em conferência.** O arquivo gerado é **OFX 1.0.2 (SGML)**, formato que os softwares contábeis brasileiros importam.

Processamento é **granular por documento**: se um extrato falha (ilegível, IA fora do ar), só ele vira `ERRO`; os outros do lote seguem.

**Precisa de `ANTHROPIC_API_KEY`.** Sem ela, processar um documento o marca como `ERRO` com "IA indisponível" — o resto do portal continua funcionando.

Fronteira mockada: o "sistema contábil" que importaria o OFX não existe — a entrega é o arquivo `.ofx` para download.

Fixtures de demonstração em `prisma/fixtures/` (3 PDFs com leiautes diferentes + 1 foto) são gerados por `npm run fixtures` e carregados pelo seed.
```

- [ ] **Step 7: Suíte + build** — `npm test && npm run build`.

- [ ] **Step 8: Commit**

```bash
git add prisma/fixtures prisma/seed.ts README.md package.json package-lock.json
git commit -m "feat(sc-01): fixtures sinteticos de extrato + seed da caixa de entrada + doc

3 PDFs com leiautes distintos + 1 'foto' (gerados por npm run fixtures,
commitados) provam que a solucao generaliza entre leiautes e entre
formatos de entrada — o argumento central do modulo. Seed carrega os 4
como DocumentoEntrada PENDENTE, com contas bancarias sinteticas por
cliente.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

## Self-Review

**1. Cobertura da spec:**

| Requisito (spec §5.1 / §5.2) | Task |
|---|---|
| `DocumentoEntrada` (tipo, cliente, arquivo, status, data de chegada) | 1 |
| Seed popula entradas com datas ao longo do mês | 11 |
| Cron mensal varre as pendentes em lote | 10 |
| Operador sobe arquivo avulso e roda na hora | 7 (`enviarDocumento`), 10 (botão) |
| Processamento por documento; falha no meio não reprocessa o que deu certo | 5 (`processarDocumento` isolado + `PARCIAL`) |
| Upload de PDF **ou foto** → API multimodal, sem OCR separado | 4 (`document`/`image` block) |
| Linhas `{data, histórico, valor}` com confiança por linha, tolerando leiaute | 4 (prompt + schema), 11 (fixtures com leiautes diferentes) |
| Gera OFX válido para download | 2 (gerador), 8 (rota) |
| `Lancamento` (documentoEntradaId, data, histórico, valor, confiança, status CONFIRMADO\|PENDENTE_REVISAO) | 1 |
| Fila de conferência com o trecho original, confirmação manual antes de "pronto para importar" | 3 (trava), 7 (`confirmarLancamento`), 9 (`LinhaConferencia`) |
| Fronteira mockada: entrega é o OFX para download | 8, README (11) |
| Seed: ≥3 PDFs com leiautes diferentes + 1 foto | 11 |
| Toda execução grava `Execucao` via `executarModulo` | 7, 10 |
| Erro conhecido → mensagem legível, sem stack trace | 4 (mapeamento), 5 (`mensagemDeErro`), 8 (JSON) |
| `ADMIN` vê tudo, `OPERADOR` só do setor (`Contábil`) | 10 (guarda da página), 7/8 (guarda das actions/rota) |
| Catálogo estático, flag `implementado` | 10 Step 5 |
| Teste: gerador de OFX a partir de transações estruturadas | 2 |

Sem lacunas. A "caixa de entrada" fica genérica o suficiente (`tipo: NFSE` já no enum) para o SC-11 plugar depois.

**2. Placeholders:** nenhum "TBD"/"TODO". O único ponto com decisão do implementador é o nome exato de `Anthropic.TextBlock`/`Anthropic.APIError` na versão instalada do SDK (Task 4, nota explícita) e o fallback de fixture se `@napi-rs/canvas` não instalar (Task 11, caminho alternativo completo).

**3. Consistência de tipos:**
- `LinhaExtraida` (Task 4) consumido por Task 5; `ExtratorExtrato` idem.
- `ContaOfx` / `TransacaoOfx` (Task 2) consumidos por Task 6 (`DocumentoDetalhe.conta`) e Task 8 (`gerarOfx`).
- `StatusConferencia` (Task 3) = valores do enum Prisma `StatusLancamento` (Task 1); a ponte é `as StatusConferencia` na leitura (Task 6), padrão idêntico ao do SC-20.
- `DocumentoResumo` / `DocumentoDetalhe` / `LancamentoDetalhe` (Task 6) consumidos por Tasks 9 e 10.
- `executarModulo(codigo, disparadoPor, executar)` e `ResultadoExecucao` — assinatura da fundação, respeitada em 5, 7, 10.
- `cronAutorizado(authHeader, secret)` — de `@/lib/cron-logica` (criado no SC-20), usado só na rota da Task 10.
- Rota `/modulos/sc-01` — `ModuloCard` da fundação linka `/modulos/${codigo.toLowerCase()}` = `/modulos/sc-01`. Bate.
- `valor`: `Decimal` no banco (Task 1) → `number` na fronteira das consultas (Task 6, `Number(l.valor)`) → `number` no gerador de OFX (Task 2). Consistente.
