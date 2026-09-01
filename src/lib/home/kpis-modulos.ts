import {
  listarCertificados,
  type CertificadoLinha,
} from "@/lib/certificados/consultas";
import {
  listarDocumentos,
  type DocumentoResumo,
} from "@/lib/documentos/consultas-sc01";
import {
  listarNotas,
  type NotaResumo,
} from "@/lib/presuncao/consultas-sc11";

/**
 * Tom semântico do número em destaque do card, travado na paleta da marca:
 *  - `atencao` → âmbar (pendência, alerta)
 *  - `ok`      → turquesa (nada pedindo ação)
 *  - `erro`    → carmim (falha de execução — e só isso)
 */
export type TomKpi = "atencao" | "ok" | "erro";

export type KpiModulo = {
  /** Número de destaque (Archivo, peso 800). */
  valor: number;
  /** Frase curta ao lado do número, já concordando em número com `valor`. */
  rotulo: string;
  tom: TomKpi;
  /** Segunda pista, opcional (Plex Mono), sempre com a própria contagem. */
  detalhe?: string;
};

const concordar = (n: number, singular: string, plural: string): string =>
  n === 1 ? singular : plural;

const contar = (n: number, singular: string, plural: string): string =>
  `${n} ${concordar(n, singular, plural)}`;

/** SC-20 — certificados digitais perto do vencimento.
 *  `bucket` (pós-refatoração do SC-20): VENCIDO | D3 | D7 | D60 | OK | RENOVADO.
 *  Crítico = já venceu ou vence em até 7 dias (VENCIDO/D3/D7); alerta = D60. */
export function resumirKpiSc20(
  certificados: CertificadoLinha[],
): KpiModulo {
  const criticos = certificados.filter(
    (c) => c.bucket === "VENCIDO" || c.bucket === "D3" || c.bucket === "D7",
  ).length;
  const emAlerta = certificados.filter((c) => c.bucket === "D60").length;

  if (criticos > 0) {
    return {
      valor: criticos,
      rotulo: concordar(
        criticos,
        "certificado vencido ou crítico",
        "certificados vencidos ou críticos",
      ),
      tom: "atencao",
      ...(emAlerta > 0
        ? {
            detalhe: contar(
              emAlerta,
              "certificado em alerta",
              "certificados em alerta",
            ),
          }
        : {}),
    };
  }

  if (emAlerta > 0) {
    return {
      valor: emAlerta,
      rotulo: concordar(
        emAlerta,
        "certificado em alerta",
        "certificados em alerta",
      ),
      tom: "atencao",
    };
  }

  return { valor: 0, rotulo: "certificados em dia", tom: "ok" };
}

/** SC-01 — conversão de extrato bancário para OFX. */
export function resumirKpiSc01(extratos: DocumentoResumo[]): KpiModulo {
  const comErro = extratos.filter((d) => d.status === "ERRO").length;
  const emConferencia = extratos.reduce((soma, d) => soma + d.emRevisao, 0);
  const pendentes = extratos.filter((d) => d.status === "PENDENTE").length;

  if (comErro > 0) {
    return {
      valor: comErro,
      rotulo: concordar(comErro, "extrato com erro", "extratos com erro"),
      tom: "erro",
      ...(emConferencia > 0
        ? {
            detalhe: contar(
              emConferencia,
              "linha em conferência",
              "linhas em conferência",
            ),
          }
        : {}),
    };
  }

  if (emConferencia > 0) {
    return {
      valor: emConferencia,
      rotulo: concordar(
        emConferencia,
        "linha em conferência",
        "linhas em conferência",
      ),
      tom: "atencao",
      ...(pendentes > 0
        ? { detalhe: contar(pendentes, "extrato pendente", "extratos pendentes") }
        : {}),
    };
  }

  if (pendentes > 0) {
    return {
      valor: pendentes,
      rotulo: concordar(
        pendentes,
        "extrato aguardando leitura",
        "extratos aguardando leitura",
      ),
      tom: "atencao",
    };
  }

  return { valor: 0, rotulo: "extratos em dia", tom: "ok" };
}

/** SC-11 — presunção correta nas notas de serviço médicas. */
export function resumirKpiSc11(notas: NotaResumo[]): KpiModulo {
  const comErro = notas.filter((n) => n.status === "ERRO").length;
  const emConferencia = notas.reduce((soma, n) => soma + n.emRevisao, 0);
  const pendentes = notas.filter((n) => n.status === "PENDENTE").length;

  if (comErro > 0) {
    return {
      valor: comErro,
      rotulo: concordar(comErro, "nota com erro", "notas com erro"),
      tom: "erro",
      ...(emConferencia > 0
        ? {
            detalhe: contar(
              emConferencia,
              "item em conferência",
              "itens em conferência",
            ),
          }
        : {}),
    };
  }

  if (emConferencia > 0) {
    return {
      valor: emConferencia,
      rotulo: concordar(
        emConferencia,
        "item em conferência",
        "itens em conferência",
      ),
      tom: "atencao",
      ...(pendentes > 0
        ? { detalhe: contar(pendentes, "nota pendente", "notas pendentes") }
        : {}),
    };
  }

  if (pendentes > 0) {
    return {
      valor: pendentes,
      rotulo: concordar(
        pendentes,
        "nota aguardando processamento",
        "notas aguardando processamento",
      ),
      tom: "atencao",
    };
  }

  return { valor: 0, rotulo: "notas em dia", tom: "ok" };
}

/**
 * Resolve o KPI de um módulo pelo código. Só os módulos visíveis para o
 * usuário chegam aqui (a home filtra antes), e as chamadas rodam em paralelo.
 */
export async function obterKpiModulo(
  codigo: string,
): Promise<KpiModulo | null> {
  switch (codigo) {
    case "SC-20":
      return resumirKpiSc20(await listarCertificados());
    case "SC-01":
      return resumirKpiSc01(await listarDocumentos("EXTRATO"));
    case "SC-11":
      return resumirKpiSc11(await listarNotas());
    default:
      return null;
  }
}
