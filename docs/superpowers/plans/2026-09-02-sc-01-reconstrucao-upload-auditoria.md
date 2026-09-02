# SC-01 — Reconstrução, upload e auditoria (Plano A) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Reconstruir as telas da SC-01 no shell da marca, trocar o upload por um modal multi-extrato com auto-detecção de cliente/banco, endurecer a régua da IA para 100%, tornar a leitura automática no envio e substituir o "Histórico de execução" por uma aba de auditoria — entregando uma SC-01 completa e melhor, sem ainda o subsistema de controle mensal (Plano B).

**Architecture:** Next 16 (App Router, Server Components + server actions), Prisma 7 (`@/generated/prisma/client`), Postgres. Lógica pura em `src/lib/documentos/*` sem Prisma (testável no Vitest); componentes em `src/components/documentos/*`; páginas e rotas em `src/app/modulos/sc-01/*`. A extração de extrato (Claude Opus) roda em `after()` depois do envio; uma segunda chamada leve (Claude Haiku) lê só o cabeçalho no anexo. Auditoria reaproveita o model genérico `RegistroAuditoria` criado pela SC-20.

**Tech Stack:** Next 16.3.3, React 19, Prisma 7.10, `@anthropic-ai/sdk` 0.122, Zod 4, Tailwind 4, Vitest 4, `@testing-library/react` 16.

**Spec:** [../specs/2026-09-02-sc-01-controle-entrega-design.md](../specs/2026-09-02-sc-01-controle-entrega-design.md) — este plano implementa §2 itens 1, 2, 4, 5 (parcial), 6 (parcial: sem cobrança), 9, 11, 12, 13; §5.4, §5.5, §5.6; §6; §7; §8 (abas Documentos/Auditoria); §10; §11; §15; §16; §17; §18; §19. Ficam para o Plano B: §4.2/§4.4 (campos de `Cliente` e `CobrancaExtrato`), §5.1/§5.2/§5.3 (dias úteis, cobertura, periodicidade), §9 (aba Controle), §13 (Configurar cliente), §14 (cobrança WhatsApp), §20 (seed dos 4 status).

## Global Constraints

- **Paleta — só estes 7 tokens Tailwind:** `petroleo` (#10505F, primário/marca), `turquesa` (#1FA69A, ação/sucesso/link), `ambar` (#E8A33D, atenção/pendência), `tinta` (#0B1A20, texto/fundo escuro), `grafite` (#5A7078, texto secundário/borda), `nevoa` (#EEF3F4, superfície), `carmim` (#C4453D, **exclusivo** de erro/falha). Nenhuma cor fora disso.
- **Tipografia:** `font-titulo` (Archivo, títulos e números de destaque), `font-texto` (IBM Plex Sans, texto e formulário), `font-codigo` (IBM Plex Mono, datas, valores, agência/conta, contadores).
- **PT-BR** em toda a UI, cópia, rótulos e mensagens de erro.
- **Import do Prisma Client:** `@/generated/prisma/client`.
- **Migração:** 100% aditiva, segura sobre banco não-vazio, sem backfill que dependa de estado (lição da SC-20).
- **Datas** de lançamento e de período são ancoradas em **meia-noite UTC** (`new Date(\`${iso}T00:00:00Z\`)`); formatação sempre em UTC (`formatarDataUTC`).
- **Régua de confiança:** `LIMIAR_CONFIANCA = 1`. `confianca >= 1` → `CONFIRMADO`; `< 1` → `PENDENTE_REVISAO`. **Nunca** ramificar por `mimeType`.
- **OFX** só libera quando **todas** as linhas do documento estão `CONFIRMADO` (comportamento atual mantido).
- **Next 16 não é o Next que você conhece.** Antes de usar qualquer API que não esteja já em uso no repo (em especial `after()` de `next/server`), leia o guia em `node_modules/next/dist/docs/` resolvido a partir da raiz do projeto.
- **Escopo de arquivos:** só `src/app/modulos/sc-01/**`, `src/lib/documentos/**`, `src/components/documentos/**` — exceto onde uma task disser explicitamente o contrário (SC-20 audit scoping em `certificados/consultas.ts`; remoção de subtítulos em SC-11/SC-20/home; `SpecularButton` em `components/ui`; `vercel.json`; `README.md`; `prisma/**`).
- **TDD, Vitest, commits frequentes.** `npm test` = `vitest run`. Rodar um arquivo: `npx vitest run <path>`. Rodar um teste: `npx vitest run <path> -t "<nome>"`.
- **Antes de escrever cada componente de UI novo**, invocar a skill `frontend-design`.
- **Setor da SC-01:** `Contábil`. Acesso: `filtrarModulosVisiveis(papel, setor).some(m => m.codigo === "SC-01")`.

---

## File Structure

**Criar:**
- `src/lib/documentos/filtros-documentos.ts` — filtrar/ordenar a tabela de documentos (puro).
- `src/lib/documentos/filtros-documentos.test.ts`
- `src/lib/documentos/historico.ts` — união de ações de auditoria da SC-01, rótulos, acento, `NATUREZAS` (puro).
- `src/lib/documentos/historico.test.ts`
- `src/lib/documentos/deteccao-cabecalho.ts` — chamada Claude Haiku (cabeçalho) + `casarCabecalho` (puro).
- `src/lib/documentos/deteccao-cabecalho.test.ts`
- `src/lib/documentos/csv-auditoria.ts` — serialização CSV da auditoria (puro).
- `src/lib/documentos/csv-auditoria.test.ts`
- `src/components/documentos/BlocoUploadExtrato.tsx` — um bloco {arquivo → detecção → cliente/banco}.
- `src/components/documentos/BlocoUploadExtrato.test.tsx`
- `src/components/documentos/ModalEnviarExtratos.tsx` — modal multi-bloco.
- `src/components/documentos/ModalEnviarExtratos.test.tsx`
- `src/components/documentos/PainelDocumentos.tsx` — toolbar + `TabelaDocumentos` (client, aba Documentos).
- `src/components/documentos/PainelDocumentos.test.tsx`
- `src/components/documentos/FiltrosAuditoriaDocumentos.tsx` — filtros da aba Auditoria (client).
- `src/components/documentos/TimelineAuditoria.tsx` — timeline de auditoria da SC-01.
- `src/components/documentos/TimelineAuditoria.test.tsx`
- `src/components/documentos/VisualizadorArquivo.tsx` — PDF em iframe / imagem com zoom.
- `src/components/documentos/VisualizadorArquivo.test.tsx`
- `src/app/modulos/sc-01/documento/[documentoId]/arquivo/route.ts` — streama os bytes do arquivo.
- `src/app/modulos/sc-01/historico/relatorio/route.ts` — CSV da auditoria.
- `docs/extratos-exemplo/banco-meridiano.html` — extrato de exemplo (mês inteiro).
- `docs/extratos-exemplo/cooperativa-sulcampos.html` — extrato de exemplo (só até dia 29).
- `prisma/migrations/<timestamp>_sc01_periodo_extrato/migration.sql`

**Modificar:**
- `prisma/schema.prisma` — 3 campos + índice em `DocumentoEntrada`.
- `src/lib/documentos/conferencia.ts` — `LIMIAR_CONFIANCA = 1`.
- `src/lib/documentos/conferencia.test.ts` — casos da nova régua.
- `src/lib/documentos/formato-documentos.ts` — comentário/limiar de `tomConfianca` (o corte já usa `LIMIAR_CONFIANCA`).
- `src/lib/documentos/extrator-extrato.ts` — `INSTRUCAO` reescrita; tool devolve `periodoInicio`/`periodoFim`; assinatura `ResultadoExtracao`.
- `src/lib/documentos/processar-sc01.ts` — grava período/competência; auditoria `LEITURA_CONCLUIDA`/`LEITURA_FALHOU`.
- `src/lib/documentos/processar-sc01.test.ts` — ajustes de assinatura + período + auditoria.
- `src/lib/documentos/acoes-sc01.ts` — `enviarDocumentos` (multi), `detectarCabecalho`, `reprocessarDocumento` (ex-`processarUm`), auditoria em `confirmarLancamento`/`excluirDocumento`; remove `processarPendentes`.
- `src/lib/documentos/consultas-sc01.ts` — `listarDocumentos` com `competencia` + `bancoRotulo`; `listarHistoricoDocumentos`.
- `src/lib/documentos/consultas-sc01.test.ts` — cobre os novos campos e a nova consulta.
- `src/lib/certificados/consultas.ts` — escopar `listarHistorico` e `obterPerfilCliente` por `entidade`.
- `src/lib/certificados/consultas.test.ts` — assere o escopo.
- `src/components/documentos/TabelaDocumentos.tsx` — coluna Banco, ordenação por cabeçalho, célula Arquivo clicável.
- `src/components/documentos/PainelLancamentos.tsx` / `LinhaConferencia.tsx` — reestilizar para o painel claro da tela de detalhe.
- `src/components/ui/SpecularButton.tsx` / `SpecularButton.css` — brilho preso para dentro do botão.
- `src/app/modulos/sc-01/page.tsx` — shell, abas Documentos/Auditoria, KPIs, botão "Enviar extratos", sem "Processar pendentes" nem "Histórico de execução".
- `src/app/modulos/sc-01/documento/[documentoId]/page.tsx` — reconstruída no shell, 2 colunas com visualizador.
- `src/app/modulos/sc-01/documento/[documentoId]/ofx/route.ts` — auditoria `OFX_BAIXADO`.
- `src/app/modulos/sc-11/page.tsx`, `src/app/modulos/sc-20/page.tsx`, `src/app/page.tsx` (+ painéis/modais da SC-20) — remoção dos parágrafos-subtítulo.
- `prisma/seed.ts` — `periodoInicio/periodoFim/competencia` nos 4 fixtures de extrato.
- `vercel.json` — cron SC-01 → diário.
- `README.md` — seção SC-01.

**Remover:**
- `src/components/documentos/FormularioUploadDocumento.tsx` (+ teste, se houver).

---

## Task 1: Migração — campos de período em `DocumentoEntrada`

**Files:**
- Modify: `prisma/schema.prisma` (model `DocumentoEntrada`, ~L209-228)
- Create: `prisma/migrations/<timestamp>_sc01_periodo_extrato/migration.sql`
- Test: `src/lib/documentos/consultas-sc01.test.ts` (roda a suíte inteira depois)

**Interfaces:**
- Produces: `DocumentoEntrada.periodoInicio: DateTime?`, `periodoFim: DateTime?`, `competencia: String?`; índice `@@index([tipo, competencia])`.

- [ ] **Step 1: Editar o schema**

Em `prisma/schema.prisma`, no model `DocumentoEntrada`, logo após `processadoEm DateTime?`:

```prisma
  periodoInicio   DateTime?
  periodoFim      DateTime?
  competencia     String?
```

E na lista de índices do model, adicionar:

```prisma
  @@index([tipo, competencia])
```

- [ ] **Step 2: Gerar a migração sem aplicar e revisar o SQL**

Run: `npx prisma migrate dev --name sc01_periodo_extrato --create-only`
Abrir `prisma/migrations/<timestamp>_sc01_periodo_extrato/migration.sql` e conferir que é **só** `ALTER TABLE "DocumentoEntrada" ADD COLUMN ...` (3×, todas nullable) + `CREATE INDEX`. Nenhum `DROP`, nenhum `UPDATE`, nenhum `NOT NULL`.

- [ ] **Step 3: Aplicar a migração e regenerar o client**

Run: `npx prisma migrate dev` (aplica a pendente) — ou `npx prisma migrate deploy && npx prisma generate` se preferir explícito.
Expected: migração aplicada, `src/generated/prisma` regenerado sem erro.

- [ ] **Step 4: Rodar a suíte inteira**

Run: `npm test`
Expected: PASS — nada quebrou (os campos novos são opcionais e ninguém os lê ainda).

- [ ] **Step 5: Commit**

```bash
git add prisma/schema.prisma prisma/migrations src/generated/prisma
git commit -m "feat(sc-01): campos de periodo de cobertura em DocumentoEntrada"
```

---

## Task 2: Régua de confiança 100%

**Files:**
- Modify: `src/lib/documentos/conferencia.ts:1`
- Modify: `src/lib/documentos/conferencia.test.ts`
- Modify: `src/lib/documentos/formato-documentos.ts` (comentário de `tomConfianca`)
- Test: `src/lib/documentos/conferencia.test.ts`

**Interfaces:**
- Produces: `LIMIAR_CONFIANCA === 1`; `classificarLancamento(0.999) === "PENDENTE_REVISAO"`, `classificarLancamento(1) === "CONFIRMADO"`.
- Consumes: nada.

- [ ] **Step 1: Reescrever os testes de `classificarLancamento`**

Em `src/lib/documentos/conferencia.test.ts`, substituir o bloco `describe("classificarLancamento", ...)` por:

```ts
describe("classificarLancamento", () => {
  it("abaixo de 100% vai para revisao", () => {
    expect(classificarLancamento(0.999)).toBe("PENDENTE_REVISAO");
    expect(classificarLancamento(0.85)).toBe("PENDENTE_REVISAO");
    expect(classificarLancamento(0)).toBe("PENDENTE_REVISAO");
  });
  it("exatamente 100% e confirmado", () => {
    expect(classificarLancamento(1)).toBe("CONFIRMADO");
    expect(classificarLancamento(LIMIAR_CONFIANCA)).toBe("CONFIRMADO");
  });
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npx vitest run src/lib/documentos/conferencia.test.ts`
Expected: FAIL — `classificarLancamento(0.999)` retorna `"CONFIRMADO"` com o limiar atual `0.85`.

- [ ] **Step 3: Baixar o limiar para 1**

Em `src/lib/documentos/conferencia.ts:1`:

```ts
export const LIMIAR_CONFIANCA = 1;
```

`classificarLancamento` e `documentoPodeBaixarOfx`/`motivoBloqueioOfx` ficam como estão (a função já é `confianca < LIMIAR_CONFIANCA ? "PENDENTE_REVISAO" : "CONFIRMADO"`).

- [ ] **Step 4: Atualizar o comentário de `tomConfianca`**

Em `src/lib/documentos/formato-documentos.ts`, no comentário acima de `tomConfianca`, trocar a frase que menciona "o mesmo LIMIAR_CONFIANCA que decide CONFIRMADO x PENDENTE_REVISAO" por: "o corte de cima é `LIMIAR_CONFIANCA` (agora 1) — só 100% pinta de turquesa; `0.6` é o degrau visual do meio." O código de `tomConfianca` **não muda** (já compara com `LIMIAR_CONFIANCA`).

- [ ] **Step 5: Rodar os testes de novo**

Run: `npx vitest run src/lib/documentos/conferencia.test.ts`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/lib/documentos/conferencia.ts src/lib/documentos/conferencia.test.ts src/lib/documentos/formato-documentos.ts
git commit -m "feat(sc-01): regua de confianca 100% (LIMIAR_CONFIANCA = 1)"
```

---

## Task 3: `filtros-documentos.ts` — filtrar e ordenar a tabela

**Files:**
- Create: `src/lib/documentos/filtros-documentos.ts`
- Test: `src/lib/documentos/filtros-documentos.test.ts`

**Interfaces:**
- Consumes: `DocumentoResumo` de `./consultas-sc01` — assumir que ganhará `bancoRotulo: string | null` e `competencia: string` na Task 8; até lá o teste usa objetos literais com esses campos.
- Produces:
  - `type FiltrosDocumento = { busca: string; status: "TODOS" | "PENDENTE" | "PROCESSADO" | "ERRO"; banco: string; competencia: string }`
  - `type OrdenacaoDocumento = "cliente-asc" | "cliente-desc" | "chegada-asc" | "chegada-desc" | "status-asc" | "status-desc" | "linhas-asc" | "linhas-desc"`
  - `filtrarDocumentos(docs, filtros): DocumentoResumo[]`
  - `ordenarDocumentos(docs, ordenacao): DocumentoResumo[]`
  - `bancosDisponiveis(docs): string[]` — rótulos distintos, ordenados.

- [ ] **Step 1: Escrever os testes**

```ts
// src/lib/documentos/filtros-documentos.test.ts
import { describe, expect, it } from "vitest";
import {
  bancosDisponiveis,
  filtrarDocumentos,
  ordenarDocumentos,
} from "./filtros-documentos";
import type { DocumentoResumo } from "./consultas-sc01";

function doc(over: Partial<DocumentoResumo>): DocumentoResumo {
  return {
    id: "d",
    clienteRazaoSocial: "Alfa Comércio de Materiais Ltda",
    tipo: "EXTRATO",
    nomeArquivo: "extrato.pdf",
    status: "PROCESSADO",
    chegadaEm: new Date("2026-08-10T00:00:00Z"),
    totalLancamentos: 3,
    emRevisao: 0,
    podeBaixarOfx: true,
    bancoRotulo: "Banco Meridiano — ag 1201 c/c 45678-9",
    competencia: "2026-08",
    ...over,
  };
}

describe("filtrarDocumentos", () => {
  it("busca casa cliente e nome do arquivo, sem acento e sem caixa", () => {
    const docs = [
      doc({ id: "a", clienteRazaoSocial: "Épsilon Tecnologia" }),
      doc({ id: "b", nomeArquivo: "AGOSTO-conta.jpg" }),
      doc({ id: "c", clienteRazaoSocial: "Outra" }),
    ];
    const r = filtrarDocumentos(docs, {
      busca: "epsilon",
      status: "TODOS",
      banco: "TODOS",
      competencia: "",
    });
    expect(r.map((d) => d.id)).toEqual(["a"]);
    expect(
      filtrarDocumentos(docs, { busca: "agosto", status: "TODOS", banco: "TODOS", competencia: "" }).map((d) => d.id),
    ).toEqual(["b"]);
  });

  it("filtra por status, banco e competencia combinados", () => {
    const docs = [
      doc({ id: "a", status: "ERRO" }),
      doc({ id: "b", status: "PROCESSADO", bancoRotulo: "Banco X" }),
      doc({ id: "c", status: "PROCESSADO", competencia: "2026-07" }),
    ];
    expect(
      filtrarDocumentos(docs, { busca: "", status: "PROCESSADO", banco: "TODOS", competencia: "2026-08" }).map((d) => d.id),
    ).toEqual(["b"]);
  });
});

describe("ordenarDocumentos", () => {
  it("chegada-desc põe o mais recente primeiro", () => {
    const docs = [
      doc({ id: "velho", chegadaEm: new Date("2026-08-01T00:00:00Z") }),
      doc({ id: "novo", chegadaEm: new Date("2026-08-20T00:00:00Z") }),
    ];
    expect(ordenarDocumentos(docs, "chegada-desc").map((d) => d.id)).toEqual(["novo", "velho"]);
    expect(ordenarDocumentos(docs, "chegada-asc").map((d) => d.id)).toEqual(["velho", "novo"]);
  });

  it("status-asc ordena PENDENTE < PROCESSADO < ERRO", () => {
    const docs = [
      doc({ id: "e", status: "ERRO" }),
      doc({ id: "p", status: "PENDENTE" }),
      doc({ id: "ok", status: "PROCESSADO" }),
    ];
    expect(ordenarDocumentos(docs, "status-asc").map((d) => d.id)).toEqual(["p", "ok", "e"]);
  });

  it("cliente-asc usa localeCompare pt-BR e não muta a entrada", () => {
    const docs = [doc({ id: "z", clienteRazaoSocial: "Zeta" }), doc({ id: "a", clienteRazaoSocial: "Alfa" })];
    const copia = [...docs];
    expect(ordenarDocumentos(docs, "cliente-asc").map((d) => d.id)).toEqual(["a", "z"]);
    expect(docs).toEqual(copia);
  });
});

describe("bancosDisponiveis", () => {
  it("devolve rótulos distintos e ordenados, ignorando null", () => {
    const docs = [
      doc({ bancoRotulo: "Banco B" }),
      doc({ bancoRotulo: "Banco A" }),
      doc({ bancoRotulo: "Banco B" }),
      doc({ bancoRotulo: null }),
    ];
    expect(bancosDisponiveis(docs)).toEqual(["Banco A", "Banco B"]);
  });
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npx vitest run src/lib/documentos/filtros-documentos.test.ts`
Expected: FAIL — módulo não existe.

- [ ] **Step 3: Implementar**

```ts
// src/lib/documentos/filtros-documentos.ts
import type { DocumentoResumo } from "./consultas-sc01";

export type FiltrosDocumento = {
  busca: string;
  status: "TODOS" | "PENDENTE" | "PROCESSADO" | "ERRO";
  banco: string; // "TODOS" ou um rótulo de bancosDisponiveis
  competencia: string; // "" ou "YYYY-MM"
};

export type OrdenacaoDocumento =
  | "cliente-asc"
  | "cliente-desc"
  | "chegada-asc"
  | "chegada-desc"
  | "status-asc"
  | "status-desc"
  | "linhas-asc"
  | "linhas-desc";

function normalizar(texto: string): string {
  return texto
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "");
}

const RANK_STATUS: Record<DocumentoResumo["status"], number> = {
  PENDENTE: 0,
  PROCESSADO: 1,
  ERRO: 2,
};

export function filtrarDocumentos(
  docs: DocumentoResumo[],
  { busca, status, banco, competencia }: FiltrosDocumento,
): DocumentoResumo[] {
  const q = normalizar(busca.trim());
  return docs.filter((d) => {
    if (status !== "TODOS" && d.status !== status) return false;
    if (banco !== "TODOS" && d.bancoRotulo !== banco) return false;
    if (competencia && d.competencia !== competencia) return false;
    if (
      q &&
      !normalizar(d.clienteRazaoSocial).includes(q) &&
      !normalizar(d.nomeArquivo).includes(q)
    ) {
      return false;
    }
    return true;
  });
}

const COMPARADORES: Record<
  OrdenacaoDocumento,
  (a: DocumentoResumo, b: DocumentoResumo) => number
> = {
  "cliente-asc": (a, b) => a.clienteRazaoSocial.localeCompare(b.clienteRazaoSocial, "pt-BR"),
  "cliente-desc": (a, b) => b.clienteRazaoSocial.localeCompare(a.clienteRazaoSocial, "pt-BR"),
  "chegada-asc": (a, b) => a.chegadaEm.getTime() - b.chegadaEm.getTime(),
  "chegada-desc": (a, b) => b.chegadaEm.getTime() - a.chegadaEm.getTime(),
  "status-asc": (a, b) => RANK_STATUS[a.status] - RANK_STATUS[b.status],
  "status-desc": (a, b) => RANK_STATUS[b.status] - RANK_STATUS[a.status],
  "linhas-asc": (a, b) => a.totalLancamentos - b.totalLancamentos,
  "linhas-desc": (a, b) => b.totalLancamentos - a.totalLancamentos,
};

export function ordenarDocumentos(
  docs: DocumentoResumo[],
  ordenacao: OrdenacaoDocumento,
): DocumentoResumo[] {
  return [...docs].sort(COMPARADORES[ordenacao]);
}

export function bancosDisponiveis(docs: DocumentoResumo[]): string[] {
  const set = new Set<string>();
  for (const d of docs) if (d.bancoRotulo) set.add(d.bancoRotulo);
  return [...set].sort((a, b) => a.localeCompare(b, "pt-BR"));
}
```

- [ ] **Step 4: Rodar e ver passar**

Run: `npx vitest run src/lib/documentos/filtros-documentos.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/documentos/filtros-documentos.ts src/lib/documentos/filtros-documentos.test.ts
git commit -m "feat(sc-01): filtros e ordenacao da tabela de documentos"
```

---

## Task 4: `historico.ts` — vocabulário de auditoria da SC-01

**Files:**
- Create: `src/lib/documentos/historico.ts`
- Test: `src/lib/documentos/historico.test.ts`

**Interfaces:**
- Consumes: `camposAlterados`, `rotuloAtor` de `@/lib/certificados/historico` (reaproveitados via import).
- Produces:
  - `type AcaoAuditoriaDocumento` — união de 9 valores (ver código).
  - `type LinhaAuditoriaDocumento = { id: string; acao: AcaoAuditoriaDocumento; descricao: string; autorEmail: string | null; criadoEm: Date; dadosAntes: Record<string, unknown> | null; dadosDepois: Record<string, unknown> | null }`
  - `ROTULO_ACAO: Record<AcaoAuditoriaDocumento, string>`
  - `ACENTO_ACAO: Record<AcaoAuditoriaDocumento, "turquesa" | "ambar" | "carmim">`
  - `NATUREZAS: { valor: AcaoAuditoriaDocumento; rotulo: string }[]`
  - re-export de `camposAlterados`, `rotuloAtor`.

- [ ] **Step 1: Escrever os testes**

```ts
// src/lib/documentos/historico.test.ts
import { describe, expect, it } from "vitest";
import {
  ACENTO_ACAO,
  NATUREZAS,
  ROTULO_ACAO,
  type AcaoAuditoriaDocumento,
} from "./historico";

const TODAS: AcaoAuditoriaDocumento[] = [
  "EXTRATO_ENVIADO",
  "LEITURA_CONCLUIDA",
  "LEITURA_FALHOU",
  "LINHA_CONFERIDA",
  "REPROCESSADO",
  "OFX_BAIXADO",
  "DOCUMENTO_EXCLUIDO",
  "EXTRATO_COBRADO",
  "CLIENTE_CONFIGURADO",
];

describe("historico da SC-01", () => {
  it("todo valor tem rótulo e acento", () => {
    for (const a of TODAS) {
      expect(ROTULO_ACAO[a]).toBeTruthy();
      expect(["turquesa", "ambar", "carmim"]).toContain(ACENTO_ACAO[a]);
    }
  });

  it("falhas e exclusão são carmim", () => {
    expect(ACENTO_ACAO.LEITURA_FALHOU).toBe("carmim");
    expect(ACENTO_ACAO.DOCUMENTO_EXCLUIDO).toBe("carmim");
  });

  it("NATUREZAS cobre exatamente as 9 ações", () => {
    expect(NATUREZAS.map((n) => n.valor).sort()).toEqual([...TODAS].sort());
  });
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npx vitest run src/lib/documentos/historico.test.ts`
Expected: FAIL — módulo não existe.

- [ ] **Step 3: Implementar**

```ts
// src/lib/documentos/historico.ts
export { camposAlterados, rotuloAtor } from "@/lib/certificados/historico";

export type AcaoAuditoriaDocumento =
  | "EXTRATO_ENVIADO"
  | "LEITURA_CONCLUIDA"
  | "LEITURA_FALHOU"
  | "LINHA_CONFERIDA"
  | "REPROCESSADO"
  | "OFX_BAIXADO"
  | "DOCUMENTO_EXCLUIDO"
  | "EXTRATO_COBRADO"
  | "CLIENTE_CONFIGURADO";

export type LinhaAuditoriaDocumento = {
  id: string;
  acao: AcaoAuditoriaDocumento;
  descricao: string;
  autorEmail: string | null;
  criadoEm: Date;
  dadosAntes: Record<string, unknown> | null;
  dadosDepois: Record<string, unknown> | null;
};

export const ROTULO_ACAO: Record<AcaoAuditoriaDocumento, string> = {
  EXTRATO_ENVIADO: "Extrato enviado",
  LEITURA_CONCLUIDA: "Leitura concluída",
  LEITURA_FALHOU: "Leitura falhou",
  LINHA_CONFERIDA: "Linha conferida",
  REPROCESSADO: "Reprocessado",
  OFX_BAIXADO: "OFX baixado",
  DOCUMENTO_EXCLUIDO: "Documento excluído",
  EXTRATO_COBRADO: "Extrato cobrado",
  CLIENTE_CONFIGURADO: "Cliente configurado",
};

export const ACENTO_ACAO: Record<
  AcaoAuditoriaDocumento,
  "turquesa" | "ambar" | "carmim"
> = {
  EXTRATO_ENVIADO: "turquesa",
  LEITURA_CONCLUIDA: "turquesa",
  OFX_BAIXADO: "turquesa",
  LINHA_CONFERIDA: "ambar",
  REPROCESSADO: "ambar",
  EXTRATO_COBRADO: "ambar",
  CLIENTE_CONFIGURADO: "ambar",
  LEITURA_FALHOU: "carmim",
  DOCUMENTO_EXCLUIDO: "carmim",
};

export const NATUREZAS: { valor: AcaoAuditoriaDocumento; rotulo: string }[] = [
  { valor: "EXTRATO_ENVIADO", rotulo: ROTULO_ACAO.EXTRATO_ENVIADO },
  { valor: "LEITURA_CONCLUIDA", rotulo: ROTULO_ACAO.LEITURA_CONCLUIDA },
  { valor: "LEITURA_FALHOU", rotulo: ROTULO_ACAO.LEITURA_FALHOU },
  { valor: "LINHA_CONFERIDA", rotulo: ROTULO_ACAO.LINHA_CONFERIDA },
  { valor: "REPROCESSADO", rotulo: ROTULO_ACAO.REPROCESSADO },
  { valor: "OFX_BAIXADO", rotulo: ROTULO_ACAO.OFX_BAIXADO },
  { valor: "DOCUMENTO_EXCLUIDO", rotulo: ROTULO_ACAO.DOCUMENTO_EXCLUIDO },
  { valor: "EXTRATO_COBRADO", rotulo: ROTULO_ACAO.EXTRATO_COBRADO },
  { valor: "CLIENTE_CONFIGURADO", rotulo: ROTULO_ACAO.CLIENTE_CONFIGURADO },
];
```

- [ ] **Step 4: Rodar e ver passar**

Run: `npx vitest run src/lib/documentos/historico.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/documentos/historico.ts src/lib/documentos/historico.test.ts
git commit -m "feat(sc-01): vocabulario de auditoria (acoes, rotulos, acento)"
```

---

## Task 5: Extrator — período no retorno + prompt de 100%

**Files:**
- Modify: `src/lib/documentos/extrator-extrato.ts`
- Test: `src/lib/documentos/extrator-extrato.test.ts` (criar se não existir)

**Interfaces:**
- Produces:
  - `type ResultadoExtracao = { linhas: LinhaExtraida[]; periodoInicio: string | null; periodoFim: string | null }`
  - `type ExtratorExtrato = (arquivo: { mimeType: string; base64: string }) => Promise<ResultadoExtracao>`
  - `criarExtratorFake(linhas: LinhaExtraida[], periodo?: { inicio: string | null; fim: string | null }): ExtratorExtrato`
  - `extrairExtratoComClaude: ExtratorExtrato`
- Consumes: nada novo.

- [ ] **Step 1: Escrever o teste do fake e do shape**

```ts
// src/lib/documentos/extrator-extrato.test.ts
import { describe, expect, it } from "vitest";
import { criarExtratorFake, type LinhaExtraida } from "./extrator-extrato";

const LINHA: LinhaExtraida = {
  data: "2026-08-03",
  historico: "TED RECEBIDA",
  valor: 100,
  confianca: 1,
};

describe("criarExtratorFake", () => {
  it("devolve linhas e período nulo por padrão", async () => {
    const ex = criarExtratorFake([LINHA]);
    expect(await ex({ mimeType: "application/pdf", base64: "x" })).toEqual({
      linhas: [LINHA],
      periodoInicio: null,
      periodoFim: null,
    });
  });

  it("devolve o período quando informado", async () => {
    const ex = criarExtratorFake([LINHA], { inicio: "2026-08-01", fim: "2026-08-31" });
    const r = await ex({ mimeType: "application/pdf", base64: "x" });
    expect(r.periodoInicio).toBe("2026-08-01");
    expect(r.periodoFim).toBe("2026-08-31");
  });
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npx vitest run src/lib/documentos/extrator-extrato.test.ts`
Expected: FAIL — `criarExtratorFake` hoje devolve `LinhaExtraida[]`, não o objeto.

- [ ] **Step 3: Reescrever `extrator-extrato.ts`**

Trocar o tipo de retorno e o fake, adicionar `periodoInicio`/`periodoFim` ao `input_schema` da ferramenta, reescrever `INSTRUCAO`, e ajustar o parse:

```ts
export type ResultadoExtracao = {
  linhas: LinhaExtraida[];
  periodoInicio: string | null; // ISO yyyy-mm-dd
  periodoFim: string | null;
};

export type ExtratorExtrato = (arquivo: {
  mimeType: string;
  base64: string;
}) => Promise<ResultadoExtracao>;

export function criarExtratorFake(
  linhas: LinhaExtraida[],
  periodo?: { inicio: string | null; fim: string | null },
): ExtratorExtrato {
  return async () => ({
    linhas,
    periodoInicio: periodo?.inicio ?? null,
    periodoFim: periodo?.fim ?? null,
  });
}
```

No `FERRAMENTA.input_schema.properties`, adicionar ao lado de `linhas`:

```ts
      periodoInicio: {
        type: "string",
        description:
          "Data inicial da cobertura DECLARADA no cabeçalho do extrato (ex.: 'Período: 01/08/2026 a 31/08/2026'), em ISO yyyy-mm-dd. Null se não houver.",
      },
      periodoFim: {
        type: "string",
        description: "Data final da cobertura declarada no cabeçalho, ISO yyyy-mm-dd. Null se não houver.",
      },
```

`INSTRUCAO` nova:

```ts
const INSTRUCAO = `Você recebe um extrato bancário brasileiro (PDF ou foto). Extraia TODOS os lançamentos, um por linha de movimentação. Para cada um:
- data em ISO yyyy-mm-dd
- historico: a descrição do lançamento
- valor em reais: NEGATIVO para débito/saída, POSITIVO para crédito/entrada
- confianca de 0 a 1: use 1 SOMENTE quando a leitura DAQUELA linha for inequívoca — dígitos nítidos, layout claro, nenhuma ambiguidade. Qualquer dúvida (foto tremida, dígito borrado, valor cortado, coluna ambígua, leiaute confuso) → confianca ABAIXO de 1.
- trechoOriginal: o texto literal de onde leu

Informe também periodoInicio e periodoFim: o período de cobertura DECLARADO no cabeçalho do extrato (linhas como "Período: 01/08/2026 a 31/08/2026", "Movimentação de ... a ...", "EXTRATO SIMPLIFICADO - AGOSTO/2026"). Se o cabeçalho não declarar, deixe null.

Ignore saldos, cabeçalhos e totais na lista de lançamentos — só as movimentações. Chame a ferramenta registrar_lancamentos uma vez, com todas as linhas e o período.`;
```

No corpo de `extrairExtratoComClaude`, onde hoje faz `return input.linhas ?? []`:

```ts
  if (toolUse && toolUse.type === "tool_use") {
    const input = toolUse.input as {
      linhas?: LinhaExtraida[];
      periodoInicio?: string | null;
      periodoFim?: string | null;
    };
    return {
      linhas: input.linhas ?? [],
      periodoInicio: input.periodoInicio ?? null,
      periodoFim: input.periodoFim ?? null,
    };
  }
```

E no fallback de texto, ao dar `JSON.parse`, devolver `{ linhas: obj.linhas ?? [], periodoInicio: obj.periodoInicio ?? null, periodoFim: obj.periodoFim ?? null }`. O `throw` final continua igual.

- [ ] **Step 4: Rodar e ver passar**

Run: `npx vitest run src/lib/documentos/extrator-extrato.test.ts`
Expected: PASS. Depois `npx vitest run src/lib/documentos/processar-sc01.test.ts` vai FALHAR (assinatura mudou) — corrigido na Task 7.

- [ ] **Step 5: Commit**

```bash
git add src/lib/documentos/extrator-extrato.ts src/lib/documentos/extrator-extrato.test.ts
git commit -m "feat(sc-01): extrator devolve periodo do cabecalho e prompt de 100%"
```

---

## Task 6: `deteccao-cabecalho.ts` — leitura rápida do cabeçalho

**Files:**
- Create: `src/lib/documentos/deteccao-cabecalho.ts`
- Test: `src/lib/documentos/deteccao-cabecalho.test.ts`

**Interfaces:**
- Consumes: `@anthropic-ai/sdk`, `IaIndisponivelError`/`traduzirErroAnthropic` de `@/lib/ia`.
- Produces:
  - `type CabecalhoExtrato = { razaoSocial: string | null; banco: string | null; agencia: string | null; conta: string | null; periodoInicio: string | null; periodoFim: string | null; confianca: number }`
  - `type DetectorCabecalho = (arquivo: { mimeType: string; base64: string }) => Promise<CabecalhoExtrato>`
  - `criarDetectorFake(c: CabecalhoExtrato): DetectorCabecalho`
  - `detectarCabecalhoComClaude: DetectorCabecalho`
  - `casarCabecalho(cab, clientes, contasPorCliente): { clienteId: string | null; contaBancariaId: string | null }`
    - `clientes: { id: string; razaoSocial: string }[]`
    - `contasPorCliente: Record<string, { id: string; bancoNome: string; agencia: string; numero: string }[]>`

- [ ] **Step 1: Escrever os testes de `casarCabecalho`**

```ts
// src/lib/documentos/deteccao-cabecalho.test.ts
import { describe, expect, it } from "vitest";
import { casarCabecalho, criarDetectorFake, type CabecalhoExtrato } from "./deteccao-cabecalho";

const CLIENTES = [
  { id: "c-alfa", razaoSocial: "Alfa Comércio de Materiais Ltda" },
  { id: "c-beta", razaoSocial: "Beta Consultoria Empresarial Ltda" },
];
const CONTAS = {
  "c-alfa": [
    { id: "cb-1", bancoNome: "Banco Meridiano", agencia: "1201", numero: "45678-9" },
    { id: "cb-2", bancoNome: "Banco Sul", agencia: "0007", numero: "11111-1" },
  ],
  "c-beta": [{ id: "cb-3", bancoNome: "Cooperativa Sul-Campos", agencia: "0455", numero: "10293-8" }],
};

const BASE: CabecalhoExtrato = {
  razaoSocial: null, banco: null, agencia: null, conta: null,
  periodoInicio: null, periodoFim: null, confianca: 0.9,
};

describe("casarCabecalho", () => {
  it("casa cliente por razão social sem acento/caixa e conta por agência+número", () => {
    const r = casarCabecalho(
      { ...BASE, razaoSocial: "ALFA COMERCIO DE MATERIAIS LTDA", agencia: "1201", conta: "45678-9" },
      CLIENTES,
      CONTAS,
    );
    expect(r).toEqual({ clienteId: "c-alfa", contaBancariaId: "cb-1" });
  });

  it("casa conta por nome do banco quando agência/número não batem", () => {
    const r = casarCabecalho(
      { ...BASE, razaoSocial: "Alfa Comércio de Materiais Ltda", banco: "meridiano" },
      CLIENTES,
      CONTAS,
    );
    expect(r).toEqual({ clienteId: "c-alfa", contaBancariaId: "cb-1" });
  });

  it("cliente sem match confiável devolve nulos", () => {
    expect(casarCabecalho({ ...BASE, razaoSocial: "Empresa Desconhecida SA" }, CLIENTES, CONTAS)).toEqual({
      clienteId: null,
      contaBancariaId: null,
    });
  });

  it("cliente único mas conta ambígua devolve clienteId e conta null", () => {
    expect(
      casarCabecalho({ ...BASE, razaoSocial: "Alfa Comércio de Materiais Ltda" }, CLIENTES, CONTAS),
    ).toEqual({ clienteId: "c-alfa", contaBancariaId: null });
  });
});

describe("criarDetectorFake", () => {
  it("devolve o cabeçalho fixo", async () => {
    const det = criarDetectorFake({ ...BASE, razaoSocial: "X" });
    expect((await det({ mimeType: "image/jpeg", base64: "z" })).razaoSocial).toBe("X");
  });
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npx vitest run src/lib/documentos/deteccao-cabecalho.test.ts`
Expected: FAIL — módulo não existe.

- [ ] **Step 3: Implementar**

```ts
// src/lib/documentos/deteccao-cabecalho.ts
import Anthropic from "@anthropic-ai/sdk";
import { IaIndisponivelError, traduzirErroAnthropic } from "@/lib/ia";

const MODELO = "claude-haiku-4-5-20251001";

export type CabecalhoExtrato = {
  razaoSocial: string | null;
  banco: string | null;
  agencia: string | null;
  conta: string | null;
  periodoInicio: string | null; // ISO yyyy-mm-dd
  periodoFim: string | null;
  confianca: number; // 0..1
};

export type DetectorCabecalho = (arquivo: {
  mimeType: string;
  base64: string;
}) => Promise<CabecalhoExtrato>;

export function criarDetectorFake(c: CabecalhoExtrato): DetectorCabecalho {
  return async () => c;
}

const FERRAMENTA = {
  name: "identificar_cabecalho",
  description: "Registra o que está no cabeçalho do extrato bancário.",
  input_schema: {
    type: "object" as const,
    properties: {
      razaoSocial: { type: "string", description: "Titular / razão social da conta, como aparece no cabeçalho. Null se ilegível." },
      banco: { type: "string", description: "Nome do banco. Null se ilegível." },
      agencia: { type: "string", description: "Número da agência. Null se ilegível." },
      conta: { type: "string", description: "Número da conta corrente. Null se ilegível." },
      periodoInicio: { type: "string", description: "Início do período de cobertura declarado, ISO yyyy-mm-dd. Null se não houver." },
      periodoFim: { type: "string", description: "Fim do período declarado, ISO yyyy-mm-dd. Null se não houver." },
      confianca: { type: "number", description: "Sua confiança geral na leitura do cabeçalho, 0 a 1." },
    },
    required: ["confianca"],
  },
};

const INSTRUCAO = `Leia APENAS o cabeçalho deste extrato bancário — não extraia lançamentos. Informe titular/razão social, banco, agência, número da conta e o período de cobertura declarado. Deixe null o que não conseguir ler com segurança. Chame identificar_cabecalho uma vez.`;

export const detectarCabecalhoComClaude: DetectorCabecalho = async ({ mimeType, base64 }) => {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new IaIndisponivelError();
  const client = new Anthropic({ apiKey });

  const blocoArquivo =
    mimeType === "application/pdf"
      ? { type: "document" as const, source: { type: "base64" as const, media_type: "application/pdf" as const, data: base64 } }
      : { type: "image" as const, source: { type: "base64" as const, media_type: mimeType as "image/jpeg" | "image/png", data: base64 } };

  let mensagem;
  try {
    mensagem = await client.messages.create({
      model: MODELO,
      max_tokens: 1024,
      tools: [FERRAMENTA],
      messages: [{ role: "user", content: [blocoArquivo, { type: "text", text: INSTRUCAO }] }],
    });
  } catch (erro) {
    throw traduzirErroAnthropic(erro);
  }

  const toolUse = mensagem.content.find((b) => b.type === "tool_use");
  const vazio: CabecalhoExtrato = {
    razaoSocial: null, banco: null, agencia: null, conta: null,
    periodoInicio: null, periodoFim: null, confianca: 0,
  };
  if (toolUse && toolUse.type === "tool_use") {
    const i = toolUse.input as Partial<CabecalhoExtrato>;
    return {
      razaoSocial: i.razaoSocial ?? null,
      banco: i.banco ?? null,
      agencia: i.agencia ?? null,
      conta: i.conta ?? null,
      periodoInicio: i.periodoInicio ?? null,
      periodoFim: i.periodoFim ?? null,
      confianca: typeof i.confianca === "number" ? i.confianca : 0,
    };
  }
  return vazio;
};

function normalizar(t: string): string {
  return t.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").trim();
}
function digitos(t: string | null): string {
  return (t ?? "").replace(/\D/g, "");
}

export function casarCabecalho(
  cab: CabecalhoExtrato,
  clientes: { id: string; razaoSocial: string }[],
  contasPorCliente: Record<string, { id: string; bancoNome: string; agencia: string; numero: string }[]>,
): { clienteId: string | null; contaBancariaId: string | null } {
  if (!cab.razaoSocial) return { clienteId: null, contaBancariaId: null };
  const alvo = normalizar(cab.razaoSocial);
  const casados = clientes.filter((c) => {
    const n = normalizar(c.razaoSocial);
    return n === alvo || n.includes(alvo) || alvo.includes(n);
  });
  if (casados.length !== 1) return { clienteId: null, contaBancariaId: null };
  const cliente = casados[0];

  const contas = contasPorCliente[cliente.id] ?? [];
  if (contas.length === 0) return { clienteId: cliente.id, contaBancariaId: null };
  if (contas.length === 1) return { clienteId: cliente.id, contaBancariaId: contas[0].id };

  const ag = digitos(cab.agencia);
  const cc = digitos(cab.conta);
  const porNumero = contas.find((c) => ag && cc && digitos(c.agencia) === ag && digitos(c.numero) === cc);
  if (porNumero) return { clienteId: cliente.id, contaBancariaId: porNumero.id };

  const banco = cab.banco ? normalizar(cab.banco) : "";
  const porBanco = contas.filter((c) => banco && normalizar(c.bancoNome).includes(banco));
  if (porBanco.length === 1) return { clienteId: cliente.id, contaBancariaId: porBanco[0].id };

  return { clienteId: cliente.id, contaBancariaId: null };
}
```

- [ ] **Step 4: Rodar e ver passar**

Run: `npx vitest run src/lib/documentos/deteccao-cabecalho.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/documentos/deteccao-cabecalho.ts src/lib/documentos/deteccao-cabecalho.test.ts
git commit -m "feat(sc-01): deteccao de cabecalho (Haiku) + casamento com o cadastro"
```

---

## Task 7: `processar-sc01.ts` — grava período/competência + auditoria

**Files:**
- Modify: `src/lib/documentos/processar-sc01.ts`
- Modify: `src/lib/documentos/processar-sc01.test.ts`

**Interfaces:**
- Consumes: `ResultadoExtracao` (Task 5); `RegistroAuditoria` do Prisma.
- Produces: `processarDocumento(documentoId, extrator?)` — inalterado na assinatura, mas agora grava `periodoInicio`/`periodoFim`/`competencia` e um `RegistroAuditoria` (`LEITURA_CONCLUIDA` ou `LEITURA_FALHOU`, `autorId`/`autorEmail` null = Sistema). Novo helper exportado `derivarCompetencia(iso: string | null, fallback: Date): string`.

- [ ] **Step 1: Ajustar os testes existentes + adicionar os novos**

Em `src/lib/documentos/processar-sc01.test.ts`: onde o fake é criado, passar o período; onde se espera o array de linhas, ajustar para `.linhas`. Adicionar:

```ts
it("grava periodoInicio/Fim/competencia do resultado da extração", async () => {
  // cenário: cria cliente + documento PENDENTE (ver helpers do arquivo)
  const { docId } = await cenarioPendente();
  await processarDocumento(
    docId,
    criarExtratorFake(
      [{ data: "2026-08-03", historico: "TED", valor: 100, confianca: 1 }],
      { inicio: "2026-08-01", fim: "2026-08-31" },
    ),
  );
  const doc = await prisma.documentoEntrada.findUniqueOrThrow({ where: { id: docId } });
  expect(doc.periodoInicio?.toISOString()).toBe("2026-08-01T00:00:00.000Z");
  expect(doc.periodoFim?.toISOString()).toBe("2026-08-31T00:00:00.000Z");
  expect(doc.competencia).toBe("2026-08");
});

it("registra LEITURA_CONCLUIDA na auditoria", async () => {
  const { docId, clienteId } = await cenarioPendente();
  await processarDocumento(
    docId,
    criarExtratorFake([{ data: "2026-08-03", historico: "TED", valor: 100, confianca: 0.5 }]),
  );
  const reg = await prisma.registroAuditoria.findFirst({
    where: { entidade: "DocumentoEntrada", entidadeId: docId, acao: "LEITURA_CONCLUIDA" },
  });
  expect(reg).not.toBeNull();
  expect(reg?.clienteId).toBe(clienteId);
  expect(reg?.autorEmail).toBeNull();
  expect(reg?.descricao).toContain("1 em conferência");
});

it("registra LEITURA_FALHOU quando o extrator lança", async () => {
  const { docId } = await cenarioPendente();
  const quebrado = async () => {
    throw new Error("arquivo ilegível");
  };
  await processarDocumento(docId, quebrado);
  const reg = await prisma.registroAuditoria.findFirst({
    where: { entidade: "DocumentoEntrada", entidadeId: docId, acao: "LEITURA_FALHOU" },
  });
  expect(reg?.descricao).toContain("ilegível");
});
```

(Se o arquivo de teste não tiver um helper `cenarioPendente`, extrair um do que já existe — cria `Cliente` com cnpj de teste + `DocumentoEntrada` `PENDENTE` e devolve `{ docId, clienteId }`. Limpar `registroAuditoria` no `afterEach` por `entidadeId`.)

- [ ] **Step 2: Rodar e ver falhar**

Run: `npx vitest run src/lib/documentos/processar-sc01.test.ts`
Expected: FAIL — período não é gravado; não há `RegistroAuditoria`.

- [ ] **Step 3: Implementar**

Em `processar-sc01.ts`:

```ts
export function derivarCompetencia(iso: string | null, fallback: Date): string {
  if (iso && /^\d{4}-\d{2}-\d{2}$/.test(iso)) return iso.slice(0, 7);
  return `${fallback.getUTCFullYear()}-${String(fallback.getUTCMonth() + 1).padStart(2, "0")}`;
}
```

No corpo de `processarDocumento`, trocar `const linhas = await extrator(...)` por `const resultado = await extrator(...)` e usar `resultado.linhas`. Dentro da `$transaction`, depois de criar os `Lancamento`:

```ts
      const emRevisao = resultado.linhas.filter(
        (l) => classificarLancamento(l.confianca) === "PENDENTE_REVISAO",
      ).length;

      await tx.documentoEntrada.update({
        where: { id: doc.id },
        data: {
          status: "PROCESSADO",
          processadoEm: new Date(),
          erro: null,
          periodoInicio: resultado.periodoInicio
            ? new Date(`${resultado.periodoInicio}T00:00:00Z`)
            : null,
          periodoFim: resultado.periodoFim
            ? new Date(`${resultado.periodoFim}T00:00:00Z`)
            : null,
          competencia: derivarCompetencia(
            resultado.periodoFim ?? resultado.periodoInicio,
            doc.chegadaEm,
          ),
        },
      });

      await tx.registroAuditoria.create({
        data: {
          entidade: "DocumentoEntrada",
          entidadeId: doc.id,
          acao: "LEITURA_CONCLUIDA",
          descricao:
            `IA leu ${resultado.linhas.length} ` +
            `${resultado.linhas.length === 1 ? "linha" : "linhas"} de ${doc.nomeArquivo}` +
            (emRevisao > 0 ? ` — ${emRevisao} em conferência` : ""),
          autorId: null,
          autorEmail: null,
          clienteId: doc.clienteId,
        },
      });
```

No `catch`, além do `update` de `status: "ERRO"`, gravar:

```ts
    await prisma.registroAuditoria.create({
      data: {
        entidade: "DocumentoEntrada",
        entidadeId: doc.id,
        acao: "LEITURA_FALHOU",
        descricao: `Falha ao ler ${doc.nomeArquivo}: ${mensagemDeErro(erro)}`,
        autorId: null,
        autorEmail: null,
        clienteId: doc.clienteId,
      },
    });
```

Importar `classificarLancamento` de `./conferencia` (já importado como `classificarLancamento`).

- [ ] **Step 4: Rodar e ver passar**

Run: `npx vitest run src/lib/documentos/processar-sc01.test.ts`
Expected: PASS.

- [ ] **Step 5: Rodar a suíte inteira**

Run: `npm test`
Expected: PASS (a Task 8 ainda não mexeu em consultas; se algum teste de `acoes-sc01` quebrar por causa da assinatura do extrator, anotar e seguir — será corrigido na Task 9; caso contrário deve estar verde).

- [ ] **Step 6: Commit**

```bash
git add src/lib/documentos/processar-sc01.ts src/lib/documentos/processar-sc01.test.ts
git commit -m "feat(sc-01): processamento grava periodo/competencia e auditoria de leitura"
```

---

## Task 8: `consultas-sc01.ts` — `bancoRotulo`, filtro de competência, `listarHistoricoDocumentos`

**Files:**
- Modify: `src/lib/documentos/consultas-sc01.ts`
- Modify: `src/lib/documentos/consultas-sc01.test.ts`

**Interfaces:**
- Produces:
  - `DocumentoResumo` ganha `bancoRotulo: string | null` e `competencia: string`.
  - `listarDocumentos(opts?: { tipo?: "EXTRATO" | "NFSE"; competencia?: string; clienteId?: string }): Promise<DocumentoResumo[]>` (assinatura muda de `(tipo?)` para `(opts?)`).
  - `listarHistoricoDocumentos(filtros: { clienteId?: string; acao?: AcaoAuditoriaDocumento; de?: Date; ate?: Date; pagina?: number; porPagina?: number }): Promise<{ linhas: LinhaAuditoriaDocumento[]; total: number }>`
- Consumes: `AcaoAuditoriaDocumento`, `LinhaAuditoriaDocumento` de `./historico`.

- [ ] **Step 1: Escrever os testes**

Em `src/lib/documentos/consultas-sc01.test.ts`, adicionar (usando o `cenario()` que já existe e criando conta bancária):

```ts
it("listarDocumentos traz bancoRotulo e competencia e filtra por competência", async () => {
  const { clienteId } = await cenarioComConta(); // cria cliente + conta + 2 docs PROCESSADO
  const ags = await listarDocumentos({ tipo: "EXTRATO", competencia: "2026-08" });
  expect(ags.every((d) => d.competencia === "2026-08")).toBe(true);
  expect(ags[0].bancoRotulo).toMatch(/ag .* c\/c /);
});

it("listarHistoricoDocumentos filtra por ação e pagina", async () => {
  const { clienteId } = await cenarioComAuditoria(); // grava 3 RegistroAuditoria entidade DocumentoEntrada
  const r = await listarHistoricoDocumentos({ clienteId, acao: "EXTRATO_ENVIADO", pagina: 1, porPagina: 10 });
  expect(r.total).toBeGreaterThanOrEqual(1);
  expect(r.linhas.every((l) => l.acao === "EXTRATO_ENVIADO")).toBe(true);
});

it("listarHistoricoDocumentos ignora eventos de outras entidades (Certificado)", async () => {
  // grava um RegistroAuditoria entidade "Certificado" para o mesmo cliente
  const { clienteId } = await cenarioComAuditoria();
  await prisma.registroAuditoria.create({
    data: { entidade: "Certificado", entidadeId: "x", acao: "CRIADO", descricao: "não deve aparecer", clienteId },
  });
  const r = await listarHistoricoDocumentos({ clienteId, pagina: 1, porPagina: 50 });
  expect(r.linhas.some((l) => l.descricao === "não deve aparecer")).toBe(false);
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npx vitest run src/lib/documentos/consultas-sc01.test.ts`
Expected: FAIL — `listarDocumentos` não aceita objeto; `listarHistoricoDocumentos` não existe.

- [ ] **Step 3: Implementar**

`DocumentoResumo`:

```ts
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
  bancoRotulo: string | null;
  competencia: string;
};
```

`listarDocumentos`:

```ts
import { derivarCompetencia } from "./processar-sc01";
import type { AcaoAuditoriaDocumento, LinhaAuditoriaDocumento } from "./historico";
import type { Prisma } from "@/generated/prisma/client";

const ENTIDADES_SC01 = ["DocumentoEntrada", "Lancamento", "Cliente", "CobrancaExtrato"];

export async function listarDocumentos(opts?: {
  tipo?: "EXTRATO" | "NFSE";
  competencia?: string;
  clienteId?: string;
}): Promise<DocumentoResumo[]> {
  const docs = await prisma.documentoEntrada.findMany({
    where: {
      ...(opts?.tipo ? { tipo: opts.tipo } : {}),
      ...(opts?.competencia ? { competencia: opts.competencia } : {}),
      ...(opts?.clienteId ? { clienteId: opts.clienteId } : {}),
    },
    orderBy: { chegadaEm: "desc" },
    include: {
      cliente: { select: { razaoSocial: true } },
      contaBancaria: { select: { bancoNome: true, agencia: true, numero: true } },
      lancamentos: { select: { status: true } },
    },
  });
  return docs.map((d) => {
    const emRevisao = d.lancamentos.filter((l) => l.status === "PENDENTE_REVISAO").length;
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
        documentoPodeBaixarOfx(d.lancamentos as { status: StatusConferencia }[]),
      bancoRotulo: d.contaBancaria
        ? `${d.contaBancaria.bancoNome} — ag ${d.contaBancaria.agencia} c/c ${d.contaBancaria.numero}`
        : null,
      competencia: d.competencia ?? derivarCompetencia(null, d.chegadaEm),
    };
  });
}
```

`listarHistoricoDocumentos` (espelha `certificados/consultas.ts`):

```ts
function paraLinhaAuditoria(r: {
  id: string;
  acao: string;
  descricao: string;
  autorEmail: string | null;
  criadoEm: Date;
  dadosAntes: Prisma.JsonValue;
  dadosDepois: Prisma.JsonValue;
}): LinhaAuditoriaDocumento {
  return {
    id: r.id,
    acao: r.acao as AcaoAuditoriaDocumento,
    descricao: r.descricao,
    autorEmail: r.autorEmail,
    criadoEm: r.criadoEm,
    dadosAntes: (r.dadosAntes as Record<string, unknown> | null) ?? null,
    dadosDepois: (r.dadosDepois as Record<string, unknown> | null) ?? null,
  };
}

export async function listarHistoricoDocumentos(filtros: {
  clienteId?: string;
  acao?: AcaoAuditoriaDocumento;
  de?: Date;
  ate?: Date;
  pagina?: number;
  porPagina?: number;
} = {}): Promise<{ linhas: LinhaAuditoriaDocumento[]; total: number }> {
  const pagina = filtros.pagina ?? 1;
  const porPagina = filtros.porPagina ?? 30;
  const where: Prisma.RegistroAuditoriaWhereInput = {
    entidade: { in: ENTIDADES_SC01 },
    ...(filtros.clienteId ? { clienteId: filtros.clienteId } : {}),
    ...(filtros.acao ? { acao: filtros.acao } : {}),
    ...(filtros.de || filtros.ate
      ? { criadoEm: { ...(filtros.de ? { gte: filtros.de } : {}), ...(filtros.ate ? { lte: filtros.ate } : {}) } }
      : {}),
  };
  const [registros, total] = await Promise.all([
    prisma.registroAuditoria.findMany({
      where,
      orderBy: { criadoEm: "desc" },
      skip: (pagina - 1) * porPagina,
      take: porPagina,
    }),
    prisma.registroAuditoria.count({ where }),
  ]);
  return { linhas: registros.map(paraLinhaAuditoria), total };
}
```

Atualizar `src/app/modulos/sc-01/page.tsx` **não** aqui (Task 19); mas o `listarDocumentos("EXTRATO")` chamado hoje na página vai quebrar a tipagem — a Task 19 troca para `listarDocumentos({ tipo: "EXTRATO" })`. Se o `page.tsx` atual não for tocado nesta task, o `tsc` do teste ainda passa (Vitest não faz typecheck do app). Rodar `npx tsc --noEmit` ao final para não deixar erro latente e, se acusar o `page.tsx`, aplicar só a troca de assinatura da chamada.

- [ ] **Step 4: Rodar e ver passar**

Run: `npx vitest run src/lib/documentos/consultas-sc01.test.ts`
Expected: PASS.

- [ ] **Step 5: Typecheck**

Run: `npx tsc --noEmit`
Expected: sem erros novos (corrigir chamada de `listarDocumentos` em `page.tsx` se aparecer).

- [ ] **Step 6: Commit**

```bash
git add src/lib/documentos/consultas-sc01.ts src/lib/documentos/consultas-sc01.test.ts src/app/modulos/sc-01/page.tsx
git commit -m "feat(sc-01): consultas com banco/competencia e listarHistoricoDocumentos"
```

---

## Task 9: `acoes-sc01.ts` — envio multi-bloco, detecção, fim do lote

**Files:**
- Modify: `src/lib/documentos/acoes-sc01.ts`
- Test: `src/lib/documentos/acoes-sc01.test.ts` (criar se não existir)
- Read: `node_modules/next/dist/docs/` (guia de `after`)

**Interfaces:**
- Produces:
  - `type EstadoEnvio = { erro: string; indice?: number } | { ok: true; enviados: number } | null`
  - `enviarDocumentos(_prev: EstadoEnvio, formData: FormData): Promise<EstadoEnvio>` — lê `quantidade` + `arquivo-i`/`clienteId-i`/`contaBancariaId-i`.
  - `detectarCabecalho(formData: FormData): Promise<{ clienteId: string | null; contaBancariaId: string | null; cabecalho: CabecalhoExtrato } | { erro: string }>`
  - `reprocessarDocumento(formData: FormData): Promise<void>` (renomeia `processarUm`).
- Removido: `processarPendentes`, `enviarDocumento` (singular).
- Consumes: `detectarCabecalhoComClaude`, `casarCabecalho` (Task 6); `processarDocumento` (Task 7).

- [ ] **Step 1: Ler o guia de `after` do Next 16**

Run: `ls node_modules/next/dist/docs/ && grep -rl "after" node_modules/next/dist/docs/ | head`
Ler o trecho sobre `import { after } from 'next/server'` — confirmar se é estável em 16.3.3, assinatura e restrições (só em request scope). Se **não** existir, usar o fallback `void processarDocumento(id).catch((e) => console.error("[sc-01 auto]", e))` e anotar no código que o cron diário é a rede.

- [ ] **Step 2: Escrever os testes de integração**

```ts
// src/lib/documentos/acoes-sc01.test.ts
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { prisma } from "@/lib/prisma";

// A sessão é mockada como ADMIN com acesso à SC-01.
vi.mock("@/lib/sessao-servidor", () => ({
  obterSessao: async () => ({
    usuarioId: "u-teste",
    email: "admin@sheepcontabil.com.br",
    nome: "Admin",
    papel: "ADMIN",
    setor: null,
  }),
}));

import { enviarDocumentos, reprocessarDocumento } from "./acoes-sc01";

const CNPJ = "77.777.777/0001-77";
let inicio: Date;
beforeEach(() => {
  inicio = new Date();
});
afterEach(async () => {
  await prisma.registroAuditoria.deleteMany({ where: { criadoEm: { gte: inicio } } });
  await prisma.lancamento.deleteMany({ where: { criadoEm: { gte: inicio } } });
  await prisma.documentoEntrada.deleteMany({ where: { cliente: { cnpj: CNPJ } } });
  await prisma.contaBancaria.deleteMany({ where: { cliente: { cnpj: CNPJ } } });
  await prisma.cliente.deleteMany({ where: { cnpj: CNPJ } });
});

async function cliente() {
  const c = await prisma.cliente.create({
    data: { razaoSocial: "Acoes SC-01", cnpj: CNPJ, atividade: "T", email: "acoes-sc01@example.com" },
  });
  const conta = await prisma.contaBancaria.create({
    data: { clienteId: c.id, bancoNome: "Banco T", compe: "001", agencia: "1", numero: "1-1" },
  });
  return { c, conta };
}

function fd(campos: Record<string, string | File>): FormData {
  const f = new FormData();
  for (const [k, v] of Object.entries(campos)) f.append(k, v as never);
  return f;
}
const arq = () => new File([Uint8Array.from([1, 2, 3])], "extrato.pdf", { type: "application/pdf" });

describe("enviarDocumentos", () => {
  it("cria N documentos e grava EXTRATO_ENVIADO por documento", async () => {
    const { c, conta } = await cliente();
    const r = await enviarDocumentos(null, fd({
      quantidade: "2",
      "arquivo-0": arq(), "clienteId-0": c.id, "contaBancariaId-0": conta.id,
      "arquivo-1": arq(), "clienteId-1": c.id, "contaBancariaId-1": conta.id,
    }));
    expect(r).toEqual({ ok: true, enviados: 2 });
    const docs = await prisma.documentoEntrada.findMany({ where: { clienteId: c.id } });
    expect(docs).toHaveLength(2);
    const regs = await prisma.registroAuditoria.count({
      where: { entidade: "DocumentoEntrada", acao: "EXTRATO_ENVIADO", clienteId: c.id },
    });
    expect(regs).toBe(2);
  });

  it("bloqueia o bloco sem cliente resolvido e aponta o índice", async () => {
    const { c, conta } = await cliente();
    const r = await enviarDocumentos(null, fd({
      quantidade: "2",
      "arquivo-0": arq(), "clienteId-0": c.id, "contaBancariaId-0": conta.id,
      "arquivo-1": arq(), "clienteId-1": "", "contaBancariaId-1": "",
    }));
    expect(r).toMatchObject({ indice: 1 });
    expect(await prisma.documentoEntrada.count({ where: { clienteId: c.id } })).toBe(0); // nada persistido
  });

  it("rejeita MIME não suportado", async () => {
    const { c, conta } = await cliente();
    const r = await enviarDocumentos(null, fd({
      quantidade: "1",
      "arquivo-0": new File(["x"], "e.txt", { type: "text/plain" }),
      "clienteId-0": c.id, "contaBancariaId-0": conta.id,
    }));
    expect(r).toMatchObject({ indice: 0 });
  });
});
```

(Nota: `enviarDocumentos` deve validar **todos** os blocos antes de criar qualquer documento — o teste "bloqueia o bloco" exige zero persistência.)

- [ ] **Step 3: Rodar e ver falhar**

Run: `npx vitest run src/lib/documentos/acoes-sc01.test.ts`
Expected: FAIL — `enviarDocumentos` não existe.

- [ ] **Step 4: Implementar**

Reescrever `acoes-sc01.ts`:

- Remover a `enviarDocumento` singular, o `esquemaUpload` de um só, e `processarPendentes`.
- Renomear `processarUm` → `reprocessarDocumento`; dentro dele, após `processarDocumento`, gravar `RegistroAuditoria` `REPROCESSADO` (`autorId: sessao.usuarioId`, `autorEmail: sessao.email`, `clienteId` do doc).
- `confirmarLancamento`: antes do `update`, ler o `lancamento` (já lê); montar `dadosAntes = { data: ISO, historico, valor }` e `dadosDepois` com o patch aplicado; após o `update`, `RegistroAuditoria` `LINHA_CONFERIDA` (`entidade: "Lancamento"`, `entidadeId: lancamentoId`, `clienteId` via `documentoEntrada.cliente`, `dadosAntes`/`dadosDepois`).
- `excluirDocumento`: antes do `deleteMany`, ler o doc (para `clienteId`/`nomeArquivo`); após, `RegistroAuditoria` `DOCUMENTO_EXCLUIDO`.
- Novas funções:

```ts
import { after } from "next/server"; // se confirmado no Step 1; senão remover e usar o fallback
import {
  detectarCabecalhoComClaude,
  casarCabecalho,
  type CabecalhoExtrato,
} from "./deteccao-cabecalho";

export type EstadoEnvio =
  | { erro: string; indice?: number }
  | { ok: true; enviados: number }
  | null;

export async function enviarDocumentos(
  _prev: EstadoEnvio,
  formData: FormData,
): Promise<EstadoEnvio> {
  const sessao = await exigirAcessoSc01();

  const qtd = Number(formData.get("quantidade") ?? 0);
  if (!Number.isInteger(qtd) || qtd < 1) return { erro: "Anexe ao menos um extrato." };

  type Pronto = { clienteId: string; contaBancariaId: string; bytes: Buffer; nome: string; mime: string };
  const prontos: Pronto[] = [];

  for (let i = 0; i < qtd; i += 1) {
    const arquivo = formData.get(`arquivo-${i}`);
    const clienteId = String(formData.get(`clienteId-${i}`) ?? "");
    const contaBancariaId = String(formData.get(`contaBancariaId-${i}`) ?? "");

    if (!(arquivo instanceof File) || arquivo.size === 0)
      return { erro: "Anexe o arquivo do extrato (PDF, JPG ou PNG).", indice: i };
    if (!MIMES_OK.includes(arquivo.type))
      return { erro: "Formato não suportado. Use PDF, JPG ou PNG.", indice: i };
    if (arquivo.size > TAMANHO_MAX) return { erro: "Arquivo acima de 15 MB.", indice: i };
    if (!clienteId || !contaBancariaId)
      return { erro: "Identifique o cliente e a conta deste extrato.", indice: i };

    const conta = await prisma.contaBancaria.findFirst({ where: { id: contaBancariaId, clienteId } });
    if (!conta) return { erro: "Conta bancária não encontrada para esse cliente.", indice: i };

    prontos.push({
      clienteId,
      contaBancariaId,
      bytes: Buffer.from(await arquivo.arrayBuffer()),
      nome: arquivo.name,
      mime: arquivo.type,
    });
  }

  const ids: string[] = [];
  for (const p of prontos) {
    const doc = await prisma.documentoEntrada.create({
      data: {
        tipo: "EXTRATO",
        clienteId: p.clienteId,
        contaBancariaId: p.contaBancariaId,
        nomeArquivo: p.nome,
        mimeType: p.mime,
        arquivo: p.bytes,
        chegadaEm: new Date(),
      },
    });
    await prisma.registroAuditoria.create({
      data: {
        entidade: "DocumentoEntrada",
        entidadeId: doc.id,
        acao: "EXTRATO_ENVIADO",
        descricao: `Extrato ${p.nome} enviado para a fila`,
        autorId: sessao.usuarioId,
        autorEmail: sessao.email,
        clienteId: p.clienteId,
      },
    });
    ids.push(doc.id);
  }

  revalidatePath(ROTA);

  const rodar = async () => {
    for (const id of ids) {
      try {
        await processarDocumento(id);
      } catch (e) {
        console.error("[sc-01 auto]", id, e);
      }
    }
  };
  if (typeof after === "function") after(rodar);
  else void rodar();

  return { ok: true, enviados: ids.length };
}

export async function detectarCabecalho(
  formData: FormData,
): Promise<
  { clienteId: string | null; contaBancariaId: string | null; cabecalho: CabecalhoExtrato } | { erro: string }
> {
  await exigirAcessoSc01();
  const arquivo = formData.get("arquivo");
  if (!(arquivo instanceof File) || arquivo.size === 0) return { erro: "Arquivo vazio." };
  if (!MIMES_OK.includes(arquivo.type)) return { erro: "Formato não suportado. Use PDF, JPG ou PNG." };
  if (arquivo.size > TAMANHO_MAX) return { erro: "Arquivo acima de 15 MB." };

  const base64 = Buffer.from(await arquivo.arrayBuffer()).toString("base64");
  let cabecalho: CabecalhoExtrato;
  try {
    cabecalho = await detectarCabecalhoComClaude({ mimeType: arquivo.type, base64 });
  } catch {
    return { erro: "Não consegui ler o cabeçalho — selecione cliente e conta na mão." };
  }

  const [clientes, contas] = await Promise.all([
    prisma.cliente.findMany({ select: { id: true, razaoSocial: true } }),
    prisma.contaBancaria.findMany({ select: { id: true, clienteId: true, bancoNome: true, agencia: true, numero: true } }),
  ]);
  const contasPorCliente: Record<string, { id: string; bancoNome: string; agencia: string; numero: string }[]> = {};
  for (const c of contas) (contasPorCliente[c.clienteId] ??= []).push(c);

  const { clienteId, contaBancariaId } = casarCabecalho(cabecalho, clientes, contasPorCliente);
  return { clienteId, contaBancariaId, cabecalho };
}
```

- [ ] **Step 5: Rodar e ver passar**

Run: `npx vitest run src/lib/documentos/acoes-sc01.test.ts`
Expected: PASS.

- [ ] **Step 6: Rodar a suíte + typecheck**

Run: `npm test && npx tsc --noEmit`
Expected: `page.tsx` (usa `enviarDocumento`/`processarPendentes`/`FormularioUploadDocumento`) e `documento/[id]/page.tsx` (usa `processarUm`) vão acusar erro de tipo — **anotar**; serão consertados nas Tasks 15, 18 e 19. Se possível, aplicar já a troca `processarUm` → `reprocessarDocumento` na tela de detalhe para reduzir ruído. Os testes (`vitest`) devem passar.

- [ ] **Step 7: Commit**

```bash
git add src/lib/documentos/acoes-sc01.ts src/lib/documentos/acoes-sc01.test.ts
git commit -m "feat(sc-01): envio multi-bloco, deteccao de cabecalho, fim do lote manual"
```

---

## Task 10: SC-20 — escopar a auditoria por `entidade`

**Files:**
- Modify: `src/lib/certificados/consultas.ts` (`listarHistorico`, `obterPerfilCliente`)
- Modify: `src/lib/certificados/consultas.test.ts`

**Interfaces:**
- Produces: `listarHistorico` e o `findMany` de `obterPerfilCliente` passam a filtrar `entidade: { in: ["Certificado", "AvisoCertificado"] }`.
- Consumes: nada.

- [ ] **Step 1: Escrever o teste**

Em `src/lib/certificados/consultas.test.ts`, adicionar:

```ts
it("listarHistorico não vê eventos de outras entidades (DocumentoEntrada)", async () => {
  const cliente = await prisma.cliente.create({
    data: { razaoSocial: "Escopo SC-20", cnpj: "88.888.888/0001-88", atividade: "T", email: "escopo-sc20@example.com" },
  });
  await prisma.registroAuditoria.create({
    data: { entidade: "DocumentoEntrada", entidadeId: "d1", acao: "EXTRATO_ENVIADO", descricao: "não é da SC-20", clienteId: cliente.id },
  });
  await prisma.registroAuditoria.create({
    data: { entidade: "Certificado", entidadeId: "c1", acao: "CRIADO", descricao: "é da SC-20", clienteId: cliente.id },
  });
  const { linhas } = await listarHistorico({ clienteId: cliente.id, pagina: 1, porPagina: 50 });
  expect(linhas.some((l) => l.descricao === "não é da SC-20")).toBe(false);
  expect(linhas.some((l) => l.descricao === "é da SC-20")).toBe(true);

  await prisma.registroAuditoria.deleteMany({ where: { clienteId: cliente.id } });
  await prisma.cliente.delete({ where: { id: cliente.id } });
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npx vitest run src/lib/certificados/consultas.test.ts -t "outras entidades"`
Expected: FAIL — evento de `DocumentoEntrada` aparece.

- [ ] **Step 3: Implementar**

Em `listarHistorico`, no objeto `where`, adicionar como primeira chave:

```ts
    entidade: { in: ["Certificado", "AvisoCertificado"] },
```

Em `obterPerfilCliente`, no `prisma.registroAuditoria.findMany`, trocar `where: { clienteId }` por:

```ts
      where: { clienteId, entidade: { in: ["Certificado", "AvisoCertificado"] } },
```

- [ ] **Step 4: Rodar e ver passar**

Run: `npx vitest run src/lib/certificados/consultas.test.ts`
Expected: PASS (toda a suíte do arquivo).

- [ ] **Step 5: Commit**

```bash
git add src/lib/certificados/consultas.ts src/lib/certificados/consultas.test.ts
git commit -m "fix(sc-20): escopa a auditoria por entidade para nao misturar com a SC-01"
```

---

## Task 11: `csv-auditoria.ts` + rota do relatório

**Files:**
- Create: `src/lib/documentos/csv-auditoria.ts`
- Create: `src/lib/documentos/csv-auditoria.test.ts`
- Create: `src/app/modulos/sc-01/historico/relatorio/route.ts`

**Interfaces:**
- Consumes: `LinhaAuditoriaDocumento` (Task 4), `rotuloAtor` (Task 4 re-export), `NATUREZAS` (Task 4), `listarHistoricoDocumentos` (Task 8).
- Produces: `gerarCsvAuditoria(linhas: LinhaAuditoriaDocumento[]): string`.

- [ ] **Step 1: Escrever o teste do serializador**

```ts
// src/lib/documentos/csv-auditoria.test.ts
import { describe, expect, it } from "vitest";
import { gerarCsvAuditoria } from "./csv-auditoria";
import type { LinhaAuditoriaDocumento } from "./historico";

const linha = (over: Partial<LinhaAuditoriaDocumento>): LinhaAuditoriaDocumento => ({
  id: "1",
  acao: "EXTRATO_ENVIADO",
  descricao: "Extrato agosto.pdf enviado",
  autorEmail: "op@sheepcontabil.com.br",
  criadoEm: new Date("2026-08-10T13:05:00Z"),
  dadosAntes: null,
  dadosDepois: null,
  ...over,
});

describe("gerarCsvAuditoria", () => {
  it("tem BOM, cabeçalho e usa ';'", () => {
    const csv = gerarCsvAuditoria([linha({})]);
    expect(csv.startsWith("﻿")).toBe(true);
    expect(csv.split("\r\n")[0]).toBe("data;hora;ator;evento;descricao");
  });
  it("ator vira 'Sistema' quando autorEmail é null e escapa ';' no texto", () => {
    const csv = gerarCsvAuditoria([linha({ autorEmail: null, descricao: "a; b" })]);
    expect(csv).toContain(";Sistema;");
    expect(csv).toContain('"a; b"');
  });
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npx vitest run src/lib/documentos/csv-auditoria.test.ts`
Expected: FAIL — módulo não existe.

- [ ] **Step 3: Implementar o serializador**

```ts
// src/lib/documentos/csv-auditoria.ts
import { rotuloAtor, type LinhaAuditoriaDocumento } from "./historico";

function campo(v: string): string {
  if (/^[=+\-@]/.test(v)) v = "'" + v;
  if (/[;"\r\n]/.test(v)) return `"${v.replace(/"/g, '""')}"`;
  return v;
}
function linha(cols: string[]): string {
  return cols.map(campo).join(";");
}
function dataUTC(d: Date): string {
  return new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeZone: "UTC" }).format(d);
}
function horaUTC(d: Date): string {
  return new Intl.DateTimeFormat("pt-BR", { timeStyle: "short", timeZone: "UTC" }).format(d);
}

export function gerarCsvAuditoria(linhas: LinhaAuditoriaDocumento[]): string {
  const saida = [linha(["data", "hora", "ator", "evento", "descricao"])];
  for (const l of linhas) {
    saida.push(linha([dataUTC(l.criadoEm), horaUTC(l.criadoEm), rotuloAtor(l.autorEmail), l.acao, l.descricao]));
  }
  return "﻿" + saida.join("\r\n") + "\r\n";
}
```

- [ ] **Step 4: Rodar e ver passar**

Run: `npx vitest run src/lib/documentos/csv-auditoria.test.ts`
Expected: PASS.

- [ ] **Step 5: Criar a rota**

```ts
// src/app/modulos/sc-01/historico/relatorio/route.ts
import { NextResponse } from "next/server";
import { obterSessao } from "@/lib/sessao-servidor";
import { filtrarModulosVisiveis } from "@/lib/modulos-catalogo";
import { listarHistoricoDocumentos } from "@/lib/documentos/consultas-sc01";
import { gerarCsvAuditoria } from "@/lib/documentos/csv-auditoria";
import { NATUREZAS, type AcaoAuditoriaDocumento } from "@/lib/documentos/historico";

const ACOES_VALIDAS = new Set(NATUREZAS.map((n) => n.valor));

function dataOpcional(iso: string | null): Date | undefined {
  if (!iso || !/^\d{4}-\d{2}-\d{2}$/.test(iso)) return undefined;
  return new Date(`${iso}T00:00:00.000Z`);
}

export async function GET(request: Request) {
  const sessao = await obterSessao();
  const podeVer =
    sessao !== null &&
    filtrarModulosVisiveis(sessao.papel, sessao.setor).some((m) => m.codigo === "SC-01");
  if (!sessao || !podeVer) {
    return NextResponse.json({ erro: "Não autorizado." }, { status: 401 });
  }

  const url = new URL(request.url);
  const evento = url.searchParams.get("evento");
  const { linhas } = await listarHistoricoDocumentos({
    clienteId: url.searchParams.get("cliente") || undefined,
    acao:
      evento && ACOES_VALIDAS.has(evento as AcaoAuditoriaDocumento)
        ? (evento as AcaoAuditoriaDocumento)
        : undefined,
    de: dataOpcional(url.searchParams.get("de")),
    ate: dataOpcional(url.searchParams.get("ate")),
    pagina: 1,
    porPagina: 100_000,
  });

  return new NextResponse(gerarCsvAuditoria(linhas), {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": 'attachment; filename="auditoria-sc01.csv"',
    },
  });
}
```

- [ ] **Step 6: Commit**

```bash
git add src/lib/documentos/csv-auditoria.ts src/lib/documentos/csv-auditoria.test.ts src/app/modulos/sc-01/historico/relatorio/route.ts
git commit -m "feat(sc-01): CSV da auditoria + rota de relatorio"
```

---

## Task 12: Rota do arquivo original + auditoria `OFX_BAIXADO`

**Files:**
- Create: `src/app/modulos/sc-01/documento/[documentoId]/arquivo/route.ts`
- Modify: `src/app/modulos/sc-01/documento/[documentoId]/ofx/route.ts`
- Test: `src/app/modulos/sc-01/documento/[documentoId]/arquivo/route.test.ts`

**Interfaces:**
- Produces: `GET /modulos/sc-01/documento/:id/arquivo` → bytes com `Content-Type = mimeType`, `Content-Disposition: inline`, `Cache-Control: private, no-store`. 401 sem sessão, 404 sem documento.
- Consumes: `obterDocumentoComLancamentos` (para a auditoria do OFX; devolve `cliente: { id, razaoSocial }`).

- [ ] **Step 1: Escrever o teste**

```ts
// src/app/modulos/sc-01/documento/[documentoId]/arquivo/route.test.ts
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { prisma } from "@/lib/prisma";

let sessao: unknown = null;
vi.mock("@/lib/sessao-servidor", () => ({ obterSessao: async () => sessao }));

import { GET } from "./route";

const CNPJ = "99.999.999/0001-99";
let inicio: Date;
beforeEach(() => {
  inicio = new Date();
  sessao = { usuarioId: "u", email: "admin@sheepcontabil.com.br", nome: "A", papel: "ADMIN", setor: null };
});
afterEach(async () => {
  sessao = null;
  await prisma.documentoEntrada.deleteMany({ where: { cliente: { cnpj: CNPJ } } });
  await prisma.cliente.deleteMany({ where: { cnpj: CNPJ } });
});

async function doc() {
  const c = await prisma.cliente.create({
    data: { razaoSocial: "Arquivo SC-01", cnpj: CNPJ, atividade: "T", email: "arquivo-sc01@example.com" },
  });
  return prisma.documentoEntrada.create({
    data: {
      tipo: "EXTRATO", clienteId: c.id, nomeArquivo: "e.pdf", mimeType: "application/pdf",
      arquivo: Buffer.from("%PDF-1.4 teste"), chegadaEm: new Date(),
    },
  });
}
const req = () => new Request("http://localhost/x");

describe("GET arquivo", () => {
  it("200 com o Content-Type do documento", async () => {
    const d = await doc();
    const res = await GET(req(), { params: Promise.resolve({ documentoId: d.id }) });
    expect(res.status).toBe(200);
    expect(res.headers.get("Content-Type")).toBe("application/pdf");
    expect(res.headers.get("Content-Disposition")).toContain("inline");
  });
  it("401 sem sessão", async () => {
    const d = await doc();
    sessao = null;
    const res = await GET(req(), { params: Promise.resolve({ documentoId: d.id }) });
    expect(res.status).toBe(401);
  });
  it("404 para id inexistente", async () => {
    const res = await GET(req(), { params: Promise.resolve({ documentoId: "nao-existe" }) });
    expect(res.status).toBe(404);
  });
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npx vitest run "src/app/modulos/sc-01/documento/[documentoId]/arquivo/route.test.ts"`
Expected: FAIL — rota não existe.

- [ ] **Step 3: Implementar a rota do arquivo**

```ts
// src/app/modulos/sc-01/documento/[documentoId]/arquivo/route.ts
import { NextResponse } from "next/server";
import { obterSessao } from "@/lib/sessao-servidor";
import { filtrarModulosVisiveis } from "@/lib/modulos-catalogo";
import { prisma } from "@/lib/prisma";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ documentoId: string }> },
) {
  const sessao = await obterSessao();
  const podeVer =
    sessao !== null &&
    filtrarModulosVisiveis(sessao.papel, sessao.setor).some((m) => m.codigo === "SC-01");
  if (!sessao || !podeVer) {
    return NextResponse.json({ erro: "Não autorizado." }, { status: 401 });
  }

  const { documentoId } = await params;
  const doc = await prisma.documentoEntrada.findUnique({
    where: { id: documentoId },
    select: { arquivo: true, mimeType: true, nomeArquivo: true },
  });
  if (!doc) {
    return NextResponse.json({ erro: "Documento não encontrado." }, { status: 404 });
  }

  return new NextResponse(Buffer.from(doc.arquivo), {
    status: 200,
    headers: {
      "Content-Type": doc.mimeType,
      "Content-Disposition": `inline; filename="${doc.nomeArquivo.replace(/"/g, "")}"`,
      "Cache-Control": "private, no-store",
    },
  });
}
```

- [ ] **Step 4: Auditoria no OFX**

Em `.../ofx/route.ts`, depois de gerar `ofx` e antes do `return`:

```ts
  await prisma.registroAuditoria.create({
    data: {
      entidade: "DocumentoEntrada",
      entidadeId: documentoId,
      acao: "OFX_BAIXADO",
      descricao: `OFX de ${doc.cliente.razaoSocial} baixado`,
      autorId: sessao.usuarioId,
      autorEmail: sessao.email,
      clienteId: doc.cliente.id,
    },
  });
```

Importar `prisma` de `@/lib/prisma` no topo do arquivo da rota do OFX.

- [ ] **Step 5: Rodar e ver passar**

Run: `npx vitest run "src/app/modulos/sc-01/documento/[documentoId]/arquivo/route.test.ts"`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add "src/app/modulos/sc-01/documento/[documentoId]/arquivo/route.ts" "src/app/modulos/sc-01/documento/[documentoId]/arquivo/route.test.ts" "src/app/modulos/sc-01/documento/[documentoId]/ofx/route.ts"
git commit -m "feat(sc-01): rota do arquivo original + auditoria de download do OFX"
```

---

## Task 13: `SpecularButton` — brilho preso ao botão

**Files:**
- Modify: `src/components/ui/SpecularButton.css`
- Modify: `src/components/ui/SpecularButton.tsx` (remover `BLEED`)
- Test: `src/components/ui/SpecularButton.test.tsx` (criar) — guarda de regressão no CSS

**Interfaces:**
- Produces: `.sb` com `overflow: hidden`; `.sb__fx` com `inset: 0`, sem `mask-composite`.

- [ ] **Step 1: Escrever o teste de guarda**

```tsx
// src/components/ui/SpecularButton.test.tsx
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { SpecularButton } from "./SpecularButton";

const css = readFileSync(join(__dirname, "SpecularButton.css"), "utf8");

describe("SpecularButton — brilho contido", () => {
  it("o CSS prende o brilho no botão e não usa máscara de anel", () => {
    expect(css).toMatch(/\.sb\s*{[^}]*overflow:\s*hidden/s);
    expect(css).not.toMatch(/mask-composite/);
    expect(css).not.toMatch(/inset:\s*calc\(-1 \* var\(--sb-bleed\)\)/);
  });
  it("renderiza o rótulo e o elemento de efeito", () => {
    render(<SpecularButton>Enviar</SpecularButton>);
    expect(screen.getByRole("button", { name: "Enviar" })).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npx vitest run src/components/ui/SpecularButton.test.tsx`
Expected: FAIL — CSS ainda tem `mask-composite` e o `inset` negativo.

- [ ] **Step 3: Ajustar o CSS**

No bloco `.sb { … }`, adicionar `overflow: hidden;` (depois de `isolation: isolate;`).

Substituir o bloco `.sb__fx { … }` inteiro por:

```css
.sb__fx {
  position: absolute;
  inset: 0;
  border-radius: inherit;
  pointer-events: none;
  z-index: 1;
  background: radial-gradient(
    var(--sb-shine) circle at var(--sb-mx) var(--sb-my),
    var(--sb-rim) 0%,
    color-mix(in srgb, var(--sb-rim) 35%, transparent) 45%,
    transparent 72%
  );
  opacity: calc(0.12 + 0.88 * var(--sb-glow));
  transition: opacity 0.3s ease;
}
```

No `.sb`, a custom property `--sb-bleed` pode ser removida (não é mais usada). O bloco `@media (prefers-reduced-motion: reduce)` fica como está (`.sb__fx { opacity: 0.16 }`).

- [ ] **Step 4: Ajustar o `.tsx`**

Em `SpecularButton.tsx`: remover `const BLEED = 14;`. Em `passo()`, trocar:

```ts
    el.style.setProperty("--sb-mx", `${ptr.x - r.left}px`);
    el.style.setProperty("--sb-my", `${ptr.y - r.top}px`);
```

- [ ] **Step 5: Rodar e ver passar + suíte**

Run: `npx vitest run src/components/ui/SpecularButton.test.tsx && npm test`
Expected: PASS.

- [ ] **Step 6: Verificação visual manual**

Subir `npm run dev`, abrir `/login`, passar o mouse nos botões: o brilho acompanha o cursor **sem** ultrapassar a borda; nenhuma linha de divisão fora do botão.

- [ ] **Step 7: Commit**

```bash
git add src/components/ui/SpecularButton.css src/components/ui/SpecularButton.tsx src/components/ui/SpecularButton.test.tsx
git commit -m "fix(ui): brilho do SpecularButton preso ao botao, sem anel que vaza"
```

---

## Task 14: `BlocoUploadExtrato` + `ModalEnviarExtratos`

**Files:**
- Create: `src/components/documentos/BlocoUploadExtrato.tsx`
- Create: `src/components/documentos/BlocoUploadExtrato.test.tsx`
- Create: `src/components/documentos/ModalEnviarExtratos.tsx`
- Create: `src/components/documentos/ModalEnviarExtratos.test.tsx`
- Remove: `src/components/documentos/FormularioUploadDocumento.tsx` (+ teste, se houver)

**Interfaces:**
- Consumes: `enviarDocumentos`/`detectarCabecalho` de `@/lib/documentos/acoes-sc01`; `Modal` de `@/components/certificados/Modal`; `SpecularButton`.
- Produces:
  - `type BlocoValor = { clienteId: string; contaBancariaId: string; nomeArquivo: string | null; deteccao: "idle" | "lendo" | "ok" | "manual" }`
  - `BlocoUploadExtrato` props: `{ indice: number; clientes: {id;razaoSocial}[]; contasPorCliente: Record<string, {id;rotulo}[]>; valor: BlocoValor; aoMudar(patch): void; aoArquivo(file: File): void; aoRemover?(): void; erro?: string }`
  - `ModalEnviarExtratos` props: `{ aberto: boolean; aoFechar(): void; clientes; contasPorCliente }`

- [ ] **Step 0: Invocar `frontend-design`** para calibrar tipografia/estados destes componentes.

- [ ] **Step 1: Testes do `BlocoUploadExtrato`**

```tsx
// src/components/documentos/BlocoUploadExtrato.test.tsx
import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { BlocoUploadExtrato, type BlocoValor } from "./BlocoUploadExtrato";

const clientes = [{ id: "c1", razaoSocial: "Alfa" }, { id: "c2", razaoSocial: "Beta" }];
const contas = { c1: [{ id: "cb1", rotulo: "Banco T — ag 1 c/c 1-1" }] };
const base: BlocoValor = { clienteId: "", contaBancariaId: "", nomeArquivo: null, deteccao: "idle" };

it("dispara aoArquivo ao anexar e mostra o nome do arquivo", async () => {
  const aoArquivo = vi.fn();
  render(
    <BlocoUploadExtrato
      indice={0} clientes={clientes} contasPorCliente={contas}
      valor={{ ...base, nomeArquivo: "extrato.pdf", deteccao: "ok" }}
      aoMudar={() => {}} aoArquivo={aoArquivo}
    />,
  );
  const input = screen.getByLabelText(/extrato/i);
  await userEvent.upload(input, new File(["x"], "extrato.pdf", { type: "application/pdf" }));
  expect(aoArquivo).toHaveBeenCalledOnce();
  expect(screen.getByText("extrato.pdf")).toBeInTheDocument();
});

it("mostra 'Identificando…' enquanto deteccao === 'lendo'", () => {
  render(
    <BlocoUploadExtrato indice={0} clientes={clientes} contasPorCliente={contas}
      valor={{ ...base, deteccao: "lendo" }} aoMudar={() => {}} aoArquivo={() => {}} />,
  );
  expect(screen.getByText(/identificando/i)).toBeInTheDocument();
});

it("exibe o erro do bloco", () => {
  render(
    <BlocoUploadExtrato indice={1} clientes={clientes} contasPorCliente={contas}
      valor={base} aoMudar={() => {}} aoArquivo={() => {}} erro="Identifique o cliente e a conta deste extrato." />,
  );
  expect(screen.getByRole("alert")).toHaveTextContent(/identifique o cliente/i);
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npx vitest run src/components/documentos/BlocoUploadExtrato.test.tsx`
Expected: FAIL — componente não existe.

- [ ] **Step 3: Implementar `BlocoUploadExtrato`**

Componente client. Campo de arquivo (`<input type="file" accept="application/pdf,image/jpeg,image/png">` com `id={\`bloco-${indice}-arquivo\`}` e `<label htmlFor>` "Extrato (PDF, JPG ou PNG)"). Ao `onChange`, chama `aoArquivo(file)`. Selects **Cliente** e **Banco** controlados por `valor`, `onChange` → `aoMudar({ clienteId })` / `aoMudar({ contaBancariaId })`. Banco desabilitado sem cliente. Área de status: `idle` → nada; `lendo` → "Identificando…" com spinner; `ok` → "Identificado pelo arquivo" (turquesa); `manual` → "Não identifiquei — selecione na mão" (âmbar). Nome do arquivo em `font-codigo text-xs` quando `valor.nomeArquivo`. Botão "remover" (ícone ×) quando `aoRemover`. `erro` em `<p role="alert">` carmim. Reutilizar a classe `CAMPO` do `FormularioUploadDocumento` antigo. Só tokens da paleta.

- [ ] **Step 4: Testes do `ModalEnviarExtratos`**

```tsx
// src/components/documentos/ModalEnviarExtratos.test.tsx
import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

const enviarDocumentos = vi.fn(async () => ({ ok: true, enviados: 1 }));
const detectarCabecalho = vi.fn(async () => ({ clienteId: "c1", contaBancariaId: "cb1", cabecalho: {} }));
vi.mock("@/lib/documentos/acoes-sc01", () => ({ enviarDocumentos: (...a: unknown[]) => enviarDocumentos(...a), detectarCabecalho: (...a: unknown[]) => detectarCabecalho(...a) }));

import { ModalEnviarExtratos } from "./ModalEnviarExtratos";

const props = {
  aberto: true,
  aoFechar: vi.fn(),
  clientes: [{ id: "c1", razaoSocial: "Alfa" }],
  contasPorCliente: { c1: [{ id: "cb1", rotulo: "Banco T — ag 1 c/c 1-1" }] },
};

it("começa com 1 bloco e adiciona/remove", async () => {
  render(<ModalEnviarExtratos {...props} />);
  expect(screen.getAllByLabelText(/extrato \(pdf/i)).toHaveLength(1);
  await userEvent.click(screen.getByRole("button", { name: /adicionar outro extrato/i }));
  expect(screen.getAllByLabelText(/extrato \(pdf/i)).toHaveLength(2);
  await userEvent.click(screen.getAllByRole("button", { name: /remover/i })[0]);
  expect(screen.getAllByLabelText(/extrato \(pdf/i)).toHaveLength(1);
});

it("anexar dispara detectarCabecalho e preenche o cliente do bloco", async () => {
  render(<ModalEnviarExtratos {...props} />);
  await userEvent.upload(
    screen.getByLabelText(/extrato \(pdf/i),
    new File(["x"], "e.pdf", { type: "application/pdf" }),
  );
  expect(detectarCabecalho).toHaveBeenCalledOnce();
  // após resolver, o select de cliente reflete "c1"
  expect(await screen.findByDisplayValue("Alfa")).toBeInTheDocument();
});
```

- [ ] **Step 5: Rodar e ver falhar**

Run: `npx vitest run src/components/documentos/ModalEnviarExtratos.test.tsx`
Expected: FAIL — componente não existe.

- [ ] **Step 6: Implementar `ModalEnviarExtratos`**

Client. Usa `<Modal aberto aoFechar titulo="Enviar extratos">`. Estado: `blocos: { file: File | null; valor: BlocoValor }[]` (começa `[{ file: null, valor: base }]`). `useActionState(enviarDocumentos, null)`. Um `<form action={acaoFormulario}>` com, para cada bloco `i`, um `<BlocoUploadExtrato indice={i} …>` cujos inputs de verdade (`arquivo-i`, `clienteId-i`, `contaBancariaId-i`) vivem dentro do form (o de arquivo é o próprio `<input type=file name={\`arquivo-${i}\`}>`; cliente/conta como `<input type="hidden" name={\`clienteId-${i}\`} value={…}>` + selects controlados que atualizam o estado). Hidden `<input type="hidden" name="quantidade" value={blocos.length}>`.
- `aoArquivo(i, file)`: seta `deteccao: "lendo"`, monta um `FormData` só com `arquivo`, chama `detectarCabecalho`; no retorno, `aoMudar(i, { clienteId, contaBancariaId, nomeArquivo: file.name, deteccao: clienteId ? "ok" : "manual" })`.
- "＋ Adicionar outro extrato" → `setBlocos([...blocos, { file: null, valor: base }])`.
- Rodapé: "Cancelar" (`aoFechar`) + `<SpecularButton type="submit">Enviar {n} {n===1?"extrato":"extratos"}</SpecularButton>`.
- `useEffect`: quando `estado?.ok` → `aoFechar()`. Quando `estado?.erro` com `indice` → passar `erro` só para aquele `BlocoUploadExtrato`; sem `indice` → alerta no topo.
- **Sem** parágrafo-subtítulo (Global Constraints).

- [ ] **Step 7: Remover o formulário antigo**

```bash
git rm src/components/documentos/FormularioUploadDocumento.tsx
# remover o import/uso em page.tsx é feito na Task 19
```

- [ ] **Step 8: Rodar e ver passar**

Run: `npx vitest run src/components/documentos/BlocoUploadExtrato.test.tsx src/components/documentos/ModalEnviarExtratos.test.tsx`
Expected: PASS.

- [ ] **Step 9: Commit**

```bash
git add src/components/documentos/BlocoUploadExtrato.tsx src/components/documentos/BlocoUploadExtrato.test.tsx src/components/documentos/ModalEnviarExtratos.tsx src/components/documentos/ModalEnviarExtratos.test.tsx src/components/documentos/FormularioUploadDocumento.tsx
git commit -m "feat(sc-01): modal multi-bloco de envio de extratos com auto-deteccao"
```

---

## Task 15: `TabelaDocumentos` + `PainelDocumentos`

**Files:**
- Modify: `src/components/documentos/TabelaDocumentos.tsx`
- Create: `src/components/documentos/PainelDocumentos.tsx`
- Create: `src/components/documentos/PainelDocumentos.test.tsx`
- Modify: `src/components/documentos/TabelaDocumentos` (test existente, se houver)

**Interfaces:**
- Consumes: `DocumentoResumo` (Task 8); `filtrarDocumentos`/`ordenarDocumentos`/`bancosDisponiveis`/`OrdenacaoDocumento` (Task 3).
- Produces:
  - `TabelaDocumentos` props: `{ documentos: DocumentoResumo[]; ordenacao: OrdenacaoDocumento; aoOrdenar(coluna: "cliente" | "chegada" | "status" | "linhas"): void }`
  - `PainelDocumentos` props: `{ documentos: DocumentoResumo[]; competenciaInicial: string }` (client; toolbar + `TabelaDocumentos`)

- [ ] **Step 0: Invocar `frontend-design`.**

- [ ] **Step 1: Testes do `PainelDocumentos`**

```tsx
// src/components/documentos/PainelDocumentos.test.tsx
import { describe, expect, it } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { PainelDocumentos } from "./PainelDocumentos";
import type { DocumentoResumo } from "@/lib/documentos/consultas-sc01";

const d = (o: Partial<DocumentoResumo>): DocumentoResumo => ({
  id: "d", clienteRazaoSocial: "Alfa", tipo: "EXTRATO", nomeArquivo: "a.pdf",
  status: "PROCESSADO", chegadaEm: new Date("2026-08-10T00:00:00Z"),
  totalLancamentos: 2, emRevisao: 0, podeBaixarOfx: true,
  bancoRotulo: "Banco Meridiano — ag 1 c/c 1", competencia: "2026-08", ...o,
});

it("ordena por cliente ao clicar no cabeçalho", async () => {
  render(<PainelDocumentos competenciaInicial="2026-08" documentos={[
    d({ id: "z", clienteRazaoSocial: "Zeta" }),
    d({ id: "a", clienteRazaoSocial: "Alfa" }),
  ]} />);
  await userEvent.click(screen.getByRole("button", { name: /cliente/i }));
  const linhas = screen.getAllByRole("row").slice(1);
  expect(within(linhas[0]).getByText("Alfa")).toBeInTheDocument();
});

it("a célula do arquivo é um link para a rota /arquivo em nova aba", () => {
  render(<PainelDocumentos competenciaInicial="2026-08" documentos={[d({ id: "abc" })]} />);
  const link = screen.getByRole("link", { name: /a\.pdf/i });
  expect(link).toHaveAttribute("href", "/modulos/sc-01/documento/abc/arquivo");
  expect(link).toHaveAttribute("target", "_blank");
});

it("filtra por busca", async () => {
  render(<PainelDocumentos competenciaInicial="2026-08" documentos={[
    d({ id: "a", clienteRazaoSocial: "Alfa" }), d({ id: "b", clienteRazaoSocial: "Beta" }),
  ]} />);
  await userEvent.type(screen.getByLabelText(/buscar/i), "beta");
  expect(screen.queryByText("Alfa")).not.toBeInTheDocument();
  expect(screen.getByText("Beta")).toBeInTheDocument();
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npx vitest run src/components/documentos/PainelDocumentos.test.tsx`
Expected: FAIL.

- [ ] **Step 3: Reescrever `TabelaDocumentos`**

Manter o estado vazio (sem o subtítulo antigo). Cabeçalho: `Cliente` (ordenável), `Arquivo`, `Banco`, `Chegada` (ordenável), `Status` (ordenável), `Linhas` (ordenável), `Abrir`. Cabeçalho ordenável no padrão do `PainelCertificados` (`<button>` com ▲/▼, `text-petroleo` quando ativo). Célula **Arquivo**: `<a href={\`/modulos/sc-01/documento/${d.id}/arquivo\`} target="_blank" rel="noopener noreferrer" className="… text-turquesa hover:underline">{d.nomeArquivo}</a>`. Célula **Banco**: `d.bancoRotulo ?? "—"` em `font-codigo text-xs text-grafite`. Célula **Abrir**: `Link` para `/modulos/sc-01/documento/${d.id}` (mantém o ícone atual).

- [ ] **Step 4: Implementar `PainelDocumentos`**

Client. Toolbar: `<input type="search" aria-label="Buscar cliente ou arquivo">`, `<select>` status (Todos/Pendente/Processado/Erro), `<select>` banco (`bancosDisponiveis(documentos)`), `<input type="month">` (default `competenciaInicial`), pílula de contagem, "Limpar" (só quando algum filtro ativo). `useState` de `filtros` + `ordenacao` (`"chegada-desc"` inicial). `useMemo`: `ordenarDocumentos(filtrarDocumentos(documentos, filtros), ordenacao)`. `aoOrdenar(coluna)` alterna `-asc`/`-desc`. Passa tudo para `<TabelaDocumentos>`. Classe de campo igual à toolbar do `PainelSc20`.

- [ ] **Step 5: Rodar e ver passar**

Run: `npx vitest run src/components/documentos/PainelDocumentos.test.tsx`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/components/documentos/TabelaDocumentos.tsx src/components/documentos/PainelDocumentos.tsx src/components/documentos/PainelDocumentos.test.tsx
git commit -m "feat(sc-01): tabela de documentos com filtros, ordenacao e arquivo clicavel"
```

---

## Task 16: `FiltrosAuditoriaDocumentos` + `TimelineAuditoria`

**Files:**
- Create: `src/components/documentos/FiltrosAuditoriaDocumentos.tsx`
- Create: `src/components/documentos/TimelineAuditoria.tsx`
- Create: `src/components/documentos/TimelineAuditoria.test.tsx`

**Interfaces:**
- Consumes: `LinhaAuditoriaDocumento`, `ACENTO_ACAO`, `ROTULO_ACAO`, `NATUREZAS`, `camposAlterados`, `rotuloAtor` (Task 4); `formatarDataUTC` de `@/lib/documentos/formato-documentos`.
- Produces:
  - `TimelineAuditoria` props: `{ linhas: LinhaAuditoriaDocumento[] }`
  - `FiltrosAuditoriaDocumentos` props: `{ clientes: { id: string; razaoSocial: string }[]; valores: { cliente?: string; evento?: string; de?: string; ate?: string } }` (client; `router.push` para `?aba=auditoria&...`)

- [ ] **Step 0: Invocar `frontend-design`.**

- [ ] **Step 1: Testes da `TimelineAuditoria`**

```tsx
// src/components/documentos/TimelineAuditoria.test.tsx
import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { TimelineAuditoria } from "./TimelineAuditoria";
import type { LinhaAuditoriaDocumento } from "@/lib/documentos/historico";

const l = (o: Partial<LinhaAuditoriaDocumento>): LinhaAuditoriaDocumento => ({
  id: "1", acao: "EXTRATO_ENVIADO", descricao: "Extrato a.pdf enviado",
  autorEmail: null, criadoEm: new Date("2026-08-10T13:00:00Z"),
  dadosAntes: null, dadosDepois: null, ...o,
});

it("mostra estado vazio", () => {
  render(<TimelineAuditoria linhas={[]} />);
  expect(screen.getByText(/nada registrado/i)).toBeInTheDocument();
});

it("ator nulo aparece como 'Sistema'", () => {
  render(<TimelineAuditoria linhas={[l({})]} />);
  expect(screen.getByText(/sistema/i)).toBeInTheDocument();
});

it("mostra o diff campo: antes → depois", () => {
  render(<TimelineAuditoria linhas={[l({
    acao: "LINHA_CONFERIDA",
    dadosAntes: { valor: "100" }, dadosDepois: { valor: "120" },
  })]} />);
  expect(screen.getByText(/valor:/)).toBeInTheDocument();
  expect(screen.getByText(/100 → 120/)).toBeInTheDocument();
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npx vitest run src/components/documentos/TimelineAuditoria.test.tsx`
Expected: FAIL.

- [ ] **Step 3: Implementar `TimelineAuditoria`**

Copiar a estrutura de `src/components/certificados/TimelineHistorico.tsx` (lista `<ol>` com nó colorido, `descricao`, `time` data+hora UTC, chips de diff via `camposAlterados`, `rotuloAtor`), trocando os imports para `@/lib/documentos/historico` e usando `ACENTO_ACAO`/`ROTULO_ACAO` locais. Estado vazio: "Nada registrado ainda — envio, leitura, conferência e download de OFX aparecem aqui." `NO_COR` mapeia `turquesa`/`ambar`/`carmim` para `bg-*`.

- [ ] **Step 4: Implementar `FiltrosAuditoriaDocumentos`**

Copiar a estrutura de `src/components/certificados/FiltrosHistorico.tsx`: selects `cliente` e `evento` (de `NATUREZAS` local), `de`/`ate`, botões "Filtrar"/"Limpar" (`useRouter().push` para `/modulos/sc-01?aba=auditoria&...`), link "Baixar CSV" para `/modulos/sc-01/historico/relatorio?<mesmos params>`. Legenda de 3 cores (turquesa = envio/leitura/OFX; âmbar = conferência/reprocesso/cobrança/config; carmim = falha/exclusão). Sem lib.

- [ ] **Step 5: Rodar e ver passar**

Run: `npx vitest run src/components/documentos/TimelineAuditoria.test.tsx`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/components/documentos/FiltrosAuditoriaDocumentos.tsx src/components/documentos/TimelineAuditoria.tsx src/components/documentos/TimelineAuditoria.test.tsx
git commit -m "feat(sc-01): filtros e timeline da aba de auditoria"
```

---

## Task 17: `VisualizadorArquivo` + reconstrução da tela de detalhe

**Files:**
- Create: `src/components/documentos/VisualizadorArquivo.tsx`
- Create: `src/components/documentos/VisualizadorArquivo.test.tsx`
- Modify: `src/components/documentos/PainelLancamentos.tsx`, `src/components/documentos/LinhaConferencia.tsx` (reestilo p/ painel claro)
- Modify: `src/app/modulos/sc-01/documento/[documentoId]/page.tsx`

**Interfaces:**
- Consumes: `DocumentoDetalhe` de `@/lib/documentos/consultas-sc01`; `reprocessarDocumento` (Task 9).
- Produces: `VisualizadorArquivo` props: `{ src: string; mimeType: string; nomeArquivo: string }`.

- [ ] **Step 0: Invocar `frontend-design`** para o shell da tela e o visualizador.

- [ ] **Step 1: Testes do `VisualizadorArquivo`**

```tsx
// src/components/documentos/VisualizadorArquivo.test.tsx
import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { VisualizadorArquivo } from "./VisualizadorArquivo";

it("PDF vira <iframe> apontando para o src", () => {
  const { container } = render(
    <VisualizadorArquivo src="/x/arquivo" mimeType="application/pdf" nomeArquivo="e.pdf" />,
  );
  const iframe = container.querySelector("iframe");
  expect(iframe?.getAttribute("src")).toContain("/x/arquivo");
});

it("imagem vira <img> e o zoom aumenta a escala", async () => {
  render(<VisualizadorArquivo src="/x/arquivo" mimeType="image/jpeg" nomeArquivo="e.jpg" />);
  const img = screen.getByRole("img", { name: /e\.jpg/i });
  const antes = img.style.transform;
  await userEvent.click(screen.getByRole("button", { name: /aproximar/i }));
  expect(img.style.transform).not.toBe(antes);
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npx vitest run src/components/documentos/VisualizadorArquivo.test.tsx`
Expected: FAIL.

- [ ] **Step 3: Implementar `VisualizadorArquivo`**

Client. Se `mimeType === "application/pdf"`: `<iframe src={\`${src}#view=FitH\`} title={nomeArquivo} className="h-[min(78vh,880px)] w-full rounded-lg border border-grafite/20 bg-white" />`. Senão: contêiner `overflow-auto rounded-lg border border-grafite/20 bg-white` com `<img src={src} alt={nomeArquivo} style={{ transform: \`scale(${zoom})\`, transformOrigin: "top left" }} />` e uma barra com botões "Aproximar" / "Afastar" / "Ajustar" (`useState(zoom)` entre 0.5 e 4, passo 0.25). Só tokens da paleta.

- [ ] **Step 4: Reestilizar `PainelLancamentos` e `LinhaConferencia`**

Ajustes cosméticos para o painel claro `bg-nevoa/95` da nova tela (bordas `grafite/20`, cabeçalhos `font-texto text-xs uppercase text-grafite`, sem parágrafos-subtítulo). Não muda comportamento nem props.

- [ ] **Step 5: Reconstruir a página de detalhe**

`src/app/modulos/sc-01/documento/[documentoId]/page.tsx` — server component:

```tsx
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { obterSessao } from "@/lib/sessao-servidor";
import { sair } from "@/lib/sessao-acoes";
import { CabecalhoPortal } from "@/components/CabecalhoPortal";
import { VeuAtmosferico } from "@/components/VeuAtmosferico";
import { filtrarModulosVisiveis, obterModulo } from "@/lib/modulos-catalogo";
import { obterDocumentoComLancamentos } from "@/lib/documentos/consultas-sc01";
import { reprocessarDocumento } from "@/lib/documentos/acoes-sc01";
import { BadgeStatusDocumento } from "@/components/documentos/BadgeStatusDocumento";
import { BotaoProcessar } from "@/components/documentos/BotaoProcessar";
import { BotaoBaixarOfx } from "@/components/documentos/BotaoBaixarOfx";
import { PainelLancamentos } from "@/components/documentos/PainelLancamentos";
import { VisualizadorArquivo } from "@/components/documentos/VisualizadorArquivo";
import { formatarDataUTC } from "@/lib/documentos/formato-documentos";

export default async function PaginaDocumentoSc01({
  params,
}: {
  params: Promise<{ documentoId: string }>;
}) {
  const sessao = await obterSessao();
  if (!sessao) redirect("/login");
  const modulo = obterModulo("SC-01");
  const podeVer =
    modulo !== undefined &&
    filtrarModulosVisiveis(sessao.papel, sessao.setor).some((m) => m.codigo === "SC-01");
  if (!modulo || !podeVer) redirect("/");

  const { documentoId } = await params;
  const documento = await obterDocumentoComLancamentos(documentoId);
  if (!documento) notFound();

  const rotuloConta = documento.conta
    ? `${documento.conta.bancoNome} — ag ${documento.conta.agencia} c/c ${documento.conta.numero}`
    : "Sem conta bancária associada";

  return (
    <div className="relative min-h-screen overflow-hidden bg-tinta text-nevoa">
      <VeuAtmosferico />
      <CabecalhoPortal
        nomeUsuario={sessao.nome}
        papel={sessao.papel}
        acaoSair={
          <form action={sair}>
            <button className="rounded-full border border-nevoa/25 px-3.5 py-1.5 font-texto text-sm text-nevoa/85 transition hover:border-nevoa/60 hover:bg-white/5 hover:text-nevoa">
              Sair
            </button>
          </form>
        }
      />
      <main className="mx-auto max-w-[88rem] px-6 pb-20">
        <section className="animate-entrada pt-12 pb-8">
          <Link
            href="/modulos/sc-01"
            className="font-codigo text-[11px] font-medium uppercase tracking-[0.28em] text-turquesa hover:underline"
          >
            ← SC-01 · Extrato bancário
          </Link>
          <div className="mt-4 flex flex-wrap items-start justify-between gap-4">
            <div>
              <h1 className="font-titulo text-2xl font-extrabold leading-tight text-nevoa sm:text-3xl">
                {documento.nomeArquivo}
              </h1>
              <p className="mt-2 font-texto text-sm text-nevoa/70">
                {documento.cliente.razaoSocial} · {rotuloConta}
              </p>
            </div>
            <BadgeStatusDocumento status={documento.status} />
          </div>
        </section>

        <section className="pb-4">
          <div className="grid gap-6 rounded-2xl border border-white/15 bg-nevoa/95 p-4 shadow-[0_24px_70px_-15px_rgba(11,26,32,0.65)] backdrop-blur-xl sm:p-6 lg:grid-cols-2">
            <div className="lg:sticky lg:top-6 lg:self-start">
              <h2 className="mb-3 font-titulo text-lg font-bold text-tinta">Extrato original</h2>
              <VisualizadorArquivo
                src={`/modulos/sc-01/documento/${documento.id}/arquivo`}
                mimeType={documento.mimeType}
                nomeArquivo={documento.nomeArquivo}
              />
            </div>

            <div className="flex flex-col gap-8">
              {documento.status === "PENDENTE" || documento.status === "ERRO" ? (
                <BotaoProcessar
                  acao={reprocessarDocumento}
                  rotulo="Reprocessar"
                  documentoId={documento.id}
                />
              ) : null}

              <PainelLancamentos documento={documento} />

              <section>
                <h2 className="mb-3 font-titulo text-lg font-bold text-tinta">Arquivo OFX</h2>
                <BotaoBaixarOfx
                  href={`/modulos/sc-01/documento/${documento.id}/ofx`}
                  bloqueado={!documento.podeBaixarOfx}
                  motivo={documento.motivoBloqueio}
                />
              </section>
            </div>
          </div>
        </section>
      </main>

      <footer className="mx-auto max-w-[88rem] border-t border-white/10 px-6 py-6">
        <p className="font-codigo text-[10px] uppercase tracking-[0.28em] text-nevoa/40">
          Acesso restrito · SheepContabil
        </p>
      </footer>
    </div>
  );
}
```

(Se a Task 9 já trocou `processarUm` → `reprocessarDocumento`, o import acima resolve. `BotaoProcessar` continua servindo — só muda o rótulo.)

- [ ] **Step 6: Rodar tudo**

Run: `npx vitest run src/components/documentos/VisualizadorArquivo.test.tsx && npm test && npx tsc --noEmit`
Expected: testes PASS; `tsc` só pode acusar `page.tsx` da lista (Task 19).

- [ ] **Step 7: Verificação visual manual**

`npm run dev` → logar → abrir um documento pela lista → conferir o shell escuro, o extrato à esquerda, lançamentos/OFX à direita, e o "Reprocessar" só em PENDENTE/ERRO.

- [ ] **Step 8: Commit**

```bash
git add src/components/documentos/VisualizadorArquivo.tsx src/components/documentos/VisualizadorArquivo.test.tsx src/components/documentos/PainelLancamentos.tsx src/components/documentos/LinhaConferencia.tsx "src/app/modulos/sc-01/documento/[documentoId]/page.tsx"
git commit -m "feat(sc-01): tela de detalhe reconstruida no shell com visualizador do extrato"
```

---

## Task 18: `page.tsx` da SC-01 — shell, abas, KPIs, "Enviar extratos"

**Files:**
- Modify: `src/app/modulos/sc-01/page.tsx`

**Interfaces:**
- Consumes: `listarDocumentos({ tipo, competencia })`, `listarHistoricoDocumentos`, `listarClientesParaUpload`, `listarContasDoCliente` (existentes); `PainelDocumentos` (Task 15), `FiltrosAuditoriaDocumentos`/`TimelineAuditoria` (Task 16), `ModalEnviarExtratos` (Task 14).
- Produces: página com abas `?aba=documentos` (padrão) e `?aba=auditoria`.

- [ ] **Step 0: Invocar `frontend-design`** para o cabeçalho, os KPIs e a `<nav>` de abas.

- [ ] **Step 1: Reescrever a página**

Estrutura (server component), espelhando o shell da SC-20:

- `searchParams: Promise<{ aba?; competencia?; cliente?; evento?; de?; ate?; pagina? }>`.
- Auth igual ao atual.
- `aba = sp.aba === "auditoria" ? "auditoria" : "documentos"`.
- `competencia` = `sp.competencia` (`/^\d{4}-\d{2}$/`) ou o mês corrente (`YYYY-MM` via `new Date()` em UTC).
- Carrega sempre: `documentos = await listarDocumentos({ tipo: "EXTRATO", competencia })`, `clientes = await listarClientesParaUpload()`, `contasPorCliente` (como hoje). Para a aba auditoria: `historico = await listarHistoricoDocumentos({ ...filtros, pagina })`.
- Cabeçalho no shell escuro: código "SC-01 · Extrato bancário" (turquesa mono), `<h1>` = `modulo.nome` (`font-titulo`), **sem** parágrafo. Botão `"Enviar extratos"` (client wrapper que abre o `ModalEnviarExtratos`).
- KPIs `<dl>` (faixa como a SC-20), derivados de `documentos`: "Na fila" (`status PENDENTE`), "Em conferência" (`emRevisao > 0`), "Com erro" (`status ERRO`), "No mês" (`documentos.length`). Sem ação (o link para filtro fica para o Plano B, quando houver a aba Controle).
- Painel claro `bg-nevoa/95` com `<nav>` de abas (`?aba=documentos` / `?aba=auditoria`), classe `abaClasse` igual à da SC-20.
- `aba === "documentos"` → `<PainelDocumentos documentos={documentos} competenciaInicial={competencia} />`.
- `aba === "auditoria"` → `<FiltrosAuditoriaDocumentos clientes={...} valores={...} />` + `<TimelineAuditoria linhas={historico.linhas} />` + paginação (30/pág, padrão da SC-20: `Página X de Y · N eventos`, links `?aba=auditoria&...&pagina=`).
- **Remover:** `import { HistoricoExecucoes }`, `import { listarHistorico }` de `@/lib/execucao`, `import { processarPendentes }`, `import { BotaoProcessar }` do cabeçalho, `import { FormularioUploadDocumento }`, a seção "Enviar extrato" inline, a seção "Histórico de execução", o `<BotaoProcessar acao={processarPendentes} …>` e o cálculo de `execucoes`.
- Rodapé "Acesso restrito · SheepContabil" (`max-w-[88rem]`).

- [ ] **Step 2: Client wrapper do botão**

Criar um pequeno `src/components/documentos/BotaoNovoExtrato.tsx` (client): `useState(aberto)` + `<SpecularButton onClick={() => setAberto(true)}>Enviar extratos</SpecularButton>` + `<ModalEnviarExtratos aberto={aberto} aoFechar={() => setAberto(false)} clientes={...} contasPorCliente={...} />`. Props: `{ clientes, contasPorCliente }`.

- [ ] **Step 3: Typecheck + suíte**

Run: `npx tsc --noEmit && npm test`
Expected: PASS (agora todas as pontas soltas de `page.tsx` estão resolvidas).

- [ ] **Step 4: Verificação visual manual**

`npm run dev` → `/modulos/sc-01`: shell escuro, abas Documentos/Auditoria, KPIs, botão "Enviar extratos" abre o modal; sem "Processar pendentes"; sem "Histórico de execução".

- [ ] **Step 5: Commit**

```bash
git add src/app/modulos/sc-01/page.tsx src/components/documentos/BotaoNovoExtrato.tsx
git commit -m "feat(sc-01): pagina no shell com abas Documentos/Auditoria e envio por modal"
```

---

## Task 19: Cron diário + README

**Files:**
- Modify: `vercel.json`
- Modify: `README.md` (seção SC-01)

- [ ] **Step 1: Cron diário**

Em `vercel.json`, trocar o item do `path: "/api/cron/sc-01"` de `"schedule": "0 8 2 * *"` para `"schedule": "0 8 * * *"`.

- [ ] **Step 2: README**

Reescrever a seção da SC-01: leitura automática no envio (via `after()` + cron diário como rede), envio por modal multi-bloco com auto-detecção, régua de confiança 100%, abas Documentos/Auditoria, tela de detalhe com visualizador. Manter o formato das outras seções de módulo.

- [ ] **Step 3: Suíte**

Run: `npm test`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add vercel.json README.md
git commit -m "chore(sc-01): cron diario como rede da leitura automatica + README"
```

---

## Task 20: Remoção dos subtítulos no portal

**Files:**
- Modify: `src/app/page.tsx`
- Modify: `src/app/modulos/sc-11/page.tsx`
- Modify: `src/app/modulos/sc-20/page.tsx`
- Modify: `src/components/certificados/PainelSc20.tsx` e modais da SC-20 que tenham parágrafo descritivo abaixo de título
- (SC-01 já sai limpa das Tasks 14–18.)

**Interfaces:** nenhuma — mudança de cópia/marcação.

- [ ] **Step 1: Mapear os alvos**

Run: `grep -rn "max-w-xl font-texto\|max-w-prose font-texto\|mt-3 .*text-nevoa/70\|mt-1 .*text-grafite" src/app src/components/certificados`
Listar os `<p>` que são **subtítulo descritivo logo abaixo de um `<h1>`/`<h2>` de seção**. **Não** mexer em: textos de estado vazio, mensagens de erro/aviso, legendas, `<span>` de contador, textos auxiliares de campo de formulário.

- [ ] **Step 2: Remover**

Apagar cada `<p>` identificado. Se a remoção deixar um wrapper `<div>` só com o `<h1>`, manter o `<div>` (o layout flex depende dele) — só o parágrafo sai.

- [ ] **Step 3: Ajustar testes que asseram o texto removido**

Run: `npm test`
Se algum teste da SC-20/SC-11 falhar por procurar a frase do subtítulo, remover a asserção correspondente (era teste de cópia, não de comportamento).

- [ ] **Step 4: Verificação visual manual**

`npm run dev` → home, `/modulos/sc-11`, `/modulos/sc-20`, `/modulos/sc-01`: nenhum parágrafo-subtítulo abaixo dos títulos; títulos, códigos, selos e contadores intactos.

- [ ] **Step 5: Commit**

```bash
git add src/app/page.tsx src/app/modulos src/components/certificados
git commit -m "refactor(ui): remove subtitulos descritivos das telas do portal"
```

---

## Task 21: Extratos de exemplo para impressão

**Files:**
- Create: `docs/extratos-exemplo/banco-meridiano.html`
- Create: `docs/extratos-exemplo/cooperativa-sulcampos.html`
- Create: `docs/extratos-exemplo/README.md`

**Interfaces:** nenhuma (arquivos de apoio).

- [ ] **Step 1: `banco-meridiano.html`**

HTML único, CSS embutido, sem dependências. **Banco fictício** "Banco Meridiano S.A." (CNPJ fictício, ex.: `12.345.678/0001-90`). Retrato A4. `@media print { @page { size: A4; margin: 14mm } body { … } }` e sombra/realce só fora do print. Conteúdo:
- Cabeçalho: nome do banco + "Extrato de Conta Corrente" · "Agência 1201 · Conta 45678-9" · **"Período: 01/08/2026 a 31/08/2026"** · "Titular: Alfa Comércio de Materiais Ltda".
- Caixa de resumo: Saldo anterior / Total de créditos / Total de débitos / Saldo atual.
- Tabela monoespaçada, zebra: `Data · Histórico · Documento · Valor (R$) · Saldo (R$)` — ~14 lançamentos plausíveis de agosto/2026 (TED, PIX, boleto, tarifa, débito automático, IOF, rendimento), valores com sinal, coluna de saldo acumulado.
- Rodapé: "SAC 0800 000 0000 · Ouvidoria 0800 000 0001" · "Documento sem valor fiscal."
- Tipografia grande (corpo ≥ 12pt) e alto contraste (preto sobre branco) para sobreviver à foto.

- [ ] **Step 2: `cooperativa-sulcampos.html`**

Mesma pegada, leiaute **diferente**: "Cooperativa de Crédito Sul-Campos — SICSUL" (fictícia). Serifado, minimalista, margens largas. Colunas `Histórico · Data · Nº Doc · Débito · Crédito` (sem sinal, colunas separadas), **sem** coluna de saldo. Numeração de página ("Página 1 de 1"). **"Período: 01/08/2026 a 29/08/2026"** — cobre só até o dia 29 (exercita "Atrasado" no Plano B). Titular: "Beta Consultoria Empresarial Ltda". ~12 lançamentos. Texto legal diferente ("Extrato gerado eletronicamente pela central de cooperativas…").

- [ ] **Step 3: `README.md` da pasta**

Explicar: para que servem (testar upload de JPG e a auto-detecção), como usar (abrir no navegador → Ctrl+P → "Salvar como PDF" ou imprimir em papel → fotografar), e que os bancos são fictícios.

- [ ] **Step 4: Verificação manual**

Abrir os dois no navegador; `Ctrl+P` e conferir que cabem em 1 página A4 limpa, sem cortar coluna.

- [ ] **Step 5: Commit**

```bash
git add docs/extratos-exemplo
git commit -m "docs(sc-01): 2 extratos de exemplo (bancos ficticios) para impressao e foto"
```

---

## Task 22: Seed — período nos fixtures de extrato

**Files:**
- Modify: `prisma/seed.ts` (`seedDocumentosEntrada`, ~L189-225)

**Interfaces:** nenhuma.

- [ ] **Step 1: Ajustar `seedDocumentosEntrada`**

Para cada fixture, no `prisma.documentoEntrada.create`, adicionar `periodoInicio`/`periodoFim`/`competencia` coerentes com os dados do `gerar-fixtures.ts` (todos de **agosto/2026**):

```ts
      periodoInicio: new Date("2026-08-01T00:00:00Z"),
      periodoFim: new Date("2026-08-31T00:00:00Z"),
      competencia: "2026-08",
```

(Manter os documentos como `PENDENTE` — a leitura automática/reprocesso preencherá o período de verdade; o seed só dá um valor inicial plausível para a aba Documentos não ficar sem `competencia`.)

- [ ] **Step 2: Rodar o seed local**

Run: `npx prisma migrate reset --force` (aplica migrações + seed) — ou `npx prisma db seed` se preferir sem reset.
Expected: sem erro; `select competencia from "DocumentoEntrada"` mostra `2026-08`.

- [ ] **Step 3: Suíte**

Run: `npm test`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add prisma/seed.ts
git commit -m "chore(sc-01): seed preenche competencia nos extratos de exemplo"
```

---

## Task 23: Fechamento — suíte, lint, typecheck, revisão manual

**Files:** nenhum novo.

- [ ] **Step 1: Verificação completa**

Run: `npm test && npx tsc --noEmit && npm run lint`
Expected: tudo verde.

- [ ] **Step 2: Walkthrough manual**

`npm run dev`, logado como `admin@sheepcontabil.com.br` / `AdminSheep#2026`:
1. `/modulos/sc-01` — shell escuro, abas Documentos/Auditoria, KPIs, sem "Processar pendentes" nem "Histórico de execução".
2. "Enviar extratos" → modal; anexar um PDF de `docs/extratos-exemplo` → cliente/banco preenchidos (ou "selecione na mão"); "＋ Adicionar outro extrato" cria bloco; enviar → modal fecha, linha entra como "Na fila" e vira "Processado" sozinha.
3. Tabela: ordenar por Cliente/Chegada/Status/Linhas; buscar; filtrar por status/banco/mês; clicar no nome do arquivo → abre o PDF/JPG em nova aba.
4. "Abrir" → tela de detalhe no shell, extrato à esquerda, lançamentos/conferência/OFX à direita; confирmar uma linha em conferência; baixar OFX quando todas confirmadas.
5. Aba Auditoria: eventos `EXTRATO_ENVIADO`, `LEITURA_CONCLUIDA`, `LINHA_CONFERIDA`, `OFX_BAIXADO` com ator e diff; filtrar; "Baixar CSV".
6. `/modulos/sc-20` aba Histórico — **não** aparecem eventos da SC-01.
7. Botões do portal: brilho não vaza da borda.
8. home, SC-11, SC-20, SC-01 — sem parágrafos-subtítulo.

- [ ] **Step 3: Commit final (se houver ajuste) e abrir PR**

```bash
git status   # deve estar limpo se nada mudou no walkthrough
gh pr create --base master --head sc-01-controle-entrega --title "SC-01 — reconstrução, upload multi-bloco e auditoria (Plano A)" --body "Implementa o Plano A de docs/superpowers/plans/2026-09-02-sc-01-reconstrucao-upload-auditoria.md. Plano B (controle de entrega mensal) vem em seguida na mesma branch."
```

---

## Self-Review

**1. Cobertura da spec (itens do Plano A):**

| Spec | Task |
|---|---|
| §5.4 régua 100% | 2 |
| §5.5 filtros-documentos | 3 |
| §5.6 historico (vocabulário) | 4 |
| §6.2 extrator: período + prompt | 5 |
| §6.1 detecção de cabeçalho (Haiku) + casamento | 6, 9 |
| §6.2 processamento grava período/competência + auditoria | 7 |
| §4.3 campos de período em `DocumentoEntrada` | 1 |
| §6.3 `after()` + fallback | 9 |
| §7 leitura automática, fim do "Processar pendentes", "Reprocessar" | 9, 17, 18 |
| §8 abas Documentos/Auditoria, KPIs, "Enviar extratos", sem "Histórico de execução" | 18 |
| §10 tabela: filtros, ordenação, coluna Banco, arquivo clicável | 3, 15 |
| §11 aba Auditoria: consulta escopada, filtros, timeline, CSV, escopo SC-20 | 4, 8, 10, 11, 16 |
| §12 modal multi-bloco de envio | 14 |
| §15 tela de detalhe reconstruída + visualizador + rota `/arquivo` + auditoria OFX | 12, 17 |
| §16 SpecularButton contido | 13 |
| §17 remoção de subtítulos (portal) | 20 |
| §18 extratos de exemplo | 21 |
| §19 cron diário | 19 |
| §20 (parcial) seed com competência | 22 |

Ficam explicitamente para o **Plano B** (anotado no header): §4.2/§4.4, §5.1/§5.2/§5.3, §9 (aba Controle), §13, §14, §20 (cenário dos 4 status), KPIs com link para filtro de status.

**2. Placeholders:** sem "TBD"/"TODO". Todo passo de código traz o código real. Os únicos textos a produzir livremente são: o `INSTRUCAO` do extrator (dado na íntegra na Task 5), a cópia do README (Task 19) e o conteúdo dos 2 HTML de exemplo (Task 21, especificado campo a campo).

**3. Consistência de tipos:**
- `DocumentoResumo` ganha `bancoRotulo: string | null` + `competencia: string` na Task 8; a Task 3 escreve os testes contra esse shape e a Task 15 consome. ✔
- `ResultadoExtracao` (Task 5) consumido pela Task 7 (`resultado.linhas`, `resultado.periodoInicio/Fim`). ✔
- `CabecalhoExtrato` (Task 6) consumido pela Task 9 (`detectarCabecalho`) e Task 14 (retorno). ✔
- `EstadoEnvio` (Task 9) consumido pela Task 14 (`useActionState` + `estado.erro`/`estado.indice`/`estado.ok`). ✔
- `AcaoAuditoriaDocumento`/`LinhaAuditoriaDocumento` (Task 4) usados nas Tasks 8, 11, 16. ✔
- `OrdenacaoDocumento` + colunas `"cliente" | "chegada" | "status" | "linhas"` — Task 3 define, Task 15 usa o mesmo conjunto. ✔
- `reprocessarDocumento` (renomeia `processarUm`) — Task 9 cria, Tasks 17 e 18 importam com esse nome. ✔
- `after` de `next/server` — Task 9 confirma existência antes de importar; há fallback. ✔
