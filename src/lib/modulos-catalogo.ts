import type { PapelUsuario } from "@/generated/prisma/client";

export type NaturezaModulo = "RPA" | "AGENTE_IA" | "CONTROLE";

export type ModuloCatalogo = {
  codigo: string;
  nome: string;
  natureza: NaturezaModulo;
  setorDono: string;
  descricao: string;
  implementado: boolean;
};

export const CATALOGO_MODULOS: ModuloCatalogo[] = [
  {
    codigo: "SC-01",
    nome: "Conversão de extrato bancário para OFX",
    natureza: "AGENTE_IA",
    setorDono: "Contábil",
    descricao:
      "Lê extratos em PDF ou foto e gera um arquivo OFX pronto para importar.",
    implementado: true,
  },
  {
    codigo: "SC-11",
    nome: "Presunção correta nas notas de serviço da área médica",
    natureza: "AGENTE_IA",
    setorDono: "BPO Saúde",
    descricao:
      "Classifica cada item de nota fiscal de serviço médico na alíquota de presunção correta.",
    implementado: true,
  },
  {
    codigo: "SC-18",
    nome: "Tarefas encadeadas por tipo de processo",
    natureza: "RPA",
    setorDono: "Processos",
    descricao:
      "Cria automaticamente as próximas tarefas de um fluxo quando uma etapa é concluída.",
    implementado: false,
  },
  {
    codigo: "SC-20",
    nome: "Vencimento de certificado digital",
    natureza: "CONTROLE",
    setorDono: "Processos",
    descricao:
      "Painel e aviso de certificados digitais de clientes perto do vencimento.",
    implementado: true,
  },
];

export function obterModulo(codigo: string): ModuloCatalogo | undefined {
  return CATALOGO_MODULOS.find((modulo) => modulo.codigo === codigo);
}

export function filtrarModulosVisiveis(
  papel: PapelUsuario,
  setor: string | null,
  catalogo: ModuloCatalogo[] = CATALOGO_MODULOS,
): ModuloCatalogo[] {
  return catalogo.filter((modulo) => {
    if (!modulo.implementado) return false;
    if (papel === "ADMIN") return true;
    return modulo.setorDono === setor;
  });
}

export const NOMES_NATUREZA: Record<NaturezaModulo, string> = {
  RPA: "RPA",
  AGENTE_IA: "Agente de IA",
  CONTROLE: "Controle sistematizado",
};
