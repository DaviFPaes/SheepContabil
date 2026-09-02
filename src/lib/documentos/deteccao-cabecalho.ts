import Anthropic from "@anthropic-ai/sdk";
import { IaIndisponivelError, traduzirErroAnthropic } from "@/lib/ia";

const MODELO = "claude-haiku-4-5-20251001";

export type CabecalhoExtrato = {
  razaoSocial: string | null;
  banco: string | null;
  agencia: string | null;
  conta: string | null;
  periodoInicio: string | null; // ISO yyyy-mm-dd
  periodoFim: string | null;
  confianca: number; // 0..1
};

export type DetectorCabecalho = (arquivo: {
  mimeType: string;
  base64: string;
}) => Promise<CabecalhoExtrato>;

export function criarDetectorFake(c: CabecalhoExtrato): DetectorCabecalho {
  return async () => c;
}

const FERRAMENTA = {
  name: "identificar_cabecalho",
  description: "Registra o que está no cabeçalho do extrato bancário.",
  input_schema: {
    type: "object" as const,
    properties: {
      razaoSocial: { type: "string", description: "Titular / razão social da conta, como aparece no cabeçalho. Null se ilegível." },
      banco: { type: "string", description: "Nome do banco. Null se ilegível." },
      agencia: { type: "string", description: "Número da agência. Null se ilegível." },
      conta: { type: "string", description: "Número da conta corrente. Null se ilegível." },
      periodoInicio: { type: "string", description: "Início do período de cobertura declarado, ISO yyyy-mm-dd. Null se não houver." },
      periodoFim: { type: "string", description: "Fim do período declarado, ISO yyyy-mm-dd. Null se não houver." },
      confianca: { type: "number", description: "Sua confiança geral na leitura do cabeçalho, 0 a 1." },
    },
    required: ["confianca"],
  },
};

const INSTRUCAO = `Leia APENAS o cabeçalho deste extrato bancário — não extraia lançamentos. Informe titular/razão social, banco, agência, número da conta e o período de cobertura declarado. Deixe null o que não conseguir ler com segurança. Chame identificar_cabecalho uma vez.`;

export const detectarCabecalhoComClaude: DetectorCabecalho = async ({ mimeType, base64 }) => {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new IaIndisponivelError();
  const client = new Anthropic({ apiKey });

  const blocoArquivo =
    mimeType === "application/pdf"
      ? { type: "document" as const, source: { type: "base64" as const, media_type: "application/pdf" as const, data: base64 } }
      : { type: "image" as const, source: { type: "base64" as const, media_type: mimeType as "image/jpeg" | "image/png", data: base64 } };

  let mensagem;
  try {
    mensagem = await client.messages.create({
      model: MODELO,
      max_tokens: 1024,
      tools: [FERRAMENTA],
      messages: [{ role: "user", content: [blocoArquivo, { type: "text", text: INSTRUCAO }] }],
    });
  } catch (erro) {
    throw traduzirErroAnthropic(erro);
  }

  const toolUse = mensagem.content.find((b) => b.type === "tool_use");
  const vazio: CabecalhoExtrato = {
    razaoSocial: null, banco: null, agencia: null, conta: null,
    periodoInicio: null, periodoFim: null, confianca: 0,
  };
  if (toolUse && toolUse.type === "tool_use") {
    const i = toolUse.input as Partial<CabecalhoExtrato>;
    return {
      razaoSocial: i.razaoSocial ?? null,
      banco: i.banco ?? null,
      agencia: i.agencia ?? null,
      conta: i.conta ?? null,
      periodoInicio: i.periodoInicio ?? null,
      periodoFim: i.periodoFim ?? null,
      confianca: typeof i.confianca === "number" ? i.confianca : 0,
    };
  }
  return vazio;
};

function normalizar(t: string): string {
  return t.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").trim();
}
function digitos(t: string | null): string {
  return (t ?? "").replace(/\D/g, "");
}

export function casarCabecalho(
  cab: CabecalhoExtrato,
  clientes: { id: string; razaoSocial: string }[],
  contasPorCliente: Record<string, { id: string; bancoNome: string; agencia: string; numero: string }[]>,
): { clienteId: string | null; contaBancariaId: string | null } {
  if (!cab.razaoSocial) return { clienteId: null, contaBancariaId: null };
  const alvo = normalizar(cab.razaoSocial);
  const casados = clientes.filter((c) => {
    const n = normalizar(c.razaoSocial);
    return n === alvo || n.includes(alvo) || alvo.includes(n);
  });
  if (casados.length !== 1) return { clienteId: null, contaBancariaId: null };
  const cliente = casados[0];

  const contas = contasPorCliente[cliente.id] ?? [];
  if (contas.length === 0) return { clienteId: cliente.id, contaBancariaId: null };
  if (contas.length === 1) return { clienteId: cliente.id, contaBancariaId: contas[0].id };

  const ag = digitos(cab.agencia);
  const cc = digitos(cab.conta);
  const porNumero = contas.find((c) => ag && cc && digitos(c.agencia) === ag && digitos(c.numero) === cc);
  if (porNumero) return { clienteId: cliente.id, contaBancariaId: porNumero.id };

  const banco = cab.banco ? normalizar(cab.banco) : "";
  const porBanco = contas.filter((c) => banco && normalizar(c.bancoNome).includes(banco));
  if (porBanco.length === 1) return { clienteId: cliente.id, contaBancariaId: porBanco[0].id };

  return { clienteId: cliente.id, contaBancariaId: null };
}
