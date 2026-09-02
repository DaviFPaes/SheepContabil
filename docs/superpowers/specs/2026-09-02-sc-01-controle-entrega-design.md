# SC-01 — Controle de entrega mensal + reconstrução — Design

Data: 2026-09-02
Contexto: a SC-01 já está no ar como "caixa de entrada de extratos". Hoje é uma página única com formulário de upload inline, botão "Processar pendentes", tabela de documentos com link "Abrir", uma tela de detalhe **sem o shell da marca** e um bloco "Histórico de execução" (lista de `Execucao`). Esta evolução transforma a SC-01 num **painel de controle da entrega dos extratos** (quem deve, quem atrasou, qual dia faltou), com leitura automática no upload, multi-upload com auto-detecção de cliente/banco, cobrança por WhatsApp, aba de auditoria e reconstrução visual das telas.

Referência da fundação: [2026-08-27-portal-sheepcontabil-design.md](2026-08-27-portal-sheepcontabil-design.md) — seções 4, 6, 7, 11, 12.
Plano original do módulo: [../plans/2026-08-30-sc-01-extrato-ofx.md](../plans/2026-08-30-sc-01-extrato-ofx.md).
Espelha padrões da etapa 1 da SC-20: [2026-09-01-sc-20-vencimento-certificado-etapa-1-design.md](2026-09-01-sc-20-vencimento-certificado-etapa-1-design.md).

---

## 1. Objetivo

Dar ao operador Contábil uma **visão de trabalho da entrega dos extratos**: para cada conta bancária de cada cliente, saber se o extrato do período em fechamento chegou, se cobre o mês inteiro (e, se não, **quais dias faltam**), e se tem linhas que a IA não leu com 100% de confiança. O sistema:

- lê o extrato **automaticamente assim que é enviado** — sem botão de lote;
- aceita **vários extratos de vários clientes de uma vez**, preenchendo cliente e banco a partir do próprio arquivo;
- deixa o operador **cobrar o cliente por WhatsApp** quando é dia de receber ou quando atrasou;
- registra tudo numa **trilha de auditoria** consultável e exportável;
- gera o **OFX** só quando todas as linhas do documento estão resolvidas.

A régua da IA passa a ser **100%**: linha com `confianca = 1` é confirmada automaticamente; qualquer valor abaixo vai para conferência manual. **Não** há ramificação por formato de arquivo — PDF nativo limpo passa direto porque a IA marca 100%, foto/scan ambíguo cai em conferência.

Disparo real de WhatsApp **não** é implementado — o modal monta a mensagem e abre `wa.me`; o registro da cobrança é persistido (ver §13).

## 2. Escopo

Entra:

1. **Leitura automática no upload** via `after()` do Next 16. Remoção do botão "Processar pendentes" e da server action `processarPendentes`. Cron mantido como rede de segurança.
2. Régua de confiança **100%** (`LIMIAR_CONFIANCA = 1`), prompt do extrator reescrito, `periodoInicio`/`periodoFim` passam a ser lidos do cabeçalho do extrato.
3. **Aba Controle** (nova, padrão): uma linha por cliente × conta bancária, com selo de status **Em dia · Aguardando envio · Atrasado · Conferência**, dias faltantes, e ações WhatsApp / Configurar / Ver extratos. Filtro por competência, default = período em fechamento.
4. **Aba Documentos**: a tabela de hoje com filtros, ordenação por coluna, coluna **Banco** nova, coluna **Arquivo** clicável (abre o PDF/JPG), filtro no mês atual por padrão.
5. **Aba Auditoria**: `RegistroAuditoria` com filtros (cliente, evento, período), timeline, paginação e CSV. Substitui o bloco "Histórico de execução" na SC-01.
6. **Modal "Enviar extratos"** multi-bloco: N blocos `{arquivo → auto-detecção de cliente/banco}`, botão "adicionar outro extrato", envio em lote.
7. **Modal "Configurar cliente"**: periodicidade (mensal/semanal), telefone (WhatsApp), dia de entrega opcional.
8. **Cobrança por WhatsApp** espelhando o `ModalAvisarWhatsApp` da SC-20; registra `CobrancaExtrato`.
9. **Tela de detalhe reconstruída** no shell da marca, com **visualizador do arquivo original** (rota nova que streama os bytes) ao lado dos lançamentos, mantendo todas as funções atuais.
10. **Cálculo de dia útil** com feriados nacionais completos (fixos + móveis).
11. **`SpecularButton`**: brilho preso para dentro do botão (sem o anel que vaza).
12. **Remoção dos subtítulos** descritivos abaixo dos títulos em SC-01, SC-11, SC-20 e home.
13. **2 extratos de exemplo** em HTML print-first (`docs/extratos-exemplo/`), bancos fictícios, para imprimir e fotografar.
14. **Migration** (1) e **seed** cobrindo os quatro status.

Não entra: §24 (fora de escopo).

## 3. Abordagem de base

**Evolução aditiva.** A SC-01 em produção tem dados de seed sintético; ainda assim a migração é **100% aditiva e segura sobre tabela não-vazia** (lição da SC-20: nenhuma migração pode assumir tabela vazia). Todos os campos novos são `NULL`-áveis ou têm default; não há backfill que dependa de estado.

- `DocumentoEntrada`, `Cliente` recebem `ALTER` aditivo.
- `CobrancaExtrato` é model novo.
- `RegistroAuditoria` **já existe** (criado pela SC-20) e é reaproveitado — sem alteração de schema.
- A função pura `conferencia.ts` é ajustada (limiar 1). `TabelaDocumentos` e a tela de detalhe são reconstruídas; Controle, modais, aba Auditoria, visualizador e a lógica de dias úteis / cobertura / periodicidade são novos.
- O cron da SC-01 (`vercel.json`) passa de mensal (`0 8 2 * *`) para **diário** (`0 8 * * *`) — a leitura automática pode falhar em silêncio no serverless; o cron diário recolhe documentos presos.
- `HistoricoExecucoes.tsx` e o model `Execucao` **continuam no repo** — a SC-01 apenas deixa de exibir o bloco. `processarExtratos` (motor do cron) é mantido.

## 4. Modelo de dados

Import do Prisma Client: `@/generated/prisma/client`. Migração nova: `<timestamp>_sc01_controle_entrega`.

### 4.1 Enum novo

```prisma
enum PeriodicidadeExtrato {
  MENSAL
  SEMANAL
}
```

### 4.2 `Cliente` — campos adicionados

| Campo | Tipo | Observação |
|---|---|---|
| `periodicidadeExtrato` | `PeriodicidadeExtrato?` | `NULL` = não configurado → status "Configurar" na aba Controle. |
| `diaEntregaExtrato` | `Int?` | Opcional. Mensal: dia do mês (1–28). Semanal: dia da semana (1 = seg … 5 = sex). `NULL` = primeiro dia útil do período seguinte. |

`telefone` já existe (`String?`, adicionado pela SC-20) — reaproveitado para o WhatsApp de cobrança. Relação inversa nova: `cobrancasExtrato CobrancaExtrato[]`.

Sem backfill: `ALTER TABLE "Cliente" ADD COLUMN ... NULL`.

### 4.3 `DocumentoEntrada` — campos adicionados

| Campo | Tipo | Observação |
|---|---|---|
| `periodoInicio` | `DateTime?` | Início da cobertura **declarada no cabeçalho** do extrato (âncora meia-noite UTC). Gravado pela extração. |
| `periodoFim` | `DateTime?` | Fim da cobertura declarada. |
| `competencia` | `String?` | `"2026-08"`. Derivado na extração de `periodoFim ?? periodoInicio ?? chegadaEm`. Índice de filtro. |

Novo índice: `@@index([tipo, competencia])`.

`arquivo Bytes` (já existe) alimenta o visualizador e a rota `/documento/[id]/arquivo`.

### 4.4 `CobrancaExtrato` — model novo

```prisma
model CobrancaExtrato {
  id               String        @id @default(cuid())
  clienteId        String
  cliente          Cliente       @relation(fields: [clienteId], references: [id], onDelete: Cascade)
  contaBancariaId  String
  contaBancaria    ContaBancaria @relation(fields: [contaBancariaId], references: [id], onDelete: Cascade)
  referenciaInicio DateTime      // início do período de referência cobrado
  referenciaFim    DateTime      // fim do período de referência cobrado
  canal            String        @default("WHATSAPP")
  autorEmail       String
  enviadoEm        DateTime      @default(now())

  @@index([contaBancariaId, referenciaFim])
  @@index([clienteId, enviadoEm])
}
```

Sem `@@unique` — o operador pode cobrar de novo. A UI usa o registro mais recente por `(conta, referência)` para mostrar "cobrado há Xd" e evitar insistência acidental (aviso não-bloqueante se houver cobrança < 3 dias). `ContaBancaria` ganha a relação inversa `cobrancas CobrancaExtrato[]`.

### 4.5 `RegistroAuditoria` — reaproveitado (sem alteração de schema)

Model genérico criado pela SC-20 (`entidade`/`entidadeId`/`acao`/`descricao`/`autorId`/`autorEmail`/`clienteId`/`dadosAntes`/`dadosDepois`/`criadoEm`). A SC-01 grava com `entidade ∈ {"DocumentoEntrada", "Lancamento", "Cliente", "CobrancaExtrato"}`. Não toca o `AuditoriaTermo` da SC-11.

## 5. Lógica pura — `src/lib/documentos/*` (sem Prisma, testável)

### 5.1 `dias-uteis.ts`

Feriados nacionais brasileiros, ano a ano:

- **Fixos:** 01/01, 21/04, 01/05, 07/09, 12/10, 02/11, 15/11, 25/12.
- **Móveis:** Páscoa por Gauss/Meeus → Sexta-feira Santa (`Páscoa − 2`), Carnaval (terça, `Páscoa − 47`), Corpus Christi (`Páscoa + 60`).
- `ehDiaUtil(d: Date): boolean` — não é sábado/domingo nem feriado (comparação em UTC).
- `primeiroDiaUtilDoMes(ano: number, mes0: number): Date`
- `primeiroDiaUtilDaSemana(d: Date): Date` — segunda-feira da semana ISO de `d`, avançando se cair em feriado.
- `proximoDiaUtil(d: Date): Date`

### 5.2 `cobertura.ts`

- `type Intervalo = { inicio: Date; fim: Date }` (dias inteiros, UTC).
- `unir(intervalos: Intervalo[]): Intervalo[]` — funde sobreposições e encostados.
- `diasFaltantes(esperado: Intervalo, cobertos: Intervalo[]): Intervalo[]` — buracos de `esperado` não cobertos por `cobertos`.
- `rotularFaltantes(faltantes: Intervalo[]): string` — `"dias 30 e 31/08"` / `"05/08 a 09/08 e 22/08"`.

### 5.3 `periodicidade.ts`

- `type StatusEntrega = "NAO_CONFIGURADO" | "CONFERENCIA" | "ATRASADO" | "AGUARDANDO" | "EM_DIA"`.
- `periodoReferencia(periodicidade, hoje, competenciaSelecionada): Intervalo` — para `MENSAL`, o mês selecionado (default = mês anterior a `hoje`); para `SEMANAL`, a **última semana ISO inteira encerrada** até o fim do mês selecionado.
- `dataEntrega(periodicidade, periodoRef, diaEntregaExtrato?): Date` — primeiro dia útil após `periodoRef.fim`, ou o `diaEntregaExtrato` configurado ajustado ao próximo dia útil.
- `derivarStatus(args): { status: StatusEntrega; faltantes: Intervalo[] }` com **esta precedência** (fonte única):

  | Ordem | Condição | Status |
  |---|---|---|
  | 1 | `periodicidade == null` | `NAO_CONFIGURADO` |
  | 2 | há `Lancamento` `PENDENTE_REVISAO` nos docs da referência | `CONFERENCIA` |
  | 3 | `hoje > dataEntrega` **e** `faltantes ≠ ∅` | `ATRASADO` |
  | 4 | `hoje == dataEntrega` **e** `faltantes ≠ ∅` | `AGUARDANDO` |
  | 5 | — | `EM_DIA` |

  `faltantes = diasFaltantes(periodoRef, união dos [periodoInicio,periodoFim] dos docs da conta na referência)`. Doc sem período lido conta como cobertura vazia (a linha ganha uma nota "período não identificado").

- `ROTULO_STATUS: Record<StatusEntrega, string>` = `{ NAO_CONFIGURADO: "Configurar", CONFERENCIA: "Conferência", ATRASADO: "Atrasado", AGUARDANDO: "Aguardando envio", EM_DIA: "Em dia" }`.
- `ACENTO_STATUS` → turquesa (`EM_DIA`), âmbar (`AGUARDANDO`, `CONFERENCIA`), carmim (`ATRASADO`), grafite (`NAO_CONFIGURADO`).

**Simplificação deliberada:** para `SEMANAL` com várias semanas passadas em aberto, a linha reflete a **semana não resolvida mais antiga** e um sufixo `"+N semanas"`. Uma linha por conta, não uma por semana.

### 5.4 `conferencia.ts` — ajuste

```ts
export const LIMIAR_CONFIANCA = 1;

export function classificarLancamento(confianca: number): StatusConferencia {
  return confianca >= LIMIAR_CONFIANCA ? "CONFIRMADO" : "PENDENTE_REVISAO";
}
```

`documentoPodeBaixarOfx` / `motivoBloqueioOfx` inalterados (OFX só com todas as linhas `CONFIRMADO`). `formato-documentos.ts`: `tomConfianca` passa a `turquesa` só em `>= 1`, `âmbar` em `>= 0.6`, `carmim` abaixo. Cópia auxiliar some junto com os subtítulos (§21).

### 5.5 `filtros-documentos.ts`

Espelha `certificados/filtros.ts`. `filtrarDocumentos(docs, { busca, status, banco, competencia })` + `ordenarDocumentos(docs, ordenacao)` para `ordenacao ∈ {cliente, chegada, status, linhas}` × `{asc, desc}`.

### 5.6 `historico.ts`

```ts
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
```

`ROTULO`, `ACENTO_ACAO` (turquesa: `EXTRATO_ENVIADO`, `LEITURA_CONCLUIDA`, `OFX_BAIXADO`; âmbar: `LINHA_CONFERIDA`, `REPROCESSADO`, `EXTRATO_COBRADO`, `CLIENTE_CONFIGURADO`; carmim: `LEITURA_FALHOU`, `DOCUMENTO_EXCLUIDO`), `NATUREZAS` (para o `<select>` de filtro). Reaproveita `camposAlterados`/`rotuloAtor` de `certificados/historico.ts` (importados, não duplicados) ou move essas duas funções puras para `src/lib/auditoria/diff.ts` — decisão do plano; preferir **importar** enquanto não houver terceiro consumidor.

## 6. IA — duas passagens

### 6.1 Detecção de cabeçalho — `deteccao-cabecalho.ts`

Chamada **leve** (só cabeçalho), disparada no anexo de cada arquivo:

```ts
export type CabecalhoExtrato = {
  razaoSocial: string | null;
  banco: string | null;
  agencia: string | null;
  conta: string | null;
  periodoInicio: string | null; // ISO yyyy-mm-dd
  periodoFim: string | null;
  confianca: number;            // 0..1
};
```

`modelo = "claude-haiku-4-5-20251001"` (barato/rápido), `max_tokens` baixo, tool `identificar_cabecalho`. Instrução: "leia apenas o cabeçalho — titular/razão social, banco, agência, conta e o período de cobertura; não extraia lançamentos".

Server action `detectarCabecalho(formData)` → roda a chamada, e casa com o cadastro:
- `razaoSocial` → `Cliente` por similaridade normalizada (sem acento, caixa baixa; match exato ou `includes`).
- `agencia` + `conta` (ou `banco`) → `ContaBancaria` daquele cliente.
- devolve `{ clienteId?, contaBancariaId?, cabecalho, confianca }`. Sem match confiável → ids `undefined`, seleção manual.

### 6.2 Extração completa — `extrator-extrato.ts`

- `LinhaExtraida` inalterado; **a tool passa a retornar também** `periodoInicio` / `periodoFim` (strings ISO) no nível do resultado: `{ linhas: LinhaExtraida[], periodoInicio?: string, periodoFim?: string }`.
- `INSTRUCAO` reescrita, trechos-chave:
  - "confianca = 1 **somente** quando a leitura da linha for inequívoca: dígitos nítidos, layout claro, sem ambiguidade. Qualquer dúvida (foto tremida, dígito borrado, valor cortado, layout confuso) → confianca < 1."
  - "informe também o período de cobertura declarado no cabeçalho (ex.: 'Período: 01/08/2026 a 31/08/2026') em periodoInicio/periodoFim."
- `processarDocumento` grava `periodoInicio`, `periodoFim`, `competencia` no `DocumentoEntrada`; grava `RegistroAuditoria` `LEITURA_CONCLUIDA` (`descricao: "IA leu N linhas de <arquivo> — M em conferência"`, `entidade: "DocumentoEntrada"`, `clienteId`) ou `LEITURA_FALHOU` no `catch`.
- Custo aceito: **2 chamadas por arquivo** (cabeçalho + extração).

### 6.3 Disparo assíncrono

`enviarDocumentos` cria os `DocumentoEntrada` e agenda `processarDocumento(id)` via `after()` (`next/server`) — confirmar a API estável no Next 16 em `node_modules/next/dist/docs/` antes de implementar; se `after()` não estiver disponível, cair para `void processarDocumento(id).catch(...)` com o cron diário como rede. A linha aparece como `PENDENTE` ("Na fila") e vira `PROCESSADO`/`ERRO` sozinha.

## 7. Leitura automática e remoção do lote

- `acoes-sc01.ts`: **removidas** a export `processarPendentes` e a referência a `executarModulo` no fluxo manual. `processarExtratos` (usado pelo cron) permanece.
- `page.tsx`: sai o `<BotaoProcessar acao={processarPendentes} …>` do cabeçalho e o KPI "Na fila" vira informativo (sem ação).
- `documento/[id]/page.tsx`: o "Processar este documento" (quando `PENDENTE`/`ERRO`) permanece como **"Reprocessar"**, chamando `reprocessarDocumento` (renomeia `processarUm`), que grava `RegistroAuditoria` `REPROCESSADO`.
- `vercel.json`: cron SC-01 → `0 8 * * *`.

## 8. Página e navegação — `/modulos/sc-01`

Shell da marca (`bg-tinta` + `<VeuAtmosferico>` + `<CabecalhoPortal>` + rodapé "Acesso restrito"), `max-w-[88rem]` como a SC-20. `searchParams`: `aba`, `competencia` (`YYYY-MM`), `status`, `cliente`, `evento`, `de`, `ate`, `pagina`.

`<nav>` de abas (padrão visual da SC-20):

- `?aba=controle` (**padrão**) — painel de controle da entrega.
- `?aba=documentos` — tabela de documentos.
- `?aba=auditoria` — timeline de auditoria.

Cabeçalho: "SC-01 · Extrato bancário" (código turquesa mono) · `modulo.nome` em `font-titulo` · botão primário **"Enviar extratos"** na área de ações. **Sem** parágrafo-subtítulo. KPIs (faixa `<dl>` como a SC-20): "Atrasados", "Aguardando", "Em conferência", "Documentos no mês" — cada um linka para a aba/filtro correspondente.

Bloco "Histórico de execução" e `<HistoricoExecucoes>` **removidos** desta página.

## 9. Aba Controle — `PainelControleSc01` (client)

Orquestra estado, filtros e modais no padrão do `PainelSc20`.

### 9.1 Dados

Server: `listarControleEntrega(competencia?): LinhaControle[]` em `consultas-sc01.ts`.

```ts
type LinhaControle = {
  clienteId: string;
  razaoSocial: string;
  clienteTelefone: string | null;
  periodicidade: PeriodicidadeExtrato | null;
  diaEntregaExtrato: number | null;
  contaId: string;
  bancoRotulo: string;           // "Banco Meridiano — ag 1201 c/c 45678-9"
  periodoRefInicio: Date;
  periodoRefFim: Date;
  status: StatusEntrega;
  faltantesRotulo: string | null; // "dias 30 e 31/08"
  semanasEmAtraso: number;        // 0 exceto SEMANAL acumulado
  ultimoExtratoEm: Date | null;
  emConferencia: number;          // linhas PENDENTE_REVISAO na referência
  cobradoEm: Date | null;         // CobrancaExtrato mais recente p/ a referência
};
```

Uma linha por `ContaBancaria`. Contas sem cliente configurado entram com `status = NAO_CONFIGURADO`.

### 9.2 UI

- **Toolbar:** busca (cliente/banco) · `<select>` de status · seletor de competência (`<input type="month">`, default = mês anterior a hoje) · toggle **"Só atrasados"** · "Limpar" · à direita, botão "Enviar extratos".
- **Tabela** `TabelaControleEntrega`: agrupada por cliente (primeira linha do grupo mostra a razão social como cabeçalho de grupo). Colunas: Conta (banco/ag/cc) · Periodicidade · Referência (`ago/2026` ou `25–31/08`) · **Status** (`SeloStatusExtrato`) · Faltando (`faltantesRotulo` + `+N semanas`) · Último extrato · Ações. Cabeçalhos ordenáveis (▲/▼) por cliente, status, último extrato.
- **Ações por linha:**
  - **WhatsApp** — visível só em `AGUARDANDO` e `ATRASADO`. Abre `ModalCobrarExtrato`. Se `cobradoEm` < 3 dias, o botão vira "Cobrado há Xd" (ainda clicável, com aviso).
  - **Configurar** — abre `ModalConfigurarCliente` (sempre visível; destacado quando `NAO_CONFIGURADO`).
  - **Ver extratos** — `router.push('/modulos/sc-01?aba=documentos&cliente=<id>&competencia=<ref>')`.
- **Estado vazio** com uma frase de caráter (padrão SC-20).

### 9.3 `SeloStatusExtrato`

Selo no idioma visual do `SeloBucket` (fundo suave + texto no tom + anel interno). Só tokens da paleta. `ATRASADO` com o mesmo peso visual do `VENCIDO` da SC-20.

## 10. Aba Documentos — `TabelaDocumentos` reconstruída

- `PainelDocumentos` (client) com toolbar: busca (cliente/arquivo) · `<select>` status · `<select>` banco · `<input type="month">` (**default = mês atual**) · pílula de contagem · "Limpar". Filtro/ordenção **client-side** (`useMemo`), volume ~200/mês.
- Colunas: Cliente · Arquivo · **Banco** · Chegada · Status · Linhas · Abrir.
  - **Arquivo** é `<a href="/modulos/sc-01/documento/{id}/arquivo" target="_blank">` — abre o PDF/JPG em nova aba.
  - **Linhas** mantém o formato atual (`N` + pílula "M em revisão").
  - **Abrir** → `/modulos/sc-01/documento/{id}` (§14).
- Cabeçalhos clicáveis (▲/▼, foco petróleo) no padrão `PainelCertificados`.
- Estado vazio reescrito sem o subtítulo antigo.

## 11. Aba Auditoria

- Server: `listarHistoricoDocumentos({ clienteId, acao, de, ate, pagina, porPagina })` em `consultas-sc01.ts` — espelha `listarHistorico` da SC-20, com `where.entidade = { in: ["DocumentoEntrada", "Lancamento", "Cliente", "CobrancaExtrato"] }`. Paginação 30/página.
- `FiltrosAuditoriaDocumentos` (client): `cliente` (`<select>`), `evento` (`<select>` de `NATUREZAS`), `de` / `ate` (datas), "Filtrar" / "Limpar", "Baixar CSV". Legenda de cores igual à SC-20.
- `TimelineAuditoria`: reaproveita o visual de `TimelineHistorico` da SC-20 (linha com nó colorido, `descricao`, diff `campo: antes → depois`, ator ou "Sistema", data + hora UTC). Se `TimelineHistorico` for genérico o suficiente (tipos de `LinhaAuditoria`), **importar**; senão copiar para `components/documentos/`.
- Rota CSV: `src/app/modulos/sc-01/historico/relatorio/route.ts`, padrão da `.../sc-20/historico/relatorio/route.ts` — respeita os filtros, `Content-Disposition: attachment`.
- **SC-20:** `listarHistorico` em `src/lib/certificados/consultas.ts` ganha `where.entidade = { in: ["Certificado", "AvisoCertificado"] }` para as duas trilhas não se misturarem. `obterPerfilCliente` (mesmo arquivo) idem no seu `findMany`. Única alteração fora da SC-01 além dos subtítulos.

## 12. Modal "Enviar extratos" — `ModalEnviarExtratos` (multi-bloco)

- Botão "Enviar extratos" no cabeçalho abre o `Modal` (o de `components/certificados/Modal.tsx` — reaproveitado; mover para `components/ui/Modal.tsx` se o plano achar melhor, atualizando imports da SC-20).
- Corpo: lista de **blocos** `BlocoUploadExtrato`, começando com 1.
  - Cada bloco: `<input type="file" accept="application/pdf,image/jpeg,image/png">` + selects **Cliente** e **Banco** + área de status da detecção.
  - `onChange` do arquivo → chama `detectarCabecalho` → enquanto pende, "Identificando…"; ao voltar, preenche Cliente/Banco (editáveis) e mostra "Identificado: <razão social> · <banco>" ou "Não identifiquei — selecione manualmente".
  - Banco depende do cliente (mesma mecânica do `FormularioUploadDocumento` atual: `contasPorCliente`).
- Botão **"＋ Adicionar outro extrato"** adiciona bloco; cada bloco tem "remover" (exceto quando é o único).
- Rodapé: "Cancelar" + "Enviar N extratos".
- Submit → server action `enviarDocumentos(blocos)`:
  - valida cada bloco (arquivo presente, MIME ∈ `{pdf,jpeg,png}`, ≤ 15 MB, `clienteId` + `contaBancariaId` resolvidos e coerentes);
  - bloco inválido → retorna `{ erro, indice }`, o modal marca o bloco;
  - cria os `DocumentoEntrada` (`chegadaEm = now()`), grava `RegistroAuditoria` `EXTRATO_ENVIADO` por documento, agenda a extração de cada um (§6.3);
  - sucesso → fecha o modal, `revalidatePath("/modulos/sc-01")`. **Sem redirect.**
- `FormularioUploadDocumento.tsx` é **removido** (substituído).

## 13. Modal "Configurar cliente" — `ModalConfigurarCliente`

- Abre da linha do cliente na aba Controle. Campos: **Periodicidade** (`<select>`: "Mensal" / "Semanal"), **Telefone (WhatsApp)** (tel), **Dia de entrega** (opcional — number; rótulo muda conforme periodicidade: "dia do mês" 1–28 / "dia da semana" seg–sex).
- Server action `configurarCliente(formData)`:
  - Zod: `periodicidade ∈ {MENSAL, SEMANAL}`, `telefone?`, `diaEntrega?` no range certo por periodicidade;
  - `prisma.cliente.update` + `RegistroAuditoria` `CLIENTE_CONFIGURADO` (`entidade: "Cliente"`, `clienteId`, `dadosAntes/Depois` de periodicidade/telefone/dia) na mesma transação;
  - `revalidatePath`.
- Herda `exigirAcessoSc01()`.

## 14. Cobrança por WhatsApp — `ModalCobrarExtrato`

Espelha `ModalAvisarWhatsApp` da SC-20:

- Mensagem pré-montada conforme `status`:
  - `AGUARDANDO`: "Olá, <razão social>. Aqui é da SheepContabil. Hoje é o dia de nos enviar o extrato bancário de <referência> da conta <banco ag/cc>. Pode mandar em PDF ou foto? Obrigado!"
  - `ATRASADO`: "Olá, <razão social>. Aqui é da SheepContabil. Ainda não recebemos o extrato de <referência> da conta <banco ag/cc> — faltam <faltantesRotulo>. Consegue enviar hoje? Assim fechamos o mês no prazo. Obrigado!"
- `textarea` editável, botão "Copiar mensagem", link `https://wa.me/<digitos>?text=<encoded>` (só se houver telefone; senão aviso âmbar como na SC-20).
- "Confirmar cobrança" → server action `cobrarExtratoWhatsapp({ clienteId, contaBancariaId, referenciaInicio, referenciaFim })`:
  - cria `CobrancaExtrato` + `RegistroAuditoria` `EXTRATO_COBRADO` (`entidade: "CobrancaExtrato"`, `clienteId`, `descricao: "Cobrança de extrato (<referência>) enviada por WhatsApp para <razão social>"`);
  - `revalidatePath`. Fecha o modal; a linha passa a mostrar "Cobrado há Xd".

## 15. Tela de detalhe — `documento/[documentoId]/page.tsx` reconstruída

Mesmas funções (lançamentos, conferência, OFX, reprocessar), layout do zero no shell:

- `bg-tinta` + `<VeuAtmosferico>` + `<CabecalhoPortal>` + rodapé. `max-w-[88rem]`.
- **Cabeçalho escuro:** "← SC-01 · Extrato bancário" (link turquesa mono) · `nomeArquivo` em `font-titulo` grande · linha secundária: `razaoSocial` · conta (`banco — ag X c/c Y`) · competência · `<BadgeStatusDocumento>`.
- **Painel claro** `bg-nevoa/95` arredondado + sombra, grid 2 colunas em `lg` (`minmax(0,1fr)` cada), 1 coluna abaixo disso:
  - **Coluna esquerda — `VisualizadorArquivo`** (sticky `top-6`): PDF em `<iframe src="/modulos/sc-01/documento/{id}/arquivo#view=FitH">`; imagem em `<img>` dentro de um contêiner `overflow-auto` com botões de zoom (`scale` via estado) e arraste. Altura `min(80vh, …)`.
  - **Coluna direita:** `PainelLancamentos` reestilizado (tabela data/histórico/valor/confiança/status) → seção **"Conferência"** (cards `LinhaConferencia` reestilizados; `confirmarLancamento` passa a gravar `RegistroAuditoria` `LINHA_CONFERIDA` com `dadosAntes/Depois`) → seção **"Arquivo OFX"** (botão + `motivoBloqueio`) → **"Reprocessar"** quando `ERRO`.
- Estados vazio/erro reconstruídos no idioma visual (sem subtítulo).
- **Rota nova** `src/app/modulos/sc-01/documento/[documentoId]/arquivo/route.ts`:
  - `GET` autenticado (`obterSessao` + `filtrarModulosVisiveis` com `SC-01`, igual à rota do OFX);
  - `prisma.documentoEntrada.findUnique` → devolve `arquivo` (Bytes) com `Content-Type` = `mimeType`, `Content-Disposition: inline; filename="<nomeArquivo>"`, `Cache-Control: private, no-store`;
  - 401 sem sessão, 404 sem documento.
- **Rota OFX** (`.../ofx/route.ts`): ao servir com sucesso, grava `RegistroAuditoria` `OFX_BAIXADO` (`entidade: "DocumentoEntrada"`, `clienteId`, ator da sessão). Auditar num `GET` é intencional — é ação deliberada do usuário.

## 16. `SpecularButton` — brilho contido

`src/components/ui/SpecularButton.css`:

- `.sb` ganha `overflow: hidden` (o `border-radius` já recorta).
- `.sb__fx` passa de `inset: calc(-1 * var(--sb-bleed))` para `inset: 0`, `padding: 0`, `border-radius: inherit`; remove a máscara `xor`/`exclude` (não há mais anel) — o brilho vira um `radial-gradient` simples centrado no cursor, recortado pelo botão.
- `--sb-bleed` e o cálculo de `--sb-mx/my` no `.tsx` perdem o `+ BLEED` (o offset passa a ser relativo à borda do botão). `BLEED` some do componente.
- `.sb::after` (filete permanente da borda) é mantido — é o "detalhe em repouso".
- `@media (prefers-reduced-motion)` inalterado.

Vale para todo o portal (SC-11, SC-20, home, login).

## 17. Remoção de subtítulos

Remover o `<p>` descritivo imediatamente abaixo do `<h1>`/`<h2>` de seção em:

- **SC-01:** `page.tsx` (cabeçalho + seções), `documento/[id]/page.tsx`, todos os modais novos e o `PainelLancamentos`.
- **SC-11:** `modulos/sc-11/page.tsx` e telas correlatas.
- **SC-20:** `modulos/sc-20/page.tsx` (parágrafo do cabeçalho), `PainelSc20`, modais.
- **Home:** `app/page.tsx` (subtítulo do herói/lista de módulos, se houver).

Títulos, códigos de módulo, selos, contadores e textos de estado vazio **permanecem**. Grep guia: `mt-3 max-w-xl font-texto`, `mt-1 … text-grafite`, `max-w-prose font-texto text-sm`.

## 18. Extratos de exemplo — `docs/extratos-exemplo/`

2 arquivos HTML print-first (abre no navegador → Ctrl+P → A4 limpo; `@media print` com margens e sem sombra). Instituições **fictícias** (nada que imite banco real). Titular = cliente do seed para casar com a auto-detecção.

- **`banco-meridiano.html`** — "Banco Meridiano S.A." (fictício). Retrato, tarja superior, caixa de resumo (saldo anterior / créditos / débitos / saldo atual), tabela monoespaçada com zebra: `Data · Histórico · Documento · Valor (R$) · Saldo (R$)`, valores com sinal, saldo acumulado. Cabeçalho com **"Período: 01/08/2026 a 31/08/2026"**, agência/conta, CNPJ fictício, rodapé "SAC 0800…" e "documento sem valor fiscal". ~14 lançamentos. Titular: "Alfa Comércio de Materiais Ltda".
- **`cooperativa-sulcampos.html`** — "Cooperativa de Crédito Sul-Campos — SICSUL" (fictício). Retrato serifado minimalista, colunas separadas `Histórico · Data · Nº Doc · Débito · Crédito` (sem sinal), **sem** coluna de saldo, numeração de página, texto legal diferente. Cabeçalho **"Período: 01/08/2026 a 29/08/2026"** — cobre só até o dia 29 para exercitar o fluxo **"Atrasado"** (faltam 30 e 31). Titular: "Beta Consultoria Empresarial Ltda".

Não entram no seed nesta rodada (§24).

## 19. Cron

`src/app/api/cron/sc-01/route.ts` — contrato inalterado (valida `CRON_SECRET`, `executarModulo("SC-01", "scheduler", processarExtratos)`, devolve `{ execucaoId, status, resumo, erro }`). Só a frequência muda em `vercel.json` (§3). O cron continua gravando em `Execucao` — é a rede de segurança da leitura automática.

## 20. Seed — `prisma/seed.ts`

- `seedClientes`: os 8 clientes ganham `periodicidadeExtrato` — 6 `MENSAL`, 2 `SEMANAL`; 1 fica `NULL` de propósito (status "Configurar"). `telefone` `+55…` em todos os que têm conta.
- `seedDocumentosEntrada`: manter os 4 fixtures atuais; ajustar `chegadaEm` e adicionar `periodoInicio`/`periodoFim`/`competencia` para compor, no mês de referência:
  - 1 conta **Em dia** (extrato do mês inteiro, todas as linhas `CONFIRMADO`);
  - 1 conta **Aguardando envio** (sem extrato do mês de referência, hoje = dataEntrega — datas relativas);
  - 1 conta **Atrasado** (extrato cobrindo só parte do mês → `faltantesRotulo` populado; ou nenhum extrato e `hoje > dataEntrega`);
  - 1 conta **Conferência** (extrato processado com ≥ 1 linha `PENDENTE_REVISAO`).
- Opcional: 1 `CobrancaExtrato` antiga para uma das contas atrasadas (mostra "Cobrado há Xd").
- Sem script de reset dedicado nesta etapa (a SC-01 não tem o volume da SC-20); `prisma migrate reset` cobre.

## 21. Estrutura de arquivos

```
prisma/
  schema.prisma                              # enum PeriodicidadeExtrato; ALTER Cliente/DocumentoEntrada; model CobrancaExtrato
  migrations/<ts>_sc01_controle_entrega/      # 100% aditiva
  seed.ts                                     # periodicidade + cenário dos 4 status
vercel.json                                   # cron SC-01 → diário
docs/extratos-exemplo/
  banco-meridiano.html
  cooperativa-sulcampos.html
src/lib/documentos/
  conferencia.ts / conferencia.test.ts        # LIMIAR_CONFIANCA = 1
  formato-documentos.ts                       # tomConfianca ajustado
  dias-uteis.ts / dias-uteis.test.ts          # feriados fixos + móveis (puro)
  cobertura.ts / cobertura.test.ts            # união de intervalos, dias faltantes (puro)
  periodicidade.ts / periodicidade.test.ts    # derivarStatus, periodoReferencia, dataEntrega (puro)
  filtros-documentos.ts / .test.ts            # filtrar/ordenar documentos (puro)
  historico.ts / historico.test.ts            # AcaoAuditoriaDocumento, rótulos, acento (puro)
  deteccao-cabecalho.ts / .test.ts            # chamada IA leve + match com cadastro
  extrator-extrato.ts                         # prompt reescrito + período no retorno da tool
  processar-sc01.ts / processar-sc01.test.ts  # grava período/competência + auditoria
  consultas-sc01.ts / consultas-sc01.test.ts  # listarControleEntrega, listarDocumentos(competencia),
                                              #   obterDocumentoComLancamentos, listarHistoricoDocumentos
  acoes-sc01.ts                               # enviarDocumentos, detectarCabecalho, configurarCliente,
                                              #   cobrarExtratoWhatsapp, confirmarLancamento(+auditoria),
                                              #   reprocessarDocumento, excluirDocumento(+auditoria)
src/lib/certificados/
  consultas.ts                                # listarHistorico/obterPerfilCliente: where.entidade escopado
src/components/documentos/
  PainelControleSc01.tsx                      # orquestra a aba Controle
  TabelaControleEntrega.tsx
  SeloStatusExtrato.tsx / .test.tsx
  PainelDocumentos.tsx                        # orquestra a aba Documentos (toolbar + tabela)
  TabelaDocumentos.tsx                        # colunas + ordenação + arquivo clicável
  FiltrosAuditoriaDocumentos.tsx
  TimelineAuditoria.tsx                       # ou import de certificados/TimelineHistorico
  ModalEnviarExtratos.tsx
  BlocoUploadExtrato.tsx
  ModalConfigurarCliente.tsx
  ModalCobrarExtrato.tsx
  VisualizadorArquivo.tsx
  PainelLancamentos.tsx / LinhaConferencia.tsx / BadgeStatusDocumento.tsx   # reestilizados p/ o shell
src/components/ui/
  SpecularButton.css                          # brilho contido
src/app/modulos/sc-01/
  page.tsx                                    # shell + abas Controle/Documentos/Auditoria
  documento/[documentoId]/page.tsx            # reconstruída
  documento/[documentoId]/arquivo/route.ts    # streama os bytes (nova)
  documento/[documentoId]/ofx/route.ts        # + auditoria OFX_BAIXADO
  historico/relatorio/route.ts                # CSV da auditoria (nova)
src/app/api/cron/sc-01/route.ts               # inalterado no contrato
src/app/modulos/sc-11/… , src/app/modulos/sc-20/… , src/app/page.tsx        # remoção de subtítulos
README.md                                     # seção SC-01 reescrita
```

Removidos: `src/components/documentos/FormularioUploadDocumento.tsx` (+ teste), o uso de `BotaoProcessar` para "pendentes" (o componente fica, serve ao "Reprocessar").

## 22. Identidade visual

UI nova segue a identidade fixada (README, "A MARCA SHEEPCONTABIL"), já em utilitários Tailwind:

- **Paleta (só estes 7):** petróleo `#10505F` primário/marca; turquesa `#1FA69A` ação/sucesso/link/estado; âmbar `#E8A33D` atenção/pendência (Aguardando, Conferência); tinta `#0B1A20` texto e fundo escuro; grafite `#5A7078` texto secundário e bordas (status "Configurar"); névoa `#EEF3F4` superfícies; **carmim `#C4453D` só erro/falha** (Atrasado, LEITURA_FALHOU, validação).
- **Tipografia:** `font-titulo` (Archivo 600–800) em títulos e números de destaque; `font-texto` (IBM Plex Sans) em texto e formulário; `font-codigo` (IBM Plex Mono) em datas, valores, agência/conta e contadores.
- **Execução:** aba Controle como fila de trabalho (selo de status, agrupamento por cliente, respiro), visualizador do extrato lado a lado com a conferência na tela de detalhe, estados vazios com uma frase de caráter. Sem fonte nova, sem cor fora dos tokens.
- A skill `frontend-design` é invocada antes de escrever cada componente na fase de implementação.

## 23. Testes

TDD, Vitest, padrão do repo:

- **Puro:** `dias-uteis` (Páscoa/Carnaval/Corpus por ano conhecido, feriado que cai no fim de semana, primeiro dia útil do mês/semana); `cobertura` (união com sobreposição/encostado, buracos no meio e nas pontas, rótulo); `periodicidade` (cada linha da tabela de precedência, `SEMANAL` acumulado, `periodoReferencia` mensal/semanal, `dataEntrega` com/sem `diaEntregaExtrato`); `conferencia` (`0.999 → PENDENTE_REVISAO`, `1 → CONFIRMADO`); `filtros-documentos`; `historico` (rótulo/acento por ação).
- **Integração (Postgres local):** `processar-sc01` (grava `periodoInicio/Fim/competencia`; `LEITURA_CONCLUIDA`/`LEITURA_FALHOU`; classificação com limiar 1); `consultas-sc01` (`listarControleEntrega` cobre os 4 status + `NAO_CONFIGURADO`; `listarDocumentos` filtra competência; `listarHistoricoDocumentos` filtros + paginação + escopo de `entidade`); escopo novo da `listarHistorico` da SC-20 (não vê eventos de `DocumentoEntrada`).
- **`@testing-library/react`:** `SeloStatusExtrato` (5 rótulos), `BlocoUploadExtrato` (anexo dispara detecção; preenche/edita; erro por bloco), `ModalEnviarExtratos` (adicionar/remover bloco; bloqueia envio sem cliente resolvido), `ModalConfigurarCliente` (rótulo do dia muda por periodicidade; validação de range), `TabelaDocumentos` (ordenação por coluna; link do arquivo), `VisualizadorArquivo` (iframe p/ PDF, img + zoom p/ imagem).
- **Render/estado leve:** `SpecularButton` (glow não ultrapassa o `getBoundingClientRect` do botão — checar `inset` computado).

## 24. Critérios de aceite

- [ ] Enviar 1+ extratos pelo modal cria os documentos e a leitura roda sozinha; sem botão "Processar pendentes".
- [ ] Ao anexar um arquivo cujo cabeçalho é legível, Cliente e Banco vêm preenchidos e editáveis; ilegível → seleção manual, envio bloqueado até resolver.
- [ ] Aba Controle mostra uma linha por conta, agrupada por cliente, com status correto entre Em dia / Aguardando envio / Atrasado / Conferência (e "Configurar" quando falta periodicidade).
- [ ] Linha "Atrasado" indica **quais dias** faltam; "Conferência" reflete linhas `PENDENTE_REVISAO`.
- [ ] Botão WhatsApp aparece só em Aguardando/Atrasado, abre `wa.me` com a mensagem certa e registra a cobrança (aparece na auditoria e como "Cobrado há Xd").
- [ ] "Configurar cliente" grava periodicidade/telefone/dia e registra auditoria.
- [ ] Aba Documentos: filtro no mês atual por padrão, busca/status/banco, ordenação por coluna; a célula Arquivo abre o PDF/JPG em nova aba.
- [ ] Aba Auditoria: eventos da SC-01 com ator e diff; filtros + paginação; CSV respeita os filtros. A aba Histórico da SC-20 **não** mostra eventos da SC-01.
- [ ] Tela de detalhe reconstruída no shell, com o extrato original ao lado dos lançamentos; conferência, OFX e reprocessar seguem funcionando; OFX só libera com todas as linhas `CONFIRMADO`.
- [ ] `confianca < 1` sempre vai para conferência; `confianca = 1` confirma sozinho; sem ramificação por formato.
- [ ] Botão especular: o brilho não passa da borda do botão em nenhum tom/variante.
- [ ] Nenhuma tela de SC-01/SC-11/SC-20/home tem parágrafo-subtítulo abaixo do título.
- [ ] `docs/extratos-exemplo/*.html` imprimem em A4 limpo; um cobre o mês inteiro, o outro só até o dia 29.
- [ ] Migração aplica sobre banco não-vazio sem backfill destrutivo; `prisma migrate reset` + seed reproduz os 4 status.

## 25. Fora de escopo

- Disparo transacional real de WhatsApp/e-mail ao cliente (o modal abre `wa.me`; a entrega é manual).
- CRUD completo de cliente (o modal cobre só periodicidade/telefone/dia).
- Feriados regionais/municipais; jornada/horário comercial configurável.
- Plugar os HTML de exemplo no seed / gerar versões PDF via `gerar-fixtures.ts`.
- Detecção de dias faltantes por contagem de lançamento (decidido: só pelo período declarado).
- Uma linha por semana para clientes `SEMANAL` (usa-se a semana não resolvida mais antiga + contador).
- Reprocessamento em lote; fila/priorização de extração; limite de custo de IA.
- Script de reset dedicado da SC-01.
- Mudanças em SC-11/SC-20 além do escopo de `entidade` na auditoria e da remoção de subtítulos.
