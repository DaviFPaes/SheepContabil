import { rotuloAtor, type LinhaAuditoria } from "./historico";

// Mesma convenção do relatorio-csv.ts do SC-11: separador ';' (padrão
// pt-BR), aspas com escape "", proteção contra injeção de fórmula do
// Excel, BOM UTF-8 e quebra de linha \r\n.
function campo(v: string): string {
  if (/^[=+\-@]/.test(v)) v = "'" + v;
  if (/[;"\r\n]/.test(v)) return `"${v.replace(/"/g, '""')}"`;
  return v;
}

function linha(cols: string[]): string {
  return cols.map(campo).join(";");
}

function dataUTC(data: Date): string {
  return new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeZone: "UTC" }).format(data);
}

function horaUTC(data: Date): string {
  return new Intl.DateTimeFormat("pt-BR", { timeStyle: "short", timeZone: "UTC" }).format(data);
}

export function gerarCsvHistorico(linhas: LinhaAuditoria[]): string {
  const saida: string[] = [];
  saida.push(linha(["data", "hora", "ator", "evento", "descricao"]));

  for (const l of linhas) {
    saida.push(
      linha([dataUTC(l.criadoEm), horaUTC(l.criadoEm), rotuloAtor(l.autorEmail), l.acao, l.descricao]),
    );
  }

  return "﻿" + saida.join("\r\n") + "\r\n";
}
