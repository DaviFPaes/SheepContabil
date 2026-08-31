import type { NotaDetalhe } from "./consultas-sc11";
import { ROTULO_ALIQUOTA, ROTULO_ORIGEM } from "./formato-presuncao";

function campo(v: string): string {
  // separador é ';' — se o valor tem ';', '"' ou quebra de linha, entre aspas
  if (/[;"\n]/.test(v)) return `"${v.replace(/"/g, '""')}"`;
  return v;
}

function linha(cols: (string | number)[]): string {
  return cols.map((c) => campo(typeof c === "number" ? c.toFixed(2) : c)).join(";");
}

export function gerarCsvRelatorio(nota: NotaDetalhe): string {
  const linhas: string[] = [];
  linhas.push(linha(["descricao", "valor", "aliquota", "origem", "justificativa"]));

  for (const item of nota.itens) {
    linhas.push(
      linha([
        item.descricao,
        item.valor,
        ROTULO_ALIQUOTA[item.aliquota],
        ROTULO_ORIGEM[item.origem],
        item.justificativa,
      ]),
    );
  }

  linhas.push("");
  for (const b of nota.consolidado.porBalde) {
    linhas.push(linha([`BASE ${ROTULO_ALIQUOTA[b.aliquota]}`, b.somaValor, "", "", b.basePresuncao]));
  }
  linhas.push(linha(["TOTAL", nota.consolidado.totalValor, "", "", nota.consolidado.totalBase]));

  return "﻿" + linhas.join("\r\n") + "\r\n";
}
