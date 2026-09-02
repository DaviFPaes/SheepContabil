export { camposAlterados, rotuloAtor } from "@/lib/certificados/historico";

export type AcaoAuditoriaDocumento =
  | "EXTRATO_ENVIADO"
  | "LEITURA_CONCLUIDA"
  | "LEITURA_FALHOU"
  | "LINHA_CONFERIDA"
  | "REPROCESSADO"
  | "OFX_BAIXADO"
  | "DOCUMENTO_EXCLUIDO"
  | "EXTRATO_COBRADO"
  | "CLIENTE_CONFIGURADO";

export type LinhaAuditoriaDocumento = {
  id: string;
  acao: AcaoAuditoriaDocumento;
  descricao: string;
  autorEmail: string | null;
  criadoEm: Date;
  dadosAntes: Record<string, unknown> | null;
  dadosDepois: Record<string, unknown> | null;
};

export const ROTULO_ACAO: Record<AcaoAuditoriaDocumento, string> = {
  EXTRATO_ENVIADO: "Extrato enviado",
  LEITURA_CONCLUIDA: "Leitura concluída",
  LEITURA_FALHOU: "Leitura falhou",
  LINHA_CONFERIDA: "Linha conferida",
  REPROCESSADO: "Reprocessado",
  OFX_BAIXADO: "OFX baixado",
  DOCUMENTO_EXCLUIDO: "Documento excluído",
  EXTRATO_COBRADO: "Extrato cobrado",
  CLIENTE_CONFIGURADO: "Cliente configurado",
};

export const ACENTO_ACAO: Record<
  AcaoAuditoriaDocumento,
  "turquesa" | "ambar" | "carmim"
> = {
  EXTRATO_ENVIADO: "turquesa",
  LEITURA_CONCLUIDA: "turquesa",
  OFX_BAIXADO: "turquesa",
  LINHA_CONFERIDA: "ambar",
  REPROCESSADO: "ambar",
  EXTRATO_COBRADO: "ambar",
  CLIENTE_CONFIGURADO: "ambar",
  LEITURA_FALHOU: "carmim",
  DOCUMENTO_EXCLUIDO: "carmim",
};

export const NATUREZAS: { valor: AcaoAuditoriaDocumento; rotulo: string }[] = [
  { valor: "EXTRATO_ENVIADO", rotulo: ROTULO_ACAO.EXTRATO_ENVIADO },
  { valor: "LEITURA_CONCLUIDA", rotulo: ROTULO_ACAO.LEITURA_CONCLUIDA },
  { valor: "LEITURA_FALHOU", rotulo: ROTULO_ACAO.LEITURA_FALHOU },
  { valor: "LINHA_CONFERIDA", rotulo: ROTULO_ACAO.LINHA_CONFERIDA },
  { valor: "REPROCESSADO", rotulo: ROTULO_ACAO.REPROCESSADO },
  { valor: "OFX_BAIXADO", rotulo: ROTULO_ACAO.OFX_BAIXADO },
  { valor: "DOCUMENTO_EXCLUIDO", rotulo: ROTULO_ACAO.DOCUMENTO_EXCLUIDO },
  { valor: "EXTRATO_COBRADO", rotulo: ROTULO_ACAO.EXTRATO_COBRADO },
  { valor: "CLIENTE_CONFIGURADO", rotulo: ROTULO_ACAO.CLIENTE_CONFIGURADO },
];
