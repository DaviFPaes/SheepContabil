import Anthropic from "@anthropic-ai/sdk";

/** IA fora do ar por configuração (sem chave) ou credencial inválida. */
export class IaIndisponivelError extends Error {
  constructor(
    mensagem = "IA indisponível. Configure ANTHROPIC_API_KEY para processar documentos.",
  ) {
    super(mensagem);
    this.name = "IaIndisponivelError";
  }
}

/**
 * Converte um erro cru do SDK da Anthropic numa mensagem legível.
 * `AuthenticationError` -> IaIndisponivelError (config); `RateLimitError` e
 * `APIError` -> Error com texto amigável; qualquer outra coisa volta como
 * veio (já é `Error`) ou embrulhada.
 */
export function traduzirErroAnthropic(erro: unknown): Error {
  if (erro instanceof Anthropic.AuthenticationError) {
    return new IaIndisponivelError("Chave da Anthropic inválida.");
  }
  if (erro instanceof Anthropic.RateLimitError) {
    return new Error(
      "A IA está sobrecarregada no momento. Tente processar de novo em alguns minutos.",
    );
  }
  if (erro instanceof Anthropic.APIError) {
    return new Error(
      `A IA não conseguiu processar o conteúdo (erro ${erro.status}). Verifique se o arquivo está legível.`,
    );
  }
  return erro instanceof Error ? erro : new Error("Falha inesperada na IA.");
}
