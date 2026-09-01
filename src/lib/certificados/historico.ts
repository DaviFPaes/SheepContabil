export type AcaoAuditoria =
  | "CRIADO"
  | "EDITADO"
  | "DESATIVADO"
  | "TRANSICAO_BUCKET"
  | "AVISO_ENVIADO"
  | "AVISO_BOUNCE"
  | "RENOVACAO"
  | "ATUALIZAR_EXECUTADO";

export type LinhaAuditoria = {
  id: string;
  acao: AcaoAuditoria;
  descricao: string;
  autorEmail: string | null;
  criadoEm: Date;
  dadosAntes: Record<string, unknown> | null;
  dadosDepois: Record<string, unknown> | null;
};

export function rotuloAtor(autorEmail: string | null): string {
  return autorEmail ?? "Sistema";
}

export function camposAlterados(
  antes: Record<string, unknown> | null,
  depois: Record<string, unknown> | null,
): { campo: string; de: unknown; para: unknown }[] {
  if (!antes || !depois) return [];

  const resultado: { campo: string; de: unknown; para: unknown }[] = [];
  for (const campo of Object.keys(antes)) {
    if (!(campo in depois)) continue;
    const de = antes[campo];
    const para = depois[campo];
    if (de !== para) {
      resultado.push({ campo, de, para });
    }
  }
  return resultado;
}

// Tom visual da faixa lateral na timeline (§7.2 do design).
export const ACENTO_ACAO: Record<AcaoAuditoria, "turquesa" | "ambar" | "carmim"> = {
  CRIADO: "turquesa",
  RENOVACAO: "turquesa",
  EDITADO: "ambar",
  TRANSICAO_BUCKET: "ambar",
  ATUALIZAR_EXECUTADO: "ambar",
  AVISO_ENVIADO: "ambar",
  DESATIVADO: "carmim",
  AVISO_BOUNCE: "carmim",
};

export const NATUREZAS: { valor: AcaoAuditoria; rotulo: string }[] = [
  { valor: "CRIADO", rotulo: "Certificado criado" },
  { valor: "EDITADO", rotulo: "Certificado editado" },
  { valor: "DESATIVADO", rotulo: "Certificado desativado" },
  { valor: "TRANSICAO_BUCKET", rotulo: "Mudança de faixa" },
  { valor: "AVISO_ENVIADO", rotulo: "Aviso enviado" },
  { valor: "AVISO_BOUNCE", rotulo: "Falha no envio" },
  { valor: "RENOVACAO", rotulo: "Renovação" },
  { valor: "ATUALIZAR_EXECUTADO", rotulo: "Execução de Atualizar" },
];
