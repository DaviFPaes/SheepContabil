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

## Suposições registradas

- Extratos bancários (SC-01) chegam em PDF nativo ou em foto (JPEG/PNG) — não em PDF escaneado sem OCR embutido; a leitura usa a API multimodal da Anthropic diretamente sobre o documento, sem etapa separada de OCR.
- NFS-e (SC-11) chega em XML.
- "Sistema de tarefas" e "sistema contábil" citados no catálogo do desafio são inteiramente mockados dentro deste portal — não há integração externa real em nenhum dos 4 módulos escolhidos.
- O papel `OPERADOR` do seed está vinculado a um único setor, para demonstrar a segregação de visão.

## Onde entraria o acesso real

- `ANTHROPIC_API_KEY` no `.env` — chave real da Anthropic, usada pelos módulos SC-01 e SC-11 quando forem implementados.
- `DATABASE_URL` em produção aponta para o Supabase, não para o Postgres local.
- `CRON_SECRET` protege as rotas de disparo agendado (Vercel Cron) contra chamadas externas não autorizadas.

## Estado atual

A fundação do portal está pronta localmente apenas com a "casca" — o deploy é o próximo passo, ainda pendente: autenticação própria (sessão em cookie httpOnly, JWT assinado), proteção de rotas por middleware, cabeçalho com identidade visual da SheepContabil, motor genérico de execução de módulos (`executarModulo`/`listarHistorico`, com histórico e tratamento de erro) e a home com o catálogo de módulos filtrado por papel e setor.

Nenhum dos 4 módulos do catálogo (SC-01, SC-11, SC-18, SC-20) está implementado ainda — todos começam com `implementado: false`, então a home mostra "Nenhum módulo disponível para o seu perfil ainda." para qualquer usuário logado. Cada módulo vira um plano de execução próprio; a flag correspondente só passa a `true` quando o módulo é entregue de verdade.

## Documentação de design

- [Spec de design](docs/superpowers/specs/2026-08-27-portal-sheepcontabil-design.md)
- [Plano de implementação — fundação](docs/superpowers/plans/2026-08-27-fundacao-portal.md)
