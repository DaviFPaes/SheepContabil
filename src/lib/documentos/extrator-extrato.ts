import Anthropic from "@anthropic-ai/sdk";

const MODELO = "claude-opus-5";

export class IaIndisponivelError extends Error {
  constructor(
    mensagem = "IA indisponível. Configure ANTHROPIC_API_KEY para processar documentos.",
  ) {
    super(mensagem);
    this.name = "IaIndisponivelError";
  }
}

export type LinhaExtraida = {
  data: string; // ISO yyyy-mm-dd
  historico: string;
  valor: number; // negativo = débito/saída
  confianca: number; // 0..1
  trechoOriginal?: string;
};

export type ExtratorExtrato = (arquivo: {
  mimeType: string;
  base64: string;
}) => Promise<LinhaExtraida[]>;

export function criarExtratorFake(linhas: LinhaExtraida[]): ExtratorExtrato {
  return async () => linhas;
}

const FERRAMENTA = {
  name: "registrar_lancamentos",
  description:
    "Registra todas as linhas de movimentação encontradas no extrato bancário.",
  input_schema: {
    type: "object" as const,
    properties: {
      linhas: {
        type: "array",
        items: {
          type: "object",
          properties: {
            data: {
              type: "string",
              description: "Data do lançamento em ISO yyyy-mm-dd.",
            },
            historico: { type: "string" },
            valor: {
              type: "number",
              description:
                "Valor em reais. Negativo para débito/saída, positivo para crédito/entrada.",
            },
            confianca: {
              type: "number",
              description: "Sua confiança nesta linha, de 0 a 1.",
            },
            trechoOriginal: {
              type: "string",
              description: "O trecho literal do extrato de onde a linha foi lida.",
            },
          },
          required: ["data", "historico", "valor", "confianca"],
        },
      },
    },
    required: ["linhas"],
  },
};

const INSTRUCAO = `Você recebe um extrato bancário brasileiro (PDF ou foto). Extraia TODOS os lançamentos, um por linha de movimentação. Para cada um:
- data em ISO yyyy-mm-dd
- historico: a descrição do lançamento
- valor em reais: NEGATIVO para débito/saída, POSITIVO para crédito/entrada
- confianca de 0 a 1: quão seguro você está da leitura DAQUELA linha (leiaute ambíguo, dígito borrado na foto, valor cortado → reduza a confiança)
- trechoOriginal: o texto literal de onde leu

Ignore saldos, cabeçalhos e totais — só as movimentações. Chame a ferramenta registrar_lancamentos uma vez, com todas as linhas.`;

export const extrairExtratoComClaude: ExtratorExtrato = async ({
  mimeType,
  base64,
}) => {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new IaIndisponivelError();

  const client = new Anthropic({ apiKey });

  const blocoArquivo =
    mimeType === "application/pdf"
      ? {
          type: "document" as const,
          source: {
            type: "base64" as const,
            media_type: "application/pdf" as const,
            data: base64,
          },
        }
      : {
          type: "image" as const,
          source: {
            type: "base64" as const,
            media_type: mimeType as "image/jpeg" | "image/png",
            data: base64,
          },
        };

  let mensagem;
  try {
    const stream = client.messages.stream({
      model: MODELO,
      max_tokens: 32000,
      thinking: { type: "enabled", budget_tokens: 10000 },
      tools: [FERRAMENTA],
      messages: [
        {
          role: "user",
          content: [blocoArquivo, { type: "text", text: INSTRUCAO }],
        },
      ],
    });
    mensagem = await stream.finalMessage();
  } catch (erro) {
    if (erro instanceof Anthropic.AuthenticationError) {
      throw new IaIndisponivelError("Chave da Anthropic inválida.");
    }
    if (erro instanceof Anthropic.RateLimitError) {
      throw new Error(
        "A IA está sobrecarregada no momento. Tente processar de novo em alguns minutos.",
      );
    }
    if (erro instanceof Anthropic.APIError) {
      throw new Error(
        `A IA não conseguiu processar o documento (erro ${erro.status}). Verifique se o arquivo está legível.`,
      );
    }
    throw erro;
  }

  const toolUse = mensagem.content.find((b) => b.type === "tool_use");
  if (toolUse && toolUse.type === "tool_use") {
    const input = toolUse.input as { linhas?: LinhaExtraida[] };
    return input.linhas ?? [];
  }

  // Fallback: tenta achar um JSON com "linhas" no texto.
  const texto = mensagem.content
    .filter((b): b is Anthropic.TextBlock => b.type === "text")
    .map((b) => b.text)
    .join("\n");
  const match = texto.match(/\{[\s\S]*"linhas"[\s\S]*\}/);
  if (match) {
    try {
      const obj = JSON.parse(match[0]) as { linhas?: LinhaExtraida[] };
      return obj.linhas ?? [];
    } catch {
      /* cai no erro abaixo */
    }
  }
  throw new Error(
    "A IA não retornou os lançamentos de forma estruturada para este documento.",
  );
};
