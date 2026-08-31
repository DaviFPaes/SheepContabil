export type ContaOfx = {
  bancoNome: string;
  compe: string;
  agencia: string;
  numero: string;
};

export type TransacaoOfx = {
  data: Date;
  historico: string;
  valor: number;
};

function dataOfx(data: Date): string {
  const p = (n: number, c = 2) => String(n).padStart(c, "0");
  return (
    `${data.getUTCFullYear()}${p(data.getUTCMonth() + 1)}${p(data.getUTCDate())}` +
    `${p(data.getUTCHours())}${p(data.getUTCMinutes())}${p(data.getUTCSeconds())}[-3:BRT]`
  );
}

function valorOfx(valor: number): string {
  return valor.toFixed(2);
}

function escaparSgml(texto: string): string {
  return texto
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function fitId(data: Date, indice: number): string {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${data.getUTCFullYear()}${p(data.getUTCMonth() + 1)}${p(data.getUTCDate())}-${indice + 1}`;
}

export function gerarOfx(
  conta: ContaOfx,
  transacoes: TransacaoOfx[],
  geradoEm: Date = new Date(),
): string {
  const ordenadas = [...transacoes].sort(
    (a, b) => a.data.getTime() - b.data.getTime(),
  );
  const inicio = ordenadas[0]?.data ?? geradoEm;
  const fim = ordenadas[ordenadas.length - 1]?.data ?? geradoEm;
  const saldo = ordenadas.reduce((s, t) => s + t.valor, 0);

  const cabecalho = [
    "OFXHEADER:100",
    "DATA:OFXSGML",
    "VERSION:102",
    "SECURITY:NONE",
    "ENCODING:USASCII",
    "CHARSET:1252",
    "COMPRESSION:NONE",
    "OLDFILEUID:NONE",
    "NEWFILEUID:NONE",
    "",
    "",
  ].join("\n");

  const linhasTrn = ordenadas
    .map((t, i) =>
      [
        "<STMTTRN>",
        `<TRNTYPE>${t.valor < 0 ? "DEBIT" : "CREDIT"}`,
        `<DTPOSTED>${dataOfx(t.data)}`,
        `<TRNAMT>${valorOfx(t.valor)}`,
        `<FITID>${fitId(t.data, i)}`,
        `<MEMO>${escaparSgml(t.historico)}`,
        "</STMTTRN>",
      ].join("\n"),
    )
    .join("\n");

  const corpo = [
    "<OFX>",
    "<SIGNONMSGSRSV1>",
    "<SONRS>",
    "<STATUS>",
    "<CODE>0",
    "<SEVERITY>INFO",
    "</STATUS>",
    `<DTSERVER>${dataOfx(geradoEm)}`,
    "<LANGUAGE>POR",
    "</SONRS>",
    "</SIGNONMSGSRSV1>",
    "<BANKMSGSRSV1>",
    "<STMTTRNRS>",
    "<TRNUID>1",
    "<STATUS>",
    "<CODE>0",
    "<SEVERITY>INFO",
    "</STATUS>",
    "<STMTRS>",
    "<CURDEF>BRL",
    "<BANKACCTFROM>",
    `<BANKID>${conta.compe}`,
    `<ACCTID>${conta.numero}`,
    "<ACCTTYPE>CHECKING",
    "</BANKACCTFROM>",
    "<BANKTRANLIST>",
    `<DTSTART>${dataOfx(inicio)}`,
    `<DTEND>${dataOfx(fim)}`,
    linhasTrn,
    "</BANKTRANLIST>",
    "<LEDGERBAL>",
    `<BALAMT>${valorOfx(saldo)}`,
    `<DTASOF>${dataOfx(fim)}`,
    "</LEDGERBAL>",
    "</STMTRS>",
    "</STMTTRNRS>",
    "</BANKMSGSRSV1>",
    "</OFX>",
    "",
  ].join("\n");

  return cabecalho + corpo;
}
