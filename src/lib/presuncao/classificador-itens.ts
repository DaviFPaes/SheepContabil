import Anthropic from "@anthropic-ai/sdk";
import { IaIndisponivelError, traduzirErroAnthropic } from "@/lib/ia";
import type { AliquotaPresuncao } from "./presuncao-termos";

const MODELO = "claude-opus-5";

export type ItemParaClassificar = { descricao: string };
export type ItemClassificado = {
  indice: number;
  aliquota: AliquotaPresuncao;
  confianca: number;
  justificativa: string;
};
export type ClassificadorItens = (
  itens: ItemParaClassificar[],
) => Promise<ItemClassificado[]>;

export function criarClassificadorFake(
  resolver: (itens: ItemParaClassificar[]) => ItemClassificado[],
): ClassificadorItens {
  return async (itens) => resolver(itens);
}

const FERRAMENTA = {
  name: "registrar_classificacoes",
  description:
    "Registra a base de presunção de cada item de NFS-e de serviço médico.",
  input_schema: {
    type: "object" as const,
    properties: {
      classificacoes: {
        type: "array",
        items: {
          type: "object",
          properties: {
            indice: {
              type: "integer",
              description: "Índice do item na lista recebida (base 0).",
            },
            aliquota: {
              type: "string",
              enum: ["8", "32"],
              description:
                "8 para serviço hospitalar/equiparado (exame, imagem, análise clínica, terapia, procedimento); 32 para os demais (consulta, perícia, laudo avulso, honorário não enquadrado).",
            },
            confianca: {
              type: "number",
              description:
                "0 a 1. Reduza quando a descrição for genérica ou ambígua.",
            },
            justificativa: {
              type: "string",
              description: "Uma frase: por que essa base.",
            },
          },
          required: ["indice", "aliquota", "confianca", "justificativa"],
        },
      },
    },
    required: ["classificacoes"],
  },
};

const INSTRUCAO = `Você recebe uma lista NUMERADA de descrições de itens de uma NFS-e emitida por prestador de serviço médico. Para CADA item, decida a base de presunção do lucro presumido:
- 8%: serviços hospitalares e os a eles equiparados — exames (imagem, laboratório, análises clínicas), terapias, procedimentos, diagnósticos.
- 32%: regra geral dos demais serviços — consulta, perícia, junta médica, laudo/honorário avulso não enquadrado.
Para cada item devolva: indice (o número da lista, base 0), aliquota ("8" ou "32"), confianca de 0 a 1 (menor quando a descrição é vaga), e justificativa de uma frase. Chame a ferramenta registrar_classificacoes uma vez, com todos os itens.`;

function paraAliquota(v: string): AliquotaPresuncao {
  return v === "8" ? "P8" : "P32";
}

export const classificarComClaude: ClassificadorItens = async (itens) => {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new IaIndisponivelError();
  if (itens.length === 0) return [];

  const client = new Anthropic({ apiKey });
  const lista = itens
    .map((it, i) => `${i}. ${it.descricao}`)
    .join("\n");

  let mensagem;
  try {
    const stream = client.messages.stream({
      model: MODELO,
      max_tokens: 16000,
      thinking: { type: "adaptive" },
      tools: [FERRAMENTA],
      messages: [
        { role: "user", content: [{ type: "text", text: `${INSTRUCAO}\n\n${lista}` }] },
      ],
    });
    mensagem = await stream.finalMessage();
  } catch (erro) {
    throw traduzirErroAnthropic(erro);
  }

  const toolUse = mensagem.content.find((b) => b.type === "tool_use");
  const bruto =
    toolUse && toolUse.type === "tool_use"
      ? ((toolUse.input as { classificacoes?: unknown[] }).classificacoes ?? [])
      : [];

  const porIndice = new Map<number, ItemClassificado>();
  for (const c of bruto as Record<string, unknown>[]) {
    const indice = Number(c.indice);
    if (!Number.isInteger(indice) || indice < 0 || indice >= itens.length) continue;
    porIndice.set(indice, {
      indice,
      aliquota: paraAliquota(String(c.aliquota)),
      confianca: Math.max(0, Math.min(1, Number(c.confianca) || 0)),
      justificativa: String(c.justificativa ?? "").trim() || "Sem justificativa da IA.",
    });
  }

  // Item que a IA não devolveu cai para conferência (confiança 0, 32%).
  return itens.map((_, indice) =>
    porIndice.get(indice) ?? {
      indice,
      aliquota: "P32" as const,
      confianca: 0,
      justificativa: "IA não classificou este item.",
    },
  );
};
