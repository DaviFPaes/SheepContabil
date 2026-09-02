import { rotuloAtor, type LinhaAuditoriaDocumento } from "./historico";

function campo(v: string): string {
  if (/^[=+\-@]/.test(v)) v = "'" + v;
  if (/[;"\r\n]/.test(v)) return `"${v.replace(/"/g, '""')}"`;
  return v;
}

function linha(cols: string[]): string {
  return cols.map(campo).join(";");
}

function dataUTC(d: Date): string {
  return new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeZone: "UTC" }).format(d);
}

function horaUTC(d: Date): string {
  return new Intl.DateTimeFormat("pt-BR", { timeStyle: "short", timeZone: "UTC" }).format(d);
}

export function gerarCsvAuditoria(linhas: LinhaAuditoriaDocumento[]): string {
  const saida = [linha(["data", "hora", "ator", "evento", "descricao"])];
  for (const l of linhas) {
    saida.push(linha([dataUTC(l.criadoEm), horaUTC(l.criadoEm), rotuloAtor(l.autorEmail), l.acao, l.descricao]));
  }
  return "﻿" + saida.join("\r\n") + "\r\n";
}
