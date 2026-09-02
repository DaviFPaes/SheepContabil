# Gestão de Permissões de Operador — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Dar ao ADMIN uma tela (`/admin/usuarios`) para ligar/desligar, por operador, quais módulos e sub-áreas (abas/seções) aparecem no portal — hoje isso é fixo por `papel` + `setor`.

**Architecture:** Duas tabelas novas (`PermissaoModulo`, `PermissaoSubArea`) guardam o estado por usuário. Uma camada pura (`src/lib/permissoes/regra.ts`) decide visibilidade a partir de `papel`/`setor`/permissões, chamada por `filtrarModulosVisiveis` (já existente) e por cada `page.tsx` de módulo. Uma tela nova em `/admin/usuarios` lista operadores e liga/desliga cada linha via server actions que gravam auditoria em `RegistroAuditoria`.

**Tech Stack:** Next.js 16 (App Router, Server Components + Server Actions), Prisma 7, PostgreSQL local (`docker compose`), Vitest + Testing Library.

**Spec:** [docs/superpowers/specs/2026-09-02-gestao-permissoes-operador-design.md](../specs/2026-09-02-gestao-permissoes-operador-design.md)

## Global Constraints

- ADMIN nunca é filtrado por esse sistema — só `papel === "OPERADOR"` passa pela leitura de permissões.
- `filtrarModulosVisiveis(papel, setor, catalogo?, permissoes?)` mantém os call sites posicionais existentes (2 ou 3 argumentos) funcionando sem mudança.
- Falha fechada: chamar a regra de visibilidade de módulo para um OPERADOR sem ter buscado as permissões dá `false` (nunca `true`).
- Sub-área ausente de override = visível ("módulo completo ao ligar"); módulo ausente de linha = oculto ("nada até liberar").
- Nenhuma linha de `PermissaoModulo`/`PermissaoSubArea` é pré-criada — nem na migração, nem no `seed.ts`.
- Sub-área desligada só esconde na navegação — não bloqueia a rota interna por baixo (decisão registrada na spec §11).
- Nomenclatura em português, seguindo o padrão do repositório (`acoes.ts`/`consultas.ts` por domínio, `RegistroAuditoria` para trilha).
- Banco local via `docker compose up -d db` (Postgres em `localhost:5433`, ver `docker-compose.yml` e `.env`) — os testes que tocam Prisma rodam contra ele, seguindo o padrão de `src/lib/certificados/acoes.test.ts`.

---

## File Structure

```
prisma/schema.prisma                                  # modificado: 2 models novos + relação em Usuario
src/lib/permissoes/
  regra.ts                                             # novo: moduloVisivel / subAreaVisivel (puro)
  regra.test.ts                                        # novo
  catalogo.ts                                          # novo: SUBAREAS_MODULO
  consultas.ts                                         # novo: obterPermissoesUsuario / listarOperadoresParaGestao
  consultas.test.ts                                    # novo
  acoes.ts                                              # novo: alternarPermissaoModulo / alternarPermissaoSubArea
  acoes.test.ts                                         # novo
src/lib/modulos-catalogo.ts                            # modificado: filtrarModulosVisiveis ganha `permissoes?`
src/lib/modulos-catalogo.test.ts                       # modificado
src/components/CabecalhoPortal.tsx                     # modificado: link "Gerenciar usuários" para ADMIN
src/components/CabecalhoPortal.test.tsx                # modificado
src/components/usuarios/
  PainelGestaoUsuarios.tsx                             # novo: lista + painel de toggles
  PainelGestaoUsuarios.test.tsx                        # novo
src/app/admin/usuarios/page.tsx                        # novo: tela ADMIN-only
src/app/page.tsx                                        # modificado: Home passa permissoes pro filtro
src/app/modulos/sc-01/page.tsx                         # modificado: gate + esconde Histórico de execução
src/app/modulos/sc-11/page.tsx                         # modificado: gate + esconde Histórico de execução
src/app/modulos/sc-20/page.tsx                         # modificado: gate + esconde aba Histórico + sino
```

---

### Task 1: Modelo de dados — migração Prisma

**Files:**
- Modify: `prisma/schema.prisma`
- Create: migração gerada por `prisma migrate dev` em `prisma/migrations/<timestamp>_permissoes_operador/`

**Interfaces:**
- Produces: models Prisma `PermissaoModulo` e `PermissaoSubArea`, disponíveis em `@/generated/prisma/client` como `prisma.permissaoModulo` / `prisma.permissaoSubArea` depois do `prisma generate`.

- [ ] **Step 1: Adicionar as relações em `Usuario`**

Em `prisma/schema.prisma`, dentro do `model Usuario { ... }`, logo abaixo de `registrosAuditoria RegistroAuditoria[]`:

```prisma
model Usuario {
  id        String       @id @default(cuid())
  email     String       @unique
  nome      String
  senhaHash String
  papel     PapelUsuario
  setor     String?
  criadoEm  DateTime     @default(now())

  notificacoes       NotificacaoInApp[]
  registrosAuditoria RegistroAuditoria[]
  permissoesModulo   PermissaoModulo[]
  permissoesSubArea  PermissaoSubArea[]
}
```

- [ ] **Step 2: Adicionar os dois models novos**

Logo depois do `model Usuario { ... }`, antes de `model Cliente { ... }`:

```prisma
model PermissaoModulo {
  id           String   @id @default(cuid())
  usuarioId    String
  usuario      Usuario  @relation(fields: [usuarioId], references: [id], onDelete: Cascade)
  moduloCodigo String
  habilitado   Boolean  @default(false)
  atualizadoEm DateTime @updatedAt

  @@unique([usuarioId, moduloCodigo])
  @@index([usuarioId])
}

model PermissaoSubArea {
  id           String   @id @default(cuid())
  usuarioId    String
  usuario      Usuario  @relation(fields: [usuarioId], references: [id], onDelete: Cascade)
  moduloCodigo String
  subArea      String
  habilitado   Boolean  @default(true)
  atualizadoEm DateTime @updatedAt

  @@unique([usuarioId, moduloCodigo, subArea])
  @@index([usuarioId])
}
```

- [ ] **Step 3: Subir o Postgres local (se não estiver rodando) e gerar a migração**

```bash
docker compose up -d db
npx prisma migrate dev --name permissoes_operador
```

Isso cria `prisma/migrations/<timestamp>_permissoes_operador/migration.sql`, aplica no banco local e regenera `src/generated/prisma/*` (o `prisma generate` roda como parte do `migrate dev`).

- [ ] **Step 4: Verificar a migração gerada**

Abra o arquivo `migration.sql` criado e confirme que ele cria as duas tabelas com as colunas e o `UNIQUE`/`INDEX` acima — nenhuma outra tabela deve ser tocada. Rode `npx prisma validate` para conferir que o schema está consistente.

- [ ] **Step 5: Commit**

```bash
git add prisma/schema.prisma prisma/migrations
git commit -m "feat(permissoes): modelo de dados PermissaoModulo/PermissaoSubArea"
```

---

### Task 2: Regra de visibilidade e catálogo de sub-áreas

**Files:**
- Create: `src/lib/permissoes/regra.ts`
- Create: `src/lib/permissoes/regra.test.ts`
- Create: `src/lib/permissoes/catalogo.ts`

**Interfaces:**
- Consumes: `type ModuloCatalogo` de `@/lib/modulos-catalogo` (import type — sem dependência de runtime).
- Produces: `type PermissoesUsuario = { modulosLigados: Set<string>; subAreasDesligadas: Set<string> }`, `moduloVisivel(papel, setor, modulo, permissoes?): boolean`, `subAreaVisivel(papel, moduloCodigo, subArea, permissoes?): boolean`, `SUBAREAS_MODULO: Record<string, { chave: string; rotulo: string }[]>` — usados pelas Tasks 3, 4, 5, 7, 9–12.

- [ ] **Step 1: Escrever o teste de `regra.ts`**

`src/lib/permissoes/regra.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { moduloVisivel, subAreaVisivel, type PermissoesUsuario } from "./regra";
import type { ModuloCatalogo } from "../modulos-catalogo";

const MODULO: ModuloCatalogo = {
  codigo: "X-1",
  nome: "Módulo de teste",
  natureza: "CONTROLE",
  setorDono: "Processos",
  descricao: "teste",
  implementado: true,
};

describe("moduloVisivel", () => {
  it("admin sempre ve, mesmo sem permissoes", () => {
    expect(moduloVisivel("ADMIN", null, MODULO)).toBe(true);
  });

  it("operador de outro setor nao ve, mesmo com o modulo ligado", () => {
    const permissoes: PermissoesUsuario = {
      modulosLigados: new Set(["X-1"]),
      subAreasDesligadas: new Set(),
    };
    expect(moduloVisivel("OPERADOR", "BPO Saúde", MODULO, permissoes)).toBe(false);
  });

  it("operador do setor certo sem permissoes nao ve (falha fechada)", () => {
    expect(moduloVisivel("OPERADOR", "Processos", MODULO)).toBe(false);
  });

  it("operador do setor certo com permissoes mas sem o modulo ligado nao ve", () => {
    const permissoes: PermissoesUsuario = {
      modulosLigados: new Set(),
      subAreasDesligadas: new Set(),
    };
    expect(moduloVisivel("OPERADOR", "Processos", MODULO, permissoes)).toBe(false);
  });

  it("operador do setor certo com o modulo ligado ve", () => {
    const permissoes: PermissoesUsuario = {
      modulosLigados: new Set(["X-1"]),
      subAreasDesligadas: new Set(),
    };
    expect(moduloVisivel("OPERADOR", "Processos", MODULO, permissoes)).toBe(true);
  });
});

describe("subAreaVisivel", () => {
  it("admin sempre ve, mesmo sem permissoes", () => {
    expect(subAreaVisivel("ADMIN", "SC-20", "aba_historico")).toBe(true);
  });

  it("operador ve quando nao ha permissoes buscadas (ausencia = visivel)", () => {
    expect(subAreaVisivel("OPERADOR", "SC-20", "aba_historico")).toBe(true);
  });

  it("operador ve quando ha permissoes mas nenhuma linha pra essa sub-area", () => {
    const permissoes: PermissoesUsuario = {
      modulosLigados: new Set(["SC-20"]),
      subAreasDesligadas: new Set(),
    };
    expect(subAreaVisivel("OPERADOR", "SC-20", "aba_historico", permissoes)).toBe(true);
  });

  it("operador nao ve com override explicito desligado", () => {
    const permissoes: PermissoesUsuario = {
      modulosLigados: new Set(["SC-20"]),
      subAreasDesligadas: new Set(["SC-20:aba_historico"]),
    };
    expect(subAreaVisivel("OPERADOR", "SC-20", "aba_historico", permissoes)).toBe(false);
  });

  it("override de uma sub-area nao afeta outra", () => {
    const permissoes: PermissoesUsuario = {
      modulosLigados: new Set(["SC-20"]),
      subAreasDesligadas: new Set(["SC-20:aba_historico"]),
    };
    expect(subAreaVisivel("OPERADOR", "SC-20", "sino_avisos", permissoes)).toBe(true);
  });
});
```

- [ ] **Step 2: Rodar o teste e confirmar que falha**

Run: `npx vitest run src/lib/permissoes/regra.test.ts`
Expected: FAIL — `Cannot find module './regra'` (arquivo ainda não existe).

- [ ] **Step 3: Implementar `regra.ts`**

`src/lib/permissoes/regra.ts`:

```ts
import type { PapelUsuario } from "@/generated/prisma/client";
import type { ModuloCatalogo } from "../modulos-catalogo";

export type PermissoesUsuario = {
  // moduloCodigo dos módulos que o operador tem ligado.
  modulosLigados: Set<string>;
  // `${moduloCodigo}:${subArea}` das sub-áreas com override explícito
  // desligado — ausência da chave aqui significa "visível" (default).
  subAreasDesligadas: Set<string>;
};

// ADMIN sempre enxerga tudo — este sistema só restringe OPERADOR.
// Sem `permissoes` (call site que esqueceu de buscar) o operador não vê
// nada: falha fechada, nunca aberta.
export function moduloVisivel(
  papel: PapelUsuario,
  setor: string | null,
  modulo: ModuloCatalogo,
  permissoes?: PermissoesUsuario,
): boolean {
  if (papel === "ADMIN") return true;
  if (modulo.setorDono !== setor) return false;
  return permissoes?.modulosLigados.has(modulo.codigo) ?? false;
}

// Assume que o módulo em si já foi confirmado visível por quem chama
// (toda page.tsx de módulo só chega aqui depois do gate de `moduloVisivel`).
export function subAreaVisivel(
  papel: PapelUsuario,
  moduloCodigo: string,
  subArea: string,
  permissoes?: PermissoesUsuario,
): boolean {
  if (papel === "ADMIN") return true;
  return !permissoes?.subAreasDesligadas.has(`${moduloCodigo}:${subArea}`);
}
```

- [ ] **Step 4: Rodar o teste e confirmar que passa**

Run: `npx vitest run src/lib/permissoes/regra.test.ts`
Expected: PASS (11 testes).

- [ ] **Step 5: Criar o catálogo de sub-áreas**

`src/lib/permissoes/catalogo.ts`:

```ts
// Sub-áreas que o ADMIN pode ligar/desligar por operador, além do módulo
// inteiro. Granularidade macro — só as divisões que os próprios módulos já
// têm (aba, seção), não botão a botão. Ver spec §6.
export const SUBAREAS_MODULO: Record<string, { chave: string; rotulo: string }[]> = {
  "SC-01": [{ chave: "historico_execucao", rotulo: "Histórico de execução" }],
  "SC-11": [{ chave: "historico_execucao", rotulo: "Histórico de execução" }],
  "SC-20": [
    { chave: "aba_historico", rotulo: "Aba Histórico" },
    { chave: "sino_avisos", rotulo: "Sino de avisos" },
  ],
};
```

- [ ] **Step 6: Commit**

```bash
git add src/lib/permissoes/regra.ts src/lib/permissoes/regra.test.ts src/lib/permissoes/catalogo.ts
git commit -m "feat(permissoes): regra pura de visibilidade e catalogo de sub-areas"
```

---

### Task 3: Consultas (leitura de permissões)

**Files:**
- Create: `src/lib/permissoes/consultas.ts`
- Create: `src/lib/permissoes/consultas.test.ts`

**Interfaces:**
- Consumes: `type PermissoesUsuario` de `./regra` (Task 2); `CATALOGO_MODULOS`, `type ModuloCatalogo` de `@/lib/modulos-catalogo`; `prisma` de `@/lib/prisma`.
- Produces: `obterPermissoesUsuario(usuarioId: string): Promise<PermissoesUsuario>`, `type OperadorGestao = { id: string; nome: string; email: string; setor: string | null; modulosElegiveis: ModuloCatalogo[]; permissoes: PermissoesUsuario }`, `listarOperadoresParaGestao(): Promise<OperadorGestao[]>` — usados pela Task 4 (indireto, mesmo módulo), Task 8 e pelas Tasks 9–12.

- [ ] **Step 1: Escrever o teste**

`src/lib/permissoes/consultas.test.ts`:

```ts
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { prisma } from "@/lib/prisma";
import { obterPermissoesUsuario, listarOperadoresParaGestao } from "./consultas";

const USUARIO_ID = "u-teste-permissoes-consultas";

beforeAll(async () => {
  await prisma.usuario.upsert({
    where: { id: USUARIO_ID },
    update: {},
    create: {
      id: USUARIO_ID,
      email: "u-teste-permissoes-consultas@example.com",
      nome: "Operador Teste Permissoes",
      senhaHash: "x",
      papel: "OPERADOR",
      setor: "Processos",
    },
  });
});

afterAll(async () => {
  await prisma.permissaoSubArea.deleteMany({ where: { usuarioId: USUARIO_ID } });
  await prisma.permissaoModulo.deleteMany({ where: { usuarioId: USUARIO_ID } });
  await prisma.usuario.deleteMany({ where: { id: USUARIO_ID } });
});

describe("obterPermissoesUsuario", () => {
  it("sem nenhuma linha, devolve os dois conjuntos vazios", async () => {
    const permissoes = await obterPermissoesUsuario(USUARIO_ID);
    expect(permissoes.modulosLigados.size).toBe(0);
    expect(permissoes.subAreasDesligadas.size).toBe(0);
  });

  it("so entra no conjunto de modulos ligados quem tem habilitado = true", async () => {
    await prisma.permissaoModulo.create({
      data: { usuarioId: USUARIO_ID, moduloCodigo: "SC-20", habilitado: true },
    });
    await prisma.permissaoModulo.create({
      data: { usuarioId: USUARIO_ID, moduloCodigo: "SC-01", habilitado: false },
    });

    const permissoes = await obterPermissoesUsuario(USUARIO_ID);
    expect(permissoes.modulosLigados).toEqual(new Set(["SC-20"]));
  });

  it("so entra no conjunto de sub-areas desligadas quem tem habilitado = false", async () => {
    await prisma.permissaoSubArea.create({
      data: {
        usuarioId: USUARIO_ID,
        moduloCodigo: "SC-20",
        subArea: "aba_historico",
        habilitado: false,
      },
    });
    await prisma.permissaoSubArea.create({
      data: {
        usuarioId: USUARIO_ID,
        moduloCodigo: "SC-20",
        subArea: "sino_avisos",
        habilitado: true,
      },
    });

    const permissoes = await obterPermissoesUsuario(USUARIO_ID);
    expect(permissoes.subAreasDesligadas).toEqual(new Set(["SC-20:aba_historico"]));
  });
});

describe("listarOperadoresParaGestao", () => {
  it("conta so os modulos elegiveis pelo setor do operador, ligados de verdade", async () => {
    await prisma.permissaoModulo.upsert({
      where: { usuarioId_moduloCodigo: { usuarioId: USUARIO_ID, moduloCodigo: "SC-20" } },
      update: { habilitado: true },
      create: { usuarioId: USUARIO_ID, moduloCodigo: "SC-20", habilitado: true },
    });

    const lista = await listarOperadoresParaGestao();
    const item = lista.find((o) => o.id === USUARIO_ID);

    expect(item).toBeDefined();
    expect(item?.setor).toBe("Processos");
    expect(item?.modulosElegiveis.every((m) => m.setorDono === "Processos")).toBe(true);
    expect(item?.permissoes.modulosLigados.has("SC-20")).toBe(true);
  });

  it("so lista usuarios com papel OPERADOR", async () => {
    const lista = await listarOperadoresParaGestao();
    expect(lista.some((o) => o.email === "admin@sheepcontabil.com.br")).toBe(false);
  });
});
```

- [ ] **Step 2: Rodar o teste e confirmar que falha**

Run: `npx vitest run src/lib/permissoes/consultas.test.ts`
Expected: FAIL — `Cannot find module './consultas'`.

- [ ] **Step 3: Implementar `consultas.ts`**

`src/lib/permissoes/consultas.ts`:

```ts
import { prisma } from "@/lib/prisma";
import { CATALOGO_MODULOS, type ModuloCatalogo } from "@/lib/modulos-catalogo";
import type { PermissoesUsuario } from "./regra";

export async function obterPermissoesUsuario(usuarioId: string): Promise<PermissoesUsuario> {
  const [modulos, subAreas] = await Promise.all([
    prisma.permissaoModulo.findMany({
      where: { usuarioId, habilitado: true },
      select: { moduloCodigo: true },
    }),
    prisma.permissaoSubArea.findMany({
      where: { usuarioId, habilitado: false },
      select: { moduloCodigo: true, subArea: true },
    }),
  ]);

  return {
    modulosLigados: new Set(modulos.map((m) => m.moduloCodigo)),
    subAreasDesligadas: new Set(subAreas.map((s) => `${s.moduloCodigo}:${s.subArea}`)),
  };
}

export type OperadorGestao = {
  id: string;
  nome: string;
  email: string;
  setor: string | null;
  modulosElegiveis: ModuloCatalogo[];
  permissoes: PermissoesUsuario;
};

// Elegível = mesmo par de condições que `filtrarModulosVisiveis` já aplica
// hoje (implementado + setor dono bate) — é o "catálogo oferecível" pro
// ADMIN configurar aquele operador, não a visibilidade efetiva.
export async function listarOperadoresParaGestao(): Promise<OperadorGestao[]> {
  const operadores = await prisma.usuario.findMany({
    where: { papel: "OPERADOR" },
    orderBy: { nome: "asc" },
    select: { id: true, nome: true, email: true, setor: true },
  });

  return Promise.all(
    operadores.map(async (operador) => {
      const modulosElegiveis = CATALOGO_MODULOS.filter(
        (m) => m.implementado && m.setorDono === operador.setor,
      );
      const permissoes = await obterPermissoesUsuario(operador.id);
      return { ...operador, modulosElegiveis, permissoes };
    }),
  );
}
```

- [ ] **Step 4: Rodar o teste e confirmar que passa**

Run: `npx vitest run src/lib/permissoes/consultas.test.ts`
Expected: PASS (5 testes).

- [ ] **Step 5: Commit**

```bash
git add src/lib/permissoes/consultas.ts src/lib/permissoes/consultas.test.ts
git commit -m "feat(permissoes): consultas de leitura de permissao por usuario"
```

---

### Task 4: Ações (ligar/desligar com auditoria)

**Files:**
- Create: `src/lib/permissoes/acoes.ts`
- Create: `src/lib/permissoes/acoes.test.ts`

**Interfaces:**
- Consumes: `prisma` de `@/lib/prisma`; `obterSessao` de `@/lib/sessao-servidor`.
- Produces: `alternarPermissaoModulo(usuarioId: string, moduloCodigo: string, habilitado: boolean): Promise<{ ok: true } | { erro: string }>`, `alternarPermissaoSubArea(usuarioId: string, moduloCodigo: string, subArea: string, habilitado: boolean): Promise<{ ok: true } | { erro: string }>` — usados pela Task 7 (componente cliente).

- [ ] **Step 1: Escrever o teste**

`src/lib/permissoes/acoes.test.ts`:

```ts
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";

const USUARIO_ADMIN_ID = "u-teste-permissoes-admin";
const USUARIO_OPERADOR_ID = "u-teste-permissoes-operador";

let papelSessao: "ADMIN" | "OPERADOR" = "ADMIN";

vi.mock("@/lib/sessao-servidor", () => ({
  obterSessao: vi.fn(async () =>
    papelSessao === "ADMIN"
      ? {
          usuarioId: USUARIO_ADMIN_ID,
          email: "admin-teste-permissoes@sheepcontabil.com.br",
          nome: "Admin Teste",
          papel: "ADMIN",
          setor: null,
        }
      : {
          usuarioId: USUARIO_OPERADOR_ID,
          email: "operador-teste-permissoes@sheepcontabil.com.br",
          nome: "Operador Teste",
          papel: "OPERADOR",
          setor: "Processos",
        },
  ),
}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

import { prisma } from "@/lib/prisma";
import { alternarPermissaoModulo, alternarPermissaoSubArea } from "./acoes";

beforeAll(async () => {
  await prisma.usuario.upsert({
    where: { id: USUARIO_ADMIN_ID },
    update: {},
    create: {
      id: USUARIO_ADMIN_ID,
      email: "u-teste-permissoes-admin@example.com",
      nome: "Admin Teste Acoes",
      senhaHash: "x",
      papel: "ADMIN",
      setor: null,
    },
  });
  await prisma.usuario.upsert({
    where: { id: USUARIO_OPERADOR_ID },
    update: {},
    create: {
      id: USUARIO_OPERADOR_ID,
      email: "u-teste-permissoes-operador@example.com",
      nome: "Operador Teste Acoes",
      senhaHash: "x",
      papel: "OPERADOR",
      setor: "Processos",
    },
  });
});

afterAll(async () => {
  await prisma.registroAuditoria.deleteMany({ where: { entidadeId: USUARIO_OPERADOR_ID } });
  await prisma.permissaoSubArea.deleteMany({ where: { usuarioId: USUARIO_OPERADOR_ID } });
  await prisma.permissaoModulo.deleteMany({ where: { usuarioId: USUARIO_OPERADOR_ID } });
  await prisma.usuario.deleteMany({
    where: { id: { in: [USUARIO_ADMIN_ID, USUARIO_OPERADOR_ID] } },
  });
});

afterEach(() => {
  papelSessao = "ADMIN";
});

describe("alternarPermissaoModulo", () => {
  it("liga um modulo e grava auditoria", async () => {
    const r = await alternarPermissaoModulo(USUARIO_OPERADOR_ID, "SC-20", true);
    expect(r).toEqual({ ok: true });

    const linha = await prisma.permissaoModulo.findUnique({
      where: {
        usuarioId_moduloCodigo: { usuarioId: USUARIO_OPERADOR_ID, moduloCodigo: "SC-20" },
      },
    });
    expect(linha?.habilitado).toBe(true);

    const auditoria = await prisma.registroAuditoria.findFirst({
      where: { entidadeId: USUARIO_OPERADOR_ID, acao: "PERMISSAO_MODULO" },
      orderBy: { criadoEm: "desc" },
    });
    expect(auditoria?.dadosDepois).toEqual({ habilitado: true });
    expect(auditoria?.autorId).toBe(USUARIO_ADMIN_ID);
  });

  it("upsert e idempotente — nao duplica linha ao chamar duas vezes", async () => {
    await alternarPermissaoModulo(USUARIO_OPERADOR_ID, "SC-20", true);
    await alternarPermissaoModulo(USUARIO_OPERADOR_ID, "SC-20", true);

    const linhas = await prisma.permissaoModulo.findMany({
      where: { usuarioId: USUARIO_OPERADOR_ID, moduloCodigo: "SC-20" },
    });
    expect(linhas).toHaveLength(1);
  });

  it("bloqueia quem nao e ADMIN", async () => {
    papelSessao = "OPERADOR";
    await expect(alternarPermissaoModulo(USUARIO_OPERADOR_ID, "SC-20", true)).rejects.toThrow();
  });
});

describe("alternarPermissaoSubArea", () => {
  it("desliga uma sub-area e grava auditoria", async () => {
    const r = await alternarPermissaoSubArea(
      USUARIO_OPERADOR_ID,
      "SC-20",
      "aba_historico",
      false,
    );
    expect(r).toEqual({ ok: true });

    const linha = await prisma.permissaoSubArea.findUnique({
      where: {
        usuarioId_moduloCodigo_subArea: {
          usuarioId: USUARIO_OPERADOR_ID,
          moduloCodigo: "SC-20",
          subArea: "aba_historico",
        },
      },
    });
    expect(linha?.habilitado).toBe(false);
  });

  it("bloqueia quem nao e ADMIN", async () => {
    papelSessao = "OPERADOR";
    await expect(
      alternarPermissaoSubArea(USUARIO_OPERADOR_ID, "SC-20", "aba_historico", false),
    ).rejects.toThrow();
  });
});
```

- [ ] **Step 2: Rodar o teste e confirmar que falha**

Run: `npx vitest run src/lib/permissoes/acoes.test.ts`
Expected: FAIL — `Cannot find module './acoes'`.

- [ ] **Step 3: Implementar `acoes.ts`**

`src/lib/permissoes/acoes.ts`:

```ts
"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { obterSessao } from "@/lib/sessao-servidor";

const ROTA = "/admin/usuarios";

async function exigirAdmin() {
  const sessao = await obterSessao();
  if (!sessao || sessao.papel !== "ADMIN") {
    throw new Error("Sem acesso à gestão de usuários.");
  }
  return sessao;
}

type Resultado = { ok: true } | { erro: string };

const esquemaModulo = z.object({
  usuarioId: z.string().min(1),
  moduloCodigo: z.string().min(1),
  habilitado: z.boolean(),
});

export async function alternarPermissaoModulo(
  usuarioId: string,
  moduloCodigo: string,
  habilitado: boolean,
): Promise<Resultado> {
  const sessao = await exigirAdmin();

  const dados = esquemaModulo.safeParse({ usuarioId, moduloCodigo, habilitado });
  if (!dados.success) return { erro: "Dados inválidos." };

  const usuario = await prisma.usuario.findUnique({ where: { id: dados.data.usuarioId } });
  if (!usuario || usuario.papel !== "OPERADOR") {
    return { erro: "Usuário não encontrado." };
  }

  const anterior = await prisma.permissaoModulo.findUnique({
    where: {
      usuarioId_moduloCodigo: {
        usuarioId: dados.data.usuarioId,
        moduloCodigo: dados.data.moduloCodigo,
      },
    },
  });

  await prisma.$transaction(async (tx) => {
    await tx.permissaoModulo.upsert({
      where: {
        usuarioId_moduloCodigo: {
          usuarioId: dados.data.usuarioId,
          moduloCodigo: dados.data.moduloCodigo,
        },
      },
      update: { habilitado: dados.data.habilitado },
      create: {
        usuarioId: dados.data.usuarioId,
        moduloCodigo: dados.data.moduloCodigo,
        habilitado: dados.data.habilitado,
      },
    });

    await tx.registroAuditoria.create({
      data: {
        entidade: "Usuario",
        entidadeId: dados.data.usuarioId,
        acao: "PERMISSAO_MODULO",
        descricao: `Módulo ${dados.data.moduloCodigo} ${
          dados.data.habilitado ? "ligado" : "desligado"
        } para ${usuario.nome}`,
        autorId: sessao.usuarioId,
        autorEmail: sessao.email,
        dadosAntes: { habilitado: anterior?.habilitado ?? false },
        dadosDepois: { habilitado: dados.data.habilitado },
      },
    });
  });

  revalidatePath(ROTA);
  return { ok: true };
}

const esquemaSubArea = z.object({
  usuarioId: z.string().min(1),
  moduloCodigo: z.string().min(1),
  subArea: z.string().min(1),
  habilitado: z.boolean(),
});

export async function alternarPermissaoSubArea(
  usuarioId: string,
  moduloCodigo: string,
  subArea: string,
  habilitado: boolean,
): Promise<Resultado> {
  const sessao = await exigirAdmin();

  const dados = esquemaSubArea.safeParse({ usuarioId, moduloCodigo, subArea, habilitado });
  if (!dados.success) return { erro: "Dados inválidos." };

  const usuario = await prisma.usuario.findUnique({ where: { id: dados.data.usuarioId } });
  if (!usuario || usuario.papel !== "OPERADOR") {
    return { erro: "Usuário não encontrado." };
  }

  const anterior = await prisma.permissaoSubArea.findUnique({
    where: {
      usuarioId_moduloCodigo_subArea: {
        usuarioId: dados.data.usuarioId,
        moduloCodigo: dados.data.moduloCodigo,
        subArea: dados.data.subArea,
      },
    },
  });

  await prisma.$transaction(async (tx) => {
    await tx.permissaoSubArea.upsert({
      where: {
        usuarioId_moduloCodigo_subArea: {
          usuarioId: dados.data.usuarioId,
          moduloCodigo: dados.data.moduloCodigo,
          subArea: dados.data.subArea,
        },
      },
      update: { habilitado: dados.data.habilitado },
      create: {
        usuarioId: dados.data.usuarioId,
        moduloCodigo: dados.data.moduloCodigo,
        subArea: dados.data.subArea,
        habilitado: dados.data.habilitado,
      },
    });

    await tx.registroAuditoria.create({
      data: {
        entidade: "Usuario",
        entidadeId: dados.data.usuarioId,
        acao: "PERMISSAO_SUBAREA",
        descricao: `Sub-área ${dados.data.moduloCodigo}:${dados.data.subArea} ${
          dados.data.habilitado ? "ligada" : "desligada"
        } para ${usuario.nome}`,
        autorId: sessao.usuarioId,
        autorEmail: sessao.email,
        dadosAntes: { habilitado: anterior?.habilitado ?? true },
        dadosDepois: { habilitado: dados.data.habilitado },
      },
    });
  });

  revalidatePath(ROTA);
  return { ok: true };
}
```

- [ ] **Step 4: Rodar o teste e confirmar que passa**

Run: `npx vitest run src/lib/permissoes/acoes.test.ts`
Expected: PASS (5 testes).

- [ ] **Step 5: Commit**

```bash
git add src/lib/permissoes/acoes.ts src/lib/permissoes/acoes.test.ts
git commit -m "feat(permissoes): acoes de ligar/desligar com auditoria"
```

---

### Task 5: `filtrarModulosVisiveis` passa a considerar permissão por usuário

**Files:**
- Modify: `src/lib/modulos-catalogo.ts`
- Modify: `src/lib/modulos-catalogo.test.ts`

**Interfaces:**
- Consumes: `moduloVisivel`, `type PermissoesUsuario` de `./permissoes/regra` (Task 2).
- Produces: `filtrarModulosVisiveis(papel, setor, catalogo?, permissoes?): ModuloCatalogo[]` (assinatura estendida, mesmo nome/retorno) — usado pela Home e pelas Tasks 9–12.

- [ ] **Step 1: Atualizar o teste existente (o default mudou de "setor libera tudo" para "nada até liberar")**

Substituir o conteúdo de `src/lib/modulos-catalogo.test.ts` por:

```ts
import { describe, expect, it } from "vitest";
import { filtrarModulosVisiveis, type ModuloCatalogo } from "./modulos-catalogo";
import type { PermissoesUsuario } from "./permissoes/regra";

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
  it("admin ve todos os modulos implementados, de qualquer setor, sem depender de permissoes", () => {
    const visiveis = filtrarModulosVisiveis("ADMIN", null, catalogoFicticio);
    expect(visiveis.map((m) => m.codigo)).toEqual(["X-1", "X-2"]);
  });

  it("modulo nao implementado nunca aparece, nem para o admin", () => {
    const visiveis = filtrarModulosVisiveis("ADMIN", null, catalogoFicticio);
    expect(visiveis.map((m) => m.codigo)).not.toContain("X-3");
  });

  it("operador sem permissoes buscadas nao ve nenhum modulo (falha fechada)", () => {
    const visiveis = filtrarModulosVisiveis("OPERADOR", "Processos", catalogoFicticio);
    expect(visiveis).toEqual([]);
  });

  it("operador com permissoes mas sem nada ligado nao ve nenhum modulo", () => {
    const permissoes: PermissoesUsuario = {
      modulosLigados: new Set(),
      subAreasDesligadas: new Set(),
    };
    const visiveis = filtrarModulosVisiveis(
      "OPERADOR",
      "Processos",
      catalogoFicticio,
      permissoes,
    );
    expect(visiveis).toEqual([]);
  });

  it("operador so ve os modulos do proprio setor que estao ligados", () => {
    const permissoes: PermissoesUsuario = {
      modulosLigados: new Set(["X-1", "X-2"]), // X-1 e de outro setor
      subAreasDesligadas: new Set(),
    };
    const visiveis = filtrarModulosVisiveis(
      "OPERADOR",
      "Processos",
      catalogoFicticio,
      permissoes,
    );
    expect(visiveis.map((m) => m.codigo)).toEqual(["X-2"]);
  });
});
```

- [ ] **Step 2: Rodar o teste e confirmar que falha**

Run: `npx vitest run src/lib/modulos-catalogo.test.ts`
Expected: FAIL — os 3 primeiros testes passam, mas "operador so ve os modulos do proprio setor que estao ligados" e os dois de "nao ve" falham porque a implementação atual ainda devolve tudo do setor independente de permissão.

- [ ] **Step 3: Atualizar `filtrarModulosVisiveis`**

Em `src/lib/modulos-catalogo.ts`, adicionar o import e trocar a implementação:

```ts
import type { PapelUsuario } from "@/generated/prisma/client";
import { moduloVisivel, type PermissoesUsuario } from "./permissoes/regra";
```

```ts
export function filtrarModulosVisiveis(
  papel: PapelUsuario,
  setor: string | null,
  catalogo: ModuloCatalogo[] = CATALOGO_MODULOS,
  permissoes?: PermissoesUsuario,
): ModuloCatalogo[] {
  return catalogo.filter((modulo) => {
    if (!modulo.implementado) return false;
    return moduloVisivel(papel, setor, modulo, permissoes);
  });
}
```

(substitui o corpo atual da função, que fazia `if (papel === "ADMIN") return true; return modulo.setorDono === setor;` inline.)

- [ ] **Step 4: Rodar o teste e confirmar que passa**

Run: `npx vitest run src/lib/modulos-catalogo.test.ts`
Expected: PASS (6 testes).

- [ ] **Step 5: Commit**

```bash
git add src/lib/modulos-catalogo.ts src/lib/modulos-catalogo.test.ts
git commit -m "feat(permissoes): filtrarModulosVisiveis passa a considerar permissao por usuario"
```

---

### Task 6: Link "Gerenciar usuários" no cabeçalho (só ADMIN)

**Files:**
- Modify: `src/components/CabecalhoPortal.tsx`
- Modify: `src/components/CabecalhoPortal.test.tsx`

**Interfaces:**
- Nenhuma nova — só adiciona um link condicional dentro do componente existente, usando o `papel` que ele já recebe.

- [ ] **Step 1: Escrever o teste**

Adicionar ao final de `src/components/CabecalhoPortal.test.tsx` (dentro do `describe` existente):

```ts
  it("mostra o link de gestao de usuarios so para ADMIN", () => {
    render(<CabecalhoPortal nomeUsuario="Ana Souza" papel="ADMIN" />);
    expect(
      screen.getByRole("link", { name: /gerenciar usuários/i }),
    ).toHaveAttribute("href", "/admin/usuarios");
  });

  it("nao mostra o link de gestao de usuarios para OPERADOR", () => {
    render(<CabecalhoPortal nomeUsuario="Bruno Lima" papel="OPERADOR" />);
    expect(
      screen.queryByRole("link", { name: /gerenciar usuários/i }),
    ).not.toBeInTheDocument();
  });
```

- [ ] **Step 2: Rodar o teste e confirmar que falha**

Run: `npx vitest run src/components/CabecalhoPortal.test.tsx`
Expected: FAIL — os 2 testes novos falham (`getByRole` não encontra o link).

- [ ] **Step 3: Adicionar o link no componente**

Em `src/components/CabecalhoPortal.tsx`, adicionar o import de `Link` e o link condicional:

```tsx
import type { PapelUsuario } from "@/generated/prisma/client";
import Link from "next/link";
import { LogoSheep } from "./LogoSheep";
import type { ReactNode } from "react";
```

E dentro do segundo `<div>`, antes de `{acaoSair}`:

```tsx
      <div className="flex items-center gap-4 font-texto text-sm text-nevoa/85">
        <span className="hidden sm:inline">
          {nomeUsuario} · {papel === "ADMIN" ? "Administrador" : "Operador"}
        </span>
        {papel === "ADMIN" ? (
          <Link
            href="/admin/usuarios"
            className="hidden font-texto text-sm text-nevoa/85 underline-offset-2 transition-colors hover:text-nevoa hover:underline sm:inline motion-reduce:transition-none"
          >
            Gerenciar usuários
          </Link>
        ) : null}
        {acaoSair}
      </div>
```

- [ ] **Step 4: Rodar o teste e confirmar que passa**

Run: `npx vitest run src/components/CabecalhoPortal.test.tsx`
Expected: PASS (4 testes).

- [ ] **Step 5: Commit**

```bash
git add src/components/CabecalhoPortal.tsx src/components/CabecalhoPortal.test.tsx
git commit -m "feat(permissoes): link Gerenciar usuarios no cabecalho, so para ADMIN"
```

---

### Task 7: Painel de gestão de usuários (componente cliente)

**Files:**
- Create: `src/components/usuarios/PainelGestaoUsuarios.tsx`
- Create: `src/components/usuarios/PainelGestaoUsuarios.test.tsx`

**Interfaces:**
- Consumes: `SUBAREAS_MODULO` de `@/lib/permissoes/catalogo` (Task 2); `alternarPermissaoModulo`, `alternarPermissaoSubArea` de `@/lib/permissoes/acoes` (Task 4); `SpecularButton` de `@/components/ui/SpecularButton`.
- Produces: `type OperadorGestaoView = { id: string; nome: string; email: string; setor: string | null; modulosElegiveis: { codigo: string; nome: string }[]; modulosLigados: string[]; subAreasDesligadas: string[] }`, `PainelGestaoUsuarios({ operadores: OperadorGestaoView[] })` — usado pela Task 8. **Nota:** as props chegam como `string[]` (não `Set`) porque cruzam a fronteira Server→Client Component, onde só tipos serializáveis em JSON passam.

- [ ] **Step 1: Escrever o teste**

`src/components/usuarios/PainelGestaoUsuarios.test.tsx`:

```tsx
import { render, screen, fireEvent, cleanup, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/permissoes/acoes", () => ({
  alternarPermissaoModulo: vi.fn(async () => ({ ok: true })),
  alternarPermissaoSubArea: vi.fn(async () => ({ ok: true })),
}));
vi.mock("@/lib/permissoes/catalogo", () => ({
  SUBAREAS_MODULO: {
    "SC-20": [
      { chave: "aba_historico", rotulo: "Aba Histórico" },
      { chave: "sino_avisos", rotulo: "Sino de avisos" },
    ],
  },
}));

import { alternarPermissaoModulo } from "@/lib/permissoes/acoes";
import { PainelGestaoUsuarios, type OperadorGestaoView } from "./PainelGestaoUsuarios";

afterEach(cleanup);

const OPERADORES: OperadorGestaoView[] = [
  {
    id: "op-1",
    nome: "Bruno Lima",
    email: "bruno@sheepcontabil.com.br",
    setor: "Processos",
    modulosElegiveis: [{ codigo: "SC-20", nome: "Vencimento de certificado digital" }],
    modulosLigados: [],
    subAreasDesligadas: [],
  },
  {
    id: "op-2",
    nome: "Carla Nunes",
    email: "carla@sheepcontabil.com.br",
    setor: "BPO Saúde",
    modulosElegiveis: [],
    modulosLigados: [],
    subAreasDesligadas: [],
  },
];

const BOTAO_MODULO = "SC-20 · Vencimento de certificado digital: desligado";

describe("PainelGestaoUsuarios", () => {
  it("comeca com o primeiro operador selecionado", () => {
    render(<PainelGestaoUsuarios operadores={OPERADORES} />);
    expect(screen.getByRole("heading", { name: "Bruno Lima" })).toBeInTheDocument();
  });

  it("troca o operador selecionado ao clicar na lista", () => {
    render(<PainelGestaoUsuarios operadores={OPERADORES} />);
    fireEvent.click(screen.getByText("Carla Nunes"));
    expect(screen.getByRole("heading", { name: "Carla Nunes" })).toBeInTheDocument();
  });

  it("sub-area comeca desabilitada porque o modulo esta desligado", () => {
    render(<PainelGestaoUsuarios operadores={OPERADORES} />);
    expect(screen.getByRole("button", { name: "Aba Histórico: ligado" })).toBeDisabled();
  });

  it("liga o modulo, chama a acao e libera a sub-area", async () => {
    render(<PainelGestaoUsuarios operadores={OPERADORES} />);
    fireEvent.click(screen.getByRole("button", { name: BOTAO_MODULO }));

    expect(alternarPermissaoModulo).toHaveBeenCalledWith("op-1", "SC-20", true);
    await waitFor(() =>
      expect(screen.getByRole("button", { name: "Aba Histórico: ligado" })).not.toBeDisabled(),
    );
  });

  it("reverte e mostra erro quando a acao falha", async () => {
    vi.mocked(alternarPermissaoModulo).mockResolvedValueOnce({ erro: "falhou" });
    render(<PainelGestaoUsuarios operadores={OPERADORES} />);
    fireEvent.click(screen.getByRole("button", { name: BOTAO_MODULO }));

    await waitFor(() => expect(screen.getByText("falhou")).toBeInTheDocument());
    expect(screen.getByRole("button", { name: BOTAO_MODULO })).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Rodar o teste e confirmar que falha**

Run: `npx vitest run src/components/usuarios/PainelGestaoUsuarios.test.tsx`
Expected: FAIL — `Cannot find module './PainelGestaoUsuarios'`.

- [ ] **Step 3: Implementar o componente**

`src/components/usuarios/PainelGestaoUsuarios.tsx`:

```tsx
"use client";

import { useState } from "react";
import { SpecularButton } from "@/components/ui/SpecularButton";
import { SUBAREAS_MODULO } from "@/lib/permissoes/catalogo";
import { alternarPermissaoModulo, alternarPermissaoSubArea } from "@/lib/permissoes/acoes";

export type OperadorGestaoView = {
  id: string;
  nome: string;
  email: string;
  setor: string | null;
  modulosElegiveis: { codigo: string; nome: string }[];
  modulosLigados: string[];
  subAreasDesligadas: string[];
};

type EstadoOperador = {
  modulosLigados: Set<string>;
  subAreasDesligadas: Set<string>;
};

function paraEstado(o: OperadorGestaoView): EstadoOperador {
  return {
    modulosLigados: new Set(o.modulosLigados),
    subAreasDesligadas: new Set(o.subAreasDesligadas),
  };
}

function ToggleLinha({
  rotulo,
  ligado,
  desabilitado = false,
  onClick,
}: {
  rotulo: string;
  ligado: boolean;
  desabilitado?: boolean;
  onClick: () => void;
}) {
  return (
    <div className="flex items-center justify-between gap-3 py-1.5">
      <span className={`font-texto text-sm ${desabilitado ? "text-grafite/45" : "text-tinta"}`}>
        {rotulo}
      </span>
      <SpecularButton
        variante={ligado ? "primario" : "fantasma"}
        tamanho="sm"
        aria-pressed={ligado}
        aria-label={`${rotulo}: ${ligado ? "ligado" : "desligado"}`}
        disabled={desabilitado}
        onClick={onClick}
      >
        {ligado ? "Ligado" : "Desligado"}
      </SpecularButton>
    </div>
  );
}

export function PainelGestaoUsuarios({ operadores }: { operadores: OperadorGestaoView[] }) {
  const [selecionadoId, setSelecionadoId] = useState<string | null>(operadores[0]?.id ?? null);
  const [estados, setEstados] = useState<Record<string, EstadoOperador>>(() =>
    Object.fromEntries(operadores.map((o) => [o.id, paraEstado(o)])),
  );
  const [erro, setErro] = useState<string | null>(null);

  const selecionado = operadores.find((o) => o.id === selecionadoId) ?? null;
  const estado = selecionado ? estados[selecionado.id] : null;

  async function aoAlternarModulo(usuarioId: string, moduloCodigo: string, ligar: boolean) {
    setErro(null);
    setEstados((atual) => {
      const proximo = new Set(atual[usuarioId].modulosLigados);
      ligar ? proximo.add(moduloCodigo) : proximo.delete(moduloCodigo);
      return { ...atual, [usuarioId]: { ...atual[usuarioId], modulosLigados: proximo } };
    });

    const resultado = await alternarPermissaoModulo(usuarioId, moduloCodigo, ligar);
    if ("erro" in resultado) {
      setErro(resultado.erro);
      setEstados((atual) => {
        const proximo = new Set(atual[usuarioId].modulosLigados);
        ligar ? proximo.delete(moduloCodigo) : proximo.add(moduloCodigo);
        return { ...atual, [usuarioId]: { ...atual[usuarioId], modulosLigados: proximo } };
      });
    }
  }

  async function aoAlternarSubArea(
    usuarioId: string,
    moduloCodigo: string,
    subArea: string,
    ligar: boolean,
  ) {
    setErro(null);
    const chave = `${moduloCodigo}:${subArea}`;
    setEstados((atual) => {
      const proximo = new Set(atual[usuarioId].subAreasDesligadas);
      ligar ? proximo.delete(chave) : proximo.add(chave);
      return { ...atual, [usuarioId]: { ...atual[usuarioId], subAreasDesligadas: proximo } };
    });

    const resultado = await alternarPermissaoSubArea(usuarioId, moduloCodigo, subArea, ligar);
    if ("erro" in resultado) {
      setErro(resultado.erro);
      setEstados((atual) => {
        const proximo = new Set(atual[usuarioId].subAreasDesligadas);
        ligar ? proximo.add(chave) : proximo.delete(chave);
        return { ...atual, [usuarioId]: { ...atual[usuarioId], subAreasDesligadas: proximo } };
      });
    }
  }

  if (operadores.length === 0) {
    return <p className="font-texto text-sm text-grafite">Nenhum operador cadastrado ainda.</p>;
  }

  return (
    <div className="grid gap-6 sm:grid-cols-[16rem_1fr]">
      <ul className="flex flex-col gap-1">
        {operadores.map((o) => {
          const est = estados[o.id];
          const total = o.modulosElegiveis.filter((m) => est.modulosLigados.has(m.codigo)).length;
          return (
            <li key={o.id}>
              <button
                type="button"
                onClick={() => setSelecionadoId(o.id)}
                aria-pressed={o.id === selecionadoId}
                className={`w-full rounded-lg border px-3 py-2 text-left transition-colors motion-reduce:transition-none ${
                  o.id === selecionadoId
                    ? "border-petroleo bg-petroleo/5"
                    : "border-transparent hover:bg-nevoa"
                }`}
              >
                <span className="block font-texto text-sm font-semibold text-tinta">
                  {o.nome}
                </span>
                <span className="block font-codigo text-xs text-grafite">
                  {o.setor ?? "Sem setor"} · {total} de {o.modulosElegiveis.length} módulos
                </span>
              </button>
            </li>
          );
        })}
      </ul>

      {selecionado && estado ? (
        <div className="flex flex-col gap-5">
          <div>
            <h2 className="font-titulo text-lg font-bold text-tinta">{selecionado.nome}</h2>
            <p className="font-texto text-sm text-grafite">
              {selecionado.email} · {selecionado.setor ?? "Sem setor"}
            </p>
          </div>

          {erro ? (
            <p className="rounded-lg border border-carmim/30 bg-carmim/5 px-3 py-2 font-texto text-sm text-carmim">
              {erro}
            </p>
          ) : null}

          {selecionado.modulosElegiveis.length === 0 ? (
            <p className="font-texto text-sm text-grafite">
              Nenhum módulo do setor deste operador está implementado ainda.
            </p>
          ) : (
            <div className="flex flex-col divide-y divide-grafite/10">
              {selecionado.modulosElegiveis.map((modulo) => {
                const ligado = estado.modulosLigados.has(modulo.codigo);
                const subAreas = SUBAREAS_MODULO[modulo.codigo] ?? [];
                return (
                  <div key={modulo.codigo} className="py-3">
                    <ToggleLinha
                      rotulo={`${modulo.codigo} · ${modulo.nome}`}
                      ligado={ligado}
                      onClick={() => aoAlternarModulo(selecionado.id, modulo.codigo, !ligado)}
                    />
                    {subAreas.length > 0 ? (
                      <div className="mt-1 flex flex-col gap-0.5 border-l border-grafite/15 pl-4">
                        {subAreas.map((sub) => {
                          const chave = `${modulo.codigo}:${sub.chave}`;
                          const subLigada = !estado.subAreasDesligadas.has(chave);
                          return (
                            <ToggleLinha
                              key={sub.chave}
                              rotulo={sub.rotulo}
                              ligado={subLigada}
                              desabilitado={!ligado}
                              onClick={() =>
                                aoAlternarSubArea(
                                  selecionado.id,
                                  modulo.codigo,
                                  sub.chave,
                                  !subLigada,
                                )
                              }
                            />
                          );
                        })}
                      </div>
                    ) : null}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      ) : null}
    </div>
  );
}
```

- [ ] **Step 4: Rodar o teste e confirmar que passa**

Run: `npx vitest run src/components/usuarios/PainelGestaoUsuarios.test.tsx`
Expected: PASS (5 testes).

- [ ] **Step 5: Commit**

```bash
git add src/components/usuarios/PainelGestaoUsuarios.tsx src/components/usuarios/PainelGestaoUsuarios.test.tsx
git commit -m "feat(permissoes): painel de gestao de usuarios (lista + toggles)"
```

---

### Task 8: Tela `/admin/usuarios`

**Files:**
- Create: `src/app/admin/usuarios/page.tsx`

**Interfaces:**
- Consumes: `obterSessao` de `@/lib/sessao-servidor`; `sair` de `@/lib/sessao-acoes`; `CabecalhoPortal` de `@/components/CabecalhoPortal` (Task 6); `listarOperadoresParaGestao` de `@/lib/permissoes/consultas` (Task 3); `PainelGestaoUsuarios`, `type OperadorGestaoView` de `@/components/usuarios/PainelGestaoUsuarios` (Task 7).
- Produces: rota `/admin/usuarios`.

Sem arquivo de teste — nenhuma `page.tsx` do repositório tem teste próprio (a lógica já foi coberta nas Tasks 2–7); verificação é manual via `npm run dev` (Step 3).

- [ ] **Step 1: Implementar a página**

`src/app/admin/usuarios/page.tsx`:

```tsx
import { redirect } from "next/navigation";
import { obterSessao } from "@/lib/sessao-servidor";
import { sair } from "@/lib/sessao-acoes";
import { CabecalhoPortal } from "@/components/CabecalhoPortal";
import { listarOperadoresParaGestao } from "@/lib/permissoes/consultas";
import {
  PainelGestaoUsuarios,
  type OperadorGestaoView,
} from "@/components/usuarios/PainelGestaoUsuarios";

export default async function PaginaGestaoUsuarios() {
  const sessao = await obterSessao();
  if (!sessao) {
    redirect("/login");
  }
  if (sessao.papel !== "ADMIN") {
    redirect("/");
  }

  const operadores = await listarOperadoresParaGestao();
  // Sets não cruzam a fronteira Server → Client Component (só JSON):
  // convertidos para array só aqui, na borda.
  const operadoresView: OperadorGestaoView[] = operadores.map((o) => ({
    id: o.id,
    nome: o.nome,
    email: o.email,
    setor: o.setor,
    modulosElegiveis: o.modulosElegiveis.map((m) => ({ codigo: m.codigo, nome: m.nome })),
    modulosLigados: [...o.permissoes.modulosLigados],
    subAreasDesligadas: [...o.permissoes.subAreasDesligadas],
  }));

  return (
    <>
      <CabecalhoPortal
        nomeUsuario={sessao.nome}
        papel={sessao.papel}
        acaoSair={
          <form action={sair}>
            <button className="font-texto text-sm underline underline-offset-2">Sair</button>
          </form>
        }
      />
      <main className="mx-auto flex max-w-4xl flex-col gap-6 px-6 py-10">
        <div>
          <span className="font-codigo text-xs uppercase tracking-wide text-grafite">
            Administração
          </span>
          <h1 className="font-titulo text-2xl font-bold text-tinta">Gerenciar usuários</h1>
          <p className="mt-1 max-w-prose font-texto text-sm text-grafite">
            Escolha um operador para ligar ou desligar os módulos e as áreas que aparecem
            para ele. Sem nada ligado aqui, o operador não vê módulo nenhum.
          </p>
        </div>

        <PainelGestaoUsuarios operadores={operadoresView} />
      </main>
    </>
  );
}
```

- [ ] **Step 2: Verificar tipos e lint**

Run: `npx tsc --noEmit && npx eslint src/app/admin/usuarios/page.tsx`
Expected: sem erros.

- [ ] **Step 3: Verificação manual**

Com `docker compose up -d db` e `npm run dev` rodando, logue como `admin@sheepcontabil.com.br` (senha `AdminSheep#2026`, ver `prisma/seed.ts`), abra `/admin/usuarios` pelo link do cabeçalho, selecione "Bruno Lima" e ligue o módulo SC-20 — confirme que o toggle muda visualmente. Rode `npx prisma studio` (ou uma query direta) para conferir que a linha em `PermissaoModulo` e a linha em `RegistroAuditoria` foram gravadas.

- [ ] **Step 4: Commit**

```bash
git add src/app/admin/usuarios/page.tsx
git commit -m "feat(permissoes): tela /admin/usuarios"
```

---

### Task 9: Home passa a respeitar a permissão do operador

**Files:**
- Modify: `src/app/page.tsx`

**Interfaces:**
- Consumes: `obterPermissoesUsuario` de `@/lib/permissoes/consultas` (Task 3).

Sem teste dedicado (mesmo racional da Task 8) — a lógica de filtro já está coberta pela Task 5. Verificação manual no Step 3.

- [ ] **Step 1: Buscar as permissões e repassar pro filtro**

Em `src/app/page.tsx`, adicionar o import:

```ts
import { obterPermissoesUsuario } from "@/lib/permissoes/consultas";
```

E trocar:

```ts
  const modulos = filtrarModulosVisiveis(sessao.papel, sessao.setor);
```

por:

```ts
  const permissoes =
    sessao.papel === "OPERADOR" ? await obterPermissoesUsuario(sessao.usuarioId) : undefined;
  const modulos = filtrarModulosVisiveis(sessao.papel, sessao.setor, undefined, permissoes);
```

- [ ] **Step 2: Verificar tipos**

Run: `npx tsc --noEmit`
Expected: sem erros.

- [ ] **Step 3: Verificação manual**

Logue como `operador.processos@sheepcontabil.com.br` (senha `OperadorSheep#2026`) **antes** de qualquer toggle na Task 8 — a Home deve mostrar "Nenhum módulo disponível para o seu perfil ainda." Depois de ligar SC-20 pra esse operador em `/admin/usuarios` (como ADMIN), relogue como esse operador — o card do SC-20 deve aparecer.

- [ ] **Step 4: Commit**

```bash
git add src/app/page.tsx
git commit -m "feat(permissoes): Home respeita permissao de modulo do operador"
```

---

### Task 10: SC-01 — gate por permissão e esconder Histórico de execução

**Files:**
- Modify: `src/app/modulos/sc-01/page.tsx`

**Interfaces:**
- Consumes: `obterPermissoesUsuario` de `@/lib/permissoes/consultas`; `subAreaVisivel` de `@/lib/permissoes/regra`.

Sem teste dedicado — verificação manual no Step 3.

- [ ] **Step 1: Buscar permissões e usar no gate**

Em `src/app/modulos/sc-01/page.tsx`, adicionar os imports:

```ts
import { obterPermissoesUsuario } from "@/lib/permissoes/consultas";
import { subAreaVisivel } from "@/lib/permissoes/regra";
```

E trocar:

```ts
  const modulo = obterModulo("SC-01");
  const podeVer =
    modulo !== undefined &&
    filtrarModulosVisiveis(sessao.papel, sessao.setor).some((m) => m.codigo === "SC-01");
  if (!modulo || !podeVer) {
    redirect("/");
  }
```

por:

```ts
  const permissoes =
    sessao.papel === "OPERADOR" ? await obterPermissoesUsuario(sessao.usuarioId) : undefined;

  const modulo = obterModulo("SC-01");
  const podeVer =
    modulo !== undefined &&
    filtrarModulosVisiveis(sessao.papel, sessao.setor, undefined, permissoes).some(
      (m) => m.codigo === "SC-01",
    );
  if (!modulo || !podeVer) {
    redirect("/");
  }

  const mostrarHistorico = subAreaVisivel(sessao.papel, "SC-01", "historico_execucao", permissoes);
```

- [ ] **Step 2: Esconder a seção "Histórico de execução"**

Trocar:

```tsx
            <section>
              <h2 className="mb-3 font-titulo text-lg font-bold text-tinta">
                Histórico de execução
              </h2>
              <HistoricoExecucoes execucoes={execucoes} />
            </section>
```

por:

```tsx
            {mostrarHistorico ? (
              <section>
                <h2 className="mb-3 font-titulo text-lg font-bold text-tinta">
                  Histórico de execução
                </h2>
                <HistoricoExecucoes execucoes={execucoes} />
              </section>
            ) : null}
```

- [ ] **Step 3: Verificação manual**

Como ADMIN em `/admin/usuarios`, ligue SC-01 para `operador.processos@sheepcontabil.com.br` mas desligue a sub-área "Histórico de execução". Relogue como esse operador, abra `/modulos/sc-01` — a seção de upload/documentos aparece, mas "Histórico de execução" não. Religue a sub-área e confirme que ela volta a aparecer.

- [ ] **Step 4: Commit**

```bash
git add src/app/modulos/sc-01/page.tsx
git commit -m "feat(permissoes): SC-01 respeita permissao de modulo e sub-area"
```

---

### Task 11: SC-11 — gate por permissão e esconder Histórico de execução

**Files:**
- Modify: `src/app/modulos/sc-11/page.tsx`

**Interfaces:**
- Consumes: mesmas de Task 10, aplicadas ao código `"SC-11"`.

Sem teste dedicado — verificação manual no Step 3.

- [ ] **Step 1: Buscar permissões e usar no gate**

Em `src/app/modulos/sc-11/page.tsx`, adicionar os imports:

```ts
import { obterPermissoesUsuario } from "@/lib/permissoes/consultas";
import { subAreaVisivel } from "@/lib/permissoes/regra";
```

E trocar:

```ts
  const modulo = obterModulo("SC-11");
  const podeVer =
    modulo !== undefined &&
    filtrarModulosVisiveis(sessao.papel, sessao.setor).some((m) => m.codigo === "SC-11");
  if (!modulo || !podeVer) {
    redirect("/");
  }
```

por:

```ts
  const permissoes =
    sessao.papel === "OPERADOR" ? await obterPermissoesUsuario(sessao.usuarioId) : undefined;

  const modulo = obterModulo("SC-11");
  const podeVer =
    modulo !== undefined &&
    filtrarModulosVisiveis(sessao.papel, sessao.setor, undefined, permissoes).some(
      (m) => m.codigo === "SC-11",
    );
  if (!modulo || !podeVer) {
    redirect("/");
  }

  const mostrarHistorico = subAreaVisivel(sessao.papel, "SC-11", "historico_execucao", permissoes);
```

- [ ] **Step 2: Esconder a seção "Histórico de execução"**

Trocar:

```tsx
            <section>
              <h2 className="mb-3 font-titulo text-lg font-bold text-tinta">
                Histórico de execução
              </h2>
              <HistoricoExecucoes execucoes={execucoes} />
            </section>
```

por:

```tsx
            {mostrarHistorico ? (
              <section>
                <h2 className="mb-3 font-titulo text-lg font-bold text-tinta">
                  Histórico de execução
                </h2>
                <HistoricoExecucoes execucoes={execucoes} />
              </section>
            ) : null}
```

- [ ] **Step 3: Verificação manual**

Mesmo roteiro da Task 10, usando `operador.saude@sheepcontabil.com.br` e o módulo SC-11 em `/admin/usuarios`. O link "Gerenciar termos de presunção →" continua visível só para ADMIN (não muda — já era assim antes desta feature).

- [ ] **Step 4: Commit**

```bash
git add src/app/modulos/sc-11/page.tsx
git commit -m "feat(permissoes): SC-11 respeita permissao de modulo e sub-area"
```

---

### Task 12: SC-20 — gate por permissão, esconder aba Histórico e sino de avisos

**Files:**
- Modify: `src/app/modulos/sc-20/page.tsx`

**Interfaces:**
- Consumes: `obterPermissoesUsuario` de `@/lib/permissoes/consultas`; `subAreaVisivel` de `@/lib/permissoes/regra`.

Sem teste dedicado — verificação manual no Step 4.

- [ ] **Step 1: Buscar permissões e usar no gate**

Em `src/app/modulos/sc-20/page.tsx`, adicionar os imports:

```ts
import { obterPermissoesUsuario } from "@/lib/permissoes/consultas";
import { subAreaVisivel } from "@/lib/permissoes/regra";
```

E trocar:

```ts
  const modulo = obterModulo("SC-20");
  const podeVer =
    modulo !== undefined &&
    filtrarModulosVisiveis(sessao.papel, sessao.setor).some((m) => m.codigo === "SC-20");
  if (!modulo || !podeVer) {
    redirect("/");
  }
```

por:

```ts
  const permissoes =
    sessao.papel === "OPERADOR" ? await obterPermissoesUsuario(sessao.usuarioId) : undefined;

  const modulo = obterModulo("SC-20");
  const podeVer =
    modulo !== undefined &&
    filtrarModulosVisiveis(sessao.papel, sessao.setor, undefined, permissoes).some(
      (m) => m.codigo === "SC-20",
    );
  if (!modulo || !podeVer) {
    redirect("/");
  }

  const mostrarAbaHistorico = subAreaVisivel(sessao.papel, "SC-20", "aba_historico", permissoes);
  const mostrarSino = subAreaVisivel(sessao.papel, "SC-20", "sino_avisos", permissoes);
```

- [ ] **Step 2: A URL não pode forçar a aba Histórico quando ela está escondida**

Trocar:

```ts
  const sp = await searchParams;
  const aba = sp.aba === "historico" ? "historico" : "certificados";
```

por:

```ts
  const sp = await searchParams;
  const aba = mostrarAbaHistorico && sp.aba === "historico" ? "historico" : "certificados";
```

- [ ] **Step 3: Esconder o item de nav "Histórico" e o sino**

Trocar:

```tsx
            <nav className="mb-5 flex gap-5 border-b border-grafite/15">
              <Link href="/modulos/sc-20?aba=certificados" className={abaClasse(aba === "certificados")}>
                Certificados
              </Link>
              <Link href="/modulos/sc-20?aba=historico" className={abaClasse(aba === "historico")}>
                Histórico
              </Link>
            </nav>
```

por:

```tsx
            <nav className="mb-5 flex gap-5 border-b border-grafite/15">
              <Link href="/modulos/sc-20?aba=certificados" className={abaClasse(aba === "certificados")}>
                Certificados
              </Link>
              {mostrarAbaHistorico ? (
                <Link href="/modulos/sc-20?aba=historico" className={abaClasse(aba === "historico")}>
                  Histórico
                </Link>
              ) : null}
            </nav>
```

E trocar:

```tsx
            <SinoAvisos notificacoes={notificacoes} tom="escuro" />
```

por:

```tsx
            {mostrarSino ? <SinoAvisos notificacoes={notificacoes} tom="escuro" /> : null}
```

- [ ] **Step 4: Verificação manual**

Como ADMIN em `/admin/usuarios`, ligue SC-20 para `operador.processos@sheepcontabil.com.br` e desligue "Aba Histórico" e "Sino de avisos". Relogue como esse operador em `/modulos/sc-20`: sem o item "Histórico" no nav, sem o sino, e digitar `?aba=historico` na URL não muda a aba (fica em "Certificados"). Religue as duas sub-áreas e confirme que voltam.

- [ ] **Step 5: Commit**

```bash
git add src/app/modulos/sc-20/page.tsx
git commit -m "feat(permissoes): SC-20 respeita permissao de modulo, aba historico e sino"
```

---

## Self-Review

**Cobertura da spec:** §3 (Task 1), §4 (Task 2), §5 (Tasks 3–4), §6 (Task 2), §7 (Tasks 7–8), §8 (Tasks 5, 6, 9–12), §9 (nenhuma linha pré-criada — nenhuma task mexe no `seed.ts`, é intencional), §10 (testes em cada task de lib/componente), §11 (nenhuma rota de sub-área bloqueada — confirmado, nenhuma task adiciona guarda de rota interna).

**Consistência de tipos:** `PermissoesUsuario` definido na Task 2, usado sem alteração de forma nas Tasks 3, 4 (indiretamente, via `consultas.ts`), 5, 9–12. `OperadorGestao` (com `Set`) fica só em `consultas.ts`/`page.tsx` (servidor); `OperadorGestaoView` (com `string[]`) é a versão que cruza pro Client Component — os nomes dos campos batem entre os dois em todo lugar que os converte (Task 8, Step 1). `alternarPermissaoModulo`/`alternarPermissaoSubArea` devolvem `{ ok: true } | { erro: string }` em todo lugar que os chama (Task 7).

**Nota fora da spec:** a spec §5 esboçava `listarOperadoresParaGestao` devolvendo `totalModulosElegiveis`/`totalModulosLigados` como números prontos; a Task 3 devolve `modulosElegiveis` (array) + `permissoes` (a mesma forma já usada em toda parte) e deixa quem consome (a Task 7, no componente) derivar a contagem — a mesma informação, sem duplicar a representação. Comportamento idêntico ao descrito na spec.
