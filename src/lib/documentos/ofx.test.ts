import { describe, expect, it } from "vitest";
import { gerarOfx, type ContaOfx, type TransacaoOfx } from "./ofx";

const CONTA: ContaOfx = {
  bancoNome: "Banco Exemplo",
  compe: "341",
  agencia: "1234",
  numero: "56789-0",
};

const GERADO_EM = new Date("2026-08-30T12:00:00Z");

const TX: TransacaoOfx[] = [
  { data: new Date("2026-08-03T00:00:00Z"), historico: "PAGAMENTO FORNECEDOR", valor: -150.5 },
  { data: new Date("2026-08-10T00:00:00Z"), historico: "RECEBIMENTO CLIENTE A & B", valor: 2300 },
  { data: new Date("2026-08-21T00:00:00Z"), historico: "TARIFA BANCARIA", valor: -29.9 },
];

describe("gerarOfx", () => {
  const ofx = gerarOfx(CONTA, TX, GERADO_EM);

  it("abre com o cabecalho OFX 1.0.2 SGML", () => {
    expect(ofx.startsWith("OFXHEADER:100")).toBe(true);
    expect(ofx).toContain("VERSION:102");
    expect(ofx).toContain("DATA:OFXSGML");
  });

  it("inclui banco e conta em BANKACCTFROM", () => {
    expect(ofx).toContain("<BANKID>341");
    expect(ofx).toContain("<ACCTID>56789-0");
    expect(ofx).toContain("<ACCTTYPE>CHECKING");
    expect(ofx).toContain("<CURDEF>BRL");
  });

  it("gera um STMTTRN por transacao, com sinal e 2 casas", () => {
    const blocos = ofx.split("<STMTTRN>").length - 1;
    expect(blocos).toBe(3);
    expect(ofx).toContain("<TRNAMT>-150.50");
    expect(ofx).toContain("<TRNAMT>2300.00");
    expect(ofx).toContain("<TRNAMT>-29.90");
  });

  it("classifica DEBIT/CREDIT pelo sinal", () => {
    expect(ofx).toContain("<TRNTYPE>DEBIT");
    expect(ofx).toContain("<TRNTYPE>CREDIT");
  });

  it("escapa & < > no MEMO", () => {
    expect(ofx).toContain("<MEMO>RECEBIMENTO CLIENTE A &amp; B");
  });

  it("gera FITID unico por transacao", () => {
    const fitids = [...ofx.matchAll(/<FITID>([^\n]+)/g)].map((m) => m[1]);
    expect(new Set(fitids).size).toBe(fitids.length);
    expect(fitids.length).toBe(3);
  });

  it("DTSTART/DTEND cobrem a faixa das transacoes", () => {
    expect(ofx).toContain("<DTSTART>20260803");
    expect(ofx).toContain("<DTEND>20260821");
  });

  it("LEDGERBAL e a soma dos valores", () => {
    // -150.50 + 2300 - 29.90 = 2119.60
    expect(ofx).toContain("<BALAMT>2119.60");
  });

  it("fecha todas as tags de agregado", () => {
    for (const tag of ["OFX", "BANKMSGSRSV1", "STMTTRNRS", "STMTRS", "BANKTRANLIST", "BANKACCTFROM"]) {
      expect(ofx).toContain(`</${tag}>`);
    }
  });
});
