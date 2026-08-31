# SC-11 — Presunção correta nas notas de serviço da área médica — Design

Data: 2026-08-31
Prazo de entrega: 2026-09-01
Contexto: 3º e último módulo do desafio SheepContabil. Segundo agente de IA real, reaproveitando a "caixa de entrada", o motor de execução e o sistema visual já entregues no SC-20 e no SC-01.

Referência: spec da fundação [2026-08-27-portal-sheepcontabil-design.md](2026-08-27-portal-sheepcontabil-design.md) — seções 3, 4, 5.1, 5.3, 6, 7, 11, 12.

---

## 1. Objetivo

Uma NFS-e de prestador de serviço médico traz vários itens. Sob o **lucro presumido**, cada item se enquadra numa das duas bases de presunção:

- **8%** — serviços hospitalares e os a eles equiparados (Lei 9.249/95, art. 15, §1º, III, "a"): exames de imagem, análises clínicas, terapias, procedimentos.
- **32%** — regra geral dos demais serviços (consultas, perícias, laudos avulsos, honorários não enquadrados).

O módulo lê o XML da nota, classifica **cada item** numa das duas bases, registra **por que** cada item recebeu aquela base, e entrega um relatório consolidado para download. Casos que a classificação automática não resolve com segurança caem numa **fila de conferência** para decisão manual antes de fechar.

## 2. Escopo

Entra:

- Caixa de entrada de NFS-e (reuso de `DocumentoEntrada`, `tipo: NFSE`).
- Parse de XML NFS-e no formato ABRASF simplificado (§6).
- Motor puro de casamento de termos (§5).
- Classificação por IA dos itens sem match, em lote (§7).
- Fila de conferência + revisão manual por item (§8).
- Consolidado por base de presunção + relatório CSV para download, travado até a conferência zerar (§9).
- Tela dedicada de gestão dos termos de presunção, com auditoria de reclassificações (§10).
- Página do módulo, detalhe da nota, rota de cron mensal, flag de catálogo (§§11–12).
- Seed: termos iniciais + 2–3 XMLs sintéticos, sendo um com ~387 itens (§14).

Não entra: §20.

## 3. Modelo de dados

Import do Prisma Client: `@/generated/prisma/client`. Migração nova: `<timestamp>_sc11_presuncao`.

### 3.1 Enums novos

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
```

`AliquotaPresuncao` é um par fixo que o código conhece. Um mapa em `src/lib/presuncao/presuncao-termos.ts` converte para número:
`PERCENTUAL_ALIQUOTA = { P8: 8, P32: 32 }`. Nenhum outro valor de presunção é válido no módulo.

`StatusItemNota` é dedicado — **não** reusa o `StatusLancamento` do SC-01, para manter os dois módulos desacoplados (uma futura terceira situação num deles não deve vazar para o outro).

### 3.2 Models novos

```prisma
model TermoPresuncao {
  id        String            @id @default(cuid())
  termo     String            @unique
  aliquota  AliquotaPresuncao
  criadoEm  DateTime          @default(now())
}

model AuditoriaTermo {
  id               String            @id @default(cuid())
  termoId          String?           // null quando o termo foi removido depois
  termoTexto       String            // snapshot do texto no momento da ação
  acao             AcaoAuditoria
  aliquotaAnterior AliquotaPresuncao? // null em CRIACAO
  aliquotaNova     AliquotaPresuncao? // null em REMOCAO
  autorEmail       String
  criadoEm         DateTime          @default(now())

  @@index([criadoEm])
}

model NotaServico {
  id                 String     @id @default(cuid())
  documentoEntradaId String     @unique
  documentoEntrada   DocumentoEntrada @relation(fields: [documentoEntradaId], references: [id], onDelete: Cascade)
  numero             String
  dataEmissao        DateTime
  valorTotal         Decimal    @db.Decimal(14, 2)
  itens              ItemNota[]
  criadoEm           DateTime   @default(now())
}

model ItemNota {
  id            String            @id @default(cuid())
  notaServicoId String
  notaServico   NotaServico       @relation(fields: [notaServicoId], references: [id], onDelete: Cascade)
  descricao     String
  valor         Decimal           @db.Decimal(14, 2)
  aliquota      AliquotaPresuncao
  origem        OrigemDecisao
  justificativa String            // termo que casou, raciocínio da IA (1 linha), ou "ajuste manual"
  confianca     Float?            // só quando origem = IA
  status        StatusItemNota    @default(CONFIRMADO)
  criadoEm      DateTime          @default(now())

  @@index([notaServicoId])
}
```

### 3.3 Relação inversa em `DocumentoEntrada`

Adicionar: `notaServico NotaServico?`.

### 3.4 Sem FK de `ItemNota` para `TermoPresuncao` — de propósito

O `ItemNota` guarda `aliquota` + `justificativa` como **snapshot do momento do processamento**. Reclassificar ou remover um termo depois **não** reescreve notas já processadas. A `AuditoriaTermo` é o registro que reconstrói o histórico ("esta nota ficou 8% porque foi classificada em 05/08, quando o termo 'tomografia' era 8%; virou 32% em 20/08 por fulano"). Só processamentos e reprocessamentos futuros usam o balde novo.

## 4. Fluxo de processamento

`src/lib/presuncao/processar-sc11.ts`, espelhando `processar-sc01.ts`.

### 4.1 `processarDocumento(documentoId, classificador?)`

1. Carrega `DocumentoEntrada` com `tipo = NFSE` e `status = PENDENTE`. Se não achar ou não estiver pendente, retorna sem efeito (idempotência).
2. `parsearNfse(xmlString)` → `{ numero, dataEmissao, valorTotal, itens: [{ descricao, valor }] }`. XML malformado → lança `XmlInvalidoError` (mensagem legível).
3. Para cada item: `casarTermo(descricao, termos)`.
   - Com match → `ItemNota { origem: REGRA, aliquota: <do termo>, justificativa: 'termo "<texto>"', status: CONFIRMADO }`.
   - Sem match → entra na lista "para a IA".
4. Os itens sem match vão ao `classificador` **em chunks de 40, sequenciais** (§7). Cada resultado → `ItemNota { origem: IA, aliquota, confianca, justificativa: <raciocínio 1 linha>, status: confianca < LIMIAR_CONFIANCA ? PENDENTE_REVISAO : CONFIRMADO }`.
5. Tudo numa `prisma.$transaction`: cria `NotaServico` (com `dataEmissao` convertida via `new Date(`${dataEmissao}T00:00:00Z`)`, padrão do SC-01) + todos os `ItemNota`; marca `DocumentoEntrada` como `PROCESSADO`, grava `processadoEm`, limpa `erro`.
6. `catch` (XML inválido, IA indisponível, chunk que falhou, rate limit) → `DocumentoEntrada` vira `ERRO` com a mensagem legível. **Granularidade por nota**: uma nota ruim não derruba as outras do lote.

### 4.2 `processarNotas({ classificador? }) → ResultadoExecucao`

- Busca `DocumentoEntrada` `tipo = NFSE`, `status = PENDENTE`, ordenado por `chegadaEm asc`.
- Chama `processarDocumento` para cada.
- Relê os documentos do lote e monta o resumo: `"<n> nota(s) no lote: <x> processada(s), <y> com erro; <z> item(ns) em conferência"`.
- `status`: `PARCIAL` se `y > 0`, senão `SUCESSO`. (`ERRO` só se uma exceção escapar de `run()` — tratado pelo `executarModulo`.)

### 4.3 Contrato do classificador

```ts
export type ItemParaClassificar = { descricao: string };
export type ItemClassificado = {
  indice: number;            // posição no array recebido
  aliquota: AliquotaPresuncao;
  confianca: number;         // 0..1
  justificativa: string;     // 1 linha, por que essa base
};
export type ClassificadorItens =
  (itens: ItemParaClassificar[]) => Promise<ItemClassificado[]>;
```

`criarClassificadorFake(map | fn)` para os testes. O default de produção é `classificarComClaude` (§7).

## 5. Motor de casamento de termos (puro)

`src/lib/presuncao/presuncao-termos.ts` — é a unidade testável central citada na spec §11.

- `normalizar(s: string): string` — `toLowerCase()`, remove diacríticos (`normalize("NFD")` + tira `\p{Diacritic}`), colapsa espaços, `trim()`.
- `casarTermo(descricao, termos): { aliquota: AliquotaPresuncao; termo: string } | null`
  - Normaliza a descrição. Para cada termo, testa se `normalizar(termo)` é **substring** da descrição normalizada.
  - Zero matches → `null`.
  - Um match → esse.
  - Vários matches → o de **maior comprimento normalizado** (mais específico). Empate de comprimento → o que for `P32` (conservador: não concede a base reduzida sem um termo específico justificar).
- `PERCENTUAL_ALIQUOTA: Record<AliquotaPresuncao, number>` = `{ P8: 8, P32: 32 }`.
- `LIMIAR_CONFIANCA = 0.85` (mesmo valor do SC-01).
- `classificarStatusItem(confianca: number): StatusItemNota` — `< LIMIAR_CONFIANCA` → `PENDENTE_REVISAO`, senão `CONFIRMADO`.
- `consolidar(itens): { porBalde: { aliquota, qtdItens, somaValor, basePresuncao }[]; totalValor; totalBase }` — agrupa por `aliquota`; `basePresuncao = somaValor * PERCENTUAL_ALIQUOTA[aliquota] / 100`. Arredonda a base a 2 casas.
- `notaPodeExportar(itens): boolean` — `itens.length > 0 && itens.every(i => i.status === "CONFIRMADO")`.
- `motivoBloqueioRelatorio(itens): string | null` — `null` se pode exportar; senão `"<n> item(ns) ainda em conferência"` ou `"Nenhum item classificado"`.

Todas as funções operam sobre tipos estruturais mínimos (`{ status }`, `{ aliquota, valor }`), sem tocar Prisma.

## 6. Parser de XML NFS-e

`src/lib/presuncao/parsear-nfse.ts` — puro. Dependência nova: **`fast-xml-parser`** (runtime; lida com namespace `ns2:`, entidades, CDATA — hand-roll disso quebra em nota real).

### 6.1 Formato aceito (ABRASF simplificado — nosso, documentado no README)

```xml
<?xml version="1.0" encoding="UTF-8"?>
<NFSe>
  <InfNfse>
    <Numero>2026-000123</Numero>
    <DataEmissao>2026-08-07</DataEmissao>
    <PrestadorServico><RazaoSocial>Clínica Vida Plena Diagnósticos</RazaoSocial></PrestadorServico>
    <TomadorServico><RazaoSocial>Alfa Comércio de Materiais Ltda</RazaoSocial></TomadorServico>
    <ListaItens>
      <Item><Discriminacao>Tomografia computadorizada de crânio</Discriminacao><Valor>450.00</Valor></Item>
      <Item><Discriminacao>Consulta médica em consultório</Discriminacao><Valor>200.00</Valor></Item>
    </ListaItens>
    <ValorTotal>650.00</ValorTotal>
  </InfNfse>
</NFSe>
```

O parser tolera prefixo de namespace (`<ns2:InfNfse>`), atributos ignorados, `ListaItens` com 1 ou N `Item`, e espaços/quebras. `Valor` aceita `1234.56` ou `1234,56`.

### 6.2 Saída e erros

`parsearNfse(xml: string): NfseParseada` onde `NfseParseada = { numero: string; dataEmissao: string /* ISO yyyy-mm-dd */; valorTotal: number; itens: { descricao: string; valor: number }[] }`.

Lança `XmlInvalidoError` (mensagem legível, ex.: `"XML da NFS-e ilegível ou fora do formato esperado."`) quando: não parseia, falta `InfNfse`, `ListaItens` vazia, ou algum `Item` sem `Discriminacao`/`Valor` numérico.

## 7. Classificador via Claude

`src/lib/presuncao/classificador-itens.ts`.

- SDK: `@anthropic-ai/sdk` (já no projeto). Modelo `claude-opus-5`. `client.messages.stream(...) + .finalMessage()`, `thinking: { type: "adaptive" }`, `max_tokens` folgado (ex. 16000 por chunk de 40 itens).
- Sem `ANTHROPIC_API_KEY` → lança `IaIndisponivelError` (de `src/lib/ia.ts`, §17.3).
- Ferramenta `registrar_classificacoes`, chamada uma vez por chunk:

```jsonc
{
  "name": "registrar_classificacoes",
  "input_schema": {
    "type": "object",
    "properties": {
      "classificacoes": {
        "type": "array",
        "items": {
          "type": "object",
          "properties": {
            "indice":       { "type": "integer", "description": "índice do item na lista recebida (base 0)" },
            "aliquota":      { "type": "string", "enum": ["8", "32"] },
            "confianca":     { "type": "number", "description": "0 a 1" },
            "justificativa": { "type": "string", "description": "1 frase: por que essa base de presunção" }
          },
          "required": ["indice", "aliquota", "confianca", "justificativa"]
        }
      }
    },
    "required": ["classificacoes"]
  }
}
```

- Instrução (resumo): recebe uma lista numerada de descrições de itens de NFS-e médica; para cada uma decide **8%** (serviço hospitalar/equiparado — exame, imagem, análise clínica, terapia, procedimento) ou **32%** (consulta, perícia, laudo avulso, honorário não enquadrado); devolve `indice`, `aliquota`, `confianca` (reduz quando a descrição é genérica/ambígua) e `justificativa` de 1 frase. Chama `registrar_classificacoes` uma vez com todas.
- Pós-processamento: mapeia `"8"→P8`, `"32"→P32`; casa `indice` de volta ao item; item que a IA não devolveu → `confianca: 0`, `aliquota: P32`, `justificativa: "IA não classificou este item"`, cai para conferência.
- Mapeamento de erros da Anthropic (via helper compartilhado de `src/lib/ia.ts`): `AuthenticationError` → `IaIndisponivelError("Chave da Anthropic inválida.")`; `RateLimitError` → `Error("A IA está sobrecarregada. Tente processar de novo em alguns minutos.")`; `APIError` → `Error("A IA não conseguiu classificar os itens (erro <status>).")`.
- `classificarComClaude` recebe já um chunk (≤40). O laço de chunking vive no `processar-sc11.ts` (§4.1 passo 4): se um chunk lança, a exceção sobe e a nota inteira vira `ERRO`.

## 8. Fila de conferência e revisão manual

- Item com `status = PENDENTE_REVISAO` aparece na **fila de conferência** no detalhe da nota: descrição, valor, base sugerida pela IA (badge), confiança, justificativa.
- Ação por item (`revisarItem`): confirmar a base sugerida **ou** trocar para a outra base. Em ambos os casos o item vira `origem: MANUAL`, `status: CONFIRMADO`, `confianca: null`, e a `justificativa` passa a `"ajuste manual — <base> confirmada por <email>"` (ou `"reclassificado de <x> para <y> por <email>"`).
- Enquanto houver qualquer item `PENDENTE_REVISAO`, o relatório fica **travado** (§9).
- Itens `REGRA` e `IA`-alta-confiança não entram na fila, mas são visíveis na tabela completa de itens (read-only nesta entrega — edição livre de item confirmado fica fora de escopo, §20).

## 9. Consolidado e relatório (fronteira mockada)

No detalhe da nota, abaixo da tabela de itens:

- **Consolidado** (`consolidar`): por balde 8% / 32% → nº de itens, Σ valor, base de presunção (Σ valor × %); e os totais da nota.
- **Botão "Baixar relatório"** — desabilitado com o motivo (`motivoBloqueioRelatorio`) enquanto a conferência não zera; habilitado depois.
- Rota `GET /modulos/sc-11/nota/[documentoId]/relatorio`:
  - Guarda de sessão + acesso ao SC-11.
  - `404` se o documento/nota não existe; `403` (JSON `{ erro }`) se `!notaPodeExportar`.
  - `200` com CSV: separador `;`, UTF-8 **com BOM** (abre certo no Excel-BR). Cabeçalho `descricao;valor;aliquota;origem;justificativa`, uma linha por item, depois linhas em branco + o consolidado (`BASE 8%;...`, `BASE 32%;...`, `TOTAL;...`). `Content-Disposition: attachment; filename="nfse-<numero>-presuncao.csv"`.
- Fronteira: não existe "lançar no sistema fiscal" de verdade — a entrega do módulo é o CSV + o consolidado auditável na tela. Documentado no README.

## 10. Tela de termos de presunção + auditoria

Rota dedicada **`/modulos/sc-11/termos`**, só `ADMIN` (operador → `redirect("/modulos/sc-11")`).

- **Tabela de termos**: `termo` · badge da base atual · **reclassificar** (alterna 8%⇄32%, `editarTermo`) · **remover** (`removerTermo`, com `confirm`).
- **Formulário "Adicionar termo"**: texto + select de base (`criarTermo`). Rejeita `termo` cujo `normalizar()` colida com um existente ("Termo equivalente já cadastrado.").
- **Histórico de auditoria** (abaixo, mais recente primeiro): data/hora, autor, termo, e a mudança — `criado como 8%` · `8% → 32%` · `removido (era 32%)`.
- Cada mutação grava um `AuditoriaTermo` **na mesma `$transaction`** da alteração do `TermoPresuncao`:
  - `criarTermo` → `acao: CRIACAO`, `aliquotaNova` preenchida, `aliquotaAnterior: null`, `termoId` do novo.
  - `editarTermo` (reclassificar) → `acao: RECLASSIFICACAO`, `aliquotaAnterior` + `aliquotaNova`. No-op se a base não mudou (não grava auditoria).
  - `removerTermo` → `acao: REMOCAO`, `aliquotaAnterior` preenchida, `termoId: null`, `termoTexto` com o snapshot.
- Na página do módulo (§11), o `ADMIN` vê um botão **"Gerenciar termos de presunção"** que leva aqui. O operador não vê o botão.

## 11. Páginas, rotas e navegação

Padrão do SC-01 (guarda de sessão → `redirect("/login")`; sem acesso → `redirect("/")`; `obterModulo("SC-11")` sem `!`).

### 11.1 `src/app/modulos/sc-11/page.tsx` (server)

`Promise.all([ listarHistorico("SC-11"), listarNotas(), listarClientesParaUpload(), listarTermos() ])`.
`<CabecalhoPortal>` + `<ModuloPageLayout>`:
- `acoes`: `<BotaoProcessar acao={processarPendentes} rotulo="Processar pendentes" />` + microcópia; e, se `sessao.papel === "ADMIN"`, o link "Gerenciar termos de presunção".
- `conteudo`: seção "Enviar NFS-e" (`<FormularioUploadNota>` — aceita só `.xml` / `text/xml` / `application/xml`, ≤ 5 MB, cliente obrigatório) + seção "Notas" (`<TabelaNotas>` — cliente, número/arquivo, status, nº de itens, em conferência, link pro detalhe).

### 11.2 `src/app/modulos/sc-11/nota/[documentoId]/page.tsx` (server)

`params` como `Promise`. `obterNotaComItens(documentoId)` → `notFound()` se `null`. Shape devolvido: `{ documentoId, status, erro, cliente: { razaoSocial }, numero, dataEmissao, itens: ItemDetalhe[], consolidado, podeExportar, motivoBloqueio }` (campos de nota nulos enquanto `status !== PROCESSADO`).
- Cabeçalho: cliente, número, emissão, `<BadgeStatusDocumento>`, link "voltar".
- Se `status = PENDENTE`: `<BotaoProcessar acao={processarUma} />` (com `<input type="hidden" name="documentoId">`), sem tabela.
- Se `status = ERRO`: mostra `erro` num box legível + botão reprocessar (também `processarUma`).
- Se `status = PROCESSADO`: `<FilaRevisaoItens>` (se houver pendências) + `<PainelItens>` (tabela completa + consolidado) + `<BotaoBaixarRelatorio href bloqueado motivo>`.

`processarUma` (server action) embrulha `executarModulo("SC-11", sessao.email, …)` chamando `processarDocumento(documentoId)` e devolvendo `{ status: "SUCESSO", resumo }` — mesmo padrão do `processarUm` do SC-01; revalida a página do módulo e o detalhe.

### 11.3 `src/app/modulos/sc-11/termos/page.tsx` (server, admin) — §10

### 11.4 `src/app/modulos/sc-11/nota/[documentoId]/relatorio/route.ts` — §9

### 11.5 `src/app/api/cron/sc-11/route.ts`

`cronAutorizado(request.headers.get("authorization"), process.env.CRON_SECRET)` → 401 se não bater. Senão `executarModulo("SC-11", "scheduler", () => processarNotas())` e devolve `{ execucaoId, status, resumo, erro }`. `catch` → 500 `{ erro: "Falha ao executar o módulo." }`.

## 12. Agendamento e catálogo

- `vercel.json` → acrescentar ao array `crons`: `{ "path": "/api/cron/sc-11", "schedule": "0 8 3 * *" }` (dia 3, 08:00 UTC — depois do SC-01 no dia 2).
- `src/lib/modulos-catalogo.ts` → no objeto `SC-11`, `implementado: false` → `true`. É a última coisa a mudar, quando o resto está verde.

## 13. Acesso e papéis

- `SC-11` é do setor **`BPO Saúde`**. `ADMIN` vê tudo; `OPERADOR` vê só o do próprio setor (`filtrarModulosVisiveis`).
- O seed atual só tem um operador (`Processos`), que não enxergaria o SC-11. Adicionar no seed **`operador.saude@sheepcontabil.com.br`** (papel `OPERADOR`, setor `BPO Saúde`, senha no mesmo padrão dos outros) para a demo cobrir a segregação de visão também neste módulo.
- Server actions e a rota do relatório repetem a guarda `exigirAcessoSc11()` (sessão + `filtrarModulosVisiveis` inclui `SC-11`). A tela de termos exige, além disso, `papel === "ADMIN"`.

## 14. Seed / dados sintéticos

`prisma/seed.ts`, idempotente (upsert / `deleteMany`+`createMany` por marcador), acrescenta:

- `seedUsuarios()` — + o operador `BPO Saúde` (§13).
- `seedTermosPresuncao()` — lista inicial (upsert por `termo`):
  - **8%**: `exame de imagem`, `raio-x`, `radiografia`, `tomografia`, `ressonancia magnetica`, `ultrassonografia`, `ecografia`, `densitometria ossea`, `mamografia`, `eletrocardiograma`, `endoscopia`, `colonoscopia`, `analises clinicas`, `patologia clinica`, `hemodialise`, `quimioterapia`, `radioterapia`, `fisioterapia`, `hemograma`.
  - Tudo que não casa cai em **32%** (consulta, perícia, laudo avulso, junta médica, honorário).
- `seedNotasNfse()` — insere 2–3 `DocumentoEntrada` `tipo NFSE`, `status PENDENTE`, `chegadaEm` espalhado no mês, lendo XMLs de `prisma/fixtures/`:
  - `nfse-pequena.xml` — ~6 itens, mistura clara de 8% e 32%.
  - `nfse-media.xml` — ~20 itens, alguns ambíguos (forçam a IA e a fila de conferência).
  - `nfse-grande.xml` — **~387 itens** (caso de estresse citado no catálogo), a maioria casando em termo, algumas dezenas sem match para exercitar o chunking.
- `prisma/fixtures/gerar-fixtures-nfse.ts` — rodado por um novo script `npm run fixtures:nfse` (`tsx prisma/fixtures/gerar-fixtures-nfse.ts`, ao lado do `fixtures` do SC-01, sem mexer nele). Script sem placeholders que gera os 3 XMLs a partir de um pool de descrições de serviços médicos plausíveis + valores. Os XMLs ficam **commitados**.

## 15. Tratamento de erro e resiliência

- `XmlInvalidoError`, `IaIndisponivelError` e erros de rate limit viram **mensagem legível** no `documento.erro` e na UI — nunca stack trace (spec §12).
- Lote granular por nota (§4.2): falha numa nota não reprocessa nem derruba as outras; o lote fecha `PARCIAL`.
- `processarDocumento` é idempotente: só age em `PENDENTE`. Reprocessar uma nota `PROCESSADO` não é oferecido na UI (evita descartar revisão manual); `ERRO` tem botão de reprocessar.
- Sem `ANTHROPIC_API_KEY`: notas com itens sem match viram `ERRO` "IA indisponível"; o resto do portal segue. Notas cujos itens **todos** casaram em termo processam normalmente mesmo sem chave.

## 16. Testes (Vitest)

Foco em lógica pura + integração de banco local (sem e2e), padrão dos módulos anteriores. `fileParallelism: false` já vale.

- `presuncao-termos.test.ts` (puro) — `normalizar` (acento, caixa, espaço); `casarTermo` (zero/um/vários matches, mais específico vence, empate → 32%); `consolidar` (soma e base por balde, arredondamento); `notaPodeExportar` / `motivoBloqueioRelatorio`; `classificarStatusItem` no limiar.
- `parsear-nfse.test.ts` (puro) — XML válido → estrutura; com namespace `ns2:`; 1 item e N itens; `Valor` com vírgula; malformado / `InfNfse` ausente / item sem valor → `XmlInvalidoError`.
- `classificador-itens.test.ts` — parse do `tool_use` → `ItemClassificado[]`; item faltando no retorno → cai pra conferência; sem `ANTHROPIC_API_KEY` → `IaIndisponivelError`. (Sem chamada real à API.)
- `processar-sc11.test.ts` (integração) — item casa termo → `REGRA`/`CONFIRMADO`; sem match + fake de IA → `IA`; confiança baixa → `PENDENTE_REVISAO`; XML ruim → documento `ERRO`, os outros do lote seguem; chunking chamado com ≥2 lotes quando > 40 sem match; idempotência (rodar 2x não duplica).
- `consultas-sc11.test.ts` (integração) — `listarNotas` agrega contagem/conferência; `obterNotaComItens` monta o consolidado; `listarAuditoriaTermos` ordena desc.
- `acoes-sc11.test.ts` (integração) — `criarTermo`/`editarTermo`/`removerTermo` gravam `AuditoriaTermo` com a ação e as alíquotas certas; `editarTermo` sem mudança de base não gera auditoria; `revisarItem` vira `MANUAL`/`CONFIRMADO`.
- `relatorio` — shape do CSV (BOM, separador, linhas do consolidado); 403 quando há item em conferência.
- Componentes — `BadgeAliquota` (P8/P32 → rótulo e classe de cor); `TabelaTermos` (render + botão reclassificar).

## 17. Estrutura de arquivos

```
prisma/
  schema.prisma                              # + 4 enums, 4 models, relação em DocumentoEntrada
  migrations/<ts>_sc11_presuncao/
  fixtures/
    gerar-fixtures-nfse.ts                   # NOVO — gera os 3 XMLs
    nfse-pequena.xml  nfse-media.xml  nfse-grande.xml
  seed.ts                                    # + operador BPO Saúde, seedTermosPresuncao(), seedNotasNfse()
vercel.json                                  # + cron sc-11
src/
  lib/
    ia.ts                                    # NOVO (§17.3) — IaIndisponivelError + mapErroAnthropic
    clientes.ts                              # NOVO (§17.3) — listarClientesParaUpload (movido do SC-01)
    presuncao/
      presuncao-termos.ts / .test.ts         # puro — matching, consolidação, limiar
      parsear-nfse.ts / .test.ts             # puro — XML → estrutura
      classificador-itens.ts / .test.ts      # ClassificadorItens, classificarComClaude, criarClassificadorFake
      processar-sc11.ts / .test.ts           # processarDocumento, processarNotas (integração)
      consultas-sc11.ts / .test.ts           # listarNotas, obterNotaComItens, listarTermos, listarAuditoriaTermos
      acoes-sc11.ts / .test.ts               # "use server": enviarNota, processarPendentes, processarUma,
                                             #   revisarItem, excluirNota, criarTermo, editarTermo, removerTermo
      formato-presuncao.ts                   # rótulos de balde/origem, formatarBRL, formatarDataUTC (reuso local)
  components/
    presuncao/
      BadgeAliquota.tsx / .test.tsx
      BadgeOrigemDecisao.tsx
      FormularioUploadNota.tsx               # "use client"
      TabelaNotas.tsx
      PainelItens.tsx                        # tabela de itens + consolidado
      FilaRevisaoItens.tsx                   # "use client"
      LinhaRevisaoItem.tsx                   # "use client"
      BotaoBaixarRelatorio.tsx
      TabelaTermos.tsx                       # "use client" — reclassificar inline
      FormularioTermo.tsx                    # "use client"
      HistoricoAuditoriaTermos.tsx
  app/
    modulos/sc-11/
      page.tsx
      termos/page.tsx                        # admin
      nota/[documentoId]/
        page.tsx
        relatorio/route.ts                   # GET CSV, 403 se travado
    api/cron/sc-11/route.ts
README.md                                    # + seção SC-11
```

### 17.3 Refactors compartilhados (pequenos, de propósito)

- `src/lib/ia.ts` — extrair `IaIndisponivelError` e o mapeamento de erros da Anthropic de `src/lib/documentos/extrator-extrato.ts` para cá; `extrator-extrato.ts` passa a reimportar. SC-11 usa o mesmo.
- `src/lib/clientes.ts` — mover `listarClientesParaUpload` de `consultas-sc01.ts` para cá; SC-01 reimporta. Evita o SC-11 importar de `documentos/`.

Ambos entram como passos próprios no plano, com `npm test` verde antes e depois.

## 18. Dependências novas

- `fast-xml-parser` (runtime) — parse do XML da NFS-e.
- Reuso: `@anthropic-ai/sdk` (SC-01), `zod`, Prisma.

## 19. Suposições registradas

- NFS-e chega em XML no formato ABRASF **simplificado** descrito em §6.1 (descrição do serviço em texto livre + valor por item). Variações municipais reais ficam fora — o README aponta onde entraria um parser por município.
- Só duas bases de presunção existem no domínio do módulo: 8% e 32%. IRPJ vs CSLL, adicionais e deduções ficam fora — o número entregue é a **base de presunção por item**, não o imposto final.
- O "sistema fiscal" que consumiria o relatório é mockado: a entrega é o CSV + o consolidado na tela.
- Um item confirmado (REGRA ou IA-alta-confiança) não é editável nesta entrega; só os que entram na fila de conferência têm ação manual.
- Reclassificar um termo vale só daqui pra frente; notas já processadas ficam como estavam (§3.4).

## 20. Fora de escopo

- Edição livre de item já confirmado fora da fila de conferência.
- Criar termo a partir de uma decisão manual na conferência ("aprender" o item).
- Parser de layouts municipais reais de NFS-e; leitura de NFS-e em PDF/imagem (só XML).
- IRPJ/CSLL, alíquotas efetivas, DAS/apuração — o módulo para na base de presunção.
- Auditoria de qualquer coisa além de mudança de termo (ex.: quem revisou cada item fica só na `justificativa`, sem tabela própria).
- Testes end-to-end automatizados.
