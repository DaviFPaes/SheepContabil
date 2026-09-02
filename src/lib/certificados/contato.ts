import type { Bucket } from "./bucket";

// Puro e sem dependência de servidor — pode ser importado tanto pelas
// consultas (servidor) quanto pelos cards do Kanban (cliente).

export type EstadoContato = "pendente" | "avisado" | "falhou";

type Aviso = { status: "QUEUED" | "SENT" | "DELIVERED" | "BOUNCED" | "FAILED" } | null;

export type LinhaContato = {
  bucket: Bucket;
  avisoD3Em: Date | null;
  avisoD60: Aviso;
  avisoD7: Aviso;
};

function avisado(a: Aviso): boolean {
  return a !== null && (a.status === "SENT" || a.status === "DELIVERED");
}

function falhou(a: Aviso): boolean {
  return a !== null && (a.status === "BOUNCED" || a.status === "FAILED");
}

// Traduz o estado do aviso de um card das colunas de contato (60 / 7 / 3
// dias) numa das três cores. `null` para os demais buckets, que não têm
// noção de "avisado".
export function estadoContato(linha: LinhaContato): EstadoContato | null {
  switch (linha.bucket) {
    case "D60":
      return falhou(linha.avisoD60) ? "falhou" : avisado(linha.avisoD60) ? "avisado" : "pendente";
    case "D7":
      return falhou(linha.avisoD7) ? "falhou" : avisado(linha.avisoD7) ? "avisado" : "pendente";
    case "D3":
      return linha.avisoD3Em ? "avisado" : "pendente";
    default:
      return null;
  }
}
