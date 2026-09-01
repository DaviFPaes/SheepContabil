# SC-20 — Vencimento de Certificado Digital (Etapa 1) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Transformar o SC-20 de painel + cron mensal numa fila de trabalho (Kanban) dos certificados perto do vencimento, com recálculo diário de bucket, avisos in-app, auditoria com aba Histórico + CSV, e cadastro/renovação via modal.

**Architecture:** Substituição limpa do núcleo. Uma migração dropa e recria `AvisoCertificado` + enum `FaixaUrgencia` e faz `ALTER` aditivo com backfill em `Certificado`/`Cliente`. Regra de bucket vira função pura (`bucket.ts`); o motor `recalcularBucturesCertificados` grava `RegistroAuditoria` em transição e `NotificacaoInApp` para usuários elegíveis, idempotente no dia. UI: abas na página, toggle Tabela/Kanban, 3 modais sobre `<dialog>`, sino no cabeçalho do módulo. Envio de e-mail ao cliente é **só interface** nesta etapa.

**Tech Stack:** Next.js 16 (App Router, RSC + Server Actions) + React 19, TypeScript, Prisma 7.10 + `@prisma/adapter-pg` sobre Postgres (Docker local `:5433`, Supabase em prod), Tailwind v4, Zod 4, Vitest 4 + `@testing-library/react`. Vercel Cron via `vercel.json`.

**Spec:** [../specs/2026-09-01-sc-20-vencimento-certificado-etapa-1-design.md](../specs/2026-09-01-sc-20-vencimento-certificado-etapa-1-design.md) — os executores leem o design junto com este plano; as regras de negócio (tabelas de bucket, colunas do Kanban, textos) vivem lá.

## Global Constraints

- **Idioma:** todo texto de UI e mensagem em **PT-BR**. Identificadores e caminhos seguem o repo (PT-BR).
- **Paleta (só estes 7 tokens Tailwind):** `petroleo` primário/marca; `turquesa` ação/sucesso/link; `ambar` atenção/pendência/highlight; `tinta` texto principal; `grafite` texto secundário/borda; `nevoa` superfície/listra; `carmim` **exclusivamente** erro/falha. Fontes: `font-titulo` (Archivo), `font-texto` (IBM Plex Sans), `font-codigo` (IBM Plex Mono).
- **Antes de escrever qualquer componente** (`.tsx` de UI), invocar a skill `frontend-design`.
- Toda execução de módulo passa por `executarModulo(moduloCodigo, disparadoPor, executar)` — nunca gravar `Execucao` direto. `disparadoPor` = e-mail do usuário sob demanda, `"scheduler"` no cron.
- Import do Prisma Client: `@/generated/prisma/client`. Após mexer no schema: `npx prisma migrate dev` regenera o client em `src/generated/prisma`.
- Conexão: runtime usa `DATABASE_URL`; CLI (`migrate`, `db seed`) usa `DIRECT_URL || DATABASE_URL`. Dev: `docker compose up -d db` (Postgres em `localhost:5433`).
- TDD: teste que falha → mínimo pra passar → refatora. `npm test` roda tudo; `npm test -- <arquivo>` filtra.
- Ao fim de **cada task**: `npx tsc --noEmit` sem erro e `npm test` verde.
- Commits pequenos, mensagem explicando o porquê, terminando com `Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>`.
- Catálogo de módulos (`src/lib/modulos-catalogo.ts`): SC-20 já é `implementado: true` — não mexer.
- Sessão: `obterSessao()` → `{ usuarioId, email, nome, papel, setor } | null`. SC-20 é do setor `"Processos"`. "Usuário elegível" a aviso in-app = `papel === "ADMIN"` OU (`papel === "OPERADOR"` E `setor === "Processos"`).
- Datas: cálculo de dias sempre ancorado em UTC (`diasRestantes` já faz). Seed sempre com datas relativas a hoje.

---

## File Structure

```
prisma/
  schema.prisma                              # MODIFY — enums + models (§4 do design)
  migrations/<ts>_sc20_kanban_avisos/         # CREATE — migração editada à mão (backfill)
  seed.ts                                     # MODIFY — patch mínimo (Task 1) e seedSc20() (Task 19)
vercel.json                                   # MODIFY — cron SC-20 diário (Task 5)
package.json                                  # MODIFY — script seed:sc20:reset (Task 19)
src/lib/certificados/
  bucket.ts / bucket.test.ts                  # CREATE (Task 2) — puro
  historico.ts / historico.test.ts            # CREATE (Task 3) — puro
  csv-historico.ts / csv-historico.test.ts    # CREATE (Task 4) — puro
  processar.ts / processar.test.ts            # REWRITE (Task 5) — motor, integração
  consultas.ts / consultas.test.ts            # REWRITE (Task 6) — leitura, integração
  acoes.ts                                    # REWRITE (Task 7) — server actions
  faixa-urgencia.ts / faixa-urgencia.test.ts  # DELETE (Task 18)
  formato.ts                                  # KEEP — formatarDataUTC, dataParaInput (reuso)
src/components/certificados/
  SeloBucket.tsx / SeloBucket.test.tsx        # CREATE (Task 8)
  Modal.tsx / Modal.test.tsx                  # CREATE (Task 9)
  AlternadorVisao.tsx / AlternadorVisao.test.tsx   # CREATE (Task 10)
  CardCertificado.tsx                         # CREATE (Task 11)
  QuadroKanban.tsx / QuadroKanban.test.tsx    # CREATE (Task 11)
  PainelCertificados.tsx                      # MODIFY (Task 12) — colunas Tipo/Titular, abre modal
  ModalCertificado.tsx                        # CREATE (Task 13)
  ModalPerfilCliente.tsx                      # CREATE (Task 14)
  ModalEnvioLote.tsx                          # CREATE (Task 15)
  SinoAvisos.tsx / SinoAvisos.test.tsx        # CREATE (Task 16)
  TimelineHistorico.tsx / TimelineHistorico.test.tsx   # CREATE (Task 17)
  FiltrosHistorico.tsx                        # CREATE (Task 17)
  BotaoAtualizar.tsx                          # RENAME de BotaoRodarAgora.tsx (Task 18)
  BotaoRodarAgora.tsx                         # DELETE (Task 18)
  BadgeFaixa.tsx / BadgeFaixa.test.tsx        # DELETE (Task 18)
  FormularioCertificado.tsx                   # DELETE (Task 13) — substituído por ModalCertificado
  ListaAvisos.tsx / ListaAvisos.test.tsx      # DELETE (Task 18) — sino + histórico substituem
  BotaoRemover.tsx                            # KEEP
src/app/modulos/sc-20/
  page.tsx                                    # REWRITE (Task 18) — abas, toggle, sino, botões
  historico/relatorio/route.ts                # CREATE (Task 18) — CSV
src/app/api/cron/sc-20/route.ts               # MODIFY (Task 5) — contexto de ator "Sistema"
README.md                                     # MODIFY (Task 19) — seção SC-20
```

---

### Task 1: Schema e migração `sc20_kanban_avisos`

**Files:**
- Modify: `prisma/schema.prisma`
- Create: `prisma/migrations/<timestamp>_sc20_kanban_avisos/migration.sql` (gerada, depois editada)
- Modify: `prisma/seed.ts` (patch mínimo para os certificados do seed antigo não quebrarem)

**Interfaces:**
- Consumes: models `Cliente`, `Certificado`, `Usuario`, `AvisoCertificado`, enum `FaixaUrgencia` (estado atual).
- Produces (Prisma Client regenerado): enums `TipoCertificado {ECNPJ ECPF NFE}`, `BucketCertificado {OK D60 D7 D3 VENCIDO RENOVADO}`, `MarcoAviso {D60 D7}`, `StatusAviso {QUEUED SENT DELIVERED BOUNCED FAILED}`, `TipoNotificacao {D60_ENTROU D7_ENTROU D3_ENTROU}`. `Cliente` += `email String`, `ativo Boolean @default(true)`. `Certificado` += `tipo TipoCertificado`, `titular String`, `emitidoEm DateTime`, `ativo Boolean @default(true)`, `observacao String?`, `substituidoPorId String? @unique`, `substituidoPor`/`substituiu` (auto-relação `"Renovacao"`), `renovadoEm DateTime?`, `bucket BucketCertificado @default(OK)`, `atualizadoEm DateTime @updatedAt`. `AvisoCertificado` recriado: `certificadoId`, `clienteId`, `marco MarcoAviso`, `destinatarioEmail String`, `status StatusAviso @default(QUEUED)`, `providerMessageId String?`, `enviadoEm DateTime?`, `criadoEm`, `atualizadoEm`, `@@unique([certificadoId, marco])`, `@@index([clienteId])`. Novos: `NotificacaoInApp` (`usuarioId`, `tipo TipoNotificacao`, `certificadoId`, `clienteId`, `lidaEm DateTime?`, `criadoEm`, `@@index([usuarioId, lidaEm])`, `@@index([usuarioId, tipo, criadoEm])`), `RegistroAuditoria` (`entidade String`, `entidadeId String`, `acao String`, `descricao String`, `autorId String?`, `autorEmail String?`, `clienteId String?`, `dadosAntes Json?`, `dadosDepois Json?`, `criadoEm`, `@@index([criadoEm])`, `@@index([entidade, entidadeId, criadoEm])`, `@@index([clienteId, criadoEm])`). Enum `FaixaUrgencia` **removido**. `Usuario` += `notificacoes`, `registrosAuditoria`.

- [ ] **Step 1: Garantir o Postgres local de pé**

Run: `docker compose up -d db && docker compose exec db pg_isready -U sheep -d sheepcontabil`
Expected: `accepting connections`.

- [ ] **Step 2: Editar `prisma/schema.prisma`** conforme §4 do design (todos os enums e models acima). Remover o enum `FaixaUrgencia` e substituir o corpo do model `AvisoCertificado` pelo novo. Adicionar `NotificacaoInApp` e `RegistroAuditoria` no fim. Adicionar as relações inversas em `Cliente` (`avisos`, `notificacoes`, `registrosAuditoria`) e `Usuario` (`notificacoes`, `registrosAuditoria`).

- [ ] **Step 3: Gerar a migração sem aplicar**

Run: `npx prisma migrate dev --name sc20_kanban_avisos --create-only`
Expected: pasta `prisma/migrations/<ts>_sc20_kanban_avisos/migration.sql` criada.

- [ ] **Step 4: Editar o `migration.sql`** para os campos `NOT NULL` sem default em tabela populada. Padrão para cada um (`Cliente.email`, `Certificado.tipo`, `Certificado.titular`, `Certificado.emitidoEm`):

```sql
-- Cliente.email
ALTER TABLE "Cliente" ADD COLUMN "email" TEXT NOT NULL DEFAULT '';
UPDATE "Cliente" SET "email" =
  regexp_replace(lower("razaoSocial"), '[^a-z0-9]+', '-', 'g') || '@example.com';
ALTER TABLE "Cliente" ALTER COLUMN "email" DROP DEFAULT;

-- Certificado.tipo  (enum já criado acima no arquivo)
ALTER TABLE "Certificado" ADD COLUMN "tipo" "TipoCertificado" NOT NULL DEFAULT 'ECNPJ';
ALTER TABLE "Certificado" ALTER COLUMN "tipo" DROP DEFAULT;

-- Certificado.titular
ALTER TABLE "Certificado" ADD COLUMN "titular" TEXT NOT NULL DEFAULT '';
UPDATE "Certificado" c SET "titular" = cl."razaoSocial"
  FROM "Cliente" cl WHERE cl."id" = c."clienteId";
ALTER TABLE "Certificado" ALTER COLUMN "titular" DROP DEFAULT;

-- Certificado.emitidoEm
ALTER TABLE "Certificado" ADD COLUMN "emitidoEm" TIMESTAMP(3) NOT NULL DEFAULT now();
UPDATE "Certificado" SET "emitidoEm" = "dataValidade" - INTERVAL '1 year';
ALTER TABLE "Certificado" ALTER COLUMN "emitidoEm" DROP DEFAULT;
```

Confirmar que o `DROP TYPE "FaixaUrgencia"` só acontece **depois** do `DROP TABLE`/recriação de `AvisoCertificado` (a coluna `faixa` usava o enum). Se o Prisma gerou `DROP TABLE "AvisoCertificado"` + `CREATE TABLE`, ok; se gerou `ALTER`, trocar por `DROP TABLE "AvisoCertificado" CASCADE;` seguido do `CREATE TABLE` novo.

- [ ] **Step 5: Aplicar a migração**

Run: `npx prisma migrate dev`
Expected: `Your database is now in sync with your schema.` + `Generated Prisma Client`.

- [ ] **Step 6: Patch mínimo no `seed.ts`** — em `seedCertificados`, no `prisma.certificado.create`/`update`, incluir os campos novos obrigatórios com valores simples para o seed antigo continuar rodando até a Task 19:

```ts
// dentro de seedCertificados, no data de create:
data: {
  clienteId: cliente.id,
  dataValidade,
  tipo: "ECNPJ",
  titular: cliente.razaoSocial,
  emitidoEm: new Date(dataValidade.getTime() - 365 * 24 * 60 * 60 * 1000),
},
```

(o `update` do mesmo bloco não precisa dos campos — já foram backfilled.)

- [ ] **Step 7: Verificar tipos e suíte**

Run: `npx tsc --noEmit && npm test`
Expected: sem erro de tipo; testes existentes verdes (os de `faixa-urgencia`/`processar`/`consultas` ainda usam o código antigo — seguem passando porque só o schema mudou e os campos antigos continuam lá).

Nota: se algum teste de integração de `processar`/`consultas` quebrar por causa do `AvisoCertificado` recriado (campos `faixa`/`diasRestantes`/`mensagem` sumiram), **parar e sinalizar** — a ordem esperada é o schema não quebrar esses testes ainda. Caso quebre, mover a reescrita de `processar.test.ts` para esta task não é o plano; em vez disso ajustar o teste antigo para o mínimo (skip explícito com `it.todo`) e anotar. _[risco conhecido: `AvisoCertificado` mudou de forma; ver Step 8]_

- [ ] **Step 8: Se `processar.test.ts` / `consultas.test.ts` quebrarem no build de tipos** (campos removidos de `AvisoCertificado`), aplicar o mínimo: comentar os `expect` que tocam `faixa`/`diasRestantes`/`mensagem` com um `// TODO(Task 5/6): reescrito` e um `it.todo`. Não investir mais — as Tasks 5 e 6 reescrevem esses arquivos inteiros.

- [ ] **Step 9: Commit**

```bash
git add prisma/schema.prisma prisma/migrations prisma/seed.ts src/generated/prisma \
  src/lib/certificados/processar.test.ts src/lib/certificados/consultas.test.ts
git commit -m "feat(sc-20): schema do Kanban — buckets, avisos por marco, notificacoes e auditoria

Substituicao limpa: AvisoCertificado deixa de registrar 'faixa mudou' e
passa a registrar marco de e-mail (com unique certificado+marco); enum
FaixaUrgencia sai, BucketCertificado entra com D3. Cliente ganha email
obrigatorio (backfill @example.com) e ativo; Certificado ganha tipo,
titular, emitidoEm, renovadoEm, substituidoPorId e bucket persistido.
NotificacaoInApp e RegistroAuditoria novos.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 2: `bucket.ts` — regra de bucket (função pura)

**Files:**
- Create: `src/lib/certificados/bucket.ts`
- Test: `src/lib/certificados/bucket.test.ts`

**Interfaces:**
- Consumes: enums do Prisma via `type` import de `@/generated/prisma/client` (`BucketCertificado`, `TipoNotificacao`) — ou reproduzir como union local se preferir isolar (o repo usa union local em `faixa-urgencia.ts`; seguir esse padrão).
- Produces:
  - `type Bucket = "OK" | "D60" | "D7" | "D3" | "VENCIDO" | "RENOVADO"`
  - `type TipoNotificacaoBucket = "D60_ENTROU" | "D7_ENTROU" | "D3_ENTROU"`
  - `diasRestantes(validoAte: Date, hoje?: Date): number` — copiar de `faixa-urgencia.ts` (cálculo UTC).
  - `calcularBucket(dias: number, opcoes: { renovado: boolean }): Bucket`
  - `ORDEM_BUCKETS: Bucket[]` — `["VENCIDO","D3","D7","D60","RENOVADO","OK"]` (mais urgente → menos; ordem usada para comparar "menos urgente").
  - `ROTULO_BUCKET: Record<Bucket, string>` — `{ OK: "Em dia", D60: "60 dias", D7: "7 dias", D3: "3 dias", VENCIDO: "Vencido", RENOVADO: "Renovado" }`.
  - `transicaoGeraNotificacao(de: Bucket | null, para: Bucket): TipoNotificacaoBucket | null`
  - `textoDias(dias: number): string`

- [ ] **Step 1: Escrever `src/lib/certificados/bucket.test.ts`**

```ts
import { describe, expect, it } from "vitest";
import {
  calcularBucket,
  diasRestantes,
  textoDias,
  transicaoGeraNotificacao,
} from "./bucket";

describe("calcularBucket", () => {
  it.each([
    [-1, "VENCIDO"],
    [0, "D3"],
    [3, "D3"],
    [4, "D7"],
    [7, "D7"],
    [8, "D60"],
    [60, "D60"],
    [61, "OK"],
    [400, "OK"],
  ] as const)("dias=%i sem renovacao -> %s", (dias, esperado) => {
    expect(calcularBucket(dias, { renovado: false })).toBe(esperado);
  });

  it("renovado vence qualquer faixa de dias", () => {
    expect(calcularBucket(-100, { renovado: true })).toBe("RENOVADO");
    expect(calcularBucket(5, { renovado: true })).toBe("RENOVADO");
  });
});

describe("transicaoGeraNotificacao", () => {
  it("gera ao entrar em D60 vindo de OK", () => {
    expect(transicaoGeraNotificacao("OK", "D60")).toBe("D60_ENTROU");
  });
  it("gera ao entrar em D7 vindo de D60", () => {
    expect(transicaoGeraNotificacao("D60", "D7")).toBe("D7_ENTROU");
  });
  it("gera ao entrar em D3 vindo de D7", () => {
    expect(transicaoGeraNotificacao("D7", "D3")).toBe("D3_ENTROU");
  });
  it("gera no primeiro cálculo (de = null) quando já está em D7", () => {
    expect(transicaoGeraNotificacao(null, "D7")).toBe("D7_ENTROU");
  });
  it("não gera ao ir para OK, VENCIDO ou RENOVADO", () => {
    expect(transicaoGeraNotificacao("D7", "VENCIDO")).toBeNull();
    expect(transicaoGeraNotificacao("D60", "OK")).toBeNull();
    expect(transicaoGeraNotificacao("D7", "RENOVADO")).toBeNull();
  });
  it("não gera quando o bucket não mudou", () => {
    expect(transicaoGeraNotificacao("D7", "D7")).toBeNull();
  });
  it("não gera ao voltar para faixa menos urgente (D7 -> D60)", () => {
    expect(transicaoGeraNotificacao("D7", "D60")).toBeNull();
  });
});

describe("textoDias", () => {
  it("futuro", () => expect(textoDias(5)).toBe("faltam 5d"));
  it("hoje", () => expect(textoDias(0)).toBe("vence hoje"));
  it("passado", () => expect(textoDias(-2)).toBe("vencido há 2d"));
});

describe("diasRestantes", () => {
  const hoje = new Date("2026-09-01T18:00:00Z");
  it("hoje = 0", () =>
    expect(diasRestantes(new Date("2026-09-01T23:00:00Z"), hoje)).toBe(0));
  it("futuro positivo", () =>
    expect(diasRestantes(new Date("2026-10-01T00:00:00Z"), hoje)).toBe(30));
  it("passado negativo", () =>
    expect(diasRestantes(new Date("2026-08-30T00:00:00Z"), hoje)).toBe(-2));
});
```

- [ ] **Step 2: Rodar e ver falhar** — `npm test -- bucket` → `Cannot find module './bucket'`.

- [ ] **Step 3: Implementar `src/lib/certificados/bucket.ts`** conforme §5 do design. `transicaoGeraNotificacao`: mapear cada bucket a um "nível de urgência" (`OK`=0, `D60`=1, `D7`=2, `D3`=3; `VENCIDO`/`RENOVADO` = não notificam nunca); retorna `${para}_ENTROU` só se `para ∈ {D60,D7,D3}` e (`de === null` ou nível(`para`) > nível(`de`)).

- [ ] **Step 4: Rodar e ver passar** — `npm test -- bucket`.

- [ ] **Step 5: Verificar suíte + tipos** — `npx tsc --noEmit && npm test`.

- [ ] **Step 6: Commit**

```bash
git add src/lib/certificados/bucket.ts src/lib/certificados/bucket.test.ts
git commit -m "feat(sc-20): regra de bucket como funcao pura, com D3 e transicao->notificacao

calcularBucket divide o antigo D7 em D7 (4-7d) e D3 (0-3d).
transicaoGeraNotificacao concentra a regra 'so avisa quem ENTROU numa
faixa mais urgente' — a fonte da idempotencia do motor.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 3: `historico.ts` — descrição legível e diff (função pura)

**Files:**
- Create: `src/lib/certificados/historico.ts`
- Test: `src/lib/certificados/historico.test.ts`

**Interfaces:**
- Consumes: nada do banco.
- Produces:
  - `type AcaoAuditoria = "CRIADO" | "EDITADO" | "DESATIVADO" | "TRANSICAO_BUCKET" | "AVISO_ENVIADO" | "AVISO_BOUNCE" | "RENOVACAO" | "ATUALIZAR_EXECUTADO"`
  - `type LinhaAuditoria = { id: string; acao: AcaoAuditoria; descricao: string; autorEmail: string | null; criadoEm: Date; dadosAntes: Record<string, unknown> | null; dadosDepois: Record<string, unknown> | null }`
  - `rotuloAtor(autorEmail: string | null): string` — `autorEmail ?? "Sistema"`.
  - `camposAlterados(antes, depois): { campo: string; de: unknown; para: unknown }[]` — só as chaves cujo valor mudou; ignora chaves ausentes de um dos lados.
  - `ACENTO_ACAO: Record<AcaoAuditoria, "turquesa" | "ambar" | "carmim">` — `CRIADO`/`RENOVACAO` = turquesa; `EDITADO`/`TRANSICAO_BUCKET`/`ATUALIZAR_EXECUTADO`/`AVISO_ENVIADO` = ambar; `DESATIVADO`/`AVISO_BOUNCE` = carmim.
  - `NATUREZAS: { valor: AcaoAuditoria; rotulo: string }[]` — para o filtro de evento.

- [ ] **Step 1: `historico.test.ts`**

```ts
import { describe, expect, it } from "vitest";
import { camposAlterados, rotuloAtor } from "./historico";

describe("rotuloAtor", () => {
  it("usa o e-mail quando há autor", () =>
    expect(rotuloAtor("ana@x.com")).toBe("ana@x.com"));
  it("usa 'Sistema' quando autor é null", () =>
    expect(rotuloAtor(null)).toBe("Sistema"));
});

describe("camposAlterados", () => {
  it("lista só o que mudou", () => {
    expect(
      camposAlterados(
        { titular: "A", dataValidade: "2026-01-01" },
        { titular: "B", dataValidade: "2026-01-01" },
      ),
    ).toEqual([{ campo: "titular", de: "A", para: "B" }]);
  });
  it("devolve vazio quando nada mudou", () => {
    expect(camposAlterados({ a: 1 }, { a: 1 })).toEqual([]);
  });
  it("tolera null dos dois lados", () => {
    expect(camposAlterados(null, null)).toEqual([]);
  });
});
```

- [ ] **Step 2: Rodar e ver falhar** — `npm test -- historico`.
- [ ] **Step 3: Implementar `historico.ts`.**
- [ ] **Step 4: Rodar e ver passar** — `npm test -- historico`.
- [ ] **Step 5: `npx tsc --noEmit && npm test`.**
- [ ] **Step 6: Commit**

```bash
git add src/lib/certificados/historico.ts src/lib/certificados/historico.test.ts
git commit -m "feat(sc-20): montagem de linha de auditoria e diff de campos (puro)

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 4: `csv-historico.ts` — serialização CSV (função pura)

**Files:**
- Create: `src/lib/certificados/csv-historico.ts`
- Test: `src/lib/certificados/csv-historico.test.ts`

**Interfaces:**
- Consumes: `LinhaAuditoria`, `rotuloAtor` de `./historico`.
- Produces: `gerarCsvHistorico(linhas: LinhaAuditoria[]): string` — cabeçalho `data;hora;ator;evento;descricao`, separador `;` (padrão pt-BR, alinhar com `relatorio-csv.ts` do SC-11 — conferir o separador que ele usa e repetir), campos com `;`/`"`/quebra entre aspas duplas com escape `""`, datas em UTC `dd/MM/yyyy` + `HH:mm`.

- [ ] **Step 1: Ler `src/lib/presuncao/relatorio-csv.ts`** para copiar convenção (separador, aspas, BOM se houver).
- [ ] **Step 2: `csv-historico.test.ts`**

```ts
import { describe, expect, it } from "vitest";
import { gerarCsvHistorico } from "./csv-historico";

const base = {
  id: "1",
  autorEmail: null,
  dadosAntes: null,
  dadosDepois: null,
  criadoEm: new Date("2026-09-01T12:30:00Z"),
};

describe("gerarCsvHistorico", () => {
  it("tem cabeçalho e uma linha por registro", () => {
    const csv = gerarCsvHistorico([
      { ...base, acao: "CRIADO", descricao: "Certificado criado" },
    ]);
    const linhas = csv.trim().split("\n");
    expect(linhas[0]).toBe("data;hora;ator;evento;descricao");
    expect(linhas[1]).toContain("01/09/2026");
    expect(linhas[1]).toContain("Sistema");
    expect(linhas[1]).toContain("CRIADO");
  });

  it("escapa separador e aspas na descrição", () => {
    const csv = gerarCsvHistorico([
      { ...base, acao: "EDITADO", descricao: 'mudou "titular"; e validade' },
    ]);
    expect(csv).toContain('"mudou ""titular""; e validade"');
  });
});
```

- [ ] **Step 3: Rodar e ver falhar** — `npm test -- csv-historico`.
- [ ] **Step 4: Implementar `csv-historico.ts`.**
- [ ] **Step 5: Rodar e ver passar; `npx tsc --noEmit && npm test`.**
- [ ] **Step 6: Commit**

```bash
git add src/lib/certificados/csv-historico.ts src/lib/certificados/csv-historico.test.ts
git commit -m "feat(sc-20): serializacao CSV do historico de auditoria (puro)

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 5: Motor `recalcularBucturesCertificados` + cron diário

**Files:**
- Rewrite: `src/lib/certificados/processar.ts`
- Rewrite: `src/lib/certificados/processar.test.ts`
- Modify: `src/app/api/cron/sc-20/route.ts`
- Modify: `vercel.json`

**Interfaces:**
- Consumes: `prisma`; `ResultadoExecucao` de `@/lib/execucao`; `calcularBucket`, `diasRestantes`, `transicaoGeraNotificacao`, `type Bucket` de `./bucket`.
- Produces:
  - `type ContextoAtor = { autorId: string | null; autorEmail: string | null }`
  - `recalcularBucketsCertificados(hoje?: Date, ator?: ContextoAtor): Promise<ResultadoExecucao>` — default `ator = { autorId: null, autorEmail: null }` (cron = Sistema).
- Comportamento (§6.3 do design): para cada `Certificado` **ativo** (`ativo: true`), recalcula bucket a partir de `diasRestantes(dataValidade, hoje)` e `renovado: substituidoPorId != null`. Se `bucket` gravado ≠ novo → `update` do campo + `RegistroAuditoria` `TRANSICAO_BUCKET` (`entidade: "Certificado"`, `entidadeId`, `clienteId`, `descricao: "Bucket de <razaoSocial> (<ROTULO tipo>): <de> → <para>"`, `dadosAntes: { bucket: de }`, `dadosDepois: { bucket: para }`, `autorId`/`autorEmail` do ator). Se `transicaoGeraNotificacao(de, para)` → para cada usuário elegível, `NotificacaoInApp` **se não existir** uma `(usuarioId, certificadoId, tipo)` com `criadoEm >= início do dia UTC de hoje`. Falha por certificado não aborta (try/catch no laço, conta `falhas`, status `PARCIAL`). No fim: `RegistroAuditoria` `ATUALIZAR_EXECUTADO` (`entidade: "Execucao"`, `entidadeId: ""`, `descricao: "<N> certificados reavaliados, <M> transições"`).

- [ ] **Step 1: Reescrever `processar.test.ts`** (integração, Postgres local). Helpers no padrão do arquivo atual (cliente com CNPJ de teste fixo, `dataDaqui(n)`, cleanup em `afterEach` apagando `registroAuditoria`, `notificacaoInApp`, `avisoCertificado`, `certificado`, `cliente` do CNPJ de teste; e o `usuario` elegível de teste). Casos:

```ts
// 1. transição OK->D60 grava bucket, auditoria e notificação p/ usuário elegível
it("primeiro cálculo de um certificado a 30 dias gera bucket D60, auditoria e notificação", async () => {
  const { cliente } = await cenario();
  const cert = await prisma.certificado.create({
    data: dadosCert(cliente.id, dataDaqui(30)),
  });
  const r = await recalcularBucketsCertificados();
  expect(r.status).toBe("SUCESSO");
  const salvo = await prisma.certificado.findUniqueOrThrow({ where: { id: cert.id } });
  expect(salvo.bucket).toBe("D60");
  const audit = await prisma.registroAuditoria.findMany({
    where: { entidade: "Certificado", entidadeId: cert.id, acao: "TRANSICAO_BUCKET" },
  });
  expect(audit).toHaveLength(1);
  const notifs = await prisma.notificacaoInApp.findMany({ where: { certificadoId: cert.id } });
  expect(notifs.length).toBeGreaterThanOrEqual(1);
  expect(notifs[0].tipo).toBe("D60_ENTROU");
});

// 2. rodar de novo no mesmo dia não duplica notificação nem auditoria
it("segunda execução no mesmo dia é idempotente", async () => {
  const { cliente } = await cenario();
  const cert = await prisma.certificado.create({ data: dadosCert(cliente.id, dataDaqui(30)) });
  await recalcularBucketsCertificados();
  await recalcularBucketsCertificados();
  const notifs = await prisma.notificacaoInApp.count({ where: { certificadoId: cert.id } });
  const audit = await prisma.registroAuditoria.count({
    where: { entidadeId: cert.id, acao: "TRANSICAO_BUCKET" },
  });
  expect(notifs).toBe(await prisma.usuario.count({ where: elegiveis() })); // 1 por usuário
  expect(audit).toBe(1);
});

// 3. transição para VENCIDO grava auditoria mas NÃO gera notificação
it("ir para VENCIDO não gera notificação", async () => {
  const { cliente } = await cenario();
  const cert = await prisma.certificado.create({ data: dadosCert(cliente.id, dataDaqui(-1)) });
  await recalcularBucketsCertificados();
  const salvo = await prisma.certificado.findUniqueOrThrow({ where: { id: cert.id } });
  expect(salvo.bucket).toBe("VENCIDO");
  expect(await prisma.notificacaoInApp.count({ where: { certificadoId: cert.id } })).toBe(0);
});

// 4. certificado inativo é ignorado
it("certificado inativo não é reavaliado", async () => {
  const { cliente } = await cenario();
  const cert = await prisma.certificado.create({
    data: { ...dadosCert(cliente.id, dataDaqui(5)), ativo: false, bucket: "RENOVADO" },
  });
  await recalcularBucketsCertificados();
  const salvo = await prisma.certificado.findUniqueOrThrow({ where: { id: cert.id } });
  expect(salvo.bucket).toBe("RENOVADO");
});

// 5. ATUALIZAR_EXECUTADO sempre no fim
it("grava um RegistroAuditoria ATUALIZAR_EXECUTADO por execução", async () => {
  await cenario();
  const antes = await prisma.registroAuditoria.count({ where: { acao: "ATUALIZAR_EXECUTADO" } });
  await recalcularBucketsCertificados();
  const depois = await prisma.registroAuditoria.count({ where: { acao: "ATUALIZAR_EXECUTADO" } });
  expect(depois).toBe(antes + 1);
});
```

- [ ] **Step 2: Rodar e ver falhar** — `npm test -- processar`.
- [ ] **Step 3: Implementar `processar.ts`.** Query dos elegíveis: `prisma.usuario.findMany({ where: { OR: [{ papel: "ADMIN" }, { AND: [{ papel: "OPERADOR" }, { setor: "Processos" }] }] } })`. Início do dia UTC: `const d = new Date(hoje); d.setUTCHours(0,0,0,0)`.
- [ ] **Step 4: Rodar e ver passar** — `npm test -- processar`.
- [ ] **Step 5: Atualizar `src/app/api/cron/sc-20/route.ts`** — trocar a referência `processarAvisosCertificados` por `recalcularBucketsCertificados`. Manter `executarModulo("SC-20", "scheduler", () => recalcularBucketsCertificados())` (ator default = Sistema). Contrato JSON inalterado.
- [ ] **Step 6: Atualizar `vercel.json`** — a entrada do SC-20 passa de `"schedule": "0 8 1 * *"` para `"schedule": "0 8 * * *"`. Não tocar SC-01/SC-11.
- [ ] **Step 7: `npx tsc --noEmit && npm test`.** (`acoes.ts` ainda chama `processarAvisosCertificados` — se o nome sumiu, adicionar um `export { recalcularBucketsCertificados as processarAvisosCertificados }` temporário OU já ajustar a chamada em `acoes.ts:rodarAgora` para `recalcularBucketsCertificados()` sem contexto; a Task 7 reescreve `acoes.ts` inteiro. Escolher o ajuste de 1 linha em `acoes.ts`.)
- [ ] **Step 8: Commit**

```bash
git add src/lib/certificados/processar.ts src/lib/certificados/processar.test.ts \
  src/app/api/cron/sc-20/route.ts vercel.json src/lib/certificados/acoes.ts
git commit -m "feat(sc-20): motor diario recalcula bucket, audita transicao e avisa in-app

Deixa de criar AvisoCertificado; agora grava o bucket no proprio
Certificado, RegistroAuditoria em cada transicao e NotificacaoInApp por
usuario elegivel — sem duplicar no mesmo dia. Cron passa de mensal para
diario (05:00 America/Sao_Paulo = 08:00 UTC).

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 6: `consultas.ts` — leitura para tabela, Kanban, perfil, histórico e sino

**Files:**
- Rewrite: `src/lib/certificados/consultas.ts`
- Rewrite: `src/lib/certificados/consultas.test.ts`

**Interfaces:**
- Consumes: `prisma`; `calcularBucket`, `diasRestantes`, `type Bucket` de `./bucket`; `type LinhaAuditoria`, `type AcaoAuditoria` de `./historico`.
- Produces:
  - `type CertificadoLinha = { id: string; clienteId: string; razaoSocial: string; titular: string; tipo: "ECNPJ"|"ECPF"|"NFE"; dataValidade: Date; emitidoEm: Date; diasRestantes: number; bucket: Bucket; ativo: boolean; renovadoEm: Date | null; avisoD60: StatusAvisoView | null; avisoD7: StatusAvisoView | null }` onde `StatusAvisoView = { status: "QUEUED"|"SENT"|"DELIVERED"|"BOUNCED"|"FAILED"; enviadoEm: Date | null }`.
  - `listarCertificados(hoje?: Date): Promise<CertificadoLinha[]>` — todos, ordenado por `dataValidade asc`. `bucket` recalculado ao vivo (não confia no campo gravado). `renovado` = `substituidoPorId != null`.
  - `type ColunasKanban = { aAvisar60: CertificadoLinha[]; avisado60: CertificadoLinha[]; aAvisar7: CertificadoLinha[]; avisado7: CertificadoLinha[]; confirmar3: CertificadoLinha[]; vencido: CertificadoLinha[]; renovado: CertificadoLinha[] }`
  - `montarColunasKanban(linhas: CertificadoLinha[], hoje?: Date): ColunasKanban` — **puro** (recebe as linhas já lidas), regras das 7 colunas do §8.2 (coluna 7: `bucket === "RENOVADO"` e `renovadoEm` nos últimos 7 dias). Testar isolado.
  - `contarNaoAvisados(colunas: ColunasKanban): { d60: number; d7: number }` — tamanho de `aAvisar60`/`aAvisar7` (para o botão "Enviar avisos (N)").
  - `obterPerfilCliente(clienteId: string): Promise<{ cliente: { id: string; razaoSocial: string; cnpj: string; email: string; ativo: boolean }; certificados: CertificadoLinha[]; historico: LinhaAuditoria[] } | null>` — histórico = últimas 20 linhas de `RegistroAuditoria` com `clienteId`.
  - `listarHistorico(filtros: { clienteId?: string; acao?: AcaoAuditoria; de?: Date; ate?: Date; pagina?: number; porPagina?: number }): Promise<{ linhas: LinhaAuditoria[]; total: number }>` — ordenado `criadoEm desc`, offset = `(pagina-1)*porPagina`, `porPagina` default 30.
  - `listarNotificacoes(usuarioId: string): Promise<{ id: string; tipo: "D60_ENTROU"|"D7_ENTROU"|"D3_ENTROU"; certificadoId: string; clienteId: string; lidaEm: Date | null; criadoEm: Date }[]>` — só não lidas, `criadoEm desc`.
  - `listarClientesParaSelecao()` — manter como está (id + razaoSocial), + `email`.

- [ ] **Step 1: Reescrever `consultas.test.ts`** — parte pura (`montarColunasKanban`, `contarNaoAvisados`) sem banco; parte integração para `listarCertificados`, `obterPerfilCliente`, `listarHistorico` (paginação + filtro por `acao` e por `clienteId`), `listarNotificacoes` (só não lidas). Exemplos:

```ts
describe("montarColunasKanban (puro)", () => {
  const hoje = new Date("2026-09-01T12:00:00Z");
  const linhaBase = { /* CertificadoLinha mínima */ } as any;

  it("D60 sem avisoD60 vai para 'a avisar 60'", () => {
    const c = montarColunasKanban([{ ...linhaBase, bucket: "D60", avisoD60: null }], hoje);
    expect(c.aAvisar60).toHaveLength(1);
    expect(c.avisado60).toHaveLength(0);
  });
  it("D60 com avisoD60 SENT vai para 'avisado 60'", () => {
    const c = montarColunasKanban(
      [{ ...linhaBase, bucket: "D60", avisoD60: { status: "SENT", enviadoEm: hoje } }],
      hoje,
    );
    expect(c.avisado60).toHaveLength(1);
  });
  it("D60 com avisoD60 BOUNCED continua em 'a avisar 60'", () => {
    const c = montarColunasKanban(
      [{ ...linhaBase, bucket: "D60", avisoD60: { status: "BOUNCED", enviadoEm: hoje } }],
      hoje,
    );
    expect(c.aAvisar60).toHaveLength(1);
  });
  it("RENOVADO com renovadoEm há 3 dias aparece; há 10 dias não", () => {
    const rec = { ...linhaBase, bucket: "RENOVADO" };
    expect(
      montarColunasKanban([{ ...rec, renovadoEm: new Date("2026-08-29T12:00:00Z") }], hoje).renovado,
    ).toHaveLength(1);
    expect(
      montarColunasKanban([{ ...rec, renovadoEm: new Date("2026-08-20T12:00:00Z") }], hoje).renovado,
    ).toHaveLength(0);
  });
});
```

- [ ] **Step 2: Rodar e ver falhar** — `npm test -- consultas`.
- [ ] **Step 3: Implementar `consultas.ts`.** `listarCertificados` faz `include: { cliente: true, avisos: true }`; separa `avisos` em `avisoD60`/`avisoD7` por `marco`.
- [ ] **Step 4: Rodar e ver passar** — `npm test -- consultas`.
- [ ] **Step 5: `npx tsc --noEmit && npm test`.** (Se `page.tsx` quebrar por `listarCertificadosComStatus`/`listarAvisos` terem sumido, adicionar 1 linha temporária de reexport com o nome antigo apontando p/ `listarCertificados`; a Task 18 reescreve `page.tsx`.)
- [ ] **Step 6: Commit**

```bash
git add src/lib/certificados/consultas.ts src/lib/certificados/consultas.test.ts src/lib/certificados/acoes.ts src/app/modulos/sc-20/page.tsx
git commit -m "feat(sc-20): consultas de tabela, Kanban, perfil, historico e sino

montarColunasKanban e contarNaoAvisados sao puros e testados sem banco;
o bucket e recalculado na leitura (nao confia no campo gravado pelo cron).

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 7: `acoes.ts` — server actions

**Files:**
- Rewrite: `src/lib/certificados/acoes.ts`

**Interfaces:**
- Consumes: `prisma`, `obterSessao`, `filtrarModulosVisiveis`, `executarModulo`, `revalidatePath`, `redirect`, `z`; `recalcularBucketsCertificados` de `./processar`; `calcularBucket`, `diasRestantes` de `./bucket`; `obterPerfilCliente` de `./consultas`.
- Produces (todas `"use server"`, todas chamam `exigirAcessoSc20()` primeiro):
  - `type EstadoForm = { erro: string } | { ok: true } | null`
  - `atualizarAgora(): Promise<void>` — `executarModulo("SC-20", sessao.email, () => recalcularBucketsCertificados(new Date(), { autorId: sessao.usuarioId, autorEmail: sessao.email }))` + `revalidatePath("/modulos/sc-20")`.
  - `criarCertificado(_prev: EstadoForm, form: FormData): Promise<EstadoForm>` — campos `clienteId, tipo, titular, emitidoEm, dataValidade, observacao?, ehRenovacao?("on"), certificadoAnteriorId?`. Valida `dataValidade > emitidoEm`. Cria; se `ehRenovacao` → no anterior grava `substituidoPorId = novo.id`, `renovadoEm = now()`, `ativo = false`, e `RegistroAuditoria` `RENOVACAO` + `DESATIVADO`. Recalcula e grava `bucket` do(s) certificado(s). `RegistroAuditoria` `CRIADO`. Retorna `{ ok: true }` (o modal fecha no client).
  - `editarCertificado(_prev, form): Promise<EstadoForm>` — lê `id`; carrega estado anterior; aplica; `RegistroAuditoria` `EDITADO` com `dadosAntes`/`dadosDepois` só dos campos do form.
  - `desativarCertificado(form: FormData): Promise<void>` — lê `id`; `ativo = false`; `RegistroAuditoria` `DESATIVADO`; `revalidatePath`. (Substitui o antigo `removerCertificado`; manter também `removerCertificado` deletando de fato? **Não** — desativar é o caminho; a Task 12 troca o botão.)
  - `marcarGrupoLido(tipo: "D60_ENTROU"|"D7_ENTROU"|"D3_ENTROU", diaISO: string): Promise<void>` — `updateMany` em `NotificacaoInApp` do `usuarioId` da sessão, `tipo`, `criadoEm` no intervalo `[diaISO 00:00, +24h)`, `lidaEm: null` → `lidaEm: now()`. `revalidatePath`.
  - `obterPerfilCliente(clienteId: string)` — reexporta a consulta como server action (valida acesso + `z.string().min(1)`).
- `esquema*` com Zod: `emitidoEm`/`dataValidade` no padrão do `acoes.ts` atual (`z.string().min(1).pipe(z.coerce.date())`).

- [ ] **Step 1: Implementar `acoes.ts`.** (Sem teste dedicado — as actions são cascas finas sobre Prisma + `recalcular`/`obterPerfilCliente` já cobertos. O fluxo de renovação é coberto de ponta a ponta pelo teste de componente da Task 13 + verificação manual na Task 18.)
- [ ] **Step 2: `npx tsc --noEmit && npm test`.**
- [ ] **Step 3: Commit**

```bash
git add src/lib/certificados/acoes.ts
git commit -m "feat(sc-20): server actions de atualizar, criar/editar/renovar/desativar e marcar aviso lido

Renovacao num passo: cria o novo certificado, vincula substituidoPorId,
desativa o antigo e audita as duas pontas. marcarGrupoLido zera o grupo
(tipo+dia) do proprio usuario.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 8: `SeloBucket` (componente)

**Files:**
- Create: `src/components/certificados/SeloBucket.tsx`
- Test: `src/components/certificados/SeloBucket.test.tsx`

**Interfaces:**
- Consumes: `type Bucket`, `ROTULO_BUCKET` de `@/lib/certificados/bucket`.
- Produces: `<SeloBucket bucket={Bucket} />` — pílula com `ROTULO_BUCKET[bucket]` e classe por bucket (VENCIDO/D3 = `carmim`; D7 = `ambar`; D60 = `turquesa`; RENOVADO = `grafite`; OK = `grafite/40`). Segue o visual de `BadgeFaixa.tsx` (que será removido na Task 18).

- [ ] **Step 0: invocar a skill `frontend-design`.**
- [ ] **Step 1: `SeloBucket.test.tsx`**

```tsx
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { SeloBucket } from "./SeloBucket";

describe("SeloBucket", () => {
  it("mostra o rótulo do bucket", () => {
    render(<SeloBucket bucket="D7" />);
    expect(screen.getByText("7 dias")).toBeInTheDocument();
  });
  it("usa tom de erro para VENCIDO", () => {
    const { container } = render(<SeloBucket bucket="VENCIDO" />);
    expect(container.firstChild).toHaveClass(/carmim/);
  });
});
```

- [ ] **Step 2–5: falhar → implementar → passar → `npx tsc --noEmit && npm test`.**
- [ ] **Step 6: Commit**

```bash
git add src/components/certificados/SeloBucket.tsx src/components/certificados/SeloBucket.test.tsx
git commit -m "feat(sc-20): SeloBucket — pilula de faixa com 6 valores

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 9: `Modal` genérico sobre `<dialog>`

**Files:**
- Create: `src/components/certificados/Modal.tsx`
- Test: `src/components/certificados/Modal.test.tsx`

**Interfaces:**
- Produces: `"use client"` `<Modal aberto={boolean} aoFechar={() => void} titulo={string} children />` — usa `useRef<HTMLDialogElement>`; `aberto` → `showModal()` / `close()`; fecha no `Esc` (evento `cancel`), no clique no `::backdrop` (comparar `event.target === dialogRef.current`), e num botão **X** no cabeçalho. Trava scroll do body enquanto aberto. Overlay/painel nos tokens (`bg-tinta/50` backdrop via `dialog::backdrop`, painel `bg-white`/`bg-nevoa`, borda `grafite/30`).

- [ ] **Step 0: skill `frontend-design`.**
- [ ] **Step 1: `Modal.test.tsx`** (jsdom implementa `HTMLDialogElement` parcialmente — se `showModal` não existir no jsdom desta versão, testar o contrato observável: quando `aberto` é `false` o conteúdo não aparece; clicar no X chama `aoFechar`).

```tsx
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event"; // se não houver, usar fireEvent
import { describe, expect, it, vi } from "vitest";
import { Modal } from "./Modal";

describe("Modal", () => {
  it("não renderiza conteúdo quando fechado", () => {
    render(<Modal aberto={false} aoFechar={() => {}} titulo="T"><p>corpo</p></Modal>);
    expect(screen.queryByText("corpo")).not.toBeInTheDocument();
  });
  it("chama aoFechar ao clicar no X", async () => {
    const aoFechar = vi.fn();
    render(<Modal aberto aoFechar={aoFechar} titulo="T"><p>corpo</p></Modal>);
    screen.getByRole("button", { name: /fechar/i }).click();
    expect(aoFechar).toHaveBeenCalled();
  });
});
```

- [ ] **Step 2–5: falhar → implementar → passar → suíte.** Se o jsdom não suportar `<dialog>`, o componente renderiza `children` só quando `aberto` (guard `if (!aberto) return null` além do `dialog`) — cobre o teste e o comportamento real.
- [ ] **Step 6: Commit**

```bash
git add src/components/certificados/Modal.tsx src/components/certificados/Modal.test.tsx
git commit -m "feat(sc-20): Modal generico sobre <dialog> (Esc, clique fora, X)

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 10: `AlternadorVisao` (toggle Tabela/Kanban)

**Files:**
- Create: `src/components/certificados/AlternadorVisao.tsx`
- Test: `src/components/certificados/AlternadorVisao.test.tsx`

**Interfaces:**
- Produces: `"use client"` `<AlternadorVisao valorInicial={"tabela"|"kanban"} aoMudar={(v) => void} />` — controle segmentado (2 botões). No mount: lê `localStorage["sc20:visao"]`; se a prop `valorInicial` veio de `?visao` na URL, ela vence e é escrita no `localStorage`. Ao clicar: `setState`, `localStorage.setItem`, `aoMudar(v)`. `aria-pressed` no botão ativo, cor ativa `petroleo`/`turquesa`.
- A página (Task 18) controla o que renderيzar (tabela vs `QuadroKanban`) a partir do `aoMudar` (estado client no wrapper) — `AlternadorVisao` não renderiza os painéis.

- [ ] **Step 0: skill `frontend-design`.**
- [ ] **Step 1: `AlternadorVisao.test.tsx`**

```tsx
import { render, screen, fireEvent } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AlternadorVisao } from "./AlternadorVisao";

beforeEach(() => localStorage.clear());

describe("AlternadorVisao", () => {
  it("marca a visão inicial como ativa", () => {
    render(<AlternadorVisao valorInicial="kanban" aoMudar={() => {}} />);
    expect(screen.getByRole("button", { name: /kanban/i })).toHaveAttribute("aria-pressed", "true");
  });
  it("persiste a escolha no localStorage e avisa via aoMudar", () => {
    const aoMudar = vi.fn();
    render(<AlternadorVisao valorInicial="tabela" aoMudar={aoMudar} />);
    fireEvent.click(screen.getByRole("button", { name: /kanban/i }));
    expect(localStorage.getItem("sc20:visao")).toBe("kanban");
    expect(aoMudar).toHaveBeenCalledWith("kanban");
  });
});
```

- [ ] **Step 2–5: falhar → implementar → passar → suíte.**
- [ ] **Step 6: Commit**

```bash
git add src/components/certificados/AlternadorVisao.tsx src/components/certificados/AlternadorVisao.test.tsx
git commit -m "feat(sc-20): AlternadorVisao — toggle Tabela/Kanban com preferencia no localStorage

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 11: `CardCertificado` + `QuadroKanban`

**Files:**
- Create: `src/components/certificados/CardCertificado.tsx`
- Create: `src/components/certificados/QuadroKanban.tsx`
- Test: `src/components/certificados/QuadroKanban.test.tsx`

**Interfaces:**
- Consumes: `type CertificadoLinha`, `type ColunasKanban` de `@/lib/certificados/consultas`; `textoDias` de `@/lib/certificados/bucket`; `SeloBucket`; `formatarDataUTC` de `@/lib/certificados/formato`.
- Produces:
  - `<CardCertificado linha={CertificadoLinha} aoAbrir={(clienteId) => void} />` — razão social (`font-titulo`), tipo + `titular`, `dataValidade` (`font-codigo`), `textoDias(diasRestantes)`, selo de aviso (`Avisado há Xd` a partir de `avisoD60/D7.enviadoEm` conforme o bucket; senão `Aguardando`), ícone de bounce (`carmim`) se o aviso do marco vigente está `BOUNCED`/`FAILED`. Card inteiro é `<button>` → `aoAbrir(linha.clienteId)`.
  - `<QuadroKanban colunas={ColunasKanban} contagem={{d60:number; d7:number}} aoAbrirCliente={(id)=>void} aoEnviarLote={(marco: "D60"|"D7")=>void} focoInicial={"D60"|"D7"|"D3"|null} />` — 7 colunas na ordem do §8.2, header com título + contador (`font-titulo`), listra de urgência no topo; colunas 1 e 3 com botão "Enviar avisos (N)" (desabilitado + "Nada a enviar" se N=0) → `aoEnviarLote`. `focoInicial` → `scrollIntoView` + highlight `ambar` temporário (2s) via `useEffect`.

- [ ] **Step 0: skill `frontend-design`.**
- [ ] **Step 1: `QuadroKanban.test.tsx`**

```tsx
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { QuadroKanban } from "./QuadroKanban";

const vazio = {
  aAvisar60: [], avisado60: [], aAvisar7: [], avisado7: [],
  confirmar3: [], vencido: [], renovado: [],
};
const linha = (over = {}) => ({
  id: "c1", clienteId: "cl1", razaoSocial: "Alfa Ltda", titular: "Alfa Ltda",
  tipo: "ECNPJ", dataValidade: new Date("2026-09-20T00:00:00Z"),
  emitidoEm: new Date("2025-09-20T00:00:00Z"), diasRestantes: 19, bucket: "D60",
  ativo: true, renovadoEm: null, avisoD60: null, avisoD7: null, ...over,
});

describe("QuadroKanban", () => {
  it("mostra o contador no header da coluna", () => {
    render(
      <QuadroKanban
        colunas={{ ...vazio, aAvisar60: [linha()] }}
        contagem={{ d60: 1, d7: 0 }}
        aoAbrirCliente={() => {}} aoEnviarLote={() => {}} focoInicial={null}
      />,
    );
    expect(screen.getByText("Alfa Ltda")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /enviar avisos \(1\)/i })).toBeEnabled();
  });
  it("desabilita o botão de lote quando a coluna está vazia", () => {
    render(
      <QuadroKanban colunas={vazio} contagem={{ d60: 0, d7: 0 }}
        aoAbrirCliente={() => {}} aoEnviarLote={() => {}} focoInicial={null} />,
    );
    expect(screen.getByRole("button", { name: /nada a enviar/i })).toBeDisabled();
  });
  it("clicar num card chama aoAbrirCliente com o clienteId", () => {
    const aoAbrir = vi.fn();
    render(
      <QuadroKanban colunas={{ ...vazio, vencido: [linha({ bucket: "VENCIDO", diasRestantes: -1 })] }}
        contagem={{ d60: 0, d7: 0 }} aoAbrirCliente={aoAbrir} aoEnviarLote={() => {}} focoInicial={null} />,
    );
    screen.getByRole("button", { name: /Alfa Ltda/ }).click();
    expect(aoAbrir).toHaveBeenCalledWith("cl1");
  });
});
```

- [ ] **Step 2–5: falhar → implementar os dois → passar → suíte.**
- [ ] **Step 6: Commit**

```bash
git add src/components/certificados/CardCertificado.tsx src/components/certificados/QuadroKanban.tsx src/components/certificados/QuadroKanban.test.tsx
git commit -m "feat(sc-20): QuadroKanban de 7 colunas derivadas + CardCertificado

Colunas sao posicao, nao estado: o card cai na coluna pelos dados. Botao
de lote desabilitado com 'Nada a enviar' quando a coluna esta vazia.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 12: `PainelCertificados` — colunas novas e abrir modal

**Files:**
- Modify: `src/components/certificados/PainelCertificados.tsx`

**Interfaces:**
- Consumes: `type CertificadoLinha` de `@/lib/certificados/consultas` (troca do antigo `CertificadoComStatus`); `SeloBucket` (troca de `BadgeFaixa`); `textoDias` de `bucket`.
- Produces: `<PainelCertificados certificados={CertificadoLinha[]} aoEditar={(id)=>void} aoAbrirCliente={(clienteId)=>void} />` — vira `"use client"` (precisa dos callbacks). Colunas: Cliente, **Titular**, **Tipo**, Validade, Situação (`textoDias`), Bucket (`SeloBucket`), Ações (Editar → `aoEditar(id)`; Desativar → `<BotaoRemover>` adaptado para chamar `desativarCertificado`). Linha do cliente clicável → `aoAbrirCliente`.

- [ ] **Step 0: skill `frontend-design`.**
- [ ] **Step 1: Atualizar o componente** (sem teste dedicado novo — render coberto pela página; `BotaoRemover` já existe). Ajustar `BotaoRemover` para `action={desativarCertificado}` e label "Desativar".
- [ ] **Step 2: `npx tsc --noEmit && npm test`.**
- [ ] **Step 3: Commit**

```bash
git add src/components/certificados/PainelCertificados.tsx src/components/certificados/BotaoRemover.tsx
git commit -m "feat(sc-20): tabela ganha Titular/Tipo, selo de bucket e abre modais

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 13: `ModalCertificado` (novo / editar / renovação)

**Files:**
- Create: `src/components/certificados/ModalCertificado.tsx`
- Test: `src/components/certificados/ModalCertificado.test.tsx`
- Delete: `src/components/certificados/FormularioCertificado.tsx`

**Interfaces:**
- Consumes: `Modal`; `criarCertificado`, `editarCertificado`, `type EstadoForm` de `@/lib/certificados/acoes`; `useActionState`.
- Produces: `"use client"` `<ModalCertificado aberto={boolean} aoFechar={()=>void} clientes={{id;razaoSocial}[]} certificadosPorCliente={Record<string, {id;titular;dataValidade}[]>} certificado={CertificadoLinha | null} />`. `certificado` null = criar; senão editar (campos preenchidos, `id` hidden). Campos do §8.3. `<input list>` + `<datalist>` para cliente. Checkbox "É renovação de um certificado existente" → mostra `<select name="certificadoAnteriorId">` populado de `certificadosPorCliente[clienteIdSelecionado]`. Aviso não-bloqueante (texto `ambar`) se `dataValidade` escolhida ≤ 60 dias de hoje. Em `{ ok: true }` → `aoFechar()`. Erro → texto `carmim`.

- [ ] **Step 0: skill `frontend-design`.**
- [ ] **Step 1: `ModalCertificado.test.tsx`** — foco no comportamento client (não na server action):

```tsx
// - render em modo "novo": campos vazios, sem select de renovação
// - marcar o checkbox de renovação revela o <select> de certificado anterior
// - escolher dataValidade a 20 dias mostra o aviso não-bloqueante em âmbar
// - modo "editar": recebe certificado e preenche titular/tipo/datas
```

(usar `fireEvent`/`userEvent`; mockar as actions com `vi.mock("@/lib/certificados/acoes")` devolvendo `{ ok: true }`.)

- [ ] **Step 2–5: falhar → implementar → passar → suíte.**
- [ ] **Step 6: Remover `FormularioCertificado.tsx`** e conferir que nada mais o importa (`grep`). `npx tsc --noEmit && npm test`.
- [ ] **Step 7: Commit**

```bash
git add src/components/certificados/ModalCertificado.tsx src/components/certificados/ModalCertificado.test.tsx
git rm src/components/certificados/FormularioCertificado.tsx
git commit -m "feat(sc-20): ModalCertificado cobre novo, editar e renovacao num passo

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 14: `ModalPerfilCliente`

**Files:**
- Create: `src/components/certificados/ModalPerfilCliente.tsx`

**Interfaces:**
- Consumes: `Modal`; `obterPerfilCliente` de `@/lib/certificados/acoes`; `SeloBucket`; `TimelineHistorico` (Task 17 — se esta task rodar antes, renderizar o histórico inline simples e trocar por `TimelineHistorico` na Task 17; **ordem recomendada: 17 antes de 14** — ajustar numeração na execução se necessário); `textoDias`.
- Produces: `"use client"` `<ModalPerfilCliente clienteId={string | null} aoFechar={()=>void} />`. `useEffect` em `clienteId`: quando muda para não-nulo, chama `obterPerfilCliente`, guarda em estado (`carregando` / `dados` / `erro`). Mostra dados do cliente (razão social, CNPJ, e-mail, `ativo`), lista de certificados com `SeloBucket` + `textoDias`, e as últimas linhas de histórico com link "ver tudo" → `/modulos/sc-20?aba=historico&cliente=<id>`. Fecha via `Modal`.

- [ ] **Step 0: skill `frontend-design`.**
- [ ] **Step 1: Implementar** (sem teste dedicado — é orquestração de estado sobre `obterPerfilCliente`, já coberto na Task 6; a Task 18 valida no app).
- [ ] **Step 2: `npx tsc --noEmit && npm test`.**
- [ ] **Step 3: Commit**

```bash
git add src/components/certificados/ModalPerfilCliente.tsx
git commit -m "feat(sc-20): ModalPerfilCliente — perfil + certificados + historico sem trocar de aba

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 15: `ModalEnvioLote` (visual)

**Files:**
- Create: `src/components/certificados/ModalEnvioLote.tsx`
- Test: `src/components/certificados/ModalEnvioLote.test.tsx`

**Interfaces:**
- Consumes: `Modal`.
- Produces: `"use client"` `<ModalEnvioLote aberto={boolean} aoFechar={()=>void} marco={"D60"|"D7"|null} destinatarios={{clienteId;razaoSocial;email}[]} />`. Lista `razaoSocial — email` com checkbox por linha (todos marcados), contador "X de N selecionados", botão "Confirmar envio". Confirmar → `alert`/toast simples "Envio de e-mail ainda não disponível nesta etapa." + `aoFechar()`. **Nada de server action.** Comentário `// ETAPA 2: aqui entra o EnviadorEmail (fila real + status + webhook de bounce).`

- [ ] **Step 0: skill `frontend-design`.**
- [ ] **Step 1: `ModalEnvioLote.test.tsx`**

```tsx
// - lista N destinatários, todos os checkboxes marcados por padrão
// - desmarcar um atualiza o contador "X de N selecionados"
// - "Confirmar envio" chama aoFechar e NÃO dispara nenhuma action (spy em window.alert)
```

- [ ] **Step 2–5: falhar → implementar → passar → suíte.**
- [ ] **Step 6: Commit**

```bash
git add src/components/certificados/ModalEnvioLote.tsx src/components/certificados/ModalEnvioLote.test.tsx
git commit -m "feat(sc-20): ModalEnvioLote — interface do envio em lote (sem logica nesta etapa)

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 16: `SinoAvisos`

**Files:**
- Create: `src/components/certificados/SinoAvisos.tsx`
- Test: `src/components/certificados/SinoAvisos.test.tsx`

**Interfaces:**
- Consumes: `marcarGrupoLido` de `@/lib/certificados/acoes`; `useRouter` de `next/navigation`.
- Produces: `"use client"` `<SinoAvisos notificacoes={{id;tipo;certificadoId;clienteId;lidaEm;criadoEm}[]} />`. Badge = contagem total (todas já vêm não lidas da consulta). Ao abrir: agrupa por `(tipo, dia UTC)`; cada grupo vira uma frase (`D60_ENTROU` → "N certificados entraram na faixa de 60 dias"; `D7_ENTROU` → "…7 dias"; `D3_ENTROU` → "N clientes para confirmar se fizeram a renovação"), ordenada por dia desc. Clique no grupo → `marcarGrupoLido(tipo, diaISO)` e `router.push('/modulos/sc-20?aba=certificados&visao=kanban&foco=' + mapaFoco[tipo])` (`D60_ENTROU`→`D60`, etc.). Grupo não lido com ponto `ambar`.
- Produces helper puro exportado para teste: `agruparNotificacoes(notifs): { tipo; diaISO; quantidade; frase }[]`.

- [ ] **Step 0: skill `frontend-design`.**
- [ ] **Step 1: `SinoAvisos.test.tsx`**

```tsx
import { describe, expect, it } from "vitest";
import { agruparNotificacoes } from "./SinoAvisos";

describe("agruparNotificacoes", () => {
  const d = (iso: string) => new Date(iso);
  it("agrupa por tipo + dia e monta a frase no plural certo", () => {
    const g = agruparNotificacoes([
      { id: "1", tipo: "D60_ENTROU", certificadoId: "a", clienteId: "x", lidaEm: null, criadoEm: d("2026-09-01T05:00:00Z") },
      { id: "2", tipo: "D60_ENTROU", certificadoId: "b", clienteId: "y", lidaEm: null, criadoEm: d("2026-09-01T05:00:00Z") },
      { id: "3", tipo: "D7_ENTROU",  certificadoId: "c", clienteId: "z", lidaEm: null, criadoEm: d("2026-09-01T05:00:00Z") },
    ]);
    expect(g).toHaveLength(2);
    const d60 = g.find((x) => x.tipo === "D60_ENTROU")!;
    expect(d60.quantidade).toBe(2);
    expect(d60.frase).toBe("2 certificados entraram na faixa de 60 dias");
    const d7 = g.find((x) => x.tipo === "D7_ENTROU")!;
    expect(d7.frase).toBe("1 certificado entrou na faixa de 7 dias");
  });
});
```

- [ ] **Step 2–5: falhar → implementar → passar → suíte.**
- [ ] **Step 6: Commit**

```bash
git add src/components/certificados/SinoAvisos.tsx src/components/certificados/SinoAvisos.test.tsx
git commit -m "feat(sc-20): SinoAvisos — agrupa por tipo+dia e leva ao Kanban marcando lido

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 17: `TimelineHistorico` + `FiltrosHistorico`

**Files:**
- Create: `src/components/certificados/TimelineHistorico.tsx`
- Create: `src/components/certificados/FiltrosHistorico.tsx`
- Test: `src/components/certificados/TimelineHistorico.test.tsx`

**Interfaces:**
- Consumes: `type LinhaAuditoria`, `rotuloAtor`, `camposAlterados`, `ACENTO_ACAO`, `NATUREZAS` de `@/lib/certificados/historico`; `formatarDataUTC` de `@/lib/certificados/formato`.
- Produces:
  - `<TimelineHistorico linhas={LinhaAuditoria[]} />` — lista; cada item: data+hora UTC (`font-codigo`), `rotuloAtor` (mostra "Sistema" quando `autorEmail` null), `descricao`, e se `camposAlterados(dadosAntes, dadosDepois)` não vazio, um bloco `campo: de → para`. Filete lateral `border-l-<ACENTO_ACAO[acao]>`. Estado vazio com frase de caráter.
  - `<FiltrosHistorico clientes={{id;razaoSocial}[]} valores={{cliente?;evento?;de?;ate?}} />` — `<form method="get">` (server-driven); selects/inputs com `defaultValue` de `valores`; botão "Filtrar" e link "Limpar". Inclui `<a>` "Baixar CSV" apontando para `/modulos/sc-20/historico/relatorio?<mesmos params>`.

- [ ] **Step 0: skill `frontend-design`.**
- [ ] **Step 1: `TimelineHistorico.test.tsx`**

```tsx
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { TimelineHistorico } from "./TimelineHistorico";

const base = { id: "1", criadoEm: new Date("2026-09-01T12:00:00Z") };

describe("TimelineHistorico", () => {
  it("mostra 'Sistema' quando não há autor e um diff quando há mudança", () => {
    render(
      <TimelineHistorico linhas={[{
        ...base, acao: "TRANSICAO_BUCKET", autorEmail: null,
        descricao: "Bucket de Alfa: D60 → D7",
        dadosAntes: { bucket: "D60" }, dadosDepois: { bucket: "D7" },
      }]} />,
    );
    expect(screen.getByText("Sistema")).toBeInTheDocument();
    expect(screen.getByText(/bucket/i)).toBeInTheDocument();
    expect(screen.getByText(/D60/)).toBeInTheDocument();
    expect(screen.getByText(/D7/)).toBeInTheDocument();
  });
  it("mostra o e-mail do autor quando existe", () => {
    render(<TimelineHistorico linhas={[{
      ...base, acao: "EDITADO", autorEmail: "ana@x.com", descricao: "editou",
      dadosAntes: null, dadosDepois: null,
    }]} />);
    expect(screen.getByText("ana@x.com")).toBeInTheDocument();
  });
  it("estado vazio", () => {
    render(<TimelineHistorico linhas={[]} />);
    expect(screen.getByText(/nada registrado ainda/i)).toBeInTheDocument();
  });
});
```

- [ ] **Step 2–5: falhar → implementar os dois → passar → suíte.**
- [ ] **Step 6: Commit**

```bash
git add src/components/certificados/TimelineHistorico.tsx src/components/certificados/FiltrosHistorico.tsx src/components/certificados/TimelineHistorico.test.tsx
git commit -m "feat(sc-20): TimelineHistorico com diff e ator, FiltrosHistorico com link de CSV

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 18: Página `/modulos/sc-20` (abas, toggle, sino, botões) + rota CSV + limpeza

**Files:**
- Rewrite: `src/app/modulos/sc-20/page.tsx`
- Create: `src/app/modulos/sc-20/historico/relatorio/route.ts`
- Rename: `src/components/certificados/BotaoRodarAgora.tsx` → `BotaoAtualizar.tsx`
- Delete: `src/components/certificados/BadgeFaixa.tsx` (+ test), `src/components/certificados/ListaAvisos.tsx` (+ test), `src/lib/certificados/faixa-urgencia.ts` (+ test)
- Create: `src/components/certificados/PainelSc20.tsx` (wrapper client que troca tabela↔Kanban e hospeda os modais)

**Interfaces:**
- `page.tsx` (server): lê `searchParams` `{ aba?, visao?, foco?, cliente?, evento?, de?, ate?, pagina? }`. Sessão + guarda de acesso (padrão atual). Carrega em paralelo: `listarHistorico("SC-20")` (execuções — do `ModuloPageLayout`), `listarCertificados()`, `listarClientesParaSelecao()`, `listarNotificacoes(sessao.usuarioId)`. Se `aba === "historico"`: também `listarHistorico(filtros)` (auditoria). Monta `montarColunasKanban` no server e passa as `colunas` + `contarNaoAvisados` para o `PainelSc20`.
- `BotaoAtualizar.tsx`: igual ao `BotaoRodarAgora`, texto **"Atualizar"**, `disabled` enquanto `pending` (`useFormStatus`). `action={atualizarAgora}` no `<form>` da página.
- `PainelSc20.tsx` (`"use client"`): recebe `visaoInicial`, `certificados`, `colunas`, `contagem`, `clientes`, `certificadosPorCliente`, `focoInicial`. Estado: `visao`, `modalCertificado` (`null | "novo" | CertificadoLinha`), `perfilClienteId`, `envioLote` (`null | "D60" | "D7"`). Renderiza `AlternadorVisao` + (`PainelCertificados` | `QuadroKanban`) + os 3 modais. `+ Novo certificado` (botão no header via prop `slotAcaoNovo` ou dentro do próprio painel).
- `route.ts` (CSV): valida acesso; lê os mesmos filtros; `listarHistorico({ ...filtros, porPagina: 100000, pagina: 1 })`; `gerarCsvHistorico(linhas)`; devolve `new Response(csv, { headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": 'attachment; filename="historico-sc20.csv"' } })`. Padrão do `src/app/modulos/sc-11/nota/[documentoId]/relatorio/route.ts` (conferir e espelhar).

- [ ] **Step 0: skill `frontend-design`** (a página é a composição — vale revisitar hierarquia, respiro entre abas, header com sino + 2 botões).
- [ ] **Step 1: Renomear `BotaoRodarAgora.tsx` → `BotaoAtualizar.tsx`**, trocar componente/label/`disabled`. `grep` por `BotaoRodarAgora` e `rodarAgora` — ajustar imports.
- [ ] **Step 2: Criar `PainelSc20.tsx`.**
- [ ] **Step 3: Reescrever `page.tsx`** com as abas (links `?aba=`), o header (`ModuloPageLayout` `acoes` = `<form action={atualizarAgora}><BotaoAtualizar/></form>` + `+ Novo certificado` + `<SinoAvisos/>`), `conteudo` = `aba === "historico" ? <FiltrosHistorico/> + <TimelineHistorico/> + paginação : <PainelSc20/>`.
- [ ] **Step 4: Criar `historico/relatorio/route.ts`.**
- [ ] **Step 5: Deletar** `BadgeFaixa.tsx`(+test), `ListaAvisos.tsx`(+test), `faixa-urgencia.ts`(+test). `grep -r "faixa-urgencia\|BadgeFaixa\|ListaAvisos\|CertificadoComStatus\|AvisoComCliente"` → zero fora de históricos/pl-anos.
- [ ] **Step 6: `npx tsc --noEmit && npm test`** — tudo verde.
- [ ] **Step 7: Subir o app e conferir à mão** — `npm run dev`, logar como `operador.processos@sheepcontabil.com.br` / `OperadorSheep#2026`, abrir `/modulos/sc-20`: alternar Tabela/Kanban (recarregar mantém), abrir "+ Novo certificado" com renovação, clicar num card (perfil), aba Histórico + filtro + "Baixar CSV", clicar "Atualizar", abrir o sino. `[verificação manual — anotar o que quebrar]`
- [ ] **Step 8: Commit**

```bash
git add src/app/modulos/sc-20 src/components/certificados
git rm src/components/certificados/BadgeFaixa.tsx src/components/certificados/BadgeFaixa.test.tsx \
  src/components/certificados/ListaAvisos.tsx src/components/certificados/ListaAvisos.test.tsx \
  src/lib/certificados/faixa-urgencia.ts src/lib/certificados/faixa-urgencia.test.ts \
  src/components/certificados/BotaoRodarAgora.tsx
git commit -m "feat(sc-20): pagina com abas Certificados/Historico, toggle, sino e modais

Botao 'Rodar agora' -> 'Atualizar'. Remove faixa-urgencia, BadgeFaixa e
ListaAvisos (sino + aba Historico ocupam o lugar). Rota de CSV do
historico espelha o padrao do relatorio do SC-11.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 19: Seed `seedSc20()`, script de reset e README

**Files:**
- Modify: `prisma/seed.ts`
- Modify: `package.json`
- Create: `prisma/seed-sc20-reset.ts`
- Modify: `README.md`

**Interfaces:**
- `seedSc20()` em `prisma/seed.ts`, chamada no `main()` (depois de `seedClientes`). Idempotente (upsert por `cnpj` de cliente; certificados: `deleteMany` dos clientes `@example.com` do SC-20 e recria — mais simples que upsert com encadeamento de renovação).
- Conteúdo (§10 do design): 60 clientes `<slug>@example.com`, ~5 `ativo:false`; ~90 certificados distribuídos 35 OK / 20 D60 / 12 D7 / 5 D3 / 8 VENCIDO / 10 RENOVADO (encadeados: cria o "novo" ativo + o "antigo" com `substituidoPorId`, `renovadoEm` espalhado −1..−20 dias, `ativo:false`); metade de D60 e metade de D7 com `AvisoCertificado` (`marco` correspondente, `status` `SENT`/`DELIVERED`, `enviadoEm` no passado), **5 delas `BOUNCED`** com `destinatarioEmail` `bounce+<slug>@example.com`; `RegistroAuditoria` retroativo ~6 meses (para cada certificado: 1 `CRIADO`; para os que hoje estão em faixa: 1–2 `TRANSICAO_BUCKET`; para renovados: `RENOVACAO`+`DESATIVADO`; ~10 `ATUALIZAR_EXECUTADO` espalhados); `NotificacaoInApp` não lidas para o admin e o operador de Processos cobrindo `D60_ENTROU`/`D7_ENTROU`/`D3_ENTROU` (datas nos últimos 3 dias). Tudo com `bucket` gravado coerente com as datas (chamar `calcularBucket` no seed).
- `prisma/seed-sc20-reset.ts`: importa o cliente Prisma (mesmo boilerplate do `seed.ts`), apaga na ordem `notificacaoInApp` → `registroAuditoria` (where entidade certificado/execucao do SC-20 ou `clienteId` de cliente `@example.com`) → `avisoCertificado` → `certificado` (clientes `@example.com`) → `cliente` (`email` termina em `@example.com`), e chama `seedSc20()` (exportar de `seed.ts`).
- `package.json`: `"seed:sc20:reset": "tsx prisma/seed-sc20-reset.ts"`.
- `README.md`: reescrever a seção "SC-20" — Kanban/tabela, buckets (com D3), cron diário, avisos in-app, aba Histórico + CSV, modal de certificado/renovação, envio de e-mail "somente interface nesta etapa", `npm run seed:sc20:reset`, nota UTC.

- [ ] **Step 1: Implementar `seedSc20()` e exportá-la; encadear no `main()`.**
- [ ] **Step 2: Rodar o seed** — `npx prisma migrate reset --force` (aplica migrações + seed). Expected: sem erro.
- [ ] **Step 3: Conferir no app** — `npm run dev`, `/modulos/sc-20` no Kanban: as 7 colunas têm card; coluna "Avisado 60d/7d" povoada; ao menos 1 card com ícone de bounce; sino com badge > 0; aba Histórico com dezenas de linhas e CSV baixa. `[verificação manual]`
- [ ] **Step 4: Criar `prisma/seed-sc20-reset.ts`; adicionar o script; testar** — `npm run seed:sc20:reset` duas vezes seguidas sem erro; contagem de certificados estável.
- [ ] **Step 5: Reescrever a seção SC-20 do `README.md`.**
- [ ] **Step 6: `npx tsc --noEmit && npm test`.**
- [ ] **Step 7: Commit**

```bash
git add prisma/seed.ts prisma/seed-sc20-reset.ts package.json README.md
git commit -m "feat(sc-20): seed sintetico das 7 colunas + historico retroativo + reset idempotente

60 clientes @example.com, ~90 certificados cobrindo OK/D60/D7/D3/VENCIDO/
RENOVADO, metade de D60 e D7 ja avisada (5 com bounce), RegistroAuditoria
de ~6 meses e NotificacaoInApp para popular o sino. npm run seed:sc20:reset
recria so o SC-20.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

## Self-Review

**1. Spec coverage:**

| Design § | Task |
|---|---|
| §3 substituição limpa / migração destrutiva | 1 |
| §4.1 enums / §4.2 Cliente / §4.3 Certificado / §4.4 AvisoCertificado / §4.5 NotificacaoInApp / §4.6 RegistroAuditoria / §4.7 Usuario | 1 |
| §5 `bucket.ts` (calcularBucket, transicaoGeraNotificacao, textoDias, ORDEM/ROTULO) | 2 |
| §6.1 cron diário (`vercel.json`) | 5 |
| §6.2 rota cron | 5 |
| §6.3 motor (transição→auditoria, notificação por elegível, idempotência no dia, granular, ATUALIZAR_EXECUTADO) | 5 |
| §6.4 botão "Atualizar" | 5 (action) + 18 (componente) |
| §7.1 abas | 18 |
| §7.2 aba Histórico (timeline, filtros, paginação, valores de `acao`) | 6 (query) + 17 (UI) + 18 (página) |
| §7.2 exportação CSV | 4 (serializador) + 18 (rota) |
| §7.3 toggle + `localStorage` + `?visao` | 10 + 18 |
| §8.1 tabela + Tipo/Titular | 12 |
| §8.2 Kanban 7 colunas / card / bounce fica na origem / foco | 6 (montarColunasKanban) + 11 (UI) |
| §8.3 Modal base | 9 |
| §8.3 ModalPerfilCliente | 14 |
| §8.3 ModalCertificado (novo/editar/renovação, aviso ≤60d) | 7 (action) + 13 (UI) |
| §8.4 SinoAvisos (agrupa tipo+dia, navega+marca lido) | 16 + 7 (marcarGrupoLido) |
| §9 envio em lote visual + toast | 15 |
| §10 seed + reset idempotente | 19 |
| §11 remoções (faixa-urgencia, BadgeFaixa, ListaAvisos, FormularioCertificado) | 13 + 18 |
| §12 identidade visual | Global Constraints + Step 0 "skill frontend-design" em toda task de `.tsx` |
| §13 testes (puro / integração / RTL) | 2,3,4 (puro), 5,6 (integração), 8,10,11,13,15,16,17 (RTL) |
| §14 critérios de aceite | cobertos pelas tasks acima; verificação manual nos Steps 7/3 das Tasks 18/19 |
| §10 nota operacional (seed em prod pós-deploy) | fora do plano de código — registrar no PR/deploy |

Sem lacunas de requisito.

**2. Placeholder scan:** os "verificação manual — anotar" nas Tasks 18/19 são checkpoints humanos deliberados, não placeholders de código. Nenhum step de código sem conteúdo real. As Tasks 7, 12, 14 não têm teste dedicado por serem cascas finas sobre unidades já testadas (justificado inline).

**3. Type consistency:** `recalcularBucketsCertificados` (Tasks 5, 7, 18). `montarColunasKanban` / `contarNaoAvisados` / `CertificadoLinha` / `ColunasKanban` (Tasks 6, 11, 18). `LinhaAuditoria` / `AcaoAuditoria` / `camposAlterados` / `rotuloAtor` / `ACENTO_ACAO` / `NATUREZAS` (Tasks 3, 6, 17). `EstadoForm` (Tasks 7, 13). `agruparNotificacoes` (Task 16). `gerarCsvHistorico` (Tasks 4, 18). `Bucket` / `transicaoGeraNotificacao` / `textoDias` (Tasks 2, 5, 6, 11). Nomes batem entre definição e uso.

**Nota de ordem:** a Task 14 (`ModalPerfilCliente`) consome `TimelineHistorico` da Task 17 — na execução, rodar **17 antes de 14** (ou renderizar o histórico inline simples na 14 e trocar na 17). As demais dependências seguem a numeração.
