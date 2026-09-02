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
