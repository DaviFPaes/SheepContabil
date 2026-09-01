# SC-20 — Vencimento de Certificado Digital (Etapa 1) — Design

Data: 2026-09-01
Contexto: evolução do módulo SC-20, já no ar. Hoje o módulo é uma página única com formulário inline de cadastro, tabela ordenada por validade, botão "Rodar agora", lista chata de `AvisoCertificado` e cron **mensal**. Esta etapa transforma o SC-20 numa fila de trabalho (Kanban) dos certificados perto do vencimento, com recálculo diário, avisos in-app, auditoria reforçada e cadastro via modal.

Referência da fundação: [2026-08-27-portal-sheepcontabil-design.md](2026-08-27-portal-sheepcontabil-design.md) — seções 4, 6, 7, 11, 12.
Plano original do módulo: [../plans/2026-08-29-sc-20-vencimento-certificado.md](../plans/2026-08-29-sc-20-vencimento-certificado.md).

---

## 1. Objetivo

Dar ao operador de Processos uma visão de trabalho dos certificados digitais dos clientes que estão a **60 dias ou menos** do vencimento (mais os já vencidos e os recém-renovados), organizada como um Kanban cujas colunas são **derivadas dos dados** — sem arrastar cards. O sistema recalcula a proximidade do vencimento todo dia de madrugada, avisa o operador **dentro do app** quando um certificado entra numa faixa de urgência, e registra tudo numa trilha de auditoria consultável e exportável.

O envio de e-mail ao cliente **não é implementado nesta etapa** — a interface de envio em lote existe, mas é visual (ver §9 e §12).

## 2. Escopo

Entra:

1. Botão "Rodar agora" renomeado para **"Atualizar"**.
2. Cron **diário** (05:00 `America/Sao_Paulo`) recalculando o bucket de proximidade, idempotente no dia.
3. Toggle **Tabela ↔ Kanban** acima da tabela, preferência persistida por usuário.
4. Kanban de 7 colunas como fila de trabalho dos certificados a ≤ 60 dias do vencimento.
5. Interface de envio de e-mail em lote a partir das colunas de origem — **somente visual** (§9).
6. Avisos in-app (sino no cabeçalho do módulo), sem e-mail para o usuário interno.
7. Trilha de auditoria (`RegistroAuditoria`) com aba **Histórico**, filtros, paginação e exportação CSV.
8. **"Novo certificado"** como botão que abre modal; mesmo modal cobre edição e renovação.
9. Seed sintético cobrindo todas as colunas, com histórico retroativo de ~6 meses e comando de reset.

Não entra: §12 (fora de escopo).

## 3. Abordagem de base

**Substituição limpa do núcleo.** Os dados do SC-20 em produção são 100% seed sintético e "reset + reseed" é entregável, então a migração pode:

- **Dropar e recriar** o model `AvisoCertificado` (hoje registra "a faixa mudou"; passa a registrar "marco de e-mail") e o enum `FaixaUrgencia`.
- Fazer **`ALTER` aditivo** em `Certificado` e `Cliente`, com backfill em SQL para o seed atual não quebrar durante a migração.

A função pura `faixa-urgencia.ts` é substituída por `bucket.ts`. A tabela (`PainelCertificados`) é mantida e estendida; Kanban, modais, sino e aba Histórico são novos. O cron passa a diário. `faixa-urgencia.ts`, `BadgeFaixa.tsx` e seus testes são **removidos** — nada fora do SC-20 os importa.

## 4. Modelo de dados

Import do Prisma Client: `@/generated/prisma/client`. Migração nova: `<timestamp>_sc20_kanban_avisos`.

### 4.1 Enums novos

```prisma
enum TipoCertificado {
  ECNPJ   // rótulo "e-CNPJ"
  ECPF    // rótulo "e-CPF"
  NFE     // rótulo "NF-e"
}

enum BucketCertificado {
  OK
  D60
  D7
  D3
  VENCIDO
  RENOVADO
}

enum MarcoAviso {
  D60
  D7
}

enum StatusAviso {
  QUEUED
  SENT
  DELIVERED
  BOUNCED
  FAILED
}

enum TipoNotificacao {
  D60_ENTROU
  D7_ENTROU
  D3_ENTROU
}
```

O enum antigo `FaixaUrgencia` é removido. `MarcoAviso` **não** inclui D3 — o D3 é só aviso interno, nunca marco de e-mail.

### 4.2 `Cliente` — campos adicionados

| Campo | Tipo | Observação |
|---|---|---|
| `email` | `String` | Obrigatório. Destino dos avisos ao cliente (Etapa 2). |
| `ativo` | `Boolean @default(true)` | |

Backfill na migração: adiciona `email` com default `''`, roda `UPDATE "Cliente" SET email = <slug da razaoSocial> || '@example.com'`, remove o default e aplica `NOT NULL`.

Relações inversas adicionadas: `avisos AvisoCertificado[]`, `notificacoes NotificacaoInApp[]`, `registrosAuditoria RegistroAuditoria[]`.

### 4.3 `Certificado` — campos adicionados

| Campo | Tipo | Observação |
|---|---|---|
| `tipo` | `TipoCertificado` | Backfill `ECNPJ`. |
| `titular` | `String` | Backfill = `razaoSocial` do cliente. |
| `emitidoEm` | `DateTime` | Backfill = `dataValidade - interval '1 year'`. |
| `ativo` | `Boolean @default(true)` | Renovado ou desativado ⇒ `false`. |
| `observacao` | `String?` | |
| `substituidoPorId` | `String? @unique` | Auto-relação `"Renovacao"`: `substituidoPor` / `substituiu`. |
| `renovadoEm` | `DateTime?` | Setado no ato da renovação. Alimenta a janela de 7 dias da coluna "Renovado" do Kanban. |
| `bucket` | `BucketCertificado @default(OK)` | Gravado pelo cron; a UI recalcula ao vivo também (§5). |
| `atualizadoEm` | `DateTime @updatedAt` | Auditoria genérica de alteração. |

`dataValidade` (já existente) é o "válido até".

Índices: mantém `@@index([dataValidade])`; adiciona `@@index([clienteId])` e `@@index([bucket])`.

**Simplificação deliberada:** o campo `status_renovacao` citado no pedido é **omitido**. "Renovado" é derivado de `substituidoPorId != null` (+ `renovadoEm` para a janela do Kanban). Um campo de status a menos para manter em sincronia com o vínculo de renovação.

### 4.4 `AvisoCertificado` — recriado

```prisma
model AvisoCertificado {
  id                String       @id @default(cuid())
  certificadoId     String
  certificado       Certificado  @relation(fields: [certificadoId], references: [id], onDelete: Cascade)
  clienteId         String
  cliente           Cliente      @relation(fields: [clienteId], references: [id], onDelete: Cascade)
  marco             MarcoAviso
  destinatarioEmail String
  status            StatusAviso  @default(QUEUED)
  providerMessageId String?
  enviadoEm         DateTime?
  criadoEm          DateTime     @default(now())
  atualizadoEm      DateTime     @updatedAt

  @@unique([certificadoId, marco])
  @@index([clienteId])
}
```

`@@unique([certificadoId, marco])` é a trava anti-ruído do banco: no máximo um aviso por marco por certificado. Nesta etapa **apenas o seed grava aqui** (o envio é visual, §9); o schema já fica pronto para a Etapa 2. Renovação cria um `Certificado` novo, então o ciclo de marcos recomeça naturalmente.

### 4.5 `NotificacaoInApp` — novo

```prisma
model NotificacaoInApp {
  id            String          @id @default(cuid())
  usuarioId     String
  usuario       Usuario         @relation(fields: [usuarioId], references: [id], onDelete: Cascade)
  tipo          TipoNotificacao
  certificadoId String
  certificado   Certificado     @relation(fields: [certificadoId], references: [id], onDelete: Cascade)
  clienteId     String
  cliente       Cliente         @relation(fields: [clienteId], references: [id], onDelete: Cascade)
  lidaEm        DateTime?
  criadoEm      DateTime        @default(now())

  @@index([usuarioId, lidaEm])
  @@index([usuarioId, tipo, criadoEm])
}
```

Uma linha por **(usuário elegível × certificado × evento)**. O agrupamento "por tipo + dia" do sino acontece na leitura, não no banco. "Usuário elegível" = quem enxerga o SC-20: `papel = ADMIN` ou (`papel = OPERADOR` e `setor = "Processos"`).

### 4.6 `RegistroAuditoria` — novo

```prisma
model RegistroAuditoria {
  id         String   @id @default(cuid())
  entidade   String   // "Certificado" | "AvisoCertificado" | "Execucao"
  entidadeId String
  acao       String   // ver §7.2
  descricao  String   // texto legível pronto para a timeline
  autorId    String?  // null = "Sistema" (cron)
  autor      Usuario? @relation(fields: [autorId], references: [id])
  autorEmail String?
  clienteId  String?
  cliente    Cliente? @relation(fields: [clienteId], references: [id])
  dadosAntes  Json?
  dadosDepois Json?
  criadoEm   DateTime @default(now())

  @@index([criadoEm])
  @@index([entidade, entidadeId, criadoEm])
  @@index([clienteId, criadoEm])
}
```

Model genérico; nesta etapa só o SC-20 o usa. **Não** substitui nem toca o `AuditoriaTermo` do SC-11.

### 4.7 Relações inversas em `Usuario`

`Usuario` ganha `notificacoes NotificacaoInApp[]` e `registrosAuditoria RegistroAuditoria[]` (esta última via `@relation(fields: [autorId], ...)` no `RegistroAuditoria`).

## 5. Núcleo de regras — `src/lib/certificados/bucket.ts` (função pura)

Substitui `faixa-urgencia.ts`. Testada sem banco, no padrão do `faixa-urgencia.test.ts` atual.

- `diasRestantes(validoAte: Date, hoje?: Date): number` — diferença em dias de calendário, ancorada em UTC (reaproveitado como está: hoje = 0, amanhã = 1, ontem = -1).
- `calcularBucket(dias: number, opcoes: { renovado: boolean }): BucketCertificado`

  | Condição | bucket |
  |---|---|
  | `renovado` | `RENOVADO` |
  | `dias < 0` | `VENCIDO` |
  | `0 ≤ dias ≤ 3` | `D3` |
  | `4 ≤ dias ≤ 7` | `D7` |
  | `8 ≤ dias ≤ 60` | `D60` |
  | `dias > 60` | `OK` |

  O `D3` é uma divisão do antigo `D7` do pedido (`7 ≥ d ≥ 0`): `7 ≥ d > 3` continua `D7`, `3 ≥ d ≥ 0` vira `D3`.

- `ORDEM_BUCKETS: BucketCertificado[]` (do mais urgente ao menos) e `ROTULO_BUCKET: Record<BucketCertificado, string>`.
- `transicaoGeraNotificacao(de: BucketCertificado | null, para: BucketCertificado): TipoNotificacao | null` — devolve o tipo só quando **entra** em `D60` / `D7` / `D3` vindo de um bucket menos urgente (ou de `null`). Sair de `D60` para `D7` conta como entrada em `D7`. Entrar em `VENCIDO`, `OK` ou `RENOVADO` não gera notificação.
- `textoDias(dias: number): string` — `"faltam Xd"` / `"vence hoje"` / `"vencido há Xd"`.

## 6. Cron diário e botão "Atualizar"

### 6.1 Agendamento

`vercel.json`: o cron do SC-20 muda de `0 8 1 * *` (mensal) para **`0 8 * * *`** (diário, 08:00 UTC = 05:00 `America/Sao_Paulo`, seguindo a convenção UTC que o README documenta). Os crons de SC-01 e SC-11 ficam intactos.

### 6.2 Rota

`src/app/api/cron/sc-20/route.ts` — inalterada no contrato: valida `CRON_SECRET`, chama `executarModulo("SC-20", "scheduler", recalcularBucketsCertificados)`, devolve `{ execucaoId, status, resumo, erro }`.

### 6.3 Motor — `src/lib/certificados/processar.ts`

`recalcularBucketsCertificados(hoje?: Date, contexto: { autorId: string | null; autorEmail: string | null }): Promise<ResultadoExecucao>` (renomeia `processarAvisosCertificados`, continua devolvendo `ResultadoExecucao` e rodando dentro de `executarModulo`).

Para cada certificado **ativo**:

1. Recalcula o bucket. Se difere do valor gravado em `Certificado.bucket` → `UPDATE` do campo + grava `RegistroAuditoria` (`acao: "TRANSICAO_BUCKET"`, `descricao: "Bucket de <cliente> (<tipo>): D60 → D7"`, `dadosAntes/Depois`, `autorId` do contexto).
2. Se `transicaoGeraNotificacao(bucketAnterior, bucketNovo)` devolve um tipo → cria uma `NotificacaoInApp` para **cada usuário elegível** (§4.5), referenciando o certificado.
3. **Idempotência no dia:** antes de criar a `NotificacaoInApp`, verifica se já existe uma de mesmo `(usuarioId, certificadoId, tipo)` com `criadoEm` ≥ 00:00 UTC de hoje. O `bucket` gravado já impede reprocessar transição que não houve — rodar "Atualizar" várias vezes no mesmo dia não duplica nada.
4. **Granular:** falha num certificado não aborta o lote — status final `PARCIAL`, no mesmo padrão do `processar.ts` atual.
5. Ao final, grava um `RegistroAuditoria` `acao: "ATUALIZAR_EXECUTADO"` (`entidade: "Execucao"`, `descricao: "N certificados reavaliados, M transições"`, ator do contexto).

Certificados inativos (renovados/desativados) são pulados nos passos 1–3.

### 6.4 Botão

`BotaoRodarAgora.tsx` → `BotaoAtualizar.tsx`, rótulo `"Rodar agora"` → **`"Atualizar"`**. Server action `rodarAgora` → `atualizarAgora`, mesma assinatura, chama `executarModulo("SC-20", sessao.email, (hoje) => recalcularBucketsCertificados(hoje, { autorId: sessao.usuarioId, autorEmail: sessao.email }))` + `revalidatePath`. Texto auxiliar reescrito: "Reavalia o bucket de cada certificado e gera os avisos internos das faixas que mudaram. Roda sozinho todo dia de madrugada."

## 7. Página, abas, Histórico

### 7.1 Navegação

A página `/modulos/sc-20` ganha duas abas via query param, renderizadas no servidor:

- `?aba=certificados` (padrão) — tabela/Kanban, botão "Atualizar", botão "+ Novo certificado", sino.
- `?aba=historico` — timeline de auditoria.

O bloco "Histórico de execução" do `ModuloPageLayout` (lista de `Execucao`) continua onde está — é padrão de todos os módulos.

### 7.2 Aba Histórico

Timeline de `RegistroAuditoria`, server-side, paginada por `?pagina=` (~30/página).

**Filtros** (formulário GET, combináveis): `cliente` (select), `evento` (select de `acao`), `de` / `ate` (datas).

**Cada linha:** timestamp (data + hora UTC, padrão do `HistoricoAuditoriaTermos` do SC-11), ator (`autorEmail` ou **"Sistema"**), `descricao`, e um diff compacto `campo: antes → depois` quando há `dadosAntes/Depois`. Filete lateral por natureza: turquesa = criação, âmbar = transição/edição, carmim = bounce/falha.

**Valores de `acao`** (cobrem os tipos de evento do pedido §5): `CRIADO`, `EDITADO`, `DESATIVADO`, `TRANSICAO_BUCKET`, `AVISO_ENVIADO`, `AVISO_BOUNCE`, `RENOVACAO`, `ATUALIZAR_EXECUTADO`. Nesta etapa, `AVISO_ENVIADO` e `AVISO_BOUNCE` são populados só pelo seed.

**Exportação CSV:** rota `src/app/modulos/sc-20/historico/relatorio/route.ts` (padrão do `.../relatorio/route.ts` do SC-11), respeita os filtros ativos, `Content-Disposition: attachment`.

### 7.3 Toggle Tabela ↔ Kanban

Componente client `AlternadorVisao` (controle segmentado) acima da tabela. Preferência em `localStorage` chave `sc20:visao` (`"tabela" | "kanban"`), lida no primeiro render com fallback `"tabela"`. `?visao=kanban` na URL (usado pelo sino) vence o `localStorage` e o atualiza.

## 8. Tabela, Kanban e modais

### 8.1 Tabela — `PainelCertificados`

Mantida. Ganha colunas `Tipo` e `Titular`. Selo passa a ser `SeloBucket` (6 valores). Mostra **todos** os certificados, inclusive `OK` e renovados fora da janela de 7 dias. "Editar" da linha abre o `ModalCertificado`; "Remover" continua.

### 8.2 Kanban — `QuadroKanban`

7 colunas, posição **derivada dos dados**, **sem drag-and-drop**. Cada header tem contador.

| # | Coluna | Conteúdo |
|---|---|---|
| 1 | A avisar — 60 dias | `bucket D60` sem `AvisoCertificado(D60)` |
| 2 | Avisado 60d | `bucket D60` com `AvisoCertificado(D60)` em `SENT`/`DELIVERED` |
| 3 | A avisar — 7 dias | `bucket D7` sem `AvisoCertificado(D7)` |
| 4 | Avisado 7d | `bucket D7` com `AvisoCertificado(D7)` em `SENT`/`DELIVERED` |
| 5 | Confirmar renovação — 3 dias | `bucket D3` |
| 6 | Vencido | `bucket VENCIDO` (destaque carmim) |
| 7 | Renovado | `bucket RENOVADO` com `renovadoEm` nos últimos **7 dias** |

Passados 7 dias desde `renovadoEm`, o certificado renovado **sai do Kanban** e permanece apenas na tabela simples.

- Colunas 1 e 3 têm o botão **"Enviar avisos (N)"** no topo (§9). N = 0 → desabilitado, texto "Nada a enviar".
- **Card** (`CardCertificado`): razão social, tipo, `dataValidade`, contador "faltam Xd" (Plex Mono tabular), selo de aviso (`Avisado há Xd` / `Aguardando`), ícone de bounce quando `status = BOUNCED`.
- `AvisoCertificado` com `status BOUNCED`/`FAILED` mantém o card na coluna "A avisar" de origem, com badge de erro em carmim.
- Clique no card → `ModalPerfilCliente`.
- `?foco=<D60|D7|D3>` (vindo do sino) rola até a coluna e aplica highlight temporário em âmbar.

### 8.3 Modais

Base comum: `Modal` client sobre `<dialog>` HTML nativo — fecha no **X**, clique fora e **Esc**; trava o scroll do fundo; devolve o foco ao gatilho. Overlay em tinta translúcida, painel névoa/branco, borda grafite.

**`ModalPerfilCliente`** — aberto pelo clique num card (e por link opcional na tabela). Ao abrir, chama a server action `obterPerfilCliente(clienteId)` → objeto serializável: dados do cliente (razão social, CNPJ, e-mail, ativo), certificados dele com `SeloBucket` e "faltam Xd", e as últimas N linhas de `RegistroAuditoria` filtradas por `clienteId`, com "ver tudo" → `?aba=historico&cliente=<id>`. Estado de carregando enxuto; erro conhecido vira texto. Não troca rota nem aba — fecha e volta ao mesmo ponto.

**`ModalCertificado`** — substitui o formulário inline. Botão primário **"+ Novo certificado"** no cabeçalho (área `acoes`). Campos: cliente (`<input>` + `<datalist>` como autocomplete, sem lib), tipo, titular, `emitidoEm`, `dataValidade`, observação.
- Validações: `dataValidade > emitidoEm` (bloqueante); aviso **não** bloqueante se `dataValidade` a ≤ 60 dias.
- Checkbox **"É renovação de um certificado existente"** → revela select com os certificados **ativos** do cliente escolhido. Ao salvar com essa opção: cria o novo `Certificado`; no antigo grava `substituidoPorId`, `renovadoEm = now()`, `ativo = false`; o antigo passa a `RENOVADO`.
- Ao salvar (qualquer caso): recalcula o bucket na hora e grava `RegistroAuditoria` (`CRIADO`; e `RENOVACAO` + `DESATIVADO` no antigo quando for o caso).
- Modo edição: "Editar" da linha abre o modal preenchido; salvar grava `RegistroAuditoria` `EDITADO` com `dadosAntes/Depois`.
- Server actions herdam `exigirAcessoSc20()`.

### 8.4 Sino de avisos — `SinoAvisos`

Ícone de campainha no **cabeçalho da SC-20** (não no `CabecalhoPortal` global). Badge com a contagem de `NotificacaoInApp` não lidas do usuário logado (carregadas pela página server).

Lista ao abrir, agrupada por `(tipo, dia)` na leitura:
- `"3 certificados entraram na faixa de 60 dias"`
- `"1 certificado entrou na faixa de 7 dias"`
- `"4 clientes para confirmar se fizeram a renovação"` (`D3_ENTROU`)

Grupo não lido em âmbar. Clique no grupo → navega para `?aba=certificados&visao=kanban&foco=<D60|D7|D3>` e chama `marcarGrupoLido(tipo, dia)` (server action) que aplica `lidaEm = now()` em todas as linhas daquele `(usuário, tipo, dia)`. Sem e-mail interno, sem digest.

## 9. Envio em lote — visual, sem lógica

- Colunas 1 e 3 do Kanban: botão **"Enviar avisos (N)"**.
- Clique → `ModalEnvioLote`: lista `cliente — e-mail` com checkbox por linha, **todos marcados** por padrão, contador "X de N selecionados", botão "Confirmar envio".
- Confirmar → **toast** "Envio de e-mail ainda não disponível nesta etapa." O modal fecha, **nada é persistido**, nenhum card se move.
- Comentário no código + nota neste doc marcam onde entra a Etapa 2: `EnviadorEmail` (fila real, transição de status, movimentação automática do card, webhook de bounce, reenvio individual).
- As colunas "Avisado 60d/7d", os selos `Avisado há Xd` e o ícone de bounce continuam funcionando, alimentados pelas linhas de `AvisoCertificado` do **seed**.

## 10. Seed e reset

Estende `prisma/seed.ts` com `seedSc20()` (upsert idempotente), **datas relativas a hoje**:

- **60 clientes** `@example.com` (razões sociais e CNPJs por `gerarCnpjValido`), maioria `ativo = true`, ~5 inativos.
- **~90 certificados**: 35 `OK`, 20 `D60`, 12 `D7`, ~5 `D3`, 8 `VENCIDO`, 10 `RENOVADO` (com `substituidoPorId` encadeado, antigo `ativo = false`, `atualizadoEm` espalhado — alguns dentro dos 7 dias, aparecem no Kanban; outros fora, só na tabela). `tipo` / `titular` / `emitidoEm` variados.
- **Metade de D60 e metade de D7 já avisada**: `AvisoCertificado` `status SENT`/`DELIVERED`; **5 delas `BOUNCED`** (`bounce+<slug>@example.com`).
- **`RegistroAuditoria`** retroativo ~6 meses: criações, transições, avisos enviados, bounces, renovações, execuções de "Atualizar".
- **`NotificacaoInApp`** não lidas para o admin e o operador de Processos, cobrindo os três tipos.
- **Reset + reseed idempotente**: script `npm run seed:sc20:reset` que apaga só as entidades do SC-20 na ordem das FKs e chama `seedSc20()`. `prisma migrate reset` continua funcionando ponta a ponta.

**Nota operacional (produção):** a migração é destrutiva para `AvisoCertificado` e o `build` roda só `prisma migrate deploy` — não semeia. Após o deploy desta etapa, rodar o seed uma vez em produção (`DIRECT_URL` / SESSION pooler do Supabase) para repovoar o SC-20. O plano de implementação inclui esse passo.

## 11. Estrutura de arquivos

```
prisma/
  schema.prisma                         # enums + models do §4
  migrations/<ts>_sc20_kanban_avisos/   # drop+recria AvisoCertificado e enum; ALTER aditivo + backfill
  seed.ts                               # + seedSc20()
vercel.json                            # cron SC-20 → diário
package.json                           # + script seed:sc20:reset
src/lib/certificados/
  bucket.ts / bucket.test.ts            # substitui faixa-urgencia.ts (puro)
  processar.ts / processar.test.ts      # recalcularBucketsCertificados (integração)
  consultas.ts / consultas.test.ts      # leitura: colunasKanban, perfilCliente, listarHistorico, listarNotificacoes
  acoes.ts                              # server actions: atualizarAgora, criar/editar/renovar/desativar,
                                        #   marcarGrupoLido, obterPerfilCliente (delega para consultas.ts)
  historico.ts / historico.test.ts      # descrição + diff (puro)
  csv-historico.ts / csv-historico.test.ts   # serialização CSV (puro)
src/components/certificados/
  BotaoAtualizar.tsx                    # ex-BotaoRodarAgora
  SeloBucket.tsx / SeloBucket.test.tsx  # ex-BadgeFaixa (6 valores)
  AlternadorVisao.tsx                   # toggle (localStorage + ?visao)
  PainelCertificados.tsx               # tabela — + colunas Tipo/Titular
  QuadroKanban.tsx / QuadroKanban.test.tsx
  CardCertificado.tsx
  Modal.tsx                             # <dialog> genérico
  ModalCertificado.tsx
  ModalPerfilCliente.tsx
  ModalEnvioLote.tsx                    # visual
  SinoAvisos.tsx / SinoAvisos.test.tsx
  TimelineHistorico.tsx / TimelineHistorico.test.tsx
  FiltrosHistorico.tsx
src/app/modulos/sc-20/
  page.tsx                              # abas + toggle + sino + botões
  historico/relatorio/route.ts          # CSV
src/app/api/cron/sc-20/route.ts         # inalterado no contrato
README.md                              # seção SC-20 reescrita
```

Removidos: `src/lib/certificados/faixa-urgencia.ts` (+ teste), `src/components/certificados/BadgeFaixa.tsx` (+ teste).

## 12. Identidade visual

UI nova segue a identidade fixada da marca (README, "A MARCA SHEEPCONTABIL"), já disponível como utilitários Tailwind:

- **Paleta (só estes 7):** petróleo `#10505F` primário/marca; turquesa `#1FA69A` ação/sucesso/link/estado ativo; âmbar `#E8A33D` atenção/pendência/highlight; tinta `#0B1A20` texto principal; grafite `#5A7078` texto secundário e bordas; névoa `#EEF3F4` superfícies e listras; **carmim `#C4453D` exclusivamente erro/falha** (bounce, vencido, validação).
- **Tipografia:** `font-titulo` (Archivo, 600–800) em títulos e números de destaque (contadores de coluna); `font-texto` (IBM Plex Sans) em texto e formulário; `font-codigo` (IBM Plex Mono) em datas, contadores "faltam Xd" e colunas numéricas.
- **Execução:** Kanban como composição de colunas com respiro, listra de urgência no topo de cada uma, cards com elevação sutil e transição suave ao mudarem de coluna; highlight de coluna em âmbar ao vir do sino; estados vazios com uma frase de caráter. Sem fonte nova, sem cor fora dos tokens.
- A skill `frontend-design` é invocada antes de escrever componente na fase de implementação.

## 13. Testes

TDD, Vitest, padrão do repo:

- **Puro:** `bucket` (limites de cada faixa, `transicaoGeraNotificacao`, `textoDias`), `historico` (montagem de descrição, diff, ator "Sistema"), `csv-historico` (escape, cabeçalho, filtros).
- **Integração (Postgres local):** `processar` (transição grava auditoria, idempotência no dia, granular/`PARCIAL`, uma notificação por usuário elegível, inativo é pulado); `consultas` (classificação nas 7 colunas, `obterPerfilCliente`, filtros de histórico e paginação).
- **`@testing-library/react`:** `SeloBucket` (6 rótulos), `QuadroKanban` (card na coluna certa por dados; botão "Nada a enviar" quando vazio), `SinoAvisos` (agrupamento tipo + dia; badge de não lidos), `TimelineHistorico` (diff e ator "Sistema").
- **Render/estado leve:** `AlternadorVisao` (troca + persistência), `Modal` (fecha no Esc / clique fora), `ModalEnvioLote` (toast, nada persistido).

## 14. Critérios de aceite

Mantidos nesta etapa:

- [ ] Botão exibe **"Atualizar"**; execução não duplica notificações no mesmo dia.
- [ ] Cron 05:00 (`America/Sao_Paulo`) recalcula buckets e gera avisos in-app **apenas** em transições.
- [ ] Toggle Tabela/Kanban funciona e a preferência persiste por usuário.
- [ ] Kanban mostra só ≤ 60 dias, vencidos e renovados (estes por 7 dias).
- [ ] Clique no card abre o perfil do cliente (modal), sem sair da aba.
- [ ] Aviso in-app navega até a coluna correta (scroll + highlight) e marca como lido.
- [ ] Histórico registra os tipos de evento com ator e diff; filtros e paginação funcionam; CSV respeita os filtros.
- [ ] Modal de novo certificado trata o caso de renovação (vínculo, desativação, bucket `RENOVADO`).
- [ ] Seed reproduz todas as 7 colunas com volume realista e histórico retroativo.
- [ ] `npm run seed:sc20:reset` é idempotente.

Movidos para a Etapa 2 (envio de e-mail é visual nesta etapa):

- Envio em lote gera 1 e-mail individual por cliente, sem CC/BCC.
- Confirmação de envio move o card automaticamente.
- Tentativa de reenviar o mesmo marco bloqueada em runtime (a constraint `@@unique([certificadoId, marco])` já entra no schema agora).
- Bounce permite reenvio individual.

## 15. Fora de escopo

Frontend global (nada fora de `/modulos/sc-20` e `src/lib|components/certificados`). Detecção passiva de e-mails enviados manualmente pela caixa pessoal do usuário (OAuth Gmail/Outlook + watch de inbox). E-mail para usuário interno. Digest/relatório periódico. Drag-and-drop no Kanban. **Envio transacional de e-mail ao cliente** — a interface entra, a entrega fica para a Etapa 2.
