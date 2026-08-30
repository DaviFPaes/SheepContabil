# Portal SheepContabil — Design

Data: 2026-08-27
Prazo de entrega: 2026-09-01
Contexto: desafio técnico de processo seletivo (automação de processos, caso fictício SheepContabil).

**Atualização 2026-08-30:** o SC-18 (RPA) saiu do escopo por tempo. A entrega passa a ser 3 módulos — SC-20, SC-01, SC-11 — priorizando profundidade em dois agentes de IA reais + um controle sistematizado, em vez de espalhar. Consequência assumida: a natureza **RPA fica sem cobertura**. Seções abaixo já refletem os 3.

## 1. Escopo

Três processos do catálogo:

| Código | Nome | Natureza | Complexidade | Frequência catalogada |
|---|---|---|---|---|
| SC-20 | Vencimento de certificado digital | Controle sistematizado | Baixa | Mensal |
| SC-01 | Conversão de extrato bancário para OFX | Agente de IA | Alta | Mensal |
| SC-11 | Presunção correta nas notas de serviço da área médica | Agente de IA | Alta | Mensal |

Das três naturezas do desafio, ficam cobertas Agente de IA e Controle sistematizado; RPA não (era o SC-18, cortado — ver §14).

## 2. Stack

- **Next.js 14+ (App Router, TypeScript)** — frontend e backend no mesmo projeto.
- **Prisma** sobre **Postgres (Supabase)**.
- **Autenticação própria**: sessão JWT (`jose`) em cookie httpOnly, senha com hash `bcryptjs`. Evita depender do Auth.js v5 (segue em beta; a v4 estável não foi desenhada para App Router).
- **Anthropic API (Claude)** para os módulos de Agente de IA (SC-01, SC-11) — chamada real, com a chave fornecida via variável de ambiente.
- **Deploy: Vercel**, com **Vercel Cron** para os disparos agendados.
- **Tailwind CSS v4** para estilização, com os tokens de paleta e as fontes da seção 06 do desafio (Archivo, IBM Plex Sans, IBM Plex Mono) mapeados como variáveis de tema.
- **Postgres local via Docker Compose** para desenvolvimento/testes, mesmo schema aplicado depois no Supabase em produção — evita depender de rede até o Supabase durante o desenvolvimento.

## 3. Modelo de dados (núcleo)

Comum a todos os módulos:

- `Usuario` — email, senha (hash), papel (`ADMIN` | `OPERADOR`), setor.
- `Cliente` — empresa fictícia da carteira (CNPJ sintético válido em formato, razão social, atividade).
- `Execucao` — histórico universal: código do módulo (string, ex. `"SC-20"`), quem disparou (usuário ou `scheduler`), início, fim, status (`SUCESSO` | `ERRO` | `PARCIAL`), resumo do resultado, mensagem de erro legível.

O catálogo de módulos (código, nome, natureza, setor dono, rota, `implementado: boolean`) não é uma tabela — é fixo e conhecido em tempo de build, então vive como um registro estático no código (`src/lib/modulos-catalogo.ts`). `Execucao` referencia o módulo pelo código, sem FK. A flag `implementado` começa `false` e vira `true` no plano que efetivamente entrega aquele módulo — a home só lista o que está `implementado`, conforme exigido pelo desafio. O SC-18 permanece listado no catálogo com `implementado: false` (documenta o processo do catálogo que não foi entregue); nunca aparece na home.

Específico por módulo, detalhado na seção 5.

## 4. Motor de execução comum

Cada módulo implementa uma função `run(input) -> Resultado`. Essa função é chamada:

- por uma Server Action, quando alguém aperta "rodar agora" na tela do módulo;
- por uma rota de API protegida por segredo (`CRON_SECRET` em header), quando o Vercel Cron dispara no horário configurado.

Em ambos os casos, o motor:

1. Cria um registro `Execucao` com status inicial.
2. Executa `run()` dentro de um `try/catch`.
3. Em sucesso, marca `SUCESSO` e grava o resumo do resultado.
4. Em falha, marca `ERRO` (ou `PARCIAL` se parte do lote foi concluída) e grava uma mensagem legível — nunca o stack trace cru.

## 5. Módulos

### 5.1 Padrão comum de "caixa de entrada" (SC-01 e SC-11)

SC-01 e SC-11 são catalogados como frequência **Mensal**, mas dependem de um arquivo chegar — não faz sentido um cron "gerar" um extrato ou uma nota. Resolvido com uma tabela `DocumentoEntrada` (tipo: `EXTRATO` | `NFSE`, cliente, arquivo, status `PENDENTE` | `PROCESSADO`, data de chegada):

- O seed popula entradas com datas espalhadas ao longo do mês simulado.
- Um cron mensal varre as pendentes e processa em lote.
- O operador também pode subir um arquivo avulso a qualquer momento e rodar na hora.
- Processamento é por documento: cada `DocumentoEntrada` só vira `PROCESSADO` após sucesso individual. Uma falha no meio do lote não reprocessa os que já deram certo.

### 5.2 SC-01 — Extrato bancário → OFX

Fluxo: upload (ou item pendente da caixa de entrada) de um PDF **ou de uma foto** (JPEG/PNG) do extrato → o documento vai direto para a API multimodal da Anthropic (sem etapa separada de OCR: o Claude lê PDF e imagem nativamente) → Claude interpreta as linhas em `{data, histórico, valor}` com confiança por linha, tolerando qualquer leiaute de banco e qualquer um dos dois formatos → gera arquivo OFX válido para download.

- `Lancamento` (documentoEntradaId, data, histórico, valor, confiança, status `CONFIRMADO` | `PENDENTE_REVISAO`).
- Linhas de baixa confiança aparecem numa fila de conferência ao lado do resultado, com o trecho original, para confirmação manual antes de considerar o item pronto para importar.
- Fronteira mockada: o "sistema contábil" que importaria o OFX não existe de verdade — a entrega do módulo é o arquivo OFX para download.
- Seed: pelo menos 3 extratos sintéticos em PDF com leiautes de banco diferentes, mais 1 exemplo em foto (imagem de um extrato, simulando o cliente fotografando o papel), para demonstrar que a solução generaliza tanto entre leiautes quanto entre formatos de entrada — esse é o argumento central do módulo, citado como risco no catálogo.

### 5.3 SC-11 — Presunção nas notas de serviço médicas

Fluxo: upload/entrada de XML de NFS-e → parse dos itens → cada item passa pela lista de termos editável → o que não bate em termo nenhum é classificado pelo Claude com base na descrição.

- `TermoPresuncao` (termo, alíquota) — CRUD simples para o admin editar (ex.: "exame de imagem", "raio-x", "tomografia", "ressonância" → 8%; sem match → 32%).
- `NotaServico` (cliente, número, XML original) e `ItemNota` (descrição, valor, alíquota aplicada, origem da decisão `REGRA` | `IA` | `MANUAL`, justificativa/termo que levou à conclusão).
- Cada item guarda explicitamente por que recebeu aquela alíquota — exigência direta do catálogo.
- Seed: 2-3 XMLs de NFS-e, incluindo um caso com muitos itens (referência ao "387 itens" citado no catálogo), para estressar o fluxo.

### 5.4 SC-18 — Tarefas encadeadas por tipo de processo

**Cortado do escopo em 2026-08-30 (ver §14).** Era o único módulo RPA. O desenho previsto: `Tarefa` (cliente, tipo, responsável, prazo, status, `tarefaOrigemId`) + `FluxoDefinicao` editável pelo admin; ao concluir uma tarefa, o motor cria as etapas seguintes numa transação; painel mostra onde cada caso está na corrente.

### 5.5 SC-20 — Vencimento de certificado digital

- `Certificado` (cliente, dataValidade).
- `AvisoCertificado` (certificadoId, dataAviso, faixaDeUrgência no momento) — guarda o que já foi comunicado.
- Cron mensal (mais botão sob demanda) busca certificados vencendo em até 60 dias e só gera aviso novo quando a faixa de urgência mudou desde o último aviso (evita repetir a lista inteira e virar ruído).
- Painel com certificados por cliente, dias restantes e badge de urgência.
- Seed: certificados cobrindo todas as faixas (vencido, 5, 20, 45, 90 dias), para a demo mostrar o painel completo sem esperar tempo real passar.

## 6. Autenticação e papéis

- Sessão própria: login via Server Action valida e-mail/senha (bcrypt) contra `Usuario`, gera um JWT assinado (`jose`, HS256) com `{ usuarioId, papel, setor, email }` e grava em cookie httpOnly (`sameSite=lax`, `secure` em produção), validade de 8h. Middleware do Next.js verifica o cookie em toda rota exceto `/login`; sessão ausente ou inválida redireciona para `/login`.
- `ADMIN`: enxerga todos os módulos e o CRUD de configuração (termos de presunção, fluxos de tarefas).
- `OPERADOR`: enxerga apenas os módulos do setor a que está vinculado.
- Seed cria pelo menos 1 usuário de cada papel.

## 7. Agendamento

| Módulo | Disparo sob demanda | Disparo automático |
|---|---|---|
| SC-20 | Botão "rodar agora" | Cron mensal |
| SC-01 | Upload avulso + botão "rodar agora" | Cron mensal varrendo a caixa de entrada |
| SC-11 | Upload avulso + botão "rodar agora" | Cron mensal varrendo a caixa de entrada |

Crons definidos em `vercel.json`, batendo em rotas de API protegidas por um segredo (`CRON_SECRET` em header; 401 se não bater).

## 8. Dados sintéticos (seed)

`prisma/seed.ts`, idempotente (upsert), populando:

- 1 usuário admin + 1 usuário operador (setor definido).
- ~8-10 clientes fictícios, CNPJ sintético com dígito verificador válido em formato, nomes inventados, atividades variadas.
- Certificados cobrindo todas as faixas de urgência (SC-20).
- 3 extratos bancários em PDF com leiautes diferentes, mais 1 em foto (imagem) (SC-01).
- 2-3 XMLs de NFS-e, incluindo um caso com muitos itens (SC-11).
- Lista inicial de termos de presunção (SC-11).

## 9. Repositório e deploy

- Repositório público no GitHub, commits pequenos por etapa (fundação → módulo a módulo, ordem definida na seção 10), mensagens explicando o porquê.
- `.env.example` documentando as variáveis necessárias (`DATABASE_URL`, `SESSION_SECRET`, `ANTHROPIC_API_KEY`, `CRON_SECRET`); segredo real nunca committado.
- README com: como rodar localmente, como popular o seed, suposições assumidas por módulo, e onde apontar "aqui entraria o acesso real" em cada fronteira mockada.
- Deploy na Vercel, banco no Supabase (Postgres) de produção, variáveis de ambiente configuradas na Vercel.

## 10. Ordem de implementação

1. Fundação: schema Prisma, autenticação, shell do portal (home listando módulos por papel), motor de execução comum, histórico de execução genérico. **(feito)**
2. SC-20 (mais simples) — valida o padrão ponta a ponta (módulo → execução → histórico → painel). **(feito — mergeado no `master` local)**
3. SC-01 (extrato bancário → OFX).
4. SC-11 (mais complexo, por último, já com o padrão de IA e caixa de entrada testado a partir do SC-01).

## 11. Testes

Foco em lógica de negócio pura, sem e2e/UI dado o prazo:

- Cálculo de mudança de faixa de urgência de certificado (SC-20).
- Gerador de OFX a partir de transações estruturadas (SC-01).
- Motor de matching de termos de presunção (SC-11).

E2E fica registrado como "o que eu faria com mais tempo" para a apresentação.

## 12. Tratamento de erro e resiliência

- Erro conhecido (PDF ilegível, XML malformado, LLM indisponível) vira mensagem legível na tela; erro desconhecido cai num genérico com detalhe técnico escondido atrás de "ver mais".
- Processamento em lote é granular por documento (seção 5.1): falha no meio não derruba o que já deu certo.

## 13. Suposições registradas

- Extratos chegam em PDF (nativo ou escaneado) ou em foto (JPEG/PNG); a leitura dos dois formatos é feita pela API multimodal da Anthropic, sem pipeline de OCR dedicado.
- NFS-e chega em XML no padrão ABRASF simplificado (descrição do serviço em texto livre, valor do item).
- O "sistema contábil" citado no catálogo (que importaria o OFX do SC-01) é inteiramente mockado dentro do próprio portal — não há integração externa real em nenhum dos 3 módulos.
- Papel `OPERADOR` do seed é vinculado a um único setor para demonstrar a segregação de visão; múltiplos setores por operador fica fora de escopo.

## 14. Fora de escopo

- **SC-18 (Tarefas encadeadas por tipo de processo, RPA)** — cortado em 2026-08-30 por tempo. Consequência assumida: a natureza RPA não é coberta pela entrega. Desenho previsto preservado no §5.4 para referência.
- SC-13 (download em lote no portal nacional) e demais processos do catálogo não selecionados.
- Testes end-to-end automatizados.
- Múltiplos ambientes (staging/produção) — apenas produção na Vercel.
