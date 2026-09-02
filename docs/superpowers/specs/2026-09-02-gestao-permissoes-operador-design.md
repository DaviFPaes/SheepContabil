# Gestão de Permissões de Operador — Design

Data: 2026-09-02
Contexto: até aqui, o que um operador enxerga no portal é fixo — deriva só de `papel` + `setor` (ver [modulos-catalogo.ts](../../../src/lib/modulos-catalogo.ts)). Não há como o ADMIN restringir um operador específico sem mexer em setor/código. Esta feature dá ao ADMIN uma tela para ligar/desligar, por operador, quais módulos e quais sub-áreas dentro deles aparecem.

Referência da fundação: [2026-08-27-portal-sheepcontabil-design.md](2026-08-27-portal-sheepcontabil-design.md) — Home e o padrão de gate por módulo.

---

## 1. Objetivo

Dar ao ADMIN uma tela (`/admin/usuarios`) onde, ao selecionar um operador, ele liga/desliga cada módulo que faz sentido para o setor daquele operador e, dentro de cada módulo, liga/desliga sub-áreas específicas (abas, seções). Sem essa tela, um operador novo não vê módulo nenhum — o ADMIN precisa liberar explicitamente.

ADMIN não passa por esse sistema: continua vendo tudo, sempre, como hoje.

## 2. Escopo

Entra:

1. Dois modelos novos (`PermissaoModulo`, `PermissaoSubArea`) e a migração correspondente.
2. Catálogo de sub-áreas por módulo (`src/lib/permissoes/catalogo.ts`), granularidade macro:
   - `SC-01`: `historico_execucao` — "Histórico de execução"
   - `SC-11`: `historico_execucao` — "Histórico de execução"
   - `SC-20`: `aba_historico` — "Aba Histórico", `sino_avisos` — "Sino de avisos"
3. `src/lib/permissoes/consultas.ts` e `acoes.ts` — leitura da permissão efetiva e as duas ações de toggle (com auditoria).
4. Extensão de `filtrarModulosVisiveis` para considerar módulos ligados por usuário.
5. Tela `/admin/usuarios`: lista de operadores + painel de toggles do operador selecionado.
6. Link "Gerenciar usuários" no `CabecalhoPortal`, visível só para ADMIN.
7. Home, SC-01, SC-11, SC-20 passam a esconder módulo/sub-área conforme a permissão do operador logado.
8. Cada toggle grava uma linha em `RegistroAuditoria` (`entidade: "Usuario"`).

Não entra (ver §9 para o racional de cada item):

- CRUD de usuário (criar, editar nome/papel/setor, resetar senha, desativar).
- Bloqueio de rota por sub-área — sub-área desligada só esconde na navegação; a rota interna (ex. CSV do histórico) continua respondendo se acessada direto.
- Tela de histórico/auditoria dessas mudanças — só a trilha em `RegistroAuditoria`, sem UI dedicada.
- Ações em lote (ligar/desligar tudo de um operador de uma vez).

## 3. Modelo de dados

Import do Prisma Client: `@/generated/prisma/client`. Migração nova: `<timestamp>_permissoes_operador`.

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

Em `Usuario`, adiciona `permissoesModulo PermissaoModulo[]` e `permissoesSubArea PermissaoSubArea[]`.

Duas tabelas em vez de uma com `subArea` anulável: unicidade com `NULL` no Postgres não impede duplicata (cada `NULL` é distinto para o índice), então duas linhas "módulo inteiro" para o mesmo usuário passariam sem erro. Separar os dois casos evita esse buraco.

`moduloCodigo` é `String` livre (não FK, não enum) — mesmo padrão de `Execucao.moduloCodigo`. `subArea` é `String` livre, validado contra o catálogo em código, não no banco.

Sem seed para essas tabelas: nenhuma linha é pré-criada, nem para os operadores que já existem (Bruno, Carla). Ver §8.

## 4. Regra de efetivação de visibilidade

Função pura em `src/lib/permissoes/regra.ts` (fácil de testar isoladamente):

```ts
type PermissoesUsuario = {
  modulosLigados: Set<string>;      // moduloCodigo com PermissaoModulo.habilitado = true
  subAreasDesligadas: Set<string>;  // `${moduloCodigo}:${subArea}` com habilitado = false
};

function moduloVisivel(papel, setor, modulo, permissoes?: PermissoesUsuario): boolean
function subAreaVisivel(papel, moduloCodigo, subArea, permissoes?: PermissoesUsuario): boolean
```

- **ADMIN**: sempre `true` para os dois — a permissão nem é consultada nessas páginas.
- **OPERADOR, módulo**: `true` ⟺ `modulo.setorDono === setor` **e** `permissoes.modulosLigados.has(modulo.codigo)`. Sem `PermissoesUsuario` (esquecimento no call site) ou sem linha correspondente ⟹ `false`. **Falha fechada**: quem chamar essa função para um operador sem ter buscado a permissão vê "nada", nunca "tudo".
- **OPERADOR, sub-área**: `true` ⟺ módulo visível **e** `${moduloCodigo}:${subArea}` **não** está em `subAreasDesligadas`. Ausência de linha = visível (é o "módulo completo ao ligar": a sub-área só some quando existe uma linha explícita `habilitado = false`).

`filtrarModulosVisiveis(papel, setor, catalogo?, permissoes?)` em [modulos-catalogo.ts](../../../src/lib/modulos-catalogo.ts) passa a delegar em `moduloVisivel` por item, mantendo a mesma assinatura de retorno (lista filtrada). Os `podeVer` que cada `page.tsx` de módulo já calcula usam a mesma função.

## 5. Consultas e ações

`src/lib/permissoes/consultas.ts`:

- `obterPermissoesUsuario(usuarioId): Promise<PermissoesUsuario>` — duas queries (`findMany` em cada tabela filtrado por `usuarioId`), monta os dois `Set`. Chamada só quando `sessao.papel === "OPERADOR"`.
- `listarOperadoresParaGestao(): Promise<{ id, nome, email, setor, totalModulosElegiveis: number, totalModulosLigados: number }[]>` — usuários com `papel: "OPERADOR"`, mais a contagem "N de M" (M = módulos do catálogo com `implementado: true` **e** `setorDono` igual ao setor do operador — mesmo filtro que `filtrarModulosVisiveis` já aplica hoje; N = quantos desses têm `PermissaoModulo.habilitado = true`).

`src/lib/permissoes/acoes.ts` (`"use server"`):

- `alternarPermissaoModulo(usuarioId, moduloCodigo, habilitado)`
- `alternarPermissaoSubArea(usuarioId, moduloCodigo, subArea, habilitado)`

Ambas: confirmam `obterSessao()` com `papel === "ADMIN"` internamente (defesa em profundidade — a página já bloqueia acesso, mas a action pode ser chamada direto), fazem `upsert` na linha (`@@unique` cobre o conflito) e gravam uma linha em `RegistroAuditoria`:

```ts
{
  entidade: "Usuario",
  entidadeId: usuarioId,
  acao: "PERMISSAO_MODULO" | "PERMISSAO_SUBAREA",
  descricao: `Módulo ${moduloCodigo} ${habilitado ? "ligado" : "desligado"} para ${usuario.nome}`,
  autorId: sessao.usuarioId,
  autorEmail: sessao.email,
  dadosAntes: { habilitado: valorAnterior },
  dadosDepois: { habilitado },
}
```

## 6. Catálogo de sub-áreas

`src/lib/permissoes/catalogo.ts`, ao lado do padrão de `CATALOGO_MODULOS`:

```ts
export const SUBAREAS_MODULO: Record<string, { chave: string; rotulo: string }[]> = {
  "SC-01": [{ chave: "historico_execucao", rotulo: "Histórico de execução" }],
  "SC-11": [{ chave: "historico_execucao", rotulo: "Histórico de execução" }],
  "SC-20": [
    { chave: "aba_historico", rotulo: "Aba Histórico" },
    { chave: "sino_avisos", rotulo: "Sino de avisos" },
  ],
};
```

Módulos sem entrada (ex. `SC-18`, ainda não implementado) simplesmente não têm sub-toggle na tela.

## 7. Tela `/admin/usuarios`

`src/app/admin/usuarios/page.tsx` — server component. Gate: sem sessão → `/login`; `papel !== "ADMIN"` → `/` (mesmo padrão de `/modulos/sc-11/termos`).

Visual: segue o precedente de `/modulos/sc-11/termos` — `CabecalhoPortal` + `<main>` claro (`max-w-4xl`), **sem** o shell escuro/`VeuAtmosferico`/hero dos módulos. É uma tela utilitária de administração, não um módulo.

Busca `listarOperadoresParaGestao()` e passa para um client component único, `src/components/usuarios/PainelGestaoUsuarios.tsx`, que:

- Renderiza a lista de operadores à esquerda (nome, setor, "N de M módulos ligados").
- Mantém `usuarioSelecionadoId` em estado; ao clicar, mostra à direita os módulos elegíveis (do catálogo, filtrados por `implementado: true` **e** `setorDono === setor` do operador — mesmo par de condições de `totalModulosElegiveis` acima), cada um com:
  - toggle de módulo (chama `alternarPermissaoModulo`);
  - abaixo, os toggles de sub-área do catálogo §6 para aquele módulo (chamam `alternarPermissaoSubArea`), **desabilitados visualmente** (mas mostrando o valor salvo) enquanto o módulo estiver desligado.
- Cada toggle salva sozinho ao ser clicado — sem botão "Salvar" nem estado de rascunho. Indicador pontual de "salvando…"/erro por linha (mesmo espírito dos outros paineis client do repo, ex. `PainelSc20`).

Sem sub-área cadastrada para o módulo (ex. `SC-18`, se algum dia entrar no catálogo elegível): mostra só o toggle de módulo.

## 8. Integração nas páginas existentes

Em `src/app/page.tsx` (Home), `sc-01/page.tsx`, `sc-11/page.tsx`, `sc-20/page.tsx`:

- Se `sessao.papel === "OPERADOR"`, busca `obterPermissoesUsuario(sessao.usuarioId)` junto do `Promise.all` que a página já faz. Se `"ADMIN"`, pula essa consulta (não é necessária).
- Passa o resultado para `filtrarModulosVisiveis` (Home, e o `podeVer` de cada módulo).
- Sub-áreas:
  - **SC-01/SC-11**: omite a seção "Histórico de execução" quando `!subAreaVisivel(papel, codigo, "historico_execucao", permissoes)`.
  - **SC-20**: omite o item de nav "Histórico" e força `aba = "certificados"` (ignora `?aba=historico` da URL) quando `aba_historico` estiver desligada; omite `<SinoAvisos>` quando `sino_avisos` estiver desligada.

`CabecalhoPortal.tsx` ganha o link "Gerenciar usuários" → `/admin/usuarios`, renderizado só quando `papel === "ADMIN"` (usa o prop `papel` que já recebe — sem prop nova).

## 9. Migração e seed

A migração cria as duas tabelas vazias — nenhum backfill. `seed.ts` **não** ganha nenhuma linha de permissão: Bruno (Processos) e Carla (BPO Saúde) nascem zerados, igual a qualquer operador novo. Isso é a decisão consciente de "nada até liberar" se aplicando também aos usuários que já existem — não é uma lacuna do seed.

Efeito prático: depois de aplicar essa migração (local ou produção), logar como um dos operadores mostra "nenhum módulo disponível" até um ADMIN abrir `/admin/usuarios` e ligar manualmente. Isso é esperado; vale como passo manual pós-deploy, documentado aqui para não ser confundido com regressão.

## 10. Testes

Seguindo a cobertura que o resto do repo mantém (todo `lib/*.ts` e componente relevante tem `.test`):

- `src/lib/permissoes/regra.test.ts` — `moduloVisivel`/`subAreaVisivel`: bypass de ADMIN, módulo some sem linha, módulo aparece com linha `habilitado: true`, sub-área aparece sem linha, sub-área some só com linha `habilitado: false`, "falha fechada" quando `permissoes` não é passado para um operador.
- Ajuste em `src/lib/modulos-catalogo.test.ts` para o novo parâmetro de `filtrarModulosVisiveis`.
- `src/lib/permissoes/acoes.test.ts` — upsert idempotente, guarda de ADMIN, linha de auditoria gravada com antes/depois corretos.
- `src/components/usuarios/PainelGestaoUsuarios.test.tsx` — seleciona operador, clique liga módulo, sub-área fica desabilitada com módulo desligado, clique desliga sub-área.

## 11. Racional do que ficou de fora

- **CRUD de usuário**: fora do pedido original ("selecionar as automações que aparecem"); usuários continuam nascendo via `seed.ts`/banco direto. Reavaliar se o time crescer.
- **Bloqueio de rota por sub-área**: a rota interna (ex. `/modulos/sc-20/historico/relatorio`) não teria muito valor escondida se o resto do módulo já é visível para aquele operador — não é dado fora do que ele já acessa em outro lugar da tela. Esconder na navegação resolve o pedido ("o que aparece"); bloquear rota a rota cresceria a manutenção a cada sub-área nova sem ganho de segurança real aqui.
- **Tela de histórico das permissões**: a trilha em `RegistroAuditoria` já fica gravada (reaproveitando o modelo existente); construir uma UI para ela é adiável e barato de acrescentar depois, sem migração nova.
