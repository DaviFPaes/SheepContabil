import { describe, expect, it } from "vitest";
import {
  ACENTO_ACAO,
  NATUREZAS,
  ROTULO_ACAO,
  type AcaoAuditoriaDocumento,
} from "./historico";

const TODAS: AcaoAuditoriaDocumento[] = [
  "EXTRATO_ENVIADO",
  "LEITURA_CONCLUIDA",
  "LEITURA_FALHOU",
  "LINHA_CONFERIDA",
  "REPROCESSADO",
  "OFX_BAIXADO",
  "DOCUMENTO_EXCLUIDO",
  "EXTRATO_COBRADO",
  "CLIENTE_CONFIGURADO",
];

describe("historico da SC-01", () => {
  it("todo valor tem rótulo e acento", () => {
    for (const a of TODAS) {
      expect(ROTULO_ACAO[a]).toBeTruthy();
      expect(["turquesa", "ambar", "carmim"]).toContain(ACENTO_ACAO[a]);
    }
  });

  it("falhas e exclusão são carmim", () => {
    expect(ACENTO_ACAO.LEITURA_FALHOU).toBe("carmim");
    expect(ACENTO_ACAO.DOCUMENTO_EXCLUIDO).toBe("carmim");
  });

  it("NATUREZAS cobre exatamente as 9 ações", () => {
    expect(NATUREZAS.map((n) => n.valor).sort()).toEqual([...TODAS].sort());
  });
});
