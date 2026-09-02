import type { CertificadoLinha } from "./consultas";
import { estadoContato } from "./contato";

// Módulo puro (sem Prisma) — pode ser importado tanto pela página (servidor)
// quanto pelo painel do Kanban (cliente).

// Kanban de 4 colunas — a fila de trabalho até o vencimento. "Avisado?" é a
// cor do card (ver `estadoContato`); "Renovado" saiu do Kanban (a Tabela já
// lista todos os certificados, inclusive os renovados).
export type ColunasKanban = {
  d60: CertificadoLinha[];
  d7: CertificadoLinha[];
  confirmar3: CertificadoLinha[];
  vencido: CertificadoLinha[];
};

export type OrdemKanban = "recentes" | "antigos";

// Proxy de "há quanto tempo entrou nesta faixa": quanto mais dias restam
// dentro da faixa, mais recentemente o card migrou pra cá (ex.: um card que
// acabou de sair de 60d entra em 7d com ~7 dias restantes → topo da lista).
function ordenar(cards: CertificadoLinha[], ordem: OrdemKanban): CertificadoLinha[] {
  const sinal = ordem === "recentes" ? 1 : -1;
  return [...cards].sort((a, b) => sinal * (b.diasRestantes - a.diasRestantes));
}

// Puro: recebe as linhas já lidas e só decide em qual coluna cada uma cai.
// Posição é sempre derivada dos dados — nunca há estado de coluna gravado.
export function montarColunasKanban(
  linhas: CertificadoLinha[],
  ordem: OrdemKanban = "recentes",
): ColunasKanban {
  const colunas: ColunasKanban = { d60: [], d7: [], confirmar3: [], vencido: [] };

  for (const linha of linhas) {
    switch (linha.bucket) {
      case "D60":
        colunas.d60.push(linha);
        break;
      case "D7":
        colunas.d7.push(linha);
        break;
      case "D3":
        colunas.confirmar3.push(linha);
        break;
      case "VENCIDO":
        colunas.vencido.push(linha);
        break;
      default:
        break;
    }
  }

  return {
    d60: ordenar(colunas.d60, ordem),
    d7: ordenar(colunas.d7, ordem),
    confirmar3: ordenar(colunas.confirmar3, ordem),
    vencido: ordenar(colunas.vencido, ordem),
  };
}

// Alimenta o "Enviar avisos (N)" das colunas 60d / 7d: quantos cards ainda
// não tiveram o contato confirmado (pendente ou com envio falhado).
export function contarNaoAvisados(colunas: ColunasKanban): { d60: number; d7: number } {
  const naoAvisado = (l: CertificadoLinha) => estadoContato(l) !== "avisado";
  return {
    d60: colunas.d60.filter(naoAvisado).length,
    d7: colunas.d7.filter(naoAvisado).length,
  };
}
