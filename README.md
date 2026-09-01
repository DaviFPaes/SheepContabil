# Portal SheepContabil

Portal de automações da SheepContabil — desafio técnico de processo seletivo (Sheep Technology). Caso e empresa fictícios; dados sintéticos.

## Rodando localmente

Pré-requisitos: Node.js 24+, Docker Desktop rodando.

```bash
cp .env.example .env
# SESSION_SECRET e CRON_SECRET: rode o comando abaixo duas vezes, uma para
# cada variável, e cole cada resultado no lugar certo no .env:
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"

npm install
docker compose up -d db
npx prisma migrate dev
npx prisma db seed
npm run dev
```

Abra `http://localhost:3000`.

## Credenciais de demonstração

| Perfil | E-mail | Senha |
|---|---|---|
| Administrador | admin@sheepcontabil.com.br | AdminSheep#2026 |
| Operador (setor Processos) | operador.processos@sheepcontabil.com.br | OperadorSheep#2026 |
| Operador (setor BPO Saúde — vê o SC-11) | operador.saude@sheepcontabil.com.br | OperadorSheep#2026 |

## Testes

```bash
npm test
```

Requer o Postgres local rodando e migrado (`docker compose up -d db` + `npx prisma migrate dev`) — `execucao.test.ts` fala com o banco de verdade, então sem o Docker de pé esse arquivo falha com um erro de conexão em vez de um aviso claro.

## Deploy

Produção: **[sheep-contabil.vercel.app](https://sheep-contabil.vercel.app)** — Vercel (build a partir do `master`) + Supabase (Postgres).

Banco no Supabase expõe duas connection strings, e cada uma vai para uma env var diferente:

| Env var (Vercel) | String do Supabase | Para quê |
|---|---|---|
| `DATABASE_URL` | **Transaction pooler** — porta `6543`, usuário `postgres.<ref>`, host `...pooler.supabase.com` | App em runtime (serverless) |
| `DIRECT_URL` | **Session pooler** — porta `5432`, usuário `postgres.<ref>`, host `...pooler.supabase.com` | `prisma migrate deploy` no build (o transaction pooler não roda migração) |

> Não usar a conexão direta (`db.<ref>.supabase.co`) em nenhuma das duas: ela é só IPv6 e o build/runtime da Vercel não alcança. Os dois poolers são IPv4.

Também setar na Vercel: `SESSION_SECRET`, `CRON_SECRET` (hex de 32 bytes cada), `ANTHROPIC_API_KEY` (a partir do SC-01).

O `build` roda `prisma migrate deploy && next build`, então cada push no `master` aplica as migrações pendentes no Supabase antes de publicar. O seed **não** roda no deploy — é aplicado uma vez, manualmente, apontando `DATABASE_URL` para a conexão direta do Supabase e rodando `npx prisma db seed`.

Mudança de env var na Vercel só passa a valer no **próximo deploy** (Redeploy manual ou novo push).

## Módulos

### SC-20 — Vencimento de certificado digital (Etapa 1)

Fila de trabalho dos certificados digitais da carteira. Cada certificado tem um **bucket** de proximidade do vencimento, recalculado todo dia:

| Bucket | Dias para vencer | Aparece no Kanban |
|---|---|---|
| `OK` | mais de 60 | não |
| `D60` | 8 a 60 | sim |
| `D7` | 4 a 7 | sim |
| `D3` | 0 a 3 | sim |
| `VENCIDO` | já venceu | sim |
| `RENOVADO` | tem substituto | sim, por 7 dias após a renovação |

**Tabela ↔ Kanban** (toggle acima da tabela, preferência salva por usuário no `localStorage`). A tabela lista tudo; o Kanban tem 7 colunas derivadas dos dados — sem arrastar cards, a posição vem do bucket e dos avisos. Clique num card abre o **perfil do cliente** num modal (dados, certificados e histórico filtrado), sem sair da aba.

O **cron diário** `/api/cron/sc-20` (05:00 `America/Sao_Paulo` = 08:00 UTC) e o botão **Atualizar** rodam a mesma rotina: recalculam o bucket de cada certificado ativo, gravam um `RegistroAuditoria` a cada **transição** e criam uma `NotificacaoInApp` para cada usuário que enxerga o módulo (ADMIN ou OPERADOR de **Processos**) quando um certificado **entra** numa faixa mais urgente. Idempotente no dia — rodar várias vezes não duplica aviso. O **sino** no cabeçalho agrupa os avisos por tipo + dia e leva ao Kanban na coluna certa.

**Novo certificado** é um botão → modal (cliente, tipo `e-CNPJ`/`e-CPF`/`NF-e`, titular, emissão, validade, observação). O checkbox *"é renovação"* vincula o certificado anterior, desativa-o e o move para `RENOVADO` num único passo, auditado nas duas pontas.

Aba **Histórico**: timeline de auditoria com filtros (cliente, evento, período), paginação e **exportação CSV** (`/modulos/sc-20/historico/relatorio`, respeita os filtros).

**Envio de e-mail ao cliente é só interface nesta etapa** — o botão *"Enviar avisos"* e o modal de confirmação existem, mas confirmar não dispara nada (aviso *"não disponível nesta etapa"*). As colunas *"Avisado"* e o ícone de bounce são alimentados pelo seed. A fila real de envio (`EnviadorEmail`, status, webhook de bounce, movimentação automática do card) fica para a Etapa 2.

**Seed:** `npm run seed:sc20:reset` recria só a carteira sintética do SC-20 (60 clientes `@example.com`, ~100 certificados cobrindo as 7 colunas, metade de `D60`/`D7` já avisada com 5 bounces, ~6 meses de auditoria, notificações não lidas). É idempotente. `prisma migrate reset` aplica as migrações e chama o seed completo (que inclui `seedSc20`).

### SC-01 — Conversão de extrato bancário para OFX

Caixa de entrada de documentos (`DocumentoEntrada`, compartilhada com o SC-11). O operador sobe um extrato em **PDF ou foto** (JPG/PNG) para um cliente + conta bancária; o botão **Processar pendentes** (ou o cron mensal `/api/cron/sc-01`, dia 2 às 08:00 UTC) manda cada documento para a **API multimodal da Anthropic** (`claude-opus-5`, sem OCR separado), que devolve os lançamentos `{data, histórico, valor}` com **confiança por linha**.

Linhas com confiança `< 0.85` entram numa **fila de conferência** — com o trecho original ao lado — e precisam ser confirmadas (ou corrigidas) manualmente. **O download do OFX só libera quando não há mais nenhuma linha em conferência.** O arquivo gerado é **OFX 1.0.2 (SGML)**, formato que os softwares contábeis brasileiros importam.

Processamento é **granular por documento**: se um extrato falha (ilegível, IA fora do ar), só ele vira `ERRO`; os outros do lote seguem.

**Precisa de `ANTHROPIC_API_KEY`.** Sem ela, processar um documento o marca como `ERRO` com "IA indisponível" — o resto do portal continua funcionando.

Fronteira mockada: o "sistema contábil" que importaria o OFX não existe — a entrega é o arquivo `.ofx` para download.

Fixtures de demonstração em `prisma/fixtures/` (3 PDFs com leiautes diferentes + 1 foto em JPEG) são gerados por `npm run fixtures` e carregados pelo seed.

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

## Suposições registradas

- Extratos bancários (SC-01) chegam em PDF nativo ou em foto (JPEG/PNG) — não em PDF escaneado sem OCR embutido; a leitura usa a API multimodal da Anthropic diretamente sobre o documento, sem etapa separada de OCR.
- NFS-e (SC-11) chega em XML.
- "Sistema de tarefas" e "sistema contábil" citados no catálogo do desafio são inteiramente mockados dentro deste portal — não há integração externa real em nenhum dos 4 módulos escolhidos.
- O papel `OPERADOR` do seed está vinculado a um único setor, para demonstrar a segregação de visão.
- SC-20 calcula `diasRestantes` e os buckets contra o "hoje" em **UTC**. No fuso de São Paulo (UTC-3), entre ~21:00 e a meia-noite um certificado pode ser classificado num bucket um dia mais urgente do que o calendário local indicaria — aceitável para um recálculo diário.
- SC-20 Etapa 1: o envio transacional de e-mail ao cliente entra só como interface (sem lógica) por decisão do cliente do módulo; o certificado "renovado" some do Kanban 7 dias após a renovação; o `RegistroAuditoria` é um modelo genérico usado só pelo SC-20 nesta etapa.

## Onde entraria o acesso real

- `ANTHROPIC_API_KEY` no `.env` — chave real da Anthropic, usada pelos módulos SC-01 e SC-11 quando forem implementados.
- `DATABASE_URL`/`DIRECT_URL` em produção apontam para o Supabase, não para o Postgres local.
- `CRON_SECRET` protege as rotas de disparo agendado (Vercel Cron) contra chamadas externas não autorizadas.

## Estado atual

A fundação do portal está no ar (ver **Deploy**): autenticação própria (sessão em cookie httpOnly, JWT assinado), proteção de rotas por middleware, cabeçalho com identidade visual da SheepContabil, motor genérico de execução de módulos (`executarModulo`/`listarHistorico`, com histórico e tratamento de erro) e a home com o catálogo de módulos filtrado por papel e setor.

A entrega é de **3 módulos**: SC-20 (Controle sistematizado), SC-01 e SC-11 (Agentes de IA). O SC-18 (RPA) foi cortado por tempo — a natureza RPA fica sem cobertura (ver a spec de design, §14). Ele continua listado no catálogo com `implementado: false` e nunca aparece na home.

**SC-20** (Vencimento de certificado digital) está implementado e visível na home — ver **Módulos** acima. SC-01 e SC-11 seguem com `implementado: false`. Cada módulo é um plano de execução próprio; a flag correspondente só passa a `true` quando o módulo está pronto.

## Documentação de design

- [Spec de design](docs/superpowers/specs/2026-08-27-portal-sheepcontabil-design.md)
- [Plano de implementação — fundação](docs/superpowers/plans/2026-08-27-fundacao-portal.md)
