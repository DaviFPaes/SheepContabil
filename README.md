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

### SC-20 — Vencimento de certificado digital

Painel dos certificados digitais da carteira, classificados por faixa de urgência de vencimento:

| Faixa | Dias para vencer |
|---|---|
| `VENCIDO` | já venceu |
| `CRÍTICO` | 0 a 7 |
| `ALERTA` | 8 a 30 |
| `PRÓXIMO` | 31 a 60 |
| `OK` | mais de 60 (sem aviso) |

Ao rodar (botão **Rodar agora** ou cron mensal `/api/cron/sc-20`, dia 1 às 08:00 UTC), o módulo varre os certificados **já vencidos ou a até 60 dias de vencer** e cria um `AvisoCertificado` — com o texto pronto da mensagem — **só quando a faixa mudou** desde o último aviso daquele certificado. Isso evita repetir a lista inteira todo mês.

CRUD de certificados na própria página (cliente + data de validade). Visível para o `ADMIN` e para operadores do setor **Processos**.

Fronteira mockada: o `AvisoCertificado` guarda a mensagem, mas **não há envio real** — aqui entraria a integração com e-mail / sistema de avisos. A rota de cron é protegida por `CRON_SECRET` no header `Authorization: Bearer`.

### SC-01 — Conversão de extrato bancário para OFX

Caixa de entrada de documentos (`DocumentoEntrada`, compartilhada com o SC-11). O operador sobe um extrato em **PDF ou foto** (JPG/PNG) para um cliente + conta bancária; o botão **Processar pendentes** (ou o cron mensal `/api/cron/sc-01`, dia 2 às 08:00 UTC) manda cada documento para a **API multimodal da Anthropic** (`claude-opus-5`, sem OCR separado), que devolve os lançamentos `{data, histórico, valor}` com **confiança por linha**.

Linhas com confiança `< 0.85` entram numa **fila de conferência** — com o trecho original ao lado — e precisam ser confirmadas (ou corrigidas) manualmente. **O download do OFX só libera quando não há mais nenhuma linha em conferência.** O arquivo gerado é **OFX 1.0.2 (SGML)**, formato que os softwares contábeis brasileiros importam.

Processamento é **granular por documento**: se um extrato falha (ilegível, IA fora do ar), só ele vira `ERRO`; os outros do lote seguem.

**Precisa de `ANTHROPIC_API_KEY`.** Sem ela, processar um documento o marca como `ERRO` com "IA indisponível" — o resto do portal continua funcionando.

Fronteira mockada: o "sistema contábil" que importaria o OFX não existe — a entrega é o arquivo `.ofx` para download.

Fixtures de demonstração em `prisma/fixtures/` (3 PDFs com leiautes diferentes + 1 foto em JPEG) são gerados por `npm run fixtures` e carregados pelo seed.

## Suposições registradas

- Extratos bancários (SC-01) chegam em PDF nativo ou em foto (JPEG/PNG) — não em PDF escaneado sem OCR embutido; a leitura usa a API multimodal da Anthropic diretamente sobre o documento, sem etapa separada de OCR.
- NFS-e (SC-11) chega em XML.
- "Sistema de tarefas" e "sistema contábil" citados no catálogo do desafio são inteiramente mockados dentro deste portal — não há integração externa real em nenhum dos 4 módulos escolhidos.
- O papel `OPERADOR` do seed está vinculado a um único setor, para demonstrar a segregação de visão.
- SC-20 calcula `diasRestantes` e as faixas contra o "hoje" em **UTC**. No fuso de São Paulo (UTC-3), entre ~21:00 e a meia-noite um certificado pode ser classificado numa faixa um dia mais urgente do que o calendário local indicaria — aceitável para um aviso mensal.

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
