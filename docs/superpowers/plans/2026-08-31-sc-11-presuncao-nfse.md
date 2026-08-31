# SC-11 — Presunção correta nas notas de serviço da área médica — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Entregar o 3º módulo: o operador sobe o XML de uma NFS-e médica numa caixa de entrada, o módulo classifica cada item na base de presunção 8% ou 32% — por regra (lista de termos editável) ou, quando não bate em termo nenhum, por uma chamada real ao Claude — os itens de baixa confiança caem numa fila de conferência, e só depois de tudo confirmado libera um relatório CSV consolidado para download.

**Architecture:** Módulo plugado na fundação, seguindo o padrão do SC-01: reusa `DocumentoEntrada` (`tipo: NFSE`) como caixa de entrada, o motor `executarModulo` → `Execucao`, o catálogo estático com flag `implementado`, `ModuloPageLayout`, e a rota de cron sob `/api/` protegida por `CRON_SECRET`. A lógica pura testável é o **motor de casamento de termos** e o **parser de XML**; a classificação por IA é uma chamada real à API da Anthropic (`claude-opus-5`, tool use), feita em chunks para aguentar uma nota de centenas de itens. Uma tela dedicada de admin gere os termos com **auditoria** de cada reclassificação.

**Tech Stack:** Next.js 16 (App Router, TS) + React 19, Prisma 7.10.0 + `@prisma/adapter-pg` sobre Postgres (Docker local, Supabase em produção), Tailwind v4, `zod` 4, `@anthropic-ai/sdk` 0.122.0 (modelo `claude-opus-5`), `fast-xml-parser` (novo), Vitest 4 (+ `@testing-library/react`). Vercel Cron via `vercel.json`.

**Spec:** [docs/superpowers/specs/2026-08-31-sc-11-presuncao-nfse-design.md](../specs/2026-08-31-sc-11-presuncao-nfse-design.md)

## Global Constraints

- Prazo de entrega: 2026-09-01.
- Toda execução de módulo passa por `executarModulo(moduloCodigo, disparadoPor, executar)` de `@/lib/execucao` — nunca escrever direto em `Execucao`. `disparadoPor` = e-mail do usuário sob demanda, `"scheduler"` no cron. `ResultadoExecucao = { status: "SUCESSO" | "PARCIAL"; resumo: string }`; `ERRO` só via exceção que escapa do `run()`.
- Erro conhecido (XML ilegível, IA indisponível, rate limit) vira **mensagem legível**; nunca stack trace cru na UI (spec §12, §15).
- Processamento é **granular por nota** (spec §4): falha numa nota marca só aquele `DocumentoEntrada` como `ERRO` e não derruba as outras do lote. Status `PARCIAL` quando parte do lote falhou.
- Catálogo estático em `src/lib/modulos-catalogo.ts`; a home só lista `implementado: true`. A flag do SC-11 só vira `true` na Task 11.
- **Duas bases de presunção, fixas:** `P8` (8%) e `P32` (32%). Nenhum outro valor é válido. Mapa `PERCENTUAL_ALIQUOTA = { P8: 8, P32: 32 }`.
- **Casamento de termo:** `descricao` normalizada (minúscula, sem acento, espaços colapsados) contém o `termo` normalizado como substring. Vários matches → o `termo` normalizado **mais longo** vence; empate de comprimento → o `P32` (conservador).
- **Limiar de confiança:** item classificado pela IA com `confianca < 0.85` nasce `PENDENTE_REVISAO`; `>= 0.85` nasce `CONFIRMADO`. Item por `REGRA` nasce sempre `CONFIRMADO`.
- **Download do relatório trava** enquanto a nota tiver qualquer `ItemNota` com status `PENDENTE_REVISAO` (spec §9).
- Chamada à Anthropic: `@anthropic-ai/sdk`, modelo **`claude-opus-5`**, `client.messages.stream(...)` + `.finalMessage()`, `thinking: { type: "adaptive" }`, tool `registrar_classificacoes`. Itens sem match vão em **chunks de 40**, sequenciais. Sem `ANTHROPIC_API_KEY` → lança `IaIndisponivelError` (de `@/lib/ia`) com mensagem legível; **não quebra o processo**.
- Paleta: `petroleo #10505F`, `turquesa #1FA69A`, `ambar #E8A33D`, `tinta #0B1A20`, `grafite #5A7078`, `nevoa #EEF3F4`, `carmim #C4453D` — só via utilitários `bg-/text-/border-/ring-/outline-` com esses tokens. Fontes `font-titulo` (Archivo), `font-texto` (IBM Plex Sans), `font-codigo` (IBM Plex Mono). Sem dependência de UI nova.
- Sessão: `obterSessao()` de `@/lib/sessao-servidor` → `PayloadSessao | null` (`{ usuarioId, email, nome, papel, setor }`). SC-11 é do setor **`BPO Saúde`**; `ADMIN` vê tudo, `OPERADOR` vê só módulos do próprio setor. A tela de termos exige `papel === "ADMIN"`.
- Conexão de banco: runtime usa `DATABASE_URL`; `prisma migrate deploy` (no `build`) usa `DIRECT_URL || DATABASE_URL`. Dev: Docker Postgres em `localhost:5433` (`docker compose up -d db`).
- Import do Prisma Client sem extensão: `@/generated/prisma/client`.
- `vitest.config.ts` já roda os arquivos em série (`fileParallelism: false`) e já exclui `**/.claude/**`. Testes de integração deste módulo falam com o Postgres local; limpam o que criaram por **prefixo de marcador** (`sc11-teste` em `nomeArquivo`, `zzz-teste-` em `termo`) + CNPJ fixo `66.666.666/0001-66`, e devolvem docs de seed varridos ao estado `PENDENTE`.
- Commits pequenos, mensagem explica o porquê, termina com `Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>`.

---

## File Structure

```
prisma/
  schema.prisma                          # + enums AliquotaPresuncao, OrigemDecisao, StatusItemNota, AcaoAuditoria
                                         # + models TermoPresuncao, AuditoriaTermo, NotaServico, ItemNota
                                         # + relação inversa notaServico em DocumentoEntrada
  migrations/<novo>_sc11_presuncao/
  fixtures/
    gerar-fixtures-nfse.ts               # NOVO — gera os 3 XMLs sintéticos
    nfse-pequena.xml  nfse-media.xml  nfse-grande.xml
  seed.ts                                # + operador BPO Saúde, seedTermosPresuncao(), seedNotasNfse()
vercel.json                             # + cron do SC-11
src/
  lib/
    ia.ts                               # NOVO — IaIndisponivelError + traduzirErroAnthropic (lift do SC-01)
    clientes.ts                         # NOVO — listarClientesParaUpload (movido do consultas-sc01)
    presuncao/
      presuncao-termos.ts               # puro — normalizar, casarTermo, PERCENTUAL_ALIQUOTA, LIMIAR, consolidar…
      presuncao-termos.test.ts
      parsear-nfse.ts                   # puro — parsearNfse, XmlInvalidoError
      parsear-nfse.test.ts
      classificador-itens.ts            # ClassificadorItens, classificarComClaude, criarClassificadorFake
      classificador-itens.test.ts
      processar-sc11.ts                 # processarDocumento, processarNotas({classificador?})
      processar-sc11.test.ts            # integração (banco local)
      consultas-sc11.ts                 # listarNotas, obterNotaComItens, listarTermos, listarAuditoriaTermos
      consultas-sc11.test.ts            # integração
      acoes-sc11.ts                     # "use server": enviarNota, processarPendentes, processarUma,
                                        #   revisarItem, excluirNota, criarTermo, editarTermo, removerTermo
      acoes-sc11.test.ts                # integração
      relatorio-csv.ts                  # puro — gerarCsvRelatorio(NotaDetalhe) -> string
      relatorio-csv.test.ts
      formato-presuncao.ts              # rótulos de balde/origem, formatarValorBRL, formatarDataUTC
  components/
    presuncao/
      BadgeAliquota.tsx  BadgeAliquota.test.tsx
      BadgeOrigemDecisao.tsx
      FormularioUploadNota.tsx           # "use client"
      TabelaNotas.tsx
      PainelItens.tsx                    # tabela de itens + consolidado
      FilaRevisaoItens.tsx
      LinhaRevisaoItem.tsx               # "use client"
      BotaoBaixarRelatorio.tsx
      TabelaTermos.tsx                   # "use client" — reclassificar inline
      FormularioTermo.tsx                # "use client"
      HistoricoAuditoriaTermos.tsx
  app/
    modulos/sc-11/
      page.tsx
      termos/page.tsx                    # admin
      nota/[documentoId]/
        page.tsx
        relatorio/route.ts              # GET — gera e baixa o .csv (403 se travado)
    api/cron/sc-11/route.ts             # GET protegido por CRON_SECRET
README.md                              # + seção SC-11
```

---

### Task 1: Schema — termos, auditoria, nota de serviço, item

**Files:**
- Modify: `prisma/schema.prisma`
- Create: `prisma/migrations/<novo>_sc11_presuncao/migration.sql` (gerado)

**Interfaces:**
- Consumes: nada.
- Produces: models `TermoPresuncao`, `AuditoriaTermo`, `NotaServico`, `ItemNota`; enums `AliquotaPresuncao` (`P8` | `P32`), `OrigemDecisao` (`REGRA` | `IA` | `MANUAL`), `StatusItemNota` (`CONFIRMADO` | `PENDENTE_REVISAO`), `AcaoAuditoria` (`CRIACAO` | `RECLASSIFICACAO` | `REMOCAO`). Relação `DocumentoEntrada.notaServico`.

- [ ] **Step 1: Subir o Postgres local**

Run: `docker compose up -d db`
Espere `docker inspect -f '{{.State.Health.Status}}' sheepcontabil-db` devolver `healthy`.

- [ ] **Step 2: Adicionar ao fim de `prisma/schema.prisma`**

```prisma
enum AliquotaPresuncao {
  P8
  P32
}

enum OrigemDecisao {
  REGRA
  IA
  MANUAL
}

enum StatusItemNota {
  CONFIRMADO
  PENDENTE_REVISAO
}

enum AcaoAuditoria {
  CRIACAO
  RECLASSIFICACAO
  REMOCAO
}

model TermoPresuncao {
  id       String            @id @default(cuid())
  termo    String            @unique
  aliquota AliquotaPresuncao
  criadoEm DateTime          @default(now())
}

model AuditoriaTermo {
  id               String             @id @default(cuid())
  termoId          String?
  termoTexto       String
  acao             AcaoAuditoria
  aliquotaAnterior AliquotaPresuncao?
  aliquotaNova     AliquotaPresuncao?
  autorEmail       String
  criadoEm         DateTime           @default(now())

  @@index([criadoEm])
}

model NotaServico {
  id                 String           @id @default(cuid())
  documentoEntradaId String           @unique
  documentoEntrada   DocumentoEntrada @relation(fields: [documentoEntradaId], references: [id], onDelete: Cascade)
  numero             String
  dataEmissao        DateTime
  valorTotal         Decimal          @db.Decimal(14, 2)
  itens              ItemNota[]
  criadoEm           DateTime         @default(now())
}

model ItemNota {
  id            String            @id @default(cuid())
  notaServicoId String
  notaServico   NotaServico       @relation(fields: [notaServicoId], references: [id], onDelete: Cascade)
  descricao     String
  valor         Decimal           @db.Decimal(14, 2)
  aliquota      AliquotaPresuncao
  origem        OrigemDecisao
  justificativa String
  confianca     Float?
  status        StatusItemNota    @default(CONFIRMADO)
  criadoEm      DateTime          @default(now())

  @@index([notaServicoId])
}
```

- [ ] **Step 3: Relação inversa no model `DocumentoEntrada`** — logo abaixo de `lancamentos Lancamento[]`:

```prisma
  notaServico NotaServico?
```

- [ ] **Step 4: Migração**

Run: `npx prisma migrate dev --name sc11_presuncao`
Expected: cria `prisma/migrations/<timestamp>_sc11_presuncao/` e regenera o client. Sem prompts de reset.

- [ ] **Step 5: Type-check**

Run: `npx tsc --noEmit`
Expected: PASS (0 erros).

- [ ] **Step 6: Commit**

```bash
git add prisma/schema.prisma prisma/migrations
git commit -m "$(cat <<'EOF'
feat(sc-11): schema de presuncao (TermoPresuncao, AuditoriaTermo, NotaServico, ItemNota)

Reusa DocumentoEntrada (tipo NFSE) como caixa de entrada; ItemNota
NAO tem FK pra TermoPresuncao de proposito — guarda aliquota +
justificativa como snapshot, entao reclassificar/remover um termo
depois nao reescreve nota ja processada. AuditoriaTermo e o registro
que reconstroi o historico das mudancas de termo.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 2: Refactors compartilhados — `src/lib/ia.ts` e `src/lib/clientes.ts`

Dois lifts pequenos e mecânicos para o SC-11 não importar de `src/lib/documentos/`. Cada um com `npm test` verde antes e depois, e commit próprio.

**Files:**
- Create: `src/lib/ia.ts`, `src/lib/clientes.ts`
- Modify: `src/lib/documentos/extrator-extrato.ts`, `src/lib/documentos/consultas-sc01.ts`, `src/app/modulos/sc-01/page.tsx`

**Interfaces:**
- Produces: `IaIndisponivelError` e `traduzirErroAnthropic(erro: unknown): Error` em `@/lib/ia`; `listarClientesParaUpload(): Promise<{ id: string; razaoSocial: string }[]>` em `@/lib/clientes`.

- [ ] **Step 1: Baseline** — `npm test` (tudo verde) e `docker compose up -d db` se ainda não subiu.

- [ ] **Step 2: Criar `src/lib/ia.ts`**

```ts
import Anthropic from "@anthropic-ai/sdk";

/** IA fora do ar por configuração (sem chave) ou credencial inválida. */
export class IaIndisponivelError extends Error {
  constructor(
    mensagem = "IA indisponível. Configure ANTHROPIC_API_KEY para processar documentos.",
  ) {
    super(mensagem);
    this.name = "IaIndisponivelError";
  }
}

/**
 * Converte um erro cru do SDK da Anthropic numa mensagem legível.
 * `AuthenticationError` -> IaIndisponivelError (config); `RateLimitError` e
 * `APIError` -> Error com texto amigável; qualquer outra coisa volta como
 * veio (já é `Error`) ou embrulhada.
 */
export function traduzirErroAnthropic(erro: unknown): Error {
  if (erro instanceof Anthropic.AuthenticationError) {
    return new IaIndisponivelError("Chave da Anthropic inválida.");
  }
  if (erro instanceof Anthropic.RateLimitError) {
    return new Error(
      "A IA está sobrecarregada no momento. Tente processar de novo em alguns minutos.",
    );
  }
  if (erro instanceof Anthropic.APIError) {
    return new Error(
      `A IA não conseguiu processar o conteúdo (erro ${erro.status}). Verifique se o arquivo está legível.`,
    );
  }
  return erro instanceof Error ? erro : new Error("Falha inesperada na IA.");
}
```

- [ ] **Step 3: Trocar `extrator-extrato.ts` para reusar `@/lib/ia`**

Remover a classe `IaIndisponivelError` local e o bloco `catch` com os `instanceof Anthropic.*`. No topo:

```ts
import { IaIndisponivelError, traduzirErroAnthropic } from "@/lib/ia";
```

Manter o re-export para não quebrar quem importa de `./extrator-extrato` (ex.: `processar-sc01.test.ts`):

```ts
export { IaIndisponivelError } from "@/lib/ia";
```

E o `catch` do `stream.finalMessage()` vira:

```ts
  } catch (erro) {
    throw traduzirErroAnthropic(erro);
  }
```

- [ ] **Step 4: Rodar a suíte** — `npm test`. Expected: PASS, mesma contagem de antes (nada de SC-01 muda de comportamento).

- [ ] **Step 5: Commit**

```bash
git add src/lib/ia.ts src/lib/documentos/extrator-extrato.ts
git commit -m "$(cat <<'EOF'
refactor(ia): extrai IaIndisponivelError + traducao de erro da Anthropic p/ src/lib/ia.ts

O SC-11 tambem chama a Anthropic; o mapeamento de erro para
mensagem legivel passa a ser compartilhado. extrator-extrato
reimporta e re-exporta IaIndisponivelError (compat).

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

- [ ] **Step 6: Criar `src/lib/clientes.ts`**

```ts
import { prisma } from "@/lib/prisma";

/** Clientes para o <select> dos formulários de upload (SC-01 e SC-11). */
export async function listarClientesParaUpload(): Promise<
  { id: string; razaoSocial: string }[]
> {
  return prisma.cliente.findMany({
    orderBy: { razaoSocial: "asc" },
    select: { id: true, razaoSocial: true },
  });
}
```

- [ ] **Step 7: Remover `listarClientesParaUpload` de `consultas-sc01.ts`** e re-exportar do novo lugar (no fim do arquivo):

```ts
export { listarClientesParaUpload } from "@/lib/clientes";
```

`src/app/modulos/sc-01/page.tsx` já importa de `@/lib/documentos/consultas-sc01` — o re-export mantém isso funcionando. (Opcional: trocar o import da página para `@/lib/clientes`.)

- [ ] **Step 8: Rodar a suíte + type-check** — `npx tsc --noEmit && npm test`. Expected: PASS.

- [ ] **Step 9: Commit**

```bash
git add src/lib/clientes.ts src/lib/documentos/consultas-sc01.ts
git commit -m "$(cat <<'EOF'
refactor(clientes): move listarClientesParaUpload p/ src/lib/clientes.ts

Evita o SC-11 importar de src/lib/documentos/. consultas-sc01
re-exporta pra nao quebrar a pagina do SC-01.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 3: Motor de casamento de termos (puro, TDD)

**Files:**
- Create: `src/lib/presuncao/presuncao-termos.ts`, `src/lib/presuncao/presuncao-termos.test.ts`

**Interfaces:**
- Produces:
  - `type AliquotaPresuncao = "P8" | "P32"` (mesmos nomes do enum Prisma — ponte por `as` nas bordas)
  - `type StatusItemNota = "CONFIRMADO" | "PENDENTE_REVISAO"`
  - `type OrigemDecisao = "REGRA" | "IA" | "MANUAL"`
  - `const PERCENTUAL_ALIQUOTA: Record<AliquotaPresuncao, number>`
  - `const LIMIAR_CONFIANCA = 0.85`
  - `function normalizar(s: string): string`
  - `type TermoParaCasar = { termo: string; aliquota: AliquotaPresuncao }`
  - `function casarTermo(descricao: string, termos: TermoParaCasar[]): { aliquota: AliquotaPresuncao; termo: string } | null`
  - `function classificarStatusItem(confianca: number): StatusItemNota`
  - `type ItemParaConsolidar = { aliquota: AliquotaPresuncao; valor: number }`
  - `type LinhaConsolidada = { aliquota: AliquotaPresuncao; qtdItens: number; somaValor: number; basePresuncao: number }`
  - `type Consolidado = { porBalde: LinhaConsolidada[]; totalValor: number; totalBase: number }`
  - `function consolidar(itens: ItemParaConsolidar[]): Consolidado`
  - `type ItemParaExportar = { status: StatusItemNota }`
  - `function notaPodeExportar(itens: ItemParaExportar[]): boolean`
  - `function motivoBloqueioRelatorio(itens: ItemParaExportar[]): string | null`

- [ ] **Step 1: Teste que falha — `src/lib/presuncao/presuncao-termos.test.ts`**

```ts
import { describe, expect, it } from "vitest";
import {
  casarTermo,
  classificarStatusItem,
  consolidar,
  motivoBloqueioRelatorio,
  normalizar,
  notaPodeExportar,
  PERCENTUAL_ALIQUOTA,
  type TermoParaCasar,
} from "./presuncao-termos";

const TERMOS: TermoParaCasar[] = [
  { termo: "tomografia", aliquota: "P8" },
  { termo: "tomografia computadorizada de crânio", aliquota: "P8" },
  { termo: "consulta", aliquota: "P32" },
  { termo: "raio-x", aliquota: "P8" },
];

describe("normalizar", () => {
  it("tira acento, caixa e espaço extra", () => {
    expect(normalizar("  Ressonância   Magnética ")).toBe("ressonancia magnetica");
    expect(normalizar("RAIO-X do Tórax")).toBe("raio-x do torax");
  });
});

describe("casarTermo", () => {
  it("devolve null quando nada bate", () => {
    expect(casarTermo("Sessão de acupuntura", TERMOS)).toBeNull();
  });

  it("casa por substring, ignorando acento/caixa", () => {
    const r = casarTermo("TOMOGRAFIA de abdome", TERMOS);
    expect(r).toEqual({ aliquota: "P8", termo: "tomografia" });
  });

  it("com vários matches, o termo mais longo vence", () => {
    const r = casarTermo("Tomografia computadorizada de crânio sem contraste", TERMOS);
    expect(r?.termo).toBe("tomografia computadorizada de crânio");
  });

  it("empate de comprimento -> o P32 (conservador)", () => {
    const termos: TermoParaCasar[] = [
      { termo: "aaaa", aliquota: "P8" },
      { termo: "bbbb", aliquota: "P32" },
    ];
    expect(casarTermo("linha aaaa bbbb", termos)?.aliquota).toBe("P32");
  });
});

describe("classificarStatusItem", () => {
  it("< 0.85 -> PENDENTE_REVISAO; >= 0.85 -> CONFIRMADO", () => {
    expect(classificarStatusItem(0.84)).toBe("PENDENTE_REVISAO");
    expect(classificarStatusItem(0.85)).toBe("CONFIRMADO");
  });
});

describe("consolidar", () => {
  it("agrupa por balde e calcula a base de presunção", () => {
    const c = consolidar([
      { aliquota: "P8", valor: 100 },
      { aliquota: "P8", valor: 50 },
      { aliquota: "P32", valor: 200 },
    ]);
    const p8 = c.porBalde.find((l) => l.aliquota === "P8")!;
    const p32 = c.porBalde.find((l) => l.aliquota === "P32")!;
    expect(p8).toMatchObject({ qtdItens: 2, somaValor: 150, basePresuncao: 12 }); // 150 * 8%
    expect(p32).toMatchObject({ qtdItens: 1, somaValor: 200, basePresuncao: 64 }); // 200 * 32%
    expect(c.totalValor).toBe(350);
    expect(c.totalBase).toBe(76);
  });

  it("arredonda a base a 2 casas", () => {
    const c = consolidar([{ aliquota: "P8", valor: 33.33 }]);
    expect(c.porBalde[0].basePresuncao).toBe(2.67); // 33.33 * 0.08 = 2.6664
  });
});

describe("notaPodeExportar / motivoBloqueioRelatorio", () => {
  it("bloqueia com item em revisão", () => {
    const itens = [{ status: "CONFIRMADO" as const }, { status: "PENDENTE_REVISAO" as const }];
    expect(notaPodeExportar(itens)).toBe(false);
    expect(motivoBloqueioRelatorio(itens)).toMatch(/1 item ainda em conferência/);
  });

  it("libera com tudo confirmado", () => {
    const itens = [{ status: "CONFIRMADO" as const }];
    expect(notaPodeExportar(itens)).toBe(true);
    expect(motivoBloqueioRelatorio(itens)).toBeNull();
  });

  it("nota sem item nenhum não exporta", () => {
    expect(notaPodeExportar([])).toBe(false);
    expect(motivoBloqueioRelatorio([])).toBe("Nenhum item classificado");
  });
});

describe("PERCENTUAL_ALIQUOTA", () => {
  it("mapeia os dois baldes", () => {
    expect(PERCENTUAL_ALIQUOTA).toEqual({ P8: 8, P32: 32 });
  });
});
```

- [ ] **Step 2: Rodar e ver falhar** — `npm test -- presuncao-termos` → `Cannot find module './presuncao-termos'`.

- [ ] **Step 3: Implementar `src/lib/presuncao/presuncao-termos.ts`**

```ts
export type AliquotaPresuncao = "P8" | "P32";
export type StatusItemNota = "CONFIRMADO" | "PENDENTE_REVISAO";
export type OrigemDecisao = "REGRA" | "IA" | "MANUAL";

export const PERCENTUAL_ALIQUOTA: Record<AliquotaPresuncao, number> = {
  P8: 8,
  P32: 32,
};

// Mesmo corte que decide CONFIRMADO x PENDENTE_REVISAO no SC-01. Um número só.
export const LIMIAR_CONFIANCA = 0.85;

/** minúscula, sem diacrítico, espaços colapsados. */
export function normalizar(s: string): string {
  return s
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

export type TermoParaCasar = { termo: string; aliquota: AliquotaPresuncao };

export function casarTermo(
  descricao: string,
  termos: TermoParaCasar[],
): { aliquota: AliquotaPresuncao; termo: string } | null {
  const alvo = normalizar(descricao);
  const candidatos = termos
    .map((t) => ({ ...t, norm: normalizar(t.termo) }))
    .filter((t) => t.norm.length > 0 && alvo.includes(t.norm));

  if (candidatos.length === 0) return null;

  candidatos.sort((a, b) => {
    if (b.norm.length !== a.norm.length) return b.norm.length - a.norm.length;
    // empate de comprimento: P32 (conservador) na frente
    if (a.aliquota !== b.aliquota) return a.aliquota === "P32" ? -1 : 1;
    return 0;
  });

  return { aliquota: candidatos[0].aliquota, termo: candidatos[0].termo };
}

export function classificarStatusItem(confianca: number): StatusItemNota {
  return confianca < LIMIAR_CONFIANCA ? "PENDENTE_REVISAO" : "CONFIRMADO";
}

export type ItemParaConsolidar = { aliquota: AliquotaPresuncao; valor: number };
export type LinhaConsolidada = {
  aliquota: AliquotaPresuncao;
  qtdItens: number;
  somaValor: number;
  basePresuncao: number;
};
export type Consolidado = {
  porBalde: LinhaConsolidada[];
  totalValor: number;
  totalBase: number;
};

function arred2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

export function consolidar(itens: ItemParaConsolidar[]): Consolidado {
  const baldes: AliquotaPresuncao[] = ["P8", "P32"];
  const porBalde: LinhaConsolidada[] = baldes
    .map((aliquota) => {
      const doBalde = itens.filter((i) => i.aliquota === aliquota);
      const somaValor = arred2(doBalde.reduce((s, i) => s + i.valor, 0));
      return {
        aliquota,
        qtdItens: doBalde.length,
        somaValor,
        basePresuncao: arred2((somaValor * PERCENTUAL_ALIQUOTA[aliquota]) / 100),
      };
    })
    .filter((l) => l.qtdItens > 0);

  return {
    porBalde,
    totalValor: arred2(porBalde.reduce((s, l) => s + l.somaValor, 0)),
    totalBase: arred2(porBalde.reduce((s, l) => s + l.basePresuncao, 0)),
  };
}

export type ItemParaExportar = { status: StatusItemNota };

export function notaPodeExportar(itens: ItemParaExportar[]): boolean {
  return itens.length > 0 && itens.every((i) => i.status === "CONFIRMADO");
}

export function motivoBloqueioRelatorio(
  itens: ItemParaExportar[],
): string | null {
  if (itens.length === 0) return "Nenhum item classificado";
  const emRevisao = itens.filter((i) => i.status === "PENDENTE_REVISAO").length;
  if (emRevisao === 0) return null;
  return `${emRevisao} ${emRevisao === 1 ? "item ainda em conferência" : "itens ainda em conferência"}`;
}
```

- [ ] **Step 4: Rodar e ver passar** — `npm test -- presuncao-termos`.

- [ ] **Step 5: Commit**

```bash
git add src/lib/presuncao/presuncao-termos.ts src/lib/presuncao/presuncao-termos.test.ts
git commit -m "$(cat <<'EOF'
feat(sc-11): motor puro de casamento de termos + consolidacao

normalizar (sem acento/caixa) + casarTermo por substring, mais
especifico vence, empate -> 32%. consolidar soma valor e base de
presuncao por balde. notaPodeExportar trava o relatorio ate a
conferencia zerar.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 4: Parser de XML NFS-e (puro, TDD)

**Files:**
- Modify: `package.json` (dep `fast-xml-parser`)
- Create: `src/lib/presuncao/parsear-nfse.ts`, `src/lib/presuncao/parsear-nfse.test.ts`

**Interfaces:**
- Consumes: `fast-xml-parser`.
- Produces:
  - `class XmlInvalidoError extends Error`
  - `type ItemNfse = { descricao: string; valor: number }`
  - `type NfseParseada = { numero: string; dataEmissao: string; valorTotal: number; itens: ItemNfse[] }` (`dataEmissao` ISO `yyyy-mm-dd`)
  - `function parsearNfse(xml: string): NfseParseada`

- [ ] **Step 1: Instalar o parser**

Run: `npm install fast-xml-parser@5`
Expected: entra em `dependencies`.

- [ ] **Step 2: Teste que falha — `src/lib/presuncao/parsear-nfse.test.ts`**

```ts
import { describe, expect, it } from "vitest";
import { parsearNfse, XmlInvalidoError } from "./parsear-nfse";

const XML_OK = `<?xml version="1.0" encoding="UTF-8"?>
<NFSe>
  <InfNfse>
    <Numero>2026-000123</Numero>
    <DataEmissao>2026-08-07</DataEmissao>
    <ListaItens>
      <Item><Discriminacao>Tomografia computadorizada de crânio</Discriminacao><Valor>450.00</Valor></Item>
      <Item><Discriminacao>Consulta médica em consultório</Discriminacao><Valor>200,50</Valor></Item>
    </ListaItens>
    <ValorTotal>650.50</ValorTotal>
  </InfNfse>
</NFSe>`;

const XML_NAMESPACE = `<ns2:NFSe xmlns:ns2="http://x">
  <ns2:InfNfse>
    <ns2:Numero>9</ns2:Numero>
    <ns2:DataEmissao>2026-08-01</ns2:DataEmissao>
    <ns2:ListaItens>
      <ns2:Item><ns2:Discriminacao>Raio-X</ns2:Discriminacao><ns2:Valor>80</ns2:Valor></ns2:Item>
    </ns2:ListaItens>
    <ns2:ValorTotal>80</ns2:ValorTotal>
  </ns2:InfNfse>
</ns2:NFSe>`;

describe("parsearNfse", () => {
  it("extrai número, data e itens (valor com ponto ou vírgula)", () => {
    const nota = parsearNfse(XML_OK);
    expect(nota.numero).toBe("2026-000123");
    expect(nota.dataEmissao).toBe("2026-08-07");
    expect(nota.valorTotal).toBe(650.5);
    expect(nota.itens).toEqual([
      { descricao: "Tomografia computadorizada de crânio", valor: 450 },
      { descricao: "Consulta médica em consultório", valor: 200.5 },
    ]);
  });

  it("tolera prefixo de namespace e um único Item", () => {
    const nota = parsearNfse(XML_NAMESPACE);
    expect(nota.numero).toBe("9");
    expect(nota.itens).toHaveLength(1);
    expect(nota.itens[0]).toEqual({ descricao: "Raio-X", valor: 80 });
  });

  it("lança XmlInvalidoError em XML quebrado", () => {
    expect(() => parsearNfse("<NFSe><InfNfse>")).toThrow(XmlInvalidoError);
  });

  it("lança XmlInvalidoError quando falta InfNfse", () => {
    expect(() => parsearNfse("<NFSe></NFSe>")).toThrow(XmlInvalidoError);
  });

  it("lança XmlInvalidoError quando a lista de itens está vazia", () => {
    const xml = `<NFSe><InfNfse><Numero>1</Numero><DataEmissao>2026-08-01</DataEmissao><ListaItens></ListaItens><ValorTotal>0</ValorTotal></InfNfse></NFSe>`;
    expect(() => parsearNfse(xml)).toThrow(XmlInvalidoError);
  });

  it("lança XmlInvalidoError quando um item não tem valor numérico", () => {
    const xml = `<NFSe><InfNfse><Numero>1</Numero><DataEmissao>2026-08-01</DataEmissao><ListaItens><Item><Discriminacao>X</Discriminacao><Valor>abc</Valor></Item></ListaItens><ValorTotal>0</ValorTotal></InfNfse></NFSe>`;
    expect(() => parsearNfse(xml)).toThrow(XmlInvalidoError);
  });
});
```

- [ ] **Step 3: Rodar e ver falhar** — `npm test -- parsear-nfse`.

- [ ] **Step 4: Implementar `src/lib/presuncao/parsear-nfse.ts`**

```ts
import { XMLParser, XMLValidator } from "fast-xml-parser";

export class XmlInvalidoError extends Error {
  constructor(mensagem = "XML da NFS-e ilegível ou fora do formato esperado.") {
    super(mensagem);
    this.name = "XmlInvalidoError";
  }
}

export type ItemNfse = { descricao: string; valor: number };
export type NfseParseada = {
  numero: string;
  dataEmissao: string; // ISO yyyy-mm-dd
  valorTotal: number;
  itens: ItemNfse[];
};

const parser = new XMLParser({
  ignoreAttributes: true,
  removeNSPrefix: true, // <ns2:InfNfse> -> InfNfse
  parseTagValue: false, // manter tudo string; a conversão de número é nossa
  trimValues: true,
});

function texto(v: unknown): string {
  if (v === null || v === undefined) return "";
  return String(v).trim();
}

function paraNumero(v: unknown): number {
  // aceita "1234.56" e "1234,56"
  const n = Number(texto(v).replace(/\./g, "").replace(",", "."));
  // primeiro tenta o formato pt-BR (ponto = milhar); se não deu, tenta o cru
  if (Number.isFinite(n)) return n;
  const cru = Number(texto(v));
  return cru;
}

function comoLista<T>(v: T | T[] | undefined): T[] {
  if (v === undefined || v === null) return [];
  return Array.isArray(v) ? v : [v];
}

export function parsearNfse(xml: string): NfseParseada {
  if (XMLValidator.validate(xml) !== true) {
    throw new XmlInvalidoError();
  }

  let raiz: Record<string, unknown>;
  try {
    raiz = parser.parse(xml) as Record<string, unknown>;
  } catch {
    throw new XmlInvalidoError();
  }

  // desce até InfNfse esteja onde estiver (NFSe > InfNfse, ou direto)
  const nfse = (raiz.NFSe ?? raiz) as Record<string, unknown>;
  const inf = (nfse.InfNfse ?? (raiz as Record<string, unknown>).InfNfse) as
    | Record<string, unknown>
    | undefined;
  if (!inf || typeof inf !== "object") throw new XmlInvalidoError();

  const numero = texto(inf.Numero);
  const dataEmissao = texto(inf.DataEmissao).slice(0, 10);
  const valorTotal = paraNumero(inf.ValorTotal);
  if (!numero || !/^\d{4}-\d{2}-\d{2}$/.test(dataEmissao)) {
    throw new XmlInvalidoError();
  }

  const lista = (inf.ListaItens ?? {}) as Record<string, unknown>;
  const brutos = comoLista(lista.Item as unknown);
  if (brutos.length === 0) throw new XmlInvalidoError("A NFS-e não tem itens.");

  const itens: ItemNfse[] = brutos.map((b) => {
    const item = b as Record<string, unknown>;
    const descricao = texto(item.Discriminacao);
    const valor = paraNumero(item.Valor);
    if (!descricao || !Number.isFinite(valor)) {
      throw new XmlInvalidoError("Item da NFS-e sem descrição ou valor válido.");
    }
    return { descricao, valor };
  });

  return { numero, dataEmissao, valorTotal, itens };
}
```

- [ ] **Step 5: Rodar e ver passar** — `npm test -- parsear-nfse`.

- [ ] **Step 6: `tsc` + suíte cheia** — `npx tsc --noEmit && npm test`.

- [ ] **Step 7: Commit**

```bash
git add package.json package-lock.json src/lib/presuncao/parsear-nfse.ts src/lib/presuncao/parsear-nfse.test.ts
git commit -m "$(cat <<'EOF'
feat(sc-11): parser de XML NFS-e (ABRASF simplificado)

fast-xml-parser com removeNSPrefix (tolera <ns2:...>). Extrai
numero, dataEmissao, valorTotal e itens {descricao, valor}; valor
aceita ponto ou virgula. XML quebrado / sem InfNfse / lista vazia /
item sem valor -> XmlInvalidoError com mensagem legivel.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 5: Classificador via Claude (API real da Anthropic)

**Files:**
- Create: `src/lib/presuncao/classificador-itens.ts`, `src/lib/presuncao/classificador-itens.test.ts`

**Interfaces:**
- Consumes: `IaIndisponivelError`, `traduzirErroAnthropic` de `@/lib/ia`; `type AliquotaPresuncao` de `./presuncao-termos`.
- Produces:
  - `type ItemParaClassificar = { descricao: string }`
  - `type ItemClassificado = { indice: number; aliquota: AliquotaPresuncao; confianca: number; justificativa: string }`
  - `type ClassificadorItens = (itens: ItemParaClassificar[]) => Promise<ItemClassificado[]>`
  - `function criarClassificadorFake(resolver: (itens: ItemParaClassificar[]) => ItemClassificado[]): ClassificadorItens`
  - `const classificarComClaude: ClassificadorItens`

- [ ] **Step 1: Teste que falha — `src/lib/presuncao/classificador-itens.test.ts`**

```ts
import { afterEach, describe, expect, it } from "vitest";
import {
  classificarComClaude,
  criarClassificadorFake,
  type ItemParaClassificar,
} from "./classificador-itens";
import { IaIndisponivelError } from "@/lib/ia";

const CHAVE_ORIGINAL = process.env.ANTHROPIC_API_KEY;
afterEach(() => {
  if (CHAVE_ORIGINAL === undefined) delete process.env.ANTHROPIC_API_KEY;
  else process.env.ANTHROPIC_API_KEY = CHAVE_ORIGINAL;
});

describe("classificarComClaude", () => {
  it("lança IaIndisponivelError sem ANTHROPIC_API_KEY", async () => {
    delete process.env.ANTHROPIC_API_KEY;
    await expect(
      classificarComClaude([{ descricao: "Consulta" }]),
    ).rejects.toBeInstanceOf(IaIndisponivelError);
  });
});

describe("criarClassificadorFake", () => {
  it("devolve o que o resolver produzir", async () => {
    const itens: ItemParaClassificar[] = [
      { descricao: "Tomografia" },
      { descricao: "Perícia médica" },
    ];
    const fake = criarClassificadorFake((xs) =>
      xs.map((x, indice) => ({
        indice,
        aliquota: x.descricao.includes("Tomografia") ? "P8" : "P32",
        confianca: 0.9,
        justificativa: "teste",
      })),
    );
    await expect(fake(itens)).resolves.toEqual([
      { indice: 0, aliquota: "P8", confianca: 0.9, justificativa: "teste" },
      { indice: 1, aliquota: "P32", confianca: 0.9, justificativa: "teste" },
    ]);
  });
});
```

- [ ] **Step 2: Rodar e ver falhar** — `npm test -- classificador-itens`.

- [ ] **Step 3: Implementar `src/lib/presuncao/classificador-itens.ts`**

```ts
import Anthropic from "@anthropic-ai/sdk";
import { IaIndisponivelError, traduzirErroAnthropic } from "@/lib/ia";
import type { AliquotaPresuncao } from "./presuncao-termos";

const MODELO = "claude-opus-5";

export type ItemParaClassificar = { descricao: string };
export type ItemClassificado = {
  indice: number;
  aliquota: AliquotaPresuncao;
  confianca: number;
  justificativa: string;
};
export type ClassificadorItens = (
  itens: ItemParaClassificar[],
) => Promise<ItemClassificado[]>;

export function criarClassificadorFake(
  resolver: (itens: ItemParaClassificar[]) => ItemClassificado[],
): ClassificadorItens {
  return async (itens) => resolver(itens);
}

const FERRAMENTA = {
  name: "registrar_classificacoes",
  description:
    "Registra a base de presunção de cada item de NFS-e de serviço médico.",
  input_schema: {
    type: "object" as const,
    properties: {
      classificacoes: {
        type: "array",
        items: {
          type: "object",
          properties: {
            indice: {
              type: "integer",
              description: "Índice do item na lista recebida (base 0).",
            },
            aliquota: {
              type: "string",
              enum: ["8", "32"],
              description:
                "8 para serviço hospitalar/equiparado (exame, imagem, análise clínica, terapia, procedimento); 32 para os demais (consulta, perícia, laudo avulso, honorário não enquadrado).",
            },
            confianca: {
              type: "number",
              description:
                "0 a 1. Reduza quando a descrição for genérica ou ambígua.",
            },
            justificativa: {
              type: "string",
              description: "Uma frase: por que essa base.",
            },
          },
          required: ["indice", "aliquota", "confianca", "justificativa"],
        },
      },
    },
    required: ["classificacoes"],
  },
};

const INSTRUCAO = `Você recebe uma lista NUMERADA de descrições de itens de uma NFS-e emitida por prestador de serviço médico. Para CADA item, decida a base de presunção do lucro presumido:
- 8%: serviços hospitalares e os a eles equiparados — exames (imagem, laboratório, análises clínicas), terapias, procedimentos, diagnósticos.
- 32%: regra geral dos demais serviços — consulta, perícia, junta médica, laudo/honorário avulso não enquadrado.
Para cada item devolva: indice (o número da lista, base 0), aliquota ("8" ou "32"), confianca de 0 a 1 (menor quando a descrição é vaga), e justificativa de uma frase. Chame a ferramenta registrar_classificacoes uma vez, com todos os itens.`;

function paraAliquota(v: string): AliquotaPresuncao {
  return v === "8" ? "P8" : "P32";
}

export const classificarComClaude: ClassificadorItens = async (itens) => {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new IaIndisponivelError();
  if (itens.length === 0) return [];

  const client = new Anthropic({ apiKey });
  const lista = itens
    .map((it, i) => `${i}. ${it.descricao}`)
    .join("\n");

  let mensagem;
  try {
    const stream = client.messages.stream({
      model: MODELO,
      max_tokens: 16000,
      thinking: { type: "adaptive" },
      tools: [FERRAMENTA],
      messages: [
        { role: "user", content: [{ type: "text", text: `${INSTRUCAO}\n\n${lista}` }] },
      ],
    });
    mensagem = await stream.finalMessage();
  } catch (erro) {
    throw traduzirErroAnthropic(erro);
  }

  const toolUse = mensagem.content.find((b) => b.type === "tool_use");
  const bruto =
    toolUse && toolUse.type === "tool_use"
      ? ((toolUse.input as { classificacoes?: unknown[] }).classificacoes ?? [])
      : [];

  const porIndice = new Map<number, ItemClassificado>();
  for (const c of bruto as Record<string, unknown>[]) {
    const indice = Number(c.indice);
    if (!Number.isInteger(indice) || indice < 0 || indice >= itens.length) continue;
    porIndice.set(indice, {
      indice,
      aliquota: paraAliquota(String(c.aliquota)),
      confianca: Math.max(0, Math.min(1, Number(c.confianca) || 0)),
      justificativa: String(c.justificativa ?? "").trim() || "Sem justificativa da IA.",
    });
  }

  // Item que a IA não devolveu cai para conferência (confiança 0, 32%).
  return itens.map((_, indice) =>
    porIndice.get(indice) ?? {
      indice,
      aliquota: "P32" as const,
      confianca: 0,
      justificativa: "IA não classificou este item.",
    },
  );
};
```

- [ ] **Step 4: Rodar e ver passar** — `npm test -- classificador-itens`.

- [ ] **Step 5: `tsc` + suíte cheia** — `npx tsc --noEmit && npm test`.

- [ ] **Step 6: Commit**

```bash
git add src/lib/presuncao/classificador-itens.ts src/lib/presuncao/classificador-itens.test.ts
git commit -m "$(cat <<'EOF'
feat(sc-11): classificador de itens via claude-opus-5 (tool use)

Recebe um chunk de descricoes, devolve {indice, aliquota, confianca,
justificativa} por item. Tool com enum ["8","32"] mapeado p/ P8/P32.
Item omitido pela IA cai p/ conferencia (confianca 0, 32%). Sem
chave -> IaIndisponivelError. criarClassificadorFake p/ os testes.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 6: Motor de processamento (integração, TDD)

**Files:**
- Create: `src/lib/presuncao/processar-sc11.ts`, `src/lib/presuncao/processar-sc11.test.ts`

**Interfaces:**
- Consumes: `prisma` de `@/lib/prisma`; `type ResultadoExecucao` de `@/lib/execucao`; `casarTermo`, `classificarStatusItem`, `type AliquotaPresuncao`, `type TermoParaCasar` de `./presuncao-termos`; `parsearNfse`, `XmlInvalidoError` de `./parsear-nfse`; `classificarComClaude`, `type ClassificadorItens` de `./classificador-itens`; `IaIndisponivelError` de `@/lib/ia`.
- Produces:
  - `const CHUNK_ITENS = 40`
  - `async function processarDocumento(documentoId: string, classificador?: ClassificadorItens): Promise<void>`
  - `async function processarNotas(opts?: { classificador?: ClassificadorItens }): Promise<ResultadoExecucao>`

- [ ] **Step 1: Teste que falha — `src/lib/presuncao/processar-sc11.test.ts`**

```ts
import { afterEach, describe, expect, it } from "vitest";
import { prisma } from "@/lib/prisma";
import { criarClassificadorFake } from "./classificador-itens";
import { processarDocumento, processarNotas, CHUNK_ITENS } from "./processar-sc11";

const MARCADOR = "sc11-teste";
const CNPJ = "66.666.666/0001-66";
const TERMO_MARCADOR = "zzz-teste-";

function xml(numero: string, itens: { d: string; v: number }[]): string {
  const linhas = itens
    .map((i) => `<Item><Discriminacao>${i.d}</Discriminacao><Valor>${i.v}</Valor></Item>`)
    .join("");
  const total = itens.reduce((s, i) => s + i.v, 0);
  return `<NFSe><InfNfse><Numero>${numero}</Numero><DataEmissao>2026-08-07</DataEmissao><ListaItens>${linhas}</ListaItens><ValorTotal>${total}</ValorTotal></InfNfse></NFSe>`;
}

afterEach(async () => {
  await prisma.itemNota.deleteMany({
    where: { notaServico: { documentoEntrada: { nomeArquivo: { startsWith: MARCADOR } } } },
  });
  await prisma.notaServico.deleteMany({
    where: { documentoEntrada: { nomeArquivo: { startsWith: MARCADOR } } },
  });
  await prisma.documentoEntrada.deleteMany({ where: { nomeArquivo: { startsWith: MARCADOR } } });
  await prisma.cliente.deleteMany({ where: { cnpj: CNPJ } });
  await prisma.termoPresuncao.deleteMany({ where: { termo: { startsWith: TERMO_MARCADOR } } });

  // Devolve as NFS-e do seed ao estado PENDENTE (processarNotas faz sweep global).
  await prisma.itemNota.deleteMany({
    where: { notaServico: { documentoEntrada: { nomeArquivo: { startsWith: "nfse-" } } } },
  });
  await prisma.notaServico.deleteMany({
    where: { documentoEntrada: { nomeArquivo: { startsWith: "nfse-" } } },
  });
  await prisma.documentoEntrada.updateMany({
    where: { tipo: "NFSE", nomeArquivo: { startsWith: "nfse-" } },
    data: { status: "PENDENTE", processadoEm: null, erro: null },
  });
});

async function clienteTeste() {
  return prisma.cliente.upsert({
    where: { cnpj: CNPJ },
    update: {},
    create: { razaoSocial: "Cliente SC-11 Teste", cnpj: CNPJ, atividade: "Teste" },
  });
}

async function docTeste(nome: string, conteudoXml: string) {
  const cliente = await clienteTeste();
  return prisma.documentoEntrada.create({
    data: {
      tipo: "NFSE",
      clienteId: cliente.id,
      nomeArquivo: `${MARCADOR}-${nome}.xml`,
      mimeType: "application/xml",
      arquivo: Buffer.from(conteudoXml, "utf8"),
      chegadaEm: new Date(),
    },
  });
}

describe("processarDocumento", () => {
  it("classifica por REGRA quando bate em termo, e cria a NotaServico", async () => {
    await prisma.termoPresuncao.create({
      data: { termo: `${TERMO_MARCADOR}xpto alfa`, aliquota: "P8" },
    });
    const doc = await docTeste("a", xml("1", [
      { d: "Servico xpto alfa detalhado", v: 100 },
    ]));

    await processarDocumento(doc.id, criarClassificadorFake(() => []));

    const atualizado = await prisma.documentoEntrada.findUniqueOrThrow({
      where: { id: doc.id },
      include: { notaServico: { include: { itens: true } } },
    });
    expect(atualizado.status).toBe("PROCESSADO");
    expect(atualizado.notaServico?.numero).toBe("1");
    expect(atualizado.notaServico?.itens).toHaveLength(1);
    expect(atualizado.notaServico?.itens[0].origem).toBe("REGRA");
    expect(atualizado.notaServico?.itens[0].aliquota).toBe("P8");
    expect(atualizado.notaServico?.itens[0].status).toBe("CONFIRMADO");
  });

  it("manda os itens sem match pra IA; baixa confiança vira PENDENTE_REVISAO", async () => {
    const doc = await docTeste("b", xml("2", [
      { d: "Servico xpto beta sem termo", v: 300 },
    ]));
    const fake = criarClassificadorFake((itens) =>
      itens.map((_, indice) => ({
        indice,
        aliquota: "P32" as const,
        confianca: 0.4,
        justificativa: "descrição vaga",
      })),
    );

    await processarDocumento(doc.id, fake);

    const nota = await prisma.notaServico.findFirstOrThrow({
      where: { documentoEntradaId: doc.id },
      include: { itens: true },
    });
    expect(nota.itens[0].origem).toBe("IA");
    expect(nota.itens[0].confianca).toBe(0.4);
    expect(nota.itens[0].status).toBe("PENDENTE_REVISAO");
  });

  it("XML ruim -> documento ERRO com mensagem legível, sem NotaServico", async () => {
    const doc = await docTeste("c", "<NFSe><InfNfse>");
    await processarDocumento(doc.id, criarClassificadorFake(() => []));
    const atualizado = await prisma.documentoEntrada.findUniqueOrThrow({ where: { id: doc.id } });
    expect(atualizado.status).toBe("ERRO");
    expect(atualizado.erro).toMatch(/ileg[ií]vel|formato/i);
    expect(await prisma.notaServico.count({ where: { documentoEntradaId: doc.id } })).toBe(0);
  });

  it("chama o classificador em mais de um chunk quando há > 40 itens sem match", async () => {
    const muitos = Array.from({ length: CHUNK_ITENS + 5 }, (_, i) => ({
      d: `Servico sem termo numero ${i}`,
      v: 10,
    }));
    const doc = await docTeste("d", xml("3", muitos));
    const tamanhos: number[] = [];
    const fake = criarClassificadorFake((itens) => {
      tamanhos.push(itens.length);
      return itens.map((_, indice) => ({
        indice,
        aliquota: "P8" as const,
        confianca: 0.99,
        justificativa: "ok",
      }));
    });

    await processarDocumento(doc.id, fake);

    expect(tamanhos.length).toBeGreaterThanOrEqual(2);
    expect(Math.max(...tamanhos)).toBeLessThanOrEqual(CHUNK_ITENS);
  });

  it("não reprocessa um doc que já saiu de PENDENTE", async () => {
    const doc = await docTeste("e", xml("4", [{ d: "Servico xpto beta", v: 10 }]));
    const fake = criarClassificadorFake((itens) =>
      itens.map((_, indice) => ({ indice, aliquota: "P8" as const, confianca: 1, justificativa: "ok" })),
    );
    await processarDocumento(doc.id, fake);
    await processarDocumento(doc.id, fake);
    const notas = await prisma.notaServico.count({ where: { documentoEntradaId: doc.id } });
    expect(notas).toBe(1);
  });
});

describe("processarNotas", () => {
  it("processa o lote e devolve PARCIAL quando uma nota falha", async () => {
    const bom = await docTeste("lote-bom", xml("10", [{ d: "Servico xpto beta", v: 10 }]));
    const ruim = await docTeste("lote-ruim", "<NFSe><InfNfse>");
    const fake = criarClassificadorFake((itens) =>
      itens.map((_, indice) => ({ indice, aliquota: "P32" as const, confianca: 1, justificativa: "ok" })),
    );

    const resultado = await processarNotas({ classificador: fake });

    expect(resultado.status).toBe("PARCIAL");
    expect(resultado.resumo).toMatch(/nota\(s\) no lote/i);

    const depoisBom = await prisma.documentoEntrada.findUniqueOrThrow({ where: { id: bom.id } });
    const depoisRuim = await prisma.documentoEntrada.findUniqueOrThrow({ where: { id: ruim.id } });
    expect(depoisBom.status).toBe("PROCESSADO");
    expect(depoisRuim.status).toBe("ERRO");
  });
});
```

- [ ] **Step 2: Rodar e ver falhar** — `npm test -- processar-sc11`.

- [ ] **Step 3: Implementar `src/lib/presuncao/processar-sc11.ts`**

```ts
import { prisma } from "@/lib/prisma";
import type { ResultadoExecucao } from "@/lib/execucao";
import { IaIndisponivelError } from "@/lib/ia";
import {
  casarTermo,
  classificarStatusItem,
  type AliquotaPresuncao,
  type TermoParaCasar,
} from "./presuncao-termos";
import { parsearNfse, XmlInvalidoError } from "./parsear-nfse";
import {
  classificarComClaude,
  type ClassificadorItens,
  type ItemParaClassificar,
} from "./classificador-itens";

export const CHUNK_ITENS = 40;

function mensagemDeErro(erro: unknown): string {
  if (erro instanceof IaIndisponivelError) return erro.message;
  if (erro instanceof XmlInvalidoError) return erro.message;
  if (erro instanceof Error) return erro.message;
  return "Falha inesperada ao processar a nota.";
}

type ItemMontado = {
  descricao: string;
  valor: number;
  aliquota: AliquotaPresuncao;
  origem: "REGRA" | "IA";
  justificativa: string;
  confianca: number | null;
  status: "CONFIRMADO" | "PENDENTE_REVISAO";
};

async function classificarItens(
  itens: { descricao: string; valor: number }[],
  termos: TermoParaCasar[],
  classificador: ClassificadorItens,
): Promise<ItemMontado[]> {
  const montados: (ItemMontado | null)[] = new Array(itens.length).fill(null);
  const paraIa: { indiceOriginal: number; item: ItemParaClassificar }[] = [];

  itens.forEach((item, i) => {
    const match = casarTermo(item.descricao, termos);
    if (match) {
      montados[i] = {
        descricao: item.descricao,
        valor: item.valor,
        aliquota: match.aliquota,
        origem: "REGRA",
        justificativa: `Termo "${match.termo}".`,
        confianca: null,
        status: "CONFIRMADO",
      };
    } else {
      paraIa.push({ indiceOriginal: i, item: { descricao: item.descricao } });
    }
  });

  for (let inicio = 0; inicio < paraIa.length; inicio += CHUNK_ITENS) {
    const fatia = paraIa.slice(inicio, inicio + CHUNK_ITENS);
    const classificados = await classificador(fatia.map((f) => f.item));
    classificados.forEach((c) => {
      const alvo = fatia[c.indice];
      if (!alvo) return;
      const original = itens[alvo.indiceOriginal];
      montados[alvo.indiceOriginal] = {
        descricao: original.descricao,
        valor: original.valor,
        aliquota: c.aliquota,
        origem: "IA",
        justificativa: c.justificativa,
        confianca: c.confianca,
        status: classificarStatusItem(c.confianca),
      };
    });
  }

  return montados.map((m, i) =>
    m ?? {
      descricao: itens[i].descricao,
      valor: itens[i].valor,
      aliquota: "P32" as const,
      origem: "IA" as const,
      justificativa: "IA não classificou este item.",
      confianca: 0,
      status: "PENDENTE_REVISAO" as const,
    },
  );
}

export async function processarDocumento(
  documentoId: string,
  classificador: ClassificadorItens = classificarComClaude,
): Promise<void> {
  const doc = await prisma.documentoEntrada.findUnique({ where: { id: documentoId } });
  if (!doc || doc.tipo !== "NFSE" || doc.status !== "PENDENTE") return;

  try {
    const nota = parsearNfse(Buffer.from(doc.arquivo).toString("utf8"));
    const termos: TermoParaCasar[] = (
      await prisma.termoPresuncao.findMany({ select: { termo: true, aliquota: true } })
    ).map((t) => ({ termo: t.termo, aliquota: t.aliquota as AliquotaPresuncao }));

    const itens = await classificarItens(nota.itens, termos, classificador);

    await prisma.$transaction(async (tx) => {
      const criada = await tx.notaServico.create({
        data: {
          documentoEntradaId: doc.id,
          numero: nota.numero,
          dataEmissao: new Date(`${nota.dataEmissao}T00:00:00Z`),
          valorTotal: nota.valorTotal,
        },
      });
      for (const item of itens) {
        await tx.itemNota.create({
          data: {
            notaServicoId: criada.id,
            descricao: item.descricao,
            valor: item.valor,
            aliquota: item.aliquota,
            origem: item.origem,
            justificativa: item.justificativa,
            confianca: item.confianca,
            status: item.status,
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

export async function processarNotas(opts?: {
  classificador?: ClassificadorItens;
}): Promise<ResultadoExecucao> {
  const pendentes = await prisma.documentoEntrada.findMany({
    where: { tipo: "NFSE", status: "PENDENTE" },
    orderBy: { chegadaEm: "asc" },
    select: { id: true },
  });

  for (const { id } of pendentes) {
    await processarDocumento(id, opts?.classificador);
  }

  const ids = pendentes.map((p) => p.id);
  const depois = await prisma.documentoEntrada.findMany({
    where: { id: { in: ids } },
    include: { notaServico: { include: { itens: { select: { status: true } } } } },
  });

  const processadas = depois.filter((d) => d.status === "PROCESSADO").length;
  const comErro = depois.filter((d) => d.status === "ERRO").length;
  const emRevisao = depois.reduce(
    (n, d) =>
      n +
      (d.notaServico?.itens.filter((i) => i.status === "PENDENTE_REVISAO").length ?? 0),
    0,
  );

  const resumo =
    `${pendentes.length} nota(s) no lote: ${processadas} processada(s), ${comErro} com erro` +
    (emRevisao > 0 ? `; ${emRevisao} item(ns) em conferência` : "");

  return { status: comErro > 0 ? "PARCIAL" : "SUCESSO", resumo };
}
```

- [ ] **Step 4: Rodar e ver passar** — `npm test -- processar-sc11`.

- [ ] **Step 5: Suíte cheia** — `npm test`.

- [ ] **Step 6: Commit**

```bash
git add src/lib/presuncao/processar-sc11.ts src/lib/presuncao/processar-sc11.test.ts
git commit -m "$(cat <<'EOF'
feat(sc-11): motor de processamento granular por nota

parsearNfse -> casa cada item em termo (origem REGRA) -> os sem
match vao ao classificador em chunks de 40 (origem IA, baixa
confianca vira PENDENTE_REVISAO) -> $transaction cria NotaServico +
ItemNota + marca PROCESSADO. Falha numa nota vira ERRO legivel sem
derrubar o lote; processarNotas devolve PARCIAL nesse caso.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 7: Consultas do painel (integração, TDD)

**Files:**
- Create: `src/lib/presuncao/consultas-sc11.ts`, `src/lib/presuncao/consultas-sc11.test.ts`

**Interfaces:**
- Consumes: `prisma`; `consolidar`, `notaPodeExportar`, `motivoBloqueioRelatorio`, `type Consolidado`, `type AliquotaPresuncao`, `type StatusItemNota`, `type OrigemDecisao` de `./presuncao-termos`.
- Produces:
  - `type NotaResumo = { documentoId: string; clienteRazaoSocial: string; nomeArquivo: string; status: "PENDENTE" | "PROCESSADO" | "ERRO"; chegadaEm: Date; numero: string | null; totalItens: number; emRevisao: number; podeExportar: boolean }`
  - `async function listarNotas(): Promise<NotaResumo[]>`
  - `type ItemDetalhe = { id: string; descricao: string; valor: number; aliquota: AliquotaPresuncao; origem: OrigemDecisao; justificativa: string; confianca: number | null; status: StatusItemNota }`
  - `type NotaDetalhe = { documentoId: string; status: "PENDENTE" | "PROCESSADO" | "ERRO"; erro: string | null; clienteRazaoSocial: string; nomeArquivo: string; numero: string | null; dataEmissao: Date | null; itens: ItemDetalhe[]; consolidado: Consolidado; podeExportar: boolean; motivoBloqueio: string | null }`
  - `async function obterNotaComItens(documentoId: string): Promise<NotaDetalhe | null>`
  - `type TermoView = { id: string; termo: string; aliquota: AliquotaPresuncao }`
  - `async function listarTermos(): Promise<TermoView[]>`
  - `type AuditoriaView = { id: string; termoTexto: string; acao: "CRIACAO" | "RECLASSIFICACAO" | "REMOCAO"; aliquotaAnterior: AliquotaPresuncao | null; aliquotaNova: AliquotaPresuncao | null; autorEmail: string; criadoEm: Date }`
  - `async function listarAuditoriaTermos(limite?: number): Promise<AuditoriaView[]>`

- [ ] **Step 1: Teste que falha — `src/lib/presuncao/consultas-sc11.test.ts`**

```ts
import { afterEach, describe, expect, it } from "vitest";
import { prisma } from "@/lib/prisma";
import { criarClassificadorFake } from "./classificador-itens";
import { processarDocumento } from "./processar-sc11";
import {
  listarNotas,
  obterNotaComItens,
  listarTermos,
  listarAuditoriaTermos,
} from "./consultas-sc11";

const MARCADOR = "sc11-teste";
const CNPJ = "66.666.666/0001-66";
const TERMO_MARCADOR = "zzz-teste-";

afterEach(async () => {
  await prisma.itemNota.deleteMany({
    where: { notaServico: { documentoEntrada: { nomeArquivo: { startsWith: MARCADOR } } } },
  });
  await prisma.notaServico.deleteMany({
    where: { documentoEntrada: { nomeArquivo: { startsWith: MARCADOR } } },
  });
  await prisma.documentoEntrada.deleteMany({ where: { nomeArquivo: { startsWith: MARCADOR } } });
  await prisma.cliente.deleteMany({ where: { cnpj: CNPJ } });
  await prisma.auditoriaTermo.deleteMany({ where: { termoTexto: { startsWith: TERMO_MARCADOR } } });
  await prisma.termoPresuncao.deleteMany({ where: { termo: { startsWith: TERMO_MARCADOR } } });
});

function xml(numero: string, itens: { d: string; v: number }[]): string {
  const linhas = itens
    .map((i) => `<Item><Discriminacao>${i.d}</Discriminacao><Valor>${i.v}</Valor></Item>`)
    .join("");
  return `<NFSe><InfNfse><Numero>${numero}</Numero><DataEmissao>2026-08-07</DataEmissao><ListaItens>${linhas}</ListaItens><ValorTotal>0</ValorTotal></InfNfse></NFSe>`;
}

async function notaProcessada(nome: string, confianca: number) {
  const cliente = await prisma.cliente.upsert({
    where: { cnpj: CNPJ },
    update: {},
    create: { razaoSocial: "Cliente SC-11 Teste", cnpj: CNPJ, atividade: "Teste" },
  });
  const doc = await prisma.documentoEntrada.create({
    data: {
      tipo: "NFSE",
      clienteId: cliente.id,
      nomeArquivo: `${MARCADOR}-${nome}.xml`,
      mimeType: "application/xml",
      arquivo: Buffer.from(xml("77", [{ d: "Servico sem termo alfa", v: 100 }]), "utf8"),
      chegadaEm: new Date(),
    },
  });
  await processarDocumento(
    doc.id,
    criarClassificadorFake((itens) =>
      itens.map((_, indice) => ({ indice, aliquota: "P8" as const, confianca, justificativa: "ok" })),
    ),
  );
  return doc;
}

describe("listarNotas / obterNotaComItens", () => {
  it("resume contagem e conferência; o detalhe traz o consolidado", async () => {
    const doc = await notaProcessada("a", 0.5); // baixa confiança -> 1 item em revisão

    const resumo = (await listarNotas()).find((n) => n.documentoId === doc.id);
    expect(resumo).toMatchObject({ status: "PROCESSADO", totalItens: 1, emRevisao: 1, podeExportar: false });

    const detalhe = await obterNotaComItens(doc.id);
    expect(detalhe?.numero).toBe("77");
    expect(detalhe?.itens).toHaveLength(1);
    expect(detalhe?.consolidado.porBalde[0]).toMatchObject({ aliquota: "P8", somaValor: 100, basePresuncao: 8 });
    expect(detalhe?.podeExportar).toBe(false);
    expect(detalhe?.motivoBloqueio).toMatch(/conferência/);
  });

  it("nota alta confiança já sai exportável", async () => {
    const doc = await notaProcessada("b", 0.99);
    const detalhe = await obterNotaComItens(doc.id);
    expect(detalhe?.podeExportar).toBe(true);
    expect(detalhe?.motivoBloqueio).toBeNull();
  });

  it("obterNotaComItens devolve null para id inexistente", async () => {
    expect(await obterNotaComItens("nao-existe")).toBeNull();
  });
});

describe("listarTermos / listarAuditoriaTermos", () => {
  it("lista termos ordenados e a auditoria do mais novo pro mais velho", async () => {
    const t = await prisma.termoPresuncao.create({
      data: { termo: `${TERMO_MARCADOR}tomografia`, aliquota: "P8" },
    });
    await prisma.auditoriaTermo.create({
      data: { termoId: t.id, termoTexto: t.termo, acao: "CRIACAO", aliquotaNova: "P8", autorEmail: "a@b.c" },
    });
    await prisma.auditoriaTermo.create({
      data: { termoId: t.id, termoTexto: t.termo, acao: "RECLASSIFICACAO", aliquotaAnterior: "P8", aliquotaNova: "P32", autorEmail: "a@b.c" },
    });

    expect((await listarTermos()).some((x) => x.termo === t.termo)).toBe(true);
    const aud = (await listarAuditoriaTermos()).filter((a) => a.termoTexto === t.termo);
    expect(aud[0].acao).toBe("RECLASSIFICACAO");
    expect(aud[1].acao).toBe("CRIACAO");
  });
});
```

- [ ] **Step 2: Rodar e ver falhar** — `npm test -- consultas-sc11`.

- [ ] **Step 3: Implementar `src/lib/presuncao/consultas-sc11.ts`**

```ts
import { prisma } from "@/lib/prisma";
import {
  consolidar,
  motivoBloqueioRelatorio,
  notaPodeExportar,
  type AliquotaPresuncao,
  type Consolidado,
  type OrigemDecisao,
  type StatusItemNota,
} from "./presuncao-termos";

export type NotaResumo = {
  documentoId: string;
  clienteRazaoSocial: string;
  nomeArquivo: string;
  status: "PENDENTE" | "PROCESSADO" | "ERRO";
  chegadaEm: Date;
  numero: string | null;
  totalItens: number;
  emRevisao: number;
  podeExportar: boolean;
};

export async function listarNotas(): Promise<NotaResumo[]> {
  const docs = await prisma.documentoEntrada.findMany({
    where: { tipo: "NFSE" },
    orderBy: { chegadaEm: "desc" },
    include: {
      cliente: { select: { razaoSocial: true } },
      notaServico: { include: { itens: { select: { status: true } } } },
    },
  });

  return docs.map((d) => {
    const itens = d.notaServico?.itens ?? [];
    const emRevisao = itens.filter((i) => i.status === "PENDENTE_REVISAO").length;
    return {
      documentoId: d.id,
      clienteRazaoSocial: d.cliente.razaoSocial,
      nomeArquivo: d.nomeArquivo,
      status: d.status,
      chegadaEm: d.chegadaEm,
      numero: d.notaServico?.numero ?? null,
      totalItens: itens.length,
      emRevisao,
      podeExportar:
        d.status === "PROCESSADO" &&
        notaPodeExportar(itens as { status: StatusItemNota }[]),
    };
  });
}

export type ItemDetalhe = {
  id: string;
  descricao: string;
  valor: number;
  aliquota: AliquotaPresuncao;
  origem: OrigemDecisao;
  justificativa: string;
  confianca: number | null;
  status: StatusItemNota;
};

export type NotaDetalhe = {
  documentoId: string;
  status: "PENDENTE" | "PROCESSADO" | "ERRO";
  erro: string | null;
  clienteRazaoSocial: string;
  nomeArquivo: string;
  numero: string | null;
  dataEmissao: Date | null;
  itens: ItemDetalhe[];
  consolidado: Consolidado;
  podeExportar: boolean;
  motivoBloqueio: string | null;
};

export async function obterNotaComItens(
  documentoId: string,
): Promise<NotaDetalhe | null> {
  const d = await prisma.documentoEntrada.findUnique({
    where: { id: documentoId },
    include: {
      cliente: { select: { razaoSocial: true } },
      notaServico: { include: { itens: { orderBy: { criadoEm: "asc" } } } },
    },
  });
  if (!d || d.tipo !== "NFSE") return null;

  const itens: ItemDetalhe[] = (d.notaServico?.itens ?? []).map((i) => ({
    id: i.id,
    descricao: i.descricao,
    valor: Number(i.valor),
    aliquota: i.aliquota as AliquotaPresuncao,
    origem: i.origem as OrigemDecisao,
    justificativa: i.justificativa,
    confianca: i.confianca,
    status: i.status as StatusItemNota,
  }));

  return {
    documentoId: d.id,
    status: d.status,
    erro: d.erro,
    clienteRazaoSocial: d.cliente.razaoSocial,
    nomeArquivo: d.nomeArquivo,
    numero: d.notaServico?.numero ?? null,
    dataEmissao: d.notaServico?.dataEmissao ?? null,
    itens,
    consolidado: consolidar(itens),
    podeExportar: d.status === "PROCESSADO" && notaPodeExportar(itens),
    motivoBloqueio:
      d.status === "PROCESSADO"
        ? motivoBloqueioRelatorio(itens)
        : "Nota ainda não processada",
  };
}

export type TermoView = { id: string; termo: string; aliquota: AliquotaPresuncao };

export async function listarTermos(): Promise<TermoView[]> {
  const termos = await prisma.termoPresuncao.findMany({ orderBy: { termo: "asc" } });
  return termos.map((t) => ({
    id: t.id,
    termo: t.termo,
    aliquota: t.aliquota as AliquotaPresuncao,
  }));
}

export type AuditoriaView = {
  id: string;
  termoTexto: string;
  acao: "CRIACAO" | "RECLASSIFICACAO" | "REMOCAO";
  aliquotaAnterior: AliquotaPresuncao | null;
  aliquotaNova: AliquotaPresuncao | null;
  autorEmail: string;
  criadoEm: Date;
};

export async function listarAuditoriaTermos(limite = 50): Promise<AuditoriaView[]> {
  const linhas = await prisma.auditoriaTermo.findMany({
    orderBy: { criadoEm: "desc" },
    take: limite,
  });
  return linhas.map((a) => ({
    id: a.id,
    termoTexto: a.termoTexto,
    acao: a.acao as AuditoriaView["acao"],
    aliquotaAnterior: (a.aliquotaAnterior as AliquotaPresuncao | null) ?? null,
    aliquotaNova: (a.aliquotaNova as AliquotaPresuncao | null) ?? null,
    autorEmail: a.autorEmail,
    criadoEm: a.criadoEm,
  }));
}
```

- [ ] **Step 4: Rodar e ver passar** — `npm test -- consultas-sc11`.

- [ ] **Step 5: Commit**

```bash
git add src/lib/presuncao/consultas-sc11.ts src/lib/presuncao/consultas-sc11.test.ts
git commit -m "$(cat <<'EOF'
feat(sc-11): consultas do painel e do detalhe com consolidado

listarNotas agrega total de itens + em conferencia; obterNotaComItens
monta o consolidado por balde e o motivo de bloqueio do relatorio.
listarTermos + listarAuditoriaTermos p/ a tela de admin.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 8: Server Actions + formato

**Files:**
- Create: `src/lib/presuncao/acoes-sc11.ts`, `src/lib/presuncao/acoes-sc11.test.ts`, `src/lib/presuncao/formato-presuncao.ts`

**Interfaces:**
- Consumes: `revalidatePath`, `redirect`, `zod`, `prisma`, `obterSessao`, `filtrarModulosVisiveis`, `executarModulo`, `listarClientesParaUpload` de `@/lib/clientes`, `processarDocumento` / `processarNotas` de `./processar-sc11`, `normalizar` de `./presuncao-termos`.
- Produces:
  - `formato-presuncao.ts`: `ROTULO_ALIQUOTA: Record<AliquotaPresuncao, string>` (`{ P8: "8%", P32: "32%" }`), `ROTULO_ORIGEM: Record<OrigemDecisao, string>`, `formatarValorBRL(n: number): string`, `formatarDataUTC(d: Date): string`.
  - `acoes-sc11.ts`: `type EstadoUpload = { erro: string } | null`; `enviarNota(_prev, formData): Promise<EstadoUpload>`; `processarPendentes(): Promise<void>`; `processarUma(formData): Promise<void>`; `type EstadoRevisao = { erro: string } | null`; `revisarItem(_prev, formData): Promise<EstadoRevisao>`; `excluirNota(formData): Promise<void>`; `type EstadoTermo = { erro: string } | null`; `criarTermo(_prev, formData): Promise<EstadoTermo>`; `editarTermo(formData): Promise<void>`; `removerTermo(formData): Promise<void>`.

- [ ] **Step 1: Implementar `src/lib/presuncao/formato-presuncao.ts`**

```ts
import type {
  AliquotaPresuncao,
  OrigemDecisao,
} from "./presuncao-termos";

export const ROTULO_ALIQUOTA: Record<AliquotaPresuncao, string> = {
  P8: "8%",
  P32: "32%",
};

export const ROTULO_ORIGEM: Record<OrigemDecisao, string> = {
  REGRA: "Regra",
  IA: "IA",
  MANUAL: "Manual",
};

/** R$ 1.234,56 */
export function formatarValorBRL(n: number): string {
  return n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

/** dd/mm/aaaa ancorado em UTC (datas gravadas em meia-noite UTC). */
export function formatarDataUTC(d: Date): string {
  return new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeZone: "UTC" }).format(d);
}
```

- [ ] **Step 2: Implementar `src/lib/presuncao/acoes-sc11.ts`**

```ts
"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import type { Prisma } from "@/generated/prisma/client";
import { obterSessao } from "@/lib/sessao-servidor";
import { filtrarModulosVisiveis } from "@/lib/modulos-catalogo";
import { executarModulo } from "@/lib/execucao";
import { processarDocumento, processarNotas } from "./processar-sc11";
import { normalizar, type AliquotaPresuncao } from "./presuncao-termos";

const ROTA = "/modulos/sc-11";
const ROTA_TERMOS = "/modulos/sc-11/termos";
const TAMANHO_MAX = 5 * 1024 * 1024;

async function exigirAcessoSc11() {
  const sessao = await obterSessao();
  const podeVer =
    sessao !== null &&
    filtrarModulosVisiveis(sessao.papel, sessao.setor).some((m) => m.codigo === "SC-11");
  if (!sessao || !podeVer) throw new Error("Sem acesso ao módulo SC-11.");
  return sessao;
}

async function exigirAdminSc11() {
  const sessao = await exigirAcessoSc11();
  if (sessao.papel !== "ADMIN") throw new Error("Ação restrita ao administrador.");
  return sessao;
}

export type EstadoUpload = { erro: string } | null;

const esquemaUpload = z.object({ clienteId: z.string().min(1, "Selecione o cliente.") });

export async function enviarNota(
  _prev: EstadoUpload,
  formData: FormData,
): Promise<EstadoUpload> {
  await exigirAcessoSc11();

  const dados = esquemaUpload.safeParse({ clienteId: formData.get("clienteId") });
  if (!dados.success) return { erro: dados.error.issues[0]?.message ?? "Dados inválidos." };

  const arquivo = formData.get("arquivo");
  if (!(arquivo instanceof File) || arquivo.size === 0) {
    return { erro: "Anexe o XML da NFS-e." };
  }
  if (!arquivo.name.toLowerCase().endsWith(".xml")) {
    return { erro: "Formato não suportado. Envie o XML da NFS-e." };
  }
  if (arquivo.size > TAMANHO_MAX) return { erro: "Arquivo acima de 5 MB." };

  const cliente = await prisma.cliente.findUnique({ where: { id: dados.data.clienteId } });
  if (!cliente) return { erro: "Cliente não encontrado." };

  await prisma.documentoEntrada.create({
    data: {
      tipo: "NFSE",
      clienteId: dados.data.clienteId,
      nomeArquivo: arquivo.name,
      mimeType: arquivo.type || "application/xml",
      arquivo: Buffer.from(await arquivo.arrayBuffer()),
      chegadaEm: new Date(),
    },
  });

  revalidatePath(ROTA);
  redirect(ROTA);
}

export async function processarPendentes(): Promise<void> {
  const sessao = await exigirAcessoSc11();
  await executarModulo("SC-11", sessao.email, () => processarNotas());
  revalidatePath(ROTA);
}

export async function processarUma(formData: FormData): Promise<void> {
  const sessao = await exigirAcessoSc11();
  const documentoId = String(formData.get("documentoId") ?? "");
  if (!documentoId) return;
  await executarModulo("SC-11", sessao.email, async () => {
    await processarDocumento(documentoId);
    return { status: "SUCESSO", resumo: `Nota ${documentoId} processada sob demanda.` };
  });
  revalidatePath(ROTA);
  revalidatePath(`${ROTA}/nota/${documentoId}`);
}

export type EstadoRevisao = { erro: string } | null;

const esquemaRevisao = z.object({
  itemId: z.string().min(1),
  aliquota: z.enum(["P8", "P32"]),
});

export async function revisarItem(
  _prev: EstadoRevisao,
  formData: FormData,
): Promise<EstadoRevisao> {
  const sessao = await exigirAcessoSc11();
  const dados = esquemaRevisao.safeParse({
    itemId: formData.get("itemId"),
    aliquota: formData.get("aliquota"),
  });
  if (!dados.success) return { erro: "Dados inválidos." };

  const item = await prisma.itemNota.findUnique({
    where: { id: dados.data.itemId },
    include: { notaServico: true },
  });
  if (!item) return { erro: "Item não encontrado." };

  const mudou = item.aliquota !== dados.data.aliquota;
  await prisma.itemNota.update({
    where: { id: item.id },
    data: {
      aliquota: dados.data.aliquota,
      origem: "MANUAL",
      status: "CONFIRMADO",
      confianca: null,
      justificativa: mudou
        ? `Reclassificado de ${item.aliquota === "P8" ? "8%" : "32%"} para ${dados.data.aliquota === "P8" ? "8%" : "32%"} por ${sessao.email}.`
        : `Base ${dados.data.aliquota === "P8" ? "8%" : "32%"} confirmada por ${sessao.email}.`,
    },
  });
  revalidatePath(`${ROTA}/nota/${item.notaServico.documentoEntradaId}`);
  return null;
}

export async function excluirNota(formData: FormData): Promise<void> {
  await exigirAcessoSc11();
  const documentoId = String(formData.get("documentoId") ?? "");
  if (documentoId) {
    await prisma.documentoEntrada.deleteMany({ where: { id: documentoId } });
  }
  revalidatePath(ROTA);
  redirect(ROTA);
}

// ---- Termos (admin) ----

async function registrarAuditoria(
  tx: Prisma.TransactionClient,
  dados: {
    termoId: string | null;
    termoTexto: string;
    acao: "CRIACAO" | "RECLASSIFICACAO" | "REMOCAO";
    aliquotaAnterior?: AliquotaPresuncao | null;
    aliquotaNova?: AliquotaPresuncao | null;
    autorEmail: string;
  },
) {
  await tx.auditoriaTermo.create({
    data: {
      termoId: dados.termoId,
      termoTexto: dados.termoTexto,
      acao: dados.acao,
      aliquotaAnterior: dados.aliquotaAnterior ?? null,
      aliquotaNova: dados.aliquotaNova ?? null,
      autorEmail: dados.autorEmail,
    },
  });
}

export type EstadoTermo = { erro: string } | null;

const esquemaTermo = z.object({
  termo: z.string().trim().min(2, "Termo muito curto."),
  aliquota: z.enum(["P8", "P32"]),
});

export async function criarTermo(
  _prev: EstadoTermo,
  formData: FormData,
): Promise<EstadoTermo> {
  const sessao = await exigirAdminSc11();
  const dados = esquemaTermo.safeParse({
    termo: formData.get("termo"),
    aliquota: formData.get("aliquota"),
  });
  if (!dados.success) return { erro: dados.error.issues[0]?.message ?? "Dados inválidos." };

  const alvo = normalizar(dados.data.termo);
  const existentes = await prisma.termoPresuncao.findMany({ select: { termo: true } });
  if (existentes.some((t) => normalizar(t.termo) === alvo)) {
    return { erro: "Termo equivalente já cadastrado." };
  }

  await prisma.$transaction(async (tx) => {
    const criado = await tx.termoPresuncao.create({
      data: { termo: dados.data.termo, aliquota: dados.data.aliquota },
    });
    await registrarAuditoria(tx, {
      termoId: criado.id,
      termoTexto: criado.termo,
      acao: "CRIACAO",
      aliquotaNova: dados.data.aliquota,
      autorEmail: sessao.email,
    });
  });

  revalidatePath(ROTA_TERMOS);
  return null;
}

const esquemaReclassificar = z.object({
  id: z.string().min(1),
  aliquota: z.enum(["P8", "P32"]),
});

export async function editarTermo(formData: FormData): Promise<void> {
  const sessao = await exigirAdminSc11();
  const dados = esquemaReclassificar.safeParse({
    id: formData.get("id"),
    aliquota: formData.get("aliquota"),
  });
  if (!dados.success) return;

  const termo = await prisma.termoPresuncao.findUnique({ where: { id: dados.data.id } });
  if (!termo || termo.aliquota === dados.data.aliquota) {
    revalidatePath(ROTA_TERMOS);
    return; // no-op não gera auditoria
  }

  await prisma.$transaction(async (tx) => {
    await tx.termoPresuncao.update({
      where: { id: termo.id },
      data: { aliquota: dados.data.aliquota },
    });
    await registrarAuditoria(tx, {
      termoId: termo.id,
      termoTexto: termo.termo,
      acao: "RECLASSIFICACAO",
      aliquotaAnterior: termo.aliquota as AliquotaPresuncao,
      aliquotaNova: dados.data.aliquota,
      autorEmail: sessao.email,
    });
  });

  revalidatePath(ROTA_TERMOS);
}

export async function removerTermo(formData: FormData): Promise<void> {
  const sessao = await exigirAdminSc11();
  const id = String(formData.get("id") ?? "");
  if (!id) return;
  const termo = await prisma.termoPresuncao.findUnique({ where: { id } });
  if (!termo) return;

  await prisma.$transaction(async (tx) => {
    await tx.termoPresuncao.delete({ where: { id } });
    await registrarAuditoria(tx, {
      termoId: null,
      termoTexto: termo.termo,
      acao: "REMOCAO",
      aliquotaAnterior: termo.aliquota as AliquotaPresuncao,
      autorEmail: sessao.email,
    });
  });

  revalidatePath(ROTA_TERMOS);
}
```

- [ ] **Step 3: Teste — `src/lib/presuncao/acoes-sc11.test.ts`**

O `obterSessao` lê cookie; nos testes de action, mocká-lo com `vi.mock`. Escreva:

```ts
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/sessao-servidor", () => ({
  obterSessao: vi.fn(async () => ({
    usuarioId: "u1",
    email: "admin@teste.com",
    nome: "Admin Teste",
    papel: "ADMIN",
    setor: null,
  })),
}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

import { prisma } from "@/lib/prisma";
import { criarClassificadorFake } from "./classificador-itens";
import { processarDocumento } from "./processar-sc11";
import { criarTermo, editarTermo, removerTermo, revisarItem } from "./acoes-sc11";

const TERMO_MARCADOR = "zzz-teste-";
const MARCADOR = "sc11-teste";
const CNPJ = "66.666.666/0001-66";

function fd(obj: Record<string, string>): FormData {
  const f = new FormData();
  for (const [k, v] of Object.entries(obj)) f.set(k, v);
  return f;
}

afterEach(async () => {
  await prisma.itemNota.deleteMany({
    where: { notaServico: { documentoEntrada: { nomeArquivo: { startsWith: MARCADOR } } } },
  });
  await prisma.notaServico.deleteMany({
    where: { documentoEntrada: { nomeArquivo: { startsWith: MARCADOR } } },
  });
  await prisma.documentoEntrada.deleteMany({ where: { nomeArquivo: { startsWith: MARCADOR } } });
  await prisma.cliente.deleteMany({ where: { cnpj: CNPJ } });
  await prisma.auditoriaTermo.deleteMany({ where: { termoTexto: { startsWith: TERMO_MARCADOR } } });
  await prisma.termoPresuncao.deleteMany({ where: { termo: { startsWith: TERMO_MARCADOR } } });
});

describe("criarTermo / editarTermo / removerTermo — auditoria", () => {
  it("criarTermo grava AuditoriaTermo CRIACAO", async () => {
    await criarTermo(null, fd({ termo: `${TERMO_MARCADOR}tomografia`, aliquota: "P8" }));
    const t = await prisma.termoPresuncao.findFirstOrThrow({ where: { termo: `${TERMO_MARCADOR}tomografia` } });
    const aud = await prisma.auditoriaTermo.findFirstOrThrow({ where: { termoId: t.id } });
    expect(aud.acao).toBe("CRIACAO");
    expect(aud.aliquotaNova).toBe("P8");
    expect(aud.autorEmail).toBe("admin@teste.com");
  });

  it("criarTermo rejeita termo equivalente (normalizado)", async () => {
    await criarTermo(null, fd({ termo: `${TERMO_MARCADOR}Raio X`, aliquota: "P8" }));
    const r = await criarTermo(null, fd({ termo: `${TERMO_MARCADOR}raio  x`, aliquota: "P32" }));
    expect(r).toEqual({ erro: "Termo equivalente já cadastrado." });
  });

  it("editarTermo com base diferente grava RECLASSIFICACAO; sem mudança não grava", async () => {
    await criarTermo(null, fd({ termo: `${TERMO_MARCADOR}tc`, aliquota: "P8" }));
    const t = await prisma.termoPresuncao.findFirstOrThrow({ where: { termo: `${TERMO_MARCADOR}tc` } });

    await editarTermo(fd({ id: t.id, aliquota: "P8" })); // no-op
    await editarTermo(fd({ id: t.id, aliquota: "P32" })); // reclassifica

    const auds = await prisma.auditoriaTermo.findMany({
      where: { termoTexto: `${TERMO_MARCADOR}tc` },
      orderBy: { criadoEm: "asc" },
    });
    expect(auds.map((a) => a.acao)).toEqual(["CRIACAO", "RECLASSIFICACAO"]);
    expect(auds[1].aliquotaAnterior).toBe("P8");
    expect(auds[1].aliquotaNova).toBe("P32");
  });

  it("removerTermo grava REMOCAO com snapshot e termoId null", async () => {
    await criarTermo(null, fd({ termo: `${TERMO_MARCADOR}del`, aliquota: "P32" }));
    const t = await prisma.termoPresuncao.findFirstOrThrow({ where: { termo: `${TERMO_MARCADOR}del` } });
    await removerTermo(fd({ id: t.id }));
    expect(await prisma.termoPresuncao.findUnique({ where: { id: t.id } })).toBeNull();
    const aud = await prisma.auditoriaTermo.findFirstOrThrow({
      where: { termoTexto: `${TERMO_MARCADOR}del`, acao: "REMOCAO" },
    });
    expect(aud.termoId).toBeNull();
    expect(aud.aliquotaAnterior).toBe("P32");
  });
});

describe("revisarItem", () => {
  it("vira MANUAL/CONFIRMADO e limpa a confiança", async () => {
    const cliente = await prisma.cliente.upsert({
      where: { cnpj: CNPJ },
      update: {},
      create: { razaoSocial: "Cliente SC-11 Teste", cnpj: CNPJ, atividade: "Teste" },
    });
    const doc = await prisma.documentoEntrada.create({
      data: {
        tipo: "NFSE",
        clienteId: cliente.id,
        nomeArquivo: `${MARCADOR}-rev.xml`,
        mimeType: "application/xml",
        arquivo: Buffer.from(
          `<NFSe><InfNfse><Numero>1</Numero><DataEmissao>2026-08-01</DataEmissao><ListaItens><Item><Discriminacao>Servico vago</Discriminacao><Valor>50</Valor></Item></ListaItens><ValorTotal>50</ValorTotal></InfNfse></NFSe>`,
          "utf8",
        ),
        chegadaEm: new Date(),
      },
    });
    await processarDocumento(
      doc.id,
      criarClassificadorFake((itens) =>
        itens.map((_, indice) => ({ indice, aliquota: "P32" as const, confianca: 0.3, justificativa: "vago" })),
      ),
    );
    const item = await prisma.itemNota.findFirstOrThrow({
      where: { notaServico: { documentoEntradaId: doc.id } },
    });

    await revisarItem(null, fd({ itemId: item.id, aliquota: "P8" }));

    const depois = await prisma.itemNota.findUniqueOrThrow({ where: { id: item.id } });
    expect(depois.origem).toBe("MANUAL");
    expect(depois.status).toBe("CONFIRMADO");
    expect(depois.aliquota).toBe("P8");
    expect(depois.confianca).toBeNull();
    expect(depois.justificativa).toMatch(/Reclassificado de 32% para 8%/);
  });
});
```

- [ ] **Step 4: `tsc` + lint + suíte** — `npx tsc --noEmit && npm run lint && npm test` (todos limpos).

- [ ] **Step 5: Commit**

```bash
git add src/lib/presuncao/acoes-sc11.ts src/lib/presuncao/acoes-sc11.test.ts src/lib/presuncao/formato-presuncao.ts
git commit -m "$(cat <<'EOF'
feat(sc-11): server actions (upload, processar, revisar item, CRUD de termos com auditoria)

enviarNota (so .xml, <=5MB), processarPendentes/processarUma via
executarModulo, revisarItem -> MANUAL/CONFIRMADO. criarTermo/
editarTermo/removerTermo gravam AuditoriaTermo na mesma transacao;
editarTermo sem mudanca de base e no-op; criarTermo rejeita termo
equivalente pelo normalizado.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 9: Relatório CSV + rota de download (com trava)

**Files:**
- Create: `src/lib/presuncao/relatorio-csv.ts`, `src/lib/presuncao/relatorio-csv.test.ts`, `src/app/modulos/sc-11/nota/[documentoId]/relatorio/route.ts`

**Interfaces:**
- Consumes: `type NotaDetalhe` de `./consultas-sc11`; `PERCENTUAL_ALIQUOTA` de `./presuncao-termos`; `obterNotaComItens` de `./consultas-sc11`; `obterSessao`, `filtrarModulosVisiveis`.
- Produces: `function gerarCsvRelatorio(nota: NotaDetalhe): string`.

- [ ] **Step 1: Teste que falha — `src/lib/presuncao/relatorio-csv.test.ts`**

```ts
import { describe, expect, it } from "vitest";
import { gerarCsvRelatorio } from "./relatorio-csv";
import type { NotaDetalhe } from "./consultas-sc11";

const NOTA: NotaDetalhe = {
  documentoId: "d1",
  status: "PROCESSADO",
  erro: null,
  clienteRazaoSocial: "Clínica X",
  nomeArquivo: "nfse.xml",
  numero: "2026-1",
  dataEmissao: new Date("2026-08-07T00:00:00Z"),
  itens: [
    { id: "i1", descricao: "Tomografia; com contraste", valor: 450, aliquota: "P8", origem: "REGRA", justificativa: 'Termo "tomografia".', confianca: null, status: "CONFIRMADO" },
    { id: "i2", descricao: "Consulta", valor: 200, aliquota: "P32", origem: "IA", justificativa: "consulta simples", confianca: 0.9, status: "CONFIRMADO" },
  ],
  consolidado: {
    porBalde: [
      { aliquota: "P8", qtdItens: 1, somaValor: 450, basePresuncao: 36 },
      { aliquota: "P32", qtdItens: 1, somaValor: 200, basePresuncao: 64 },
    ],
    totalValor: 650,
    totalBase: 100,
  },
  podeExportar: true,
  motivoBloqueio: null,
};

describe("gerarCsvRelatorio", () => {
  const csv = gerarCsvRelatorio(NOTA);

  it("começa com BOM e o cabeçalho", () => {
    expect(csv.startsWith("﻿")).toBe(true);
    expect(csv).toContain("descricao;valor;aliquota;origem;justificativa");
  });

  it("usa ; como separador e escapa ; dentro do campo com aspas", () => {
    expect(csv).toContain('"Tomografia; com contraste";450.00;8%;Regra;');
  });

  it("inclui as linhas do consolidado", () => {
    expect(csv).toContain("BASE 8%;450.00;;;36.00");
    expect(csv).toContain("BASE 32%;200.00;;;64.00");
    expect(csv).toContain("TOTAL;650.00;;;100.00");
  });
});
```

- [ ] **Step 2: Rodar e ver falhar** — `npm test -- relatorio-csv`.

- [ ] **Step 3: Implementar `src/lib/presuncao/relatorio-csv.ts`**

```ts
import type { NotaDetalhe } from "./consultas-sc11";
import { ROTULO_ALIQUOTA, ROTULO_ORIGEM } from "./formato-presuncao";

function campo(v: string): string {
  // separador é ';' — se o valor tem ';', '"' ou quebra de linha, entre aspas
  if (/[;"\n]/.test(v)) return `"${v.replace(/"/g, '""')}"`;
  return v;
}

function linha(cols: (string | number)[]): string {
  return cols.map((c) => campo(typeof c === "number" ? c.toFixed(2) : c)).join(";");
}

export function gerarCsvRelatorio(nota: NotaDetalhe): string {
  const linhas: string[] = [];
  linhas.push(linha(["descricao", "valor", "aliquota", "origem", "justificativa"]));

  for (const item of nota.itens) {
    linhas.push(
      linha([
        item.descricao,
        item.valor,
        ROTULO_ALIQUOTA[item.aliquota],
        ROTULO_ORIGEM[item.origem],
        item.justificativa,
      ]),
    );
  }

  linhas.push("");
  for (const b of nota.consolidado.porBalde) {
    linhas.push(linha([`BASE ${ROTULO_ALIQUOTA[b.aliquota]}`, b.somaValor, "", "", b.basePresuncao]));
  }
  linhas.push(linha(["TOTAL", nota.consolidado.totalValor, "", "", nota.consolidado.totalBase]));

  return "﻿" + linhas.join("\r\n") + "\r\n";
}
```

- [ ] **Step 4: Rodar e ver passar** — `npm test -- relatorio-csv`.

- [ ] **Step 5: Implementar `src/app/modulos/sc-11/nota/[documentoId]/relatorio/route.ts`**

```ts
import { NextResponse } from "next/server";
import { obterSessao } from "@/lib/sessao-servidor";
import { filtrarModulosVisiveis } from "@/lib/modulos-catalogo";
import { obterNotaComItens } from "@/lib/presuncao/consultas-sc11";
import { gerarCsvRelatorio } from "@/lib/presuncao/relatorio-csv";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ documentoId: string }> },
) {
  const sessao = await obterSessao();
  const podeVer =
    sessao !== null &&
    filtrarModulosVisiveis(sessao.papel, sessao.setor).some((m) => m.codigo === "SC-11");
  if (!sessao || !podeVer) {
    return NextResponse.json({ erro: "Não autorizado." }, { status: 401 });
  }

  const { documentoId } = await params;
  const nota = await obterNotaComItens(documentoId);
  if (!nota || nota.status !== "PROCESSADO") {
    return NextResponse.json({ erro: "Nota não encontrada." }, { status: 404 });
  }
  if (!nota.podeExportar) {
    return NextResponse.json(
      { erro: nota.motivoBloqueio ?? "Conferência pendente." },
      { status: 403 },
    );
  }

  const csv = gerarCsvRelatorio(nota);
  const arquivo = `nfse-${(nota.numero ?? documentoId).replace(/[^\w-]+/g, "_")}-presuncao.csv`;
  return new NextResponse(csv, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${arquivo}"`,
    },
  });
}
```

- [ ] **Step 6: `tsc` + build** — `npx tsc --noEmit && npm run build` (a rota `ƒ /modulos/sc-11/nota/[documentoId]/relatorio` aparece no output).

- [ ] **Step 7: Commit**

```bash
git add src/lib/presuncao/relatorio-csv.ts src/lib/presuncao/relatorio-csv.test.ts "src/app/modulos/sc-11/nota/[documentoId]/relatorio/route.ts"
git commit -m "$(cat <<'EOF'
feat(sc-11): relatorio CSV consolidado + rota de download travada

CSV com BOM + separador ';' (Excel-BR), uma linha por item e o
consolidado por balde no rodape. A rota devolve 401 sem acesso,
404 se a nota nao existe/nao processou, 403 enquanto houver item
em conferencia; senao o arquivo.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 10: Componentes do painel

**Files:**
- Create: `src/components/presuncao/BadgeAliquota.tsx` (+ `.test.tsx`), `BadgeOrigemDecisao.tsx`, `FormularioUploadNota.tsx`, `TabelaNotas.tsx`, `PainelItens.tsx`, `FilaRevisaoItens.tsx`, `LinhaRevisaoItem.tsx`, `BotaoBaixarRelatorio.tsx`, `TabelaTermos.tsx`, `FormularioTermo.tsx`, `HistoricoAuditoriaTermos.tsx`

**Interfaces:**
- Consumes: tipos de `@/lib/presuncao/consultas-sc11` e `@/lib/presuncao/presuncao-termos`; actions de `@/lib/presuncao/acoes-sc11`; `ROTULO_ALIQUOTA`, `ROTULO_ORIGEM`, `formatarValorBRL`, `formatarDataUTC` de `@/lib/presuncao/formato-presuncao`.
- Produces: os componentes acima, importáveis pelas páginas da Task 11.

- [ ] **Step 1: Aplicar as skills de design** — invoque `ui-ux-pro-max` e `frontend-design`. Baseline: consistência visual com `ModuloCard`, `HistoricoExecucoes`, `PainelCertificados` (SC-20) e `TabelaDocumentos` / `LinhaConferencia` (SC-01). Só tokens da paleta + as 3 fontes, sem dep nova, Tailwind v4 + SVG inline. Alvo: painel de operação denso — tabela de notas com badge de status, upload compacto, **fila de conferência** com a descrição do item + base sugerida + confiança + botões 8%/32%, consolidado por balde, e a **tela de termos** (tabela com alternador 8%⇄32% + form + histórico de auditoria).

- [ ] **Step 2: TDD `BadgeAliquota`** — teste primeiro, `src/components/presuncao/BadgeAliquota.test.tsx`:

```tsx
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { BadgeAliquota } from "./BadgeAliquota";

describe("BadgeAliquota", () => {
  it.each([
    ["P8", "8%"],
    ["P32", "32%"],
  ] as const)("%s -> %s", (aliquota, rotulo) => {
    render(<BadgeAliquota aliquota={aliquota} />);
    expect(screen.getByText(rotulo)).toBeInTheDocument();
  });
});
```

`src/components/presuncao/BadgeAliquota.tsx`:

```tsx
import type { AliquotaPresuncao } from "@/lib/presuncao/presuncao-termos";
import { ROTULO_ALIQUOTA } from "@/lib/presuncao/formato-presuncao";

// 8% = base reduzida (turquesa); 32% = regra geral (grafite).
const CLASSE: Record<AliquotaPresuncao, string> = {
  P8: "bg-turquesa/10 text-turquesa ring-turquesa/25",
  P32: "bg-grafite/10 text-grafite ring-grafite/25",
};

export function BadgeAliquota({ aliquota }: { aliquota: AliquotaPresuncao }) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 font-codigo text-xs font-medium tabular-nums leading-none ring-1 ring-inset ${CLASSE[aliquota]}`}
    >
      {ROTULO_ALIQUOTA[aliquota]}
    </span>
  );
}
```

- [ ] **Step 3: Implementar os demais componentes** seguindo os contratos abaixo. Reusar os recortes de classe do SC-01 (`CAMPO`, botões `bg-petroleo … hover:bg-turquesa`, alerta `role="alert"` com `bg-carmim/10`).

`BadgeOrigemDecisao.tsx` — `{ origem: OrigemDecisao }` → chip com `ROTULO_ORIGEM`: `REGRA` turquesa, `IA` petróleo, `MANUAL` âmbar.

`FormularioUploadNota.tsx` — `"use client"`; props `{ clientes: { id; razaoSocial }[] }`; `useActionState(enviarNota, null)`; `<select name="clienteId" required>` + `<input type="file" name="arquivo" required accept=".xml,text/xml,application/xml">` + botão "Enviar para a fila"; mostra `estado.erro`.

`TabelaNotas.tsx` — props `{ notas: NotaResumo[] }`; colunas: cliente, arquivo/nº, `<BadgeStatusDocumento status={n.status}>` (reusar o do SC-01, em `@/components/documentos/BadgeStatusDocumento`), itens (`n.totalItens`), conferência (`n.emRevisao > 0 ? \`${n.emRevisao} em conferência\` : "—"`), link "Abrir" → `/modulos/sc-11/nota/${n.documentoId}`. Estado vazio com frase.

`PainelItens.tsx` — props `{ itens: ItemDetalhe[]; consolidado: Consolidado }`; tabela (descrição, valor `formatarValorBRL`, `<BadgeAliquota>`, `<BadgeOrigemDecisao>`, justificativa em `text-xs text-grafite`); abaixo, o **consolidado**: uma linha por balde (`ROTULO_ALIQUOTA`, qtd, Σ valor, base) + total.

`LinhaRevisaoItem.tsx` — `"use client"`; props `{ item: ItemDetalhe }`; `useActionState(revisarItem, null)`; mostra descrição + `formatarConfianca`-style (percentual) + justificativa da IA; dois `<button>` num `<form action={acaoFormulario}>` com `<input type="hidden" name="itemId">` e `<button name="aliquota" value="P8">Confirmar 8%</button>` / `value="P32"`. Realça a base sugerida pela IA (`item.aliquota`).

`FilaRevisaoItens.tsx` — props `{ itens: ItemDetalhe[] }`; filtra `status === "PENDENTE_REVISAO"`; se vazio, não renderiza nada; senão título "Conferência" + contagem + lista de `<LinhaRevisaoItem>`.

`BotaoBaixarRelatorio.tsx` — props `{ href: string; bloqueado: boolean; motivo: string | null }`; se `bloqueado`, `<span>` desabilitado com o `motivo`; senão `<a href download>` estilo botão primário.

`TabelaTermos.tsx` — `"use client"`; props `{ termos: TermoView[] }`; por linha: termo, `<BadgeAliquota>`, um `<form action={editarTermo}>` com `<input type="hidden" name="id">` + `<button name="aliquota" value={outraBase}>` ("→ 8%" / "→ 32%"), e um `<form action={removerTermo}>` com botão "Remover" (`onClick` com `confirm`). 

`FormularioTermo.tsx` — `"use client"`; `useActionState(criarTermo, null)`; `<input name="termo">` + `<select name="aliquota">` (8% / 32%) + "Adicionar"; mostra `estado.erro`.

`HistoricoAuditoriaTermos.tsx` — props `{ linhas: AuditoriaView[] }`; lista: `formatarDataUTC(l.criadoEm)` + hora, `l.autorEmail`, `l.termoTexto`, e a mudança — `CRIACAO` → `criado como ${ROTULO_ALIQUOTA[l.aliquotaNova!]}`; `RECLASSIFICACAO` → `${ROTULO_ALIQUOTA[l.aliquotaAnterior!]} → ${ROTULO_ALIQUOTA[l.aliquotaNova!]}`; `REMOCAO` → `removido (era ${ROTULO_ALIQUOTA[l.aliquotaAnterior!]})`. Estado vazio: "Nenhuma alteração ainda."

- [ ] **Step 4: `npm test` + `npm run lint` + `npx tsc --noEmit`** — tudo verde.

- [ ] **Step 5: Commit**

```bash
git add src/components/presuncao
git commit -m "$(cat <<'EOF'
feat(sc-11): componentes do painel (notas, itens, conferencia, termos, auditoria)

Mesmo idioma visual do SC-01/SC-20: so tokens da paleta + as 3
fontes, SVG inline. BadgeAliquota/BadgeOrigemDecisao, upload de
XML, tabela de notas, PainelItens com consolidado, fila de
conferencia com botoes 8%/32%, tela de termos com alternador
inline e historico de auditoria.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 11: Página, detalhe, tela de termos, cron e ligar o módulo

**Files:**
- Create: `src/app/modulos/sc-11/page.tsx`, `src/app/modulos/sc-11/nota/[documentoId]/page.tsx`, `src/app/modulos/sc-11/termos/page.tsx`, `src/app/api/cron/sc-11/route.ts`
- Modify: `vercel.json`, `src/lib/modulos-catalogo.ts`

**Interfaces:**
- Consumes: tudo das Tasks 7–10; `CabecalhoPortal`, `ModuloPageLayout`, `obterSessao`, `sair`, `obterModulo`, `filtrarModulosVisiveis`, `listarHistorico`, `cronAutorizado`, `executarModulo`.
- Produces: as rotas `/modulos/sc-11`, `/modulos/sc-11/nota/[documentoId]`, `/modulos/sc-11/termos`, `/api/cron/sc-11`.

- [ ] **Step 1: `src/app/modulos/sc-11/page.tsx`** — padrão do `sc-01/page.tsx`: guarda de sessão → `redirect("/login")`; `obterModulo("SC-11")` sem `!`; sem acesso → `redirect("/")`. `Promise.all([listarHistorico("SC-11"), listarNotas(), listarClientesParaUpload(), listarTermos()])`. Monta `<CabecalhoPortal>` + `<ModuloPageLayout>` com:
  - `acoes` = `<div className="flex flex-col gap-2">` contendo `<BotaoProcessar acao={processarPendentes} rotulo="Processar pendentes" />` (reusar `@/components/documentos/BotaoProcessar`), microcópia curta, e — só se `sessao.papel === "ADMIN"` — um `<Link href="/modulos/sc-11/termos" className="font-texto text-sm text-turquesa hover:underline">Gerenciar termos de presunção</Link>`.
  - `conteudo` = seção "Enviar NFS-e" (`<FormularioUploadNota clientes={clientes} />`) + seção "Notas" (`<TabelaNotas notas={notas} />`).

- [ ] **Step 2: `src/app/modulos/sc-11/nota/[documentoId]/page.tsx`** — server; `params` como `Promise`; guarda de sessão/acesso. `obterNotaComItens(documentoId)` → `notFound()` se `null`. Renderiza `<CabecalhoPortal>` + `<main className="mx-auto flex max-w-4xl flex-col gap-8 px-6 py-10">` com:
  - cabeçalho: `nota.clienteRazaoSocial`, `nota.numero`, `formatarDataUTC(nota.dataEmissao)` se houver, `<BadgeStatusDocumento status={nota.status}>`, link "← Voltar" para `/modulos/sc-11`.
  - se `nota.status === "PENDENTE"`: `<BotaoProcessar acao={processarUma} rotulo="Processar agora" documentoId={nota.documentoId} />`.
  - se `nota.status === "ERRO"`: box `bg-carmim/10 text-carmim` com `nota.erro` + `<BotaoProcessar acao={processarUma} rotulo="Reprocessar" documentoId={nota.documentoId} />`.
  - se `nota.status === "PROCESSADO"`: `<FilaRevisaoItens itens={nota.itens} />` + `<PainelItens itens={nota.itens} consolidado={nota.consolidado} />` + `<BotaoBaixarRelatorio href={\`/modulos/sc-11/nota/${nota.documentoId}/relatorio\`} bloqueado={!nota.podeExportar} motivo={nota.motivoBloqueio} />`.

- [ ] **Step 3: `src/app/modulos/sc-11/termos/page.tsx`** — server, admin. Guarda de sessão → `redirect("/login")`; se `sessao.papel !== "ADMIN"` → `redirect("/modulos/sc-11")`. `Promise.all([listarTermos(), listarAuditoriaTermos()])`. `<CabecalhoPortal>` + `<main class="mx-auto max-w-4xl …">` com link "← Voltar para o SC-11", `<FormularioTermo />`, `<TabelaTermos termos={termos} />`, `<HistoricoAuditoriaTermos linhas={auditoria} />`.

- [ ] **Step 4: `src/app/api/cron/sc-11/route.ts`** — igual ao `cron/sc-01/route.ts`, trocando `SC-01`→`SC-11` e `processarExtratos`→`processarNotas`:

```ts
import { NextRequest, NextResponse } from "next/server";
import { cronAutorizado } from "@/lib/cron-logica";
import { executarModulo } from "@/lib/execucao";
import { processarNotas } from "@/lib/presuncao/processar-sc11";

export async function GET(request: NextRequest) {
  if (!cronAutorizado(request.headers.get("authorization"), process.env.CRON_SECRET)) {
    return NextResponse.json({ erro: "Não autorizado." }, { status: 401 });
  }
  try {
    const execucao = await executarModulo("SC-11", "scheduler", () => processarNotas());
    return NextResponse.json({
      execucaoId: execucao.id,
      status: execucao.status,
      resumo: execucao.resumo,
      erro: execucao.erro,
    });
  } catch (erro) {
    console.error("[cron sc-11]", erro);
    return NextResponse.json({ erro: "Falha ao executar o módulo." }, { status: 500 });
  }
}
```

- [ ] **Step 5: `vercel.json`** — acrescentar ao array `crons`:

```json
    {
      "path": "/api/cron/sc-11",
      "schedule": "0 8 3 * *"
    }
```

- [ ] **Step 6: `src/lib/modulos-catalogo.ts`** — no objeto `SC-11`, `implementado: false` → `true`.

- [ ] **Step 7: Suíte + build** — `npm test && npm run lint && npx tsc --noEmit && npm run build`. Esperado: verde; rotas `/modulos/sc-11`, `/modulos/sc-11/nota/[documentoId]`, `/modulos/sc-11/nota/[documentoId]/relatorio`, `/modulos/sc-11/termos`, `/api/cron/sc-11` no output.

- [ ] **Step 8: Verificação manual — a IA de verdade**

Pré: `ANTHROPIC_API_KEY` real no `.env`; `docker compose up -d db`; seed rodado (Task 12 — se ainda não, pule para lá e volte).

```bash
npm run dev
```

- Logar como `admin@sheepcontabil.com.br` → card **SC-11** na home.
- SC-11 → subir `prisma/fixtures/nfse-pequena.xml` para um cliente → aparece `PENDENTE`.
- **Processar pendentes** → o documento vira `PROCESSADO`; o histórico ganha `SUCESSO`/`PARCIAL` pelo seu e-mail.
- Abrir a nota → itens classificados; os de baixa confiança na fila de conferência; o botão "Baixar relatório" **desabilitado** com o motivo.
- Confirmar/reclassificar as linhas da fila → botão libera → baixar o CSV → abrir e checar cabeçalho, uma linha por item, e as linhas `BASE 8%` / `BASE 32%` / `TOTAL`.
- Repetir com `nfse-grande.xml` (~387 itens) → confirmar que o chunking aguenta e a página do detalhe renderiza.
- `/modulos/sc-11/termos` (admin) → reclassificar um termo → conferir a linha nova no histórico de auditoria. Reprocessar `nfse-grande.xml`? Não — já está `PROCESSADO`; só notas novas usam o balde novo.
- `curl -i http://localhost:3000/api/cron/sc-11` → 401; com `Authorization: Bearer <CRON_SECRET>` → 200.
- Sem `ANTHROPIC_API_KEY` (comente no `.env`, reinicie): processar uma nota com itens sem termo → vira `ERRO` "IA indisponível…"; as outras não são afetadas.

- [ ] **Step 9: Commit**

```bash
git add src/app/modulos/sc-11 src/app/api/cron/sc-11 vercel.json src/lib/modulos-catalogo.ts
git commit -m "$(cat <<'EOF'
feat(sc-11): pagina, detalhe, tela de termos, cron mensal e SC-11 na home

Pagina lista a caixa de entrada de NFS-e + upload + processar
pendentes; o detalhe tem a fila de conferencia, o consolidado por
balde e o botao de relatorio (travado ate conferir). /modulos/sc-11/
termos (admin) gere os termos com auditoria. /api/cron/sc-11 mensal
(dia 3, 08:00 UTC) protegido por CRON_SECRET. implementado: true
liga o card na home.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 12: Fixtures sintéticos + seed + README

**Files:**
- Create: `prisma/fixtures/gerar-fixtures-nfse.ts`, `prisma/fixtures/nfse-pequena.xml`, `prisma/fixtures/nfse-media.xml`, `prisma/fixtures/nfse-grande.xml`
- Modify: `package.json` (script `fixtures:nfse`), `prisma/seed.ts`, `README.md`

**Interfaces:**
- Consumes: `parsearNfse` (validação implícita ao rodar); models da Task 1.
- Produces: seed idempotente com termos + notas; docs no README.

- [ ] **Step 1: `package.json`** — adicionar em `scripts`:

```json
    "fixtures:nfse": "tsx prisma/fixtures/gerar-fixtures-nfse.ts",
```

- [ ] **Step 2: `prisma/fixtures/gerar-fixtures-nfse.ts`** — script sem placeholders que escreve os 3 XMLs no formato de §6.1 da spec, a partir de um pool de descrições médicas plausíveis. ESM (o projeto é `"module": "esnext"`) — resolve o próprio diretório por `import.meta.url`, igual ao `gerar-fixtures.ts` do SC-01, **não** `__dirname`. Escreva-o completo:

```ts
import { writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const AQUI = dirname(fileURLToPath(import.meta.url));

const OITO = [
  "Tomografia computadorizada de crânio",
  "Ressonância magnética de joelho",
  "Ultrassonografia abdominal total",
  "Radiografia de tórax PA e perfil",
  "Mamografia bilateral",
  "Densitometria óssea de coluna e fêmur",
  "Endoscopia digestiva alta",
  "Colonoscopia com biópsia",
  "Hemograma completo",
  "Dosagem de glicose e perfil lipídico",
  "Eletrocardiograma de repouso",
  "Sessão de quimioterapia",
  "Sessão de radioterapia",
  "Sessão de hemodiálise",
  "Análises clínicas - painel tireoidiano",
];
const TRINTA_E_DOIS = [
  "Consulta médica em consultório",
  "Consulta de retorno com especialista",
  "Perícia médica para seguradora",
  "Elaboração de laudo médico avulso",
  "Junta médica para avaliação de afastamento",
  "Parecer técnico em prontuário",
];

type ItemFix = { descricao: string; valor: number };

function preco(seed: number): number {
  return 60 + ((seed * 37) % 900) + 0.5;
}

function xmlDoItem(it: ItemFix): string {
  return `      <Item><Discriminacao>${it.descricao}</Discriminacao><Valor>${it.valor.toFixed(2)}</Valor></Item>`;
}

function nota(numero: string, dataEmissao: string, itens: ItemFix[]): string {
  const total = itens.reduce((s, i) => s + i.valor, 0);
  return [
    `<?xml version="1.0" encoding="UTF-8"?>`,
    `<NFSe>`,
    `  <InfNfse>`,
    `    <Numero>${numero}</Numero>`,
    `    <DataEmissao>${dataEmissao}</DataEmissao>`,
    `    <PrestadorServico><RazaoSocial>Clínica Vida Plena Diagnósticos</RazaoSocial></PrestadorServico>`,
    `    <ListaItens>`,
    ...itens.map(xmlDoItem),
    `    </ListaItens>`,
    `    <ValorTotal>${total.toFixed(2)}</ValorTotal>`,
    `  </InfNfse>`,
    `</NFSe>`,
    ``,
  ].join("\n");
}

// pequena: 6 itens, mistura clara
const pequena: ItemFix[] = [
  { descricao: OITO[0], valor: 480 },
  { descricao: OITO[3], valor: 120 },
  { descricao: TRINTA_E_DOIS[0], valor: 200 },
  { descricao: OITO[8], valor: 45 },
  { descricao: TRINTA_E_DOIS[2], valor: 350 },
  { descricao: OITO[5], valor: 190 },
];
writeFileSync(join(AQUI, "nfse-pequena.xml"), nota("2026-000101", "2026-08-05", pequena));

// media: ~20 itens, alguns fora do vocabulário dos termos (forçam a IA)
const mediaDescr = [
  ...OITO.slice(0, 10),
  ...TRINTA_E_DOIS,
  "Procedimento ambulatorial não especificado",
  "Atendimento de urgência - avaliação inicial",
  "Aplicação de medicação intravenosa",
  "Curativo especial com desbridamento",
];
const media: ItemFix[] = mediaDescr.map((descricao, i) => ({
  descricao,
  valor: preco(i + 3),
}));
writeFileSync(join(AQUI, "nfse-media.xml"), nota("2026-000102", "2026-08-12", media));

// grande: 387 itens, ciclando o pool + variações
const pool = [...OITO, ...TRINTA_E_DOIS];
const grande: ItemFix[] = Array.from({ length: 387 }, (_, i) => {
  const base = pool[i % pool.length];
  const sufixo = i % 5 === 0 ? ` - sessão ${Math.floor(i / pool.length) + 1}` : "";
  return { descricao: `${base}${sufixo}`, valor: preco(i) };
});
writeFileSync(join(AQUI, "nfse-grande.xml"), nota("2026-000103", "2026-08-20", grande));

console.log("Gerados: nfse-pequena.xml, nfse-media.xml, nfse-grande.xml");
```

- [ ] **Step 3: Rodar** — `npm run fixtures:nfse` → confirmar os 3 arquivos em `prisma/fixtures/`. Rodar `npm test -- parsear-nfse` (segue verde) e abrir `nfse-pequena.xml` para conferir que parece uma NFS-e (cabeçalho, `<ListaItens>` com `<Item>`, `<ValorTotal>`).

- [ ] **Step 4: `prisma/seed.ts`** — adicionar, no estilo das funções existentes.

Em `seedUsuarios()`, mais um upsert:

```ts
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
```

Novas funções + chamadas no `main()`:

```ts
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
    let conteudo: Buffer;
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
```

E no corpo do `main()` (ou equivalente), após `seedClientes()` (precisa dos clientes já criados):

```ts
  await seedTermosPresuncao();
  await seedNotasNfse();
```

(`readFileSync` de `node:fs` e `join` de `node:path` já são importados no topo do `seed.ts` — o `seedDocumentosEntrada` do SC-01 usa os dois.)

- [ ] **Step 5: Rodar o seed 2x** — `npx prisma db seed && npx prisma db seed` → sem erro, sem duplicar termos/notas (upsert / guarda por `findFirst`).

- [ ] **Step 6: `README.md`** — nova subseção sob `## Módulos`, depois da do SC-01:

```markdown
### SC-11 — Presunção correta nas notas de serviço da área médica

Caixa de entrada de NFS-e (`DocumentoEntrada`, `tipo NFSE`, a mesma do SC-01). O operador sobe o **XML** de uma NFS-e médica para um cliente; o botão **Processar pendentes** (ou o cron mensal `/api/cron/sc-11`, dia 3 às 08:00 UTC) parseia os itens e classifica cada um numa base de presunção do lucro presumido:

- **8%** — serviços hospitalares e equiparados (exames, imagem, análises clínicas, terapias, procedimentos).
- **32%** — regra geral dos demais (consulta, perícia, laudo avulso).

Cada item passa primeiro pela **lista de termos** (editável pelo admin em `/modulos/sc-11/termos`). O que não bate em termo nenhum vai para o **`claude-opus-5`** (tool use), em lotes de 40 itens — aguenta uma nota de centenas de itens. Itens que a IA classifica com **confiança `< 0.85`** entram numa **fila de conferência** e precisam ser confirmados (ou reclassificados) manualmente. **O download do relatório só libera quando não há mais item em conferência.**

Cada `ItemNota` guarda **por que** recebeu aquela base (`origem`: `REGRA` / `IA` / `MANUAL`, e a `justificativa`) — como snapshot. Reclassificar um termo depois **não** mexe em nota já processada; a tela de termos tem um **histórico de auditoria** de toda criação/reclassificação/remoção (quem, quando, de qual base para qual).

Processamento é **granular por nota**: uma NFS-e ilegível vira só ela `ERRO`; as outras do lote seguem.

**Precisa de `ANTHROPIC_API_KEY`.** Sem ela, uma nota com itens sem termo vira `ERRO` "IA indisponível" — o resto do portal continua. Notas cujos itens todos batem em termo processam mesmo sem chave.

Visível para o `ADMIN` e para operadores do setor **BPO Saúde**. A tela de termos é só do `ADMIN`.

Fronteira mockada: não existe "lançar no sistema fiscal" — a entrega é o **CSV consolidado** (`descricao;valor;aliquota;origem;justificativa` + base de presunção por balde) e o consolidado auditável na tela.

Fixtures de demonstração em `prisma/fixtures/` (`nfse-pequena/media/grande.xml`, a última com ~387 itens) são geradas por `npm run fixtures:nfse` e carregadas pelo seed.
```

- [ ] **Step 7: Suíte + build** — `npm test && npm run build`.

- [ ] **Step 8: Commit**

```bash
git add prisma/fixtures prisma/seed.ts package.json package-lock.json README.md
git commit -m "$(cat <<'EOF'
feat(sc-11): fixtures sinteticos de NFS-e + seed (termos, notas, operador BPO Saude) + doc

gerar-fixtures-nfse.ts produz 3 XMLs (o maior com ~387 itens, o
caso de estresse do catalogo). Seed: 19 termos iniciais, as 3 notas
como DocumentoEntrada PENDENTE espalhadas no mes, e o operador
operador.saude@sheepcontabil.com.br (setor BPO Saude) pra demo da
segregacao de visao. README ganha a secao do SC-11.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

## Self-Review

**1. Cobertura da spec:**

| Requisito (spec) | Task |
|---|---|
| Enums `AliquotaPresuncao`/`OrigemDecisao`/`StatusItemNota`/`AcaoAuditoria`; models `TermoPresuncao`/`AuditoriaTermo`/`NotaServico`/`ItemNota`; sem FK item→termo (§3) | 1 |
| Reuso de `DocumentoEntrada` (`tipo NFSE`) como caixa de entrada (§2, §3.3) | 1, 8 (`enviarNota`) |
| `IaIndisponivelError` compartilhado; `listarClientesParaUpload` fora de `documentos/` (§17.3) | 2 |
| Motor puro: `normalizar`, `casarTermo` (mais específico vence, empate→32%), `consolidar`, `notaPodeExportar`, limiar 0.85 (§5) | 3 |
| Parser ABRASF simplificado, namespaces, `XmlInvalidoError` (§6) | 4 |
| `classificarComClaude` (`claude-opus-5`, tool `registrar_classificacoes` enum `["8","32"]`), fake (§7) | 5 |
| Chunks de 40, sequenciais; granularidade por nota; `PARCIAL` (§4) | 6 |
| Fila de conferência: `PENDENTE_REVISAO` → `revisarItem` → `MANUAL`/`CONFIRMADO` (§8) | 8, 10 (`FilaRevisaoItens`/`LinhaRevisaoItem`), 11 |
| Consolidado por balde + CSV (`;`, BOM), rota 403 até conferir (§9) | 3 (`consolidar`), 9 |
| Tela `/modulos/sc-11/termos` (admin): reclassificar inline + auditoria na mesma transação (§10) | 8, 10, 11 |
| Página do módulo, detalhe, cron `0 8 3 * *`, flag de catálogo (§11, §12) | 11 |
| Acesso `BPO Saúde` + operador no seed; tela de termos só ADMIN (§13) | 8 (`exigirAdminSc11`), 11, 12 |
| Seed: 19 termos + 3 XMLs (um ~387 itens) via `npm run fixtures:nfse` (§14) | 12 |
| Erro conhecido → mensagem legível; lote granular (§15) | 6 (`mensagemDeErro`), 8, 9 |
| Testes: motor de termos, parser, classificador, processar, consultas, actions, CSV (§16) | 3–9 |
| 1 dep nova: `fast-xml-parser` (§18) | 4 |

Sem lacunas.

**2. Placeholders:** nenhum "TBD"/"TODO". Os componentes da Task 10 Step 3 vêm com contrato completo (props, tipos, comportamento, classes a reusar) em vez de código bloco-a-bloco — decisão consciente para não inflar o plano, seguindo o precedente da Task 9 do plano do SC-01; `BadgeAliquota` é feito em TDD com código completo como âncora do idioma visual.

**3. Consistência de tipos:**
- `AliquotaPresuncao = "P8" | "P32"` (Task 3) — consumido como string union por 5, 6, 7, 8, 9, 10; ponte `as` para o enum Prisma nas bordas de 6/7/8 (padrão idêntico ao `StatusConferencia` do SC-01).
- `ClassificadorItens` / `ItemClassificado` / `ItemParaClassificar` (Task 5) — consumidos por 6 e pelos testes de 6/7/8.
- `NfseParseada` / `parsearNfse` / `XmlInvalidoError` (Task 4) — consumidos por 6.
- `NotaDetalhe` / `ItemDetalhe` / `Consolidado` (Tasks 3, 7) — consumidos por 9 (`gerarCsvRelatorio`), 10 (`PainelItens`), 11.
- `NotaResumo` (Task 7) — consumido por 10 (`TabelaNotas`), 11.
- `TermoView` / `AuditoriaView` (Task 7) — consumidos por 10 (`TabelaTermos`, `HistoricoAuditoriaTermos`), 11.
- `EstadoUpload` / `EstadoRevisao` / `EstadoTermo` (Task 8) — consumidos pelos componentes `"use client"` da Task 10 via `useActionState`.
- `executarModulo(codigo, disparadoPor, executar)` e `ResultadoExecucao` — assinatura da fundação, respeitada em 6, 8, 11.
- `cronAutorizado(authHeader, secret)` de `@/lib/cron-logica` — usado só na rota da Task 11.
- `PERCENTUAL_ALIQUOTA` (Task 3) — usado em 3 (`consolidar`); `ROTULO_ALIQUOTA` (Task 8) — usado em 9, 10.
- Rota `/modulos/sc-11` — `ModuloCard` da fundação linka `/modulos/${codigo.toLowerCase()}` = `/modulos/sc-11`. Bate.
- `valor`: `Decimal` no banco (Task 1) → `number` na borda das consultas (Task 7, `Number(i.valor)`) → `number` no consolidado (Task 3) e no CSV (Task 9). Consistente.
