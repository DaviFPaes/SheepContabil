# Extratos de exemplo para impressão

Esta pasta contém dois extratos bancários de exemplo, usados para testar o
fluxo de upload de imagem (JPG) e a auto-detecção de cabeçalho do módulo
SC-01 (Controle de Entrega de Documentos).

## Para que servem

O SC-01 aceita como entrada tanto PDFs quanto fotos (JPG) de extratos
bancários impressos em papel. Antes de validar esse caminho com extratos
reais de clientes, é útil testar com documentos sintéticos: imprimir em
papel, fotografar com o celular e subir a foto no fluxo de importação,
conferindo se:

- a extração de cabeçalho reconhece corretamente titular, agência, conta e
  banco (usado para casar o documento com o cliente/conta certos na
  carteira);
- a leitura do período de cobertura funciona — inclusive o caso em que o
  extrato **não cobre o mês inteiro** (ver `cooperativa-sulcampos.html`,
  que vai só até 29/08 e deve disparar a detecção de "dias finais
  faltando");
- a tabela de lançamentos é extraída de forma consistente mesmo com dois
  leiautes bem diferentes entre si (fonte, colunas, presença ou não de
  saldo acumulado).

## Os dois arquivos

| Arquivo | Instituição (fictícia) | Titular | Período | Particularidade |
|---|---|---|---|---|
| `banco-meridiano.html` | Banco Meridiano S.A. | Alfa Comércio de Materiais Ltda | 01/08/2026 a 31/08/2026 | Mês completo; tabela monoespaçada com coluna de saldo acumulado |
| `cooperativa-sulcampos.html` | Cooperativa de Crédito Sul-Campos — SICSUL | Beta Consultoria Empresarial Ltda | 01/08/2026 a 29/08/2026 | Cobre só até o dia 29 (faltam os últimos 2 dias do mês, de propósito); colunas separadas de débito/crédito, sem saldo acumulado |

Os títulos das empresas (Alfa Comércio de Materiais Ltda e Beta Consultoria
Empresarial Ltda) coincidem propositalmente com clientes já cadastrados no
seed de desenvolvimento, para que o teste de casamento automático
cliente/conta funcione de ponta a ponta.

**Ambas as instituições são inteiramente fictícias.** Nomes, CNPJs,
agências e números de conta foram inventados para este teste e não
representam nenhum banco ou cooperativa de crédito real.

## Como usar

1. Abra o arquivo `.html` desejado direto no navegador (duplo clique ou
   `Ctrl+O`).
2. Pressione `Ctrl+P` para imprimir.
   - Para testar o upload de **PDF**: escolha "Salvar como PDF" no destino
     da impressão.
   - Para testar o upload de **JPG** (o caso principal deste teste):
     imprima em papel numa impressora normal, depois tire uma foto do
     papel com o celular (boa luz, sem sombra em cima do texto, folha
     bem enquadrada) e suba essa foto no fluxo de importação do SC-01.
3. Confira, na tela de importação, se o cabeçalho (titular, agência,
   conta, período) e os lançamentos foram lidos corretamente, e se o caso
   do período incompleto (`cooperativa-sulcampos.html`) é sinalizado como
   esperado.

Cada arquivo já está configurado para caber em uma página A4 (`@page {
size: A4; margin: 14mm }`), com texto grande e alto contraste para
sobreviver bem à foto.
