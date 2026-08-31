/**
 * Gera os fixtures sintéticos do SC-01: 3 extratos em PDF com leiautes
 * visivelmente diferentes (ordem de colunas, fontes, espaçamento, com/sem
 * cabeçalho de saldo, retrato/paisagem) + 1 "foto" de extrato (JPEG desenhado
 * num canvas, com leve rotação, gradiente e ruído — simula um celular).
 *
 * O objetivo é provar que a leitura por IA multimodal generaliza entre leiautes
 * e entre formatos de entrada. Os arquivos são commitados e carregados pelo seed
 * (`prisma/seed.ts` → `seedDocumentosEntrada`).
 *
 * Rodar: `npm run fixtures`
 */
import { createWriteStream, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { createCanvas } from "@napi-rs/canvas";
import PDFDocument from "pdfkit";

const AQUI = dirname(fileURLToPath(import.meta.url));
mkdirSync(AQUI, { recursive: true });

// Data fixa nas informações do PDF → regerar não muda o binário à toa.
const INFO: PDFKit.DocumentInfo = {
  Producer: "SheepContabil fixtures",
  Creator: "prisma/fixtures/gerar-fixtures.ts",
  CreationDate: new Date("2026-09-01T09:00:00.000Z"),
  ModDate: new Date("2026-09-01T09:00:00.000Z"),
};

// --------------------------------------------------------------------------
// Dados sintéticos — um conjunto de lançamentos plausível por banco.
// valor: negativo = débito/saída, positivo = crédito/entrada.
// --------------------------------------------------------------------------
type Mov = { dia: number; hist: string; doc: string; valor: number };

const ALFA: { saldoInicial: number; movs: Mov[] } = {
  saldoInicial: 8450.0,
  movs: [
    { dia: 3, hist: "TED RECEBIDA CLIENTE 4471", doc: "TED0453", valor: 4820.0 },
    { dia: 5, hist: "PAGAMENTO BOLETO ENERGISA", doc: "BOL9921", valor: -612.47 },
    { dia: 8, hist: "PIX ENVIADO FORNEC MADEIRAS", doc: "PIX3320", valor: -1500.0 },
    { dia: 12, hist: "TARIFA PACOTE SERVIÇOS", doc: "TAR0001", valor: -79.9 },
    { dia: 14, hist: "DEPÓSITO EM DINHEIRO", doc: "DEP1180", valor: 230.0 },
    { dia: 16, hist: "PIX RECEBIDO VENDA BALCÃO", doc: "PIX7745", valor: 348.75 },
    { dia: 20, hist: "DÉBITO AUTOMÁTICO VIVO FIXO", doc: "DAU5510", valor: -139.99 },
    { dia: 22, hist: "TED ENVIADA PRÓ-LABORE", doc: "TED0489", valor: -3000.0 },
    { dia: 26, hist: "IOF SOBRE OPERAÇÃO DE CRÉDITO", doc: "IOF0007", valor: -3.12 },
    { dia: 28, hist: "RENDIMENTO CONTA REMUNERADA", doc: "REN0031", valor: 18.44 },
    { dia: 29, hist: "PIX ENVIADO ALUGUEL SALA 302", doc: "PIX8890", valor: -2200.0 },
  ],
};

const BETA: { movs: Mov[] } = {
  movs: [
    { dia: 2, hist: "SALDO REMUNERADO CRÉDITO", doc: "0001", valor: 9.83 },
    { dia: 4, hist: "PIX RECEBIDO HONORÁRIOS ABR", doc: "7781", valor: 6500.0 },
    { dia: 6, hist: "PAGAMENTO BOLETO CONTABILIDADE", doc: "5540", valor: -890.0 },
    { dia: 9, hist: "TARIFA PACOTE SERVIÇOS", doc: "0002", valor: -64.9 },
    { dia: 11, hist: "TED ENVIADA IMPOSTO DAS", doc: "8830", valor: -1274.31 },
    { dia: 15, hist: "PIX ENVIADO ASSINATURA SOFTWARE", doc: "9902", valor: -249.0 },
    { dia: 18, hist: "PIX RECEBIDO CONSULTORIA XPTO", doc: "7799", valor: 3200.0 },
    { dia: 23, hist: "PAGAMENTO BOLETO ALUGUEL", doc: "5541", valor: -2100.0 },
    { dia: 27, hist: "DÉBITO AUTOMÁTICO CLARO", doc: "1120", valor: -119.9 },
    { dia: 30, hist: "PIX ENVIADO DISTRIBUIÇÃO SÓCIOS", doc: "9930", valor: -4000.0 },
  ],
};

const GAMA: { saldoInicial: number; movs: Mov[] } = {
  saldoInicial: 15230.55,
  movs: [
    { dia: 3, hist: "PIX RECEBIDO FRETE NF 11.482", doc: "P110482", valor: 2870.0 },
    { dia: 4, hist: "PAGAMENTO BOLETO POSTO IPIRANGA", doc: "B455120", valor: -1980.44 },
    { dia: 7, hist: "PIX ENVIADO PEDÁGIO SEM PARAR", doc: "P330071", valor: -412.3 },
    { dia: 10, hist: "TED RECEBIDA CLIENTE LOGÍSTICA", doc: "T009915", valor: 9540.0 },
    { dia: 13, hist: "TARIFA PACOTE SERVIÇOS", doc: "T000013", valor: -118.9 },
    { dia: 17, hist: "PAGAMENTO BOLETO SEGURO FROTA", doc: "B455133", valor: -3277.1 },
    { dia: 19, hist: "PIX ENVIADO MANUTENÇÃO CAVALO 3", doc: "P330219", valor: -2450.0 },
    { dia: 21, hist: "DÉBITO AUTOMÁTICO ANTT", doc: "D551021", valor: -260.0 },
    { dia: 24, hist: "PIX RECEBIDO FRETE NF 11.510", doc: "P110510", valor: 4120.0 },
    { dia: 28, hist: "TED ENVIADA FOLHA MOTORISTAS", doc: "T009942", valor: -8600.0 },
    { dia: 31, hist: "IOF / TARIFAS DO PERÍODO", doc: "I000031", valor: -46.77 },
  ],
};

// Foto — históricos sem acento, alinhamento monoespaçado tolera melhor.
// Cliente: Épsilon Tecnologia da Informação Ltda (base 88999000 no seed).
const DELTA: { saldoInicial: number; movs: Mov[] } = {
  saldoInicial: 3180.0,
  movs: [
    { dia: 2, hist: "PIX RECEBIDO MENSALIDADE SAAS", doc: "PIX0002", valor: 5200.0 },
    { dia: 5, hist: "PAGAMENTO BOLETO COWORKING", doc: "BOL0055", valor: -540.0 },
    { dia: 8, hist: "TARIFA PACOTE SERVICOS", doc: "TAR0008", valor: -49.9 },
    { dia: 11, hist: "PIX ENVIADO HOSPEDAGEM CLOUD", doc: "PIX0011", valor: -2600.0 },
    { dia: 14, hist: "TED RECEBIDA CONTRATO ANUAL XPTO", doc: "TED0014", valor: 12750.0 },
    { dia: 17, hist: "DEBITO AUTOMATICO ENERGIA", doc: "DAU0017", valor: -318.44 },
    { dia: 20, hist: "PIX ENVIADO LICENCA SOFTWARE", doc: "PIX0020", valor: -189.9 },
    { dia: 23, hist: "PIX RECEBIDO MENSALIDADE SAAS", doc: "PIX0023", valor: 3400.0 },
    { dia: 26, hist: "PAGAMENTO BOLETO CONTADOR", doc: "BOL0026", valor: -750.0 },
    { dia: 29, hist: "TED ENVIADA PRO LABORE SOCIOS", doc: "TED0029", valor: -9000.0 },
  ],
};

// --------------------------------------------------------------------------
// Formatação
// --------------------------------------------------------------------------
function brlAbs(n: number): string {
  const [int, dec] = Math.abs(n).toFixed(2).split(".");
  return `${int.replace(/\B(?=(\d{3})+(?!\d))/g, ".")},${dec}`;
}
function brlSigned(n: number): string {
  return (n < 0 ? "-" : "") + brlAbs(n);
}
function dc(n: number): string {
  return n < 0 ? "D" : "C";
}
function dataBR(dia: number): string {
  return `${String(dia).padStart(2, "0")}/08/2026`;
}
function saldos(saldoInicial: number, movs: Mov[]): number[] {
  const out: number[] = [];
  let s = saldoInicial;
  for (const m of movs) {
    s += m.valor;
    out.push(s);
  }
  return out;
}

// --------------------------------------------------------------------------
// Runner de PDF
// --------------------------------------------------------------------------
function renderPdf(
  nome: string,
  opts: PDFKit.PDFDocumentOptions,
  draw: (doc: PDFKit.PDFDocument) => void,
): Promise<string> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ ...opts, info: INFO });
    const caminho = join(AQUI, nome);
    const ws = createWriteStream(caminho);
    ws.on("finish", () => resolve(caminho));
    ws.on("error", reject);
    doc.on("error", reject);
    doc.pipe(ws);
    try {
      draw(doc);
      doc.end();
    } catch (erro) {
      reject(erro);
    }
  });
}

// --------------------------------------------------------------------------
// FIXTURE 1 — extrato-alfa.pdf
// Retrato. Cabeçalho de saldo em caixa. Tabela monoespaçada (Courier) com
// zebra. Colunas: Data | Histórico | Documento | Valor (R$) | Saldo (R$).
// Valores com sinal, coluna de saldo acumulado.
// --------------------------------------------------------------------------
function desenharAlfa(doc: PDFKit.PDFDocument): void {
  const M = 40;
  const seq = saldos(ALFA.saldoInicial, ALFA.movs);
  const creditos = ALFA.movs.filter((m) => m.valor > 0).reduce((a, m) => a + m.valor, 0);
  const debitos = ALFA.movs.filter((m) => m.valor < 0).reduce((a, m) => a + m.valor, 0);
  const saldoFinal = seq[seq.length - 1];

  doc.fillColor("#14243a").font("Helvetica-Bold").fontSize(20).text("Banco Alfa S.A.", M, M);
  doc.fillColor("#5b6b7d").font("Helvetica").fontSize(9);
  doc.text("Extrato de Conta Corrente", M, M + 26);
  doc.text(
    "Agência 1201  •  Conta 45678-9  •  Período: 01/08/2026 a 31/08/2026",
    M,
    M + 39,
  );
  doc.text("Titular: Alfa Comércio de Materiais Ltda", M, M + 52);

  // Caixa de resumo
  const boxY = M + 74;
  doc.roundedRect(M, boxY, 515, 56, 4).fillAndStroke("#f2f6fa", "#c6d3df");
  const celas: [string, string][] = [
    ["SALDO ANTERIOR", brlAbs(ALFA.saldoInicial)],
    ["TOTAL DE CRÉDITOS", brlAbs(creditos)],
    ["TOTAL DE DÉBITOS", brlAbs(debitos)],
    ["SALDO ATUAL", brlAbs(saldoFinal)],
  ];
  celas.forEach(([rot, val], i) => {
    const x = M + 12 + i * 128;
    doc.font("Helvetica").fontSize(7).fillColor("#6b7a8c").text(rot, x, boxY + 12, { width: 120 });
    doc.font("Helvetica-Bold").fontSize(11).fillColor("#14243a").text(val, x, boxY + 26, { width: 120 });
  });

  // Cabeçalho da tabela
  let y = boxY + 78;
  const cols = {
    data: { x: M + 4, w: 52 },
    hist: { x: M + 60, w: 208 },
    doc: { x: M + 272, w: 74 },
    valor: { x: M + 350, w: 78 },
    saldo: { x: M + 432, w: 79 },
  };
  doc.rect(M, y - 4, 515, 18).fill("#14243a");
  doc.font("Helvetica-Bold").fontSize(8).fillColor("#ffffff");
  doc.text("DATA", cols.data.x, y, { width: cols.data.w });
  doc.text("HISTÓRICO", cols.hist.x, y, { width: cols.hist.w });
  doc.text("DOCUMENTO", cols.doc.x, y, { width: cols.doc.w });
  doc.text("VALOR (R$)", cols.valor.x, y, { width: cols.valor.w, align: "right" });
  doc.text("SALDO (R$)", cols.saldo.x, y, { width: cols.saldo.w, align: "right" });

  y += 20;
  doc.font("Courier").fontSize(8.5);
  ALFA.movs.forEach((m, i) => {
    if (i % 2 === 1) doc.rect(M, y - 3, 515, 15).fill("#f6f9fb");
    doc.fillColor("#243447");
    doc.text(dataBR(m.dia), cols.data.x, y, { width: cols.data.w });
    doc.text(m.hist, cols.hist.x, y, { width: cols.hist.w, ellipsis: true, lineBreak: false });
    doc.text(m.doc, cols.doc.x, y, { width: cols.doc.w });
    doc.fillColor(m.valor < 0 ? "#a11" : "#161");
    doc.text(brlSigned(m.valor), cols.valor.x, y, { width: cols.valor.w, align: "right" });
    doc.fillColor("#243447");
    doc.text(brlAbs(seq[i]), cols.saldo.x, y, { width: cols.saldo.w, align: "right" });
    y += 15;
  });

  doc.moveTo(M, y + 2).lineTo(M + 515, y + 2).lineWidth(0.75).strokeColor("#c6d3df").stroke();
  doc.font("Helvetica").fontSize(7).fillColor("#8a97a6");
  doc.text(
    "Extrato meramente informativo. Consulte o app para comprovantes.",
    M,
    y + 8,
  );
}

// --------------------------------------------------------------------------
// FIXTURE 2 — extrato-beta.pdf
// Retrato, margem larga, minimalista. Fonte serifada (Times). SEM caixa de
// saldo e SEM coluna de saldo acumulado. Colunas reordenadas:
// Histórico | Data | Nº Doc | Débito | Crédito  (colunas separadas, sem sinal).
// --------------------------------------------------------------------------
function desenharBeta(doc: PDFKit.PDFDocument): void {
  const M = 64;
  const W = 595 - M * 2;

  doc.fillColor("#1c1c1c").font("Times-Bold").fontSize(13);
  doc.text("BANCO BETA  ·  EXTRATO MENSAL", M, M, { characterSpacing: 1.5 });
  doc.font("Times-Roman").fontSize(9.5).fillColor("#3d3d3d");
  doc.text(
    "Conta 10293-8    Agência 0455    Titular: Beta Consultoria Empresarial Ltda",
    M,
    M + 22,
  );
  doc.text("Movimentação de 01/08/2026 a 31/08/2026", M, M + 35);

  let y = M + 58;
  doc.moveTo(M, y).lineTo(M + W, y).lineWidth(0.5).strokeColor("#8f8f8f").stroke();
  y += 10;

  const cols = {
    hist: { x: M, w: 226 },
    data: { x: M + 232, w: 62 },
    doc: { x: M + 296, w: 46 },
    deb: { x: M + 344, w: 60 },
    cred: { x: M + 406, w: 61 },
  };
  doc.font("Times-Bold").fontSize(8.5).fillColor("#1c1c1c");
  doc.text("HISTÓRICO", cols.hist.x, y, { width: cols.hist.w });
  doc.text("DATA", cols.data.x, y, { width: cols.data.w });
  doc.text("Nº DOC", cols.doc.x, y, { width: cols.doc.w });
  doc.text("DÉBITO", cols.deb.x, y, { width: cols.deb.w, align: "right" });
  doc.text("CRÉDITO", cols.cred.x, y, { width: cols.cred.w, align: "right" });
  y += 16;

  doc.font("Times-Roman").fontSize(9.5).fillColor("#1c1c1c");
  for (const m of BETA.movs) {
    doc.text(m.hist, cols.hist.x, y, { width: cols.hist.w, ellipsis: true, lineBreak: false });
    doc.text(dataBR(m.dia), cols.data.x, y, { width: cols.data.w });
    doc.text(m.doc, cols.doc.x, y, { width: cols.doc.w });
    if (m.valor < 0) {
      doc.text(brlAbs(m.valor), cols.deb.x, y, { width: cols.deb.w, align: "right" });
    } else {
      doc.text(brlAbs(m.valor), cols.cred.x, y, { width: cols.cred.w, align: "right" });
    }
    y += 17;
  }

  y += 6;
  doc.moveTo(M, y).lineTo(M + W, y).lineWidth(0.5).strokeColor("#8f8f8f").stroke();
  doc.font("Times-Italic").fontSize(8).fillColor("#5d5d5d");
  doc.text(
    "Documento gerado eletronicamente. Não é válido como comprovante fiscal.",
    M,
    y + 8,
  );
}

// --------------------------------------------------------------------------
// FIXTURE 3 — extrato-gama.pdf
// PAISAGEM. Faixa colorida no topo. Helvetica em tudo. Linha "SALDO ANTERIOR"
// destacada, régua entre todas as linhas. Colunas:
// Lançamento | Dt Movim. | Dt Balancete | Valor | Saldo
// Valores com sufixo " D"/" C" (sem sinal). Linha de total em negrito.
// --------------------------------------------------------------------------
function desenharGama(doc: PDFKit.PDFDocument): void {
  const M = 36;
  const W = 842 - M * 2;
  const seq = saldos(GAMA.saldoInicial, GAMA.movs);
  const saldoFinal = seq[seq.length - 1];

  doc.rect(0, 0, 842, 62).fill("#0f2b46");
  doc.fillColor("#ffffff").font("Helvetica-Bold").fontSize(17).text("BANCO GAMA S.A.", M, 16);
  doc.font("Helvetica").fontSize(9).fillColor("#bcd0e4");
  doc.text(
    "EXTRATO DE CONTA CORRENTE   —   AGÊNCIA 3390 / CONTA 77712-1",
    M,
    40,
  );

  let y = 82;
  doc.fillColor("#3a3a3a").font("Helvetica").fontSize(8);
  doc.text(
    "Período: 01/08/2026 a 31/08/2026        Cliente: Transportadora Rota Certa Ltda",
    M,
    y,
  );
  y += 20;

  const cols = {
    hist: { x: M, w: 288 },
    mov: { x: M + 292, w: 68 },
    bal: { x: M + 362, w: 74 },
    valor: { x: M + 440, w: 150 },
    saldo: { x: M + 594, w: 176 },
  };
  doc.font("Helvetica-Bold").fontSize(8.5).fillColor("#0f2b46");
  doc.text("LANÇAMENTO", cols.hist.x, y, { width: cols.hist.w });
  doc.text("DT MOVIM.", cols.mov.x, y, { width: cols.mov.w });
  doc.text("DT BALANCETE", cols.bal.x, y, { width: cols.bal.w });
  doc.text("VALOR", cols.valor.x, y, { width: cols.valor.w, align: "right" });
  doc.text("SALDO", cols.saldo.x, y, { width: cols.saldo.w, align: "right" });
  y += 13;
  doc.moveTo(M, y).lineTo(M + W, y).lineWidth(1).strokeColor("#0f2b46").stroke();
  y += 8;

  // Linha de saldo anterior destacada
  doc.font("Helvetica-Oblique").fontSize(9).fillColor("#5b6b7d");
  doc.text("SALDO ANTERIOR", cols.hist.x, y, { width: cols.hist.w });
  doc.text("01/08/2026", cols.mov.x, y, { width: cols.mov.w });
  doc.font("Helvetica-Bold").fontSize(9).fillColor("#0f2b46");
  doc.text(`${brlAbs(GAMA.saldoInicial)} C`, cols.saldo.x, y, {
    width: cols.saldo.w,
    align: "right",
  });
  y += 16;
  doc.moveTo(M, y - 2).lineTo(M + W, y - 2).lineWidth(0.5).strokeColor("#dbe2e8").stroke();

  doc.font("Helvetica").fontSize(9);
  GAMA.movs.forEach((m, i) => {
    doc.fillColor("#22303f").text(m.hist, cols.hist.x, y, {
      width: cols.hist.w,
      ellipsis: true,
      lineBreak: false,
    });
    doc.text(dataBR(m.dia), cols.mov.x, y, { width: cols.mov.w });
    doc.text(dataBR(m.dia), cols.bal.x, y, { width: cols.bal.w });
    doc.fillColor(m.valor < 0 ? "#8a1c1c" : "#14622f");
    doc.text(`${brlAbs(m.valor)} ${dc(m.valor)}`, cols.valor.x, y, {
      width: cols.valor.w,
      align: "right",
    });
    doc.fillColor("#22303f");
    doc.text(`${brlAbs(seq[i])} ${dc(seq[i])}`, cols.saldo.x, y, {
      width: cols.saldo.w,
      align: "right",
    });
    y += 17;
    doc.moveTo(M, y - 3).lineTo(M + W, y - 3).lineWidth(0.5).strokeColor("#e6ebef").stroke();
  });

  y += 6;
  doc.moveTo(M, y).lineTo(M + W, y).lineWidth(1.2).strokeColor("#0f2b46").stroke();
  y += 6;
  doc.font("Helvetica-Bold").fontSize(10).fillColor("#0f2b46");
  doc.text("SALDO EM CONTA CORRENTE EM 31/08/2026", cols.hist.x, y, { width: 360 });
  doc.text(`${brlAbs(saldoFinal)} ${dc(saldoFinal)}`, cols.saldo.x, y, {
    width: cols.saldo.w,
    align: "right",
  });
}

// --------------------------------------------------------------------------
// FIXTURE 4 — extrato-foto.jpg
// Extrato "fotografado": canvas com fundo de papel (gradiente), ruído,
// vinheta, leve rotação e cisalhamento. Texto monoespaçado com leaders
// pontilhados. Salvo como JPEG (artefatos de compressão ajudam o efeito).
// --------------------------------------------------------------------------
function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

async function gerarFoto(): Promise<string> {
  const W = 1000;
  const H = 1414;
  const canvas = createCanvas(W, H);
  const ctx = canvas.getContext("2d");
  const rand = mulberry32(20260801);
  const seq = saldos(DELTA.saldoInicial, DELTA.movs);
  const saldoFinal = seq[seq.length - 1];

  // Fundo de papel: gradiente radial claro -> cinza nas bordas.
  const grad = ctx.createRadialGradient(W * 0.42, H * 0.34, 120, W * 0.5, H * 0.5, H * 0.75);
  grad.addColorStop(0, "#fdfdfb");
  grad.addColorStop(0.7, "#f0efe9");
  grad.addColorStop(1, "#d5d3ca");
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, W, H);

  // Banda de sombra diagonal (dobra do papel / sombra do celular).
  ctx.save();
  ctx.globalAlpha = 0.06;
  ctx.translate(W * 0.5, H * 0.5);
  ctx.rotate(-0.5);
  ctx.fillStyle = "#000000";
  ctx.fillRect(-W, -60, W * 2, 120);
  ctx.restore();

  // Ruído (grão de foto).
  for (let i = 0; i < 14000; i += 1) {
    const x = rand() * W;
    const y = rand() * H;
    const dark = rand() > 0.5;
    ctx.fillStyle = dark ? "rgba(0,0,0,0.05)" : "rgba(255,255,255,0.06)";
    ctx.fillRect(x, y, 1.5, 1.5);
  }

  // Conteúdo do extrato — grupo inteiro levemente girado + cisalhado.
  ctx.save();
  ctx.translate(W / 2, H / 2);
  ctx.rotate(-0.042); // ~ -2.4 graus
  ctx.transform(1, 0.006, -0.009, 1, 0, 0);
  ctx.translate(-W / 2, -H / 2);

  const left = 96;
  const desenhaLinha = (txt: string, x: number, y: number, cor: string, fonte: string) => {
    // desenha duas vezes: leve "sangria" de tinta para parecer foto
    ctx.font = fonte;
    ctx.fillStyle = "rgba(0,0,0,0.10)";
    ctx.fillText(txt, x + 1.2, y + 1.2);
    ctx.fillStyle = cor;
    ctx.fillText(txt, x, y);
  };

  desenhaLinha("BANCO DELTA", left, 150, "#161616", "bold 46px sans-serif");
  desenhaLinha(
    "EXTRATO SIMPLIFICADO  -  AGOSTO/2026",
    left,
    196,
    "#2c2c2c",
    "24px sans-serif",
  );
  desenhaLinha(
    "Ag 0001   Conta 55501-0",
    left,
    228,
    "#2c2c2c",
    "24px sans-serif",
  );
  desenhaLinha(
    "Epsilon Tecnologia da Informacao Ltda",
    left,
    258,
    "#2c2c2c",
    "24px sans-serif",
  );

  ctx.strokeStyle = "rgba(0,0,0,0.45)";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(left, 286);
  ctx.lineTo(W - 90, 292);
  ctx.stroke();

  desenhaLinha(
    `SALDO ANTERIOR EM 01/08 ${brlAbs(DELTA.saldoInicial).padStart(38 - "SALDO ANTERIOR EM 01/08 ".length, ".")}`,
    left,
    330,
    "#1b1b1b",
    "24px monospace",
  );

  let y = 384;
  for (const m of DELTA.movs) {
    const hist = `${m.hist} `.padEnd(32, ".").slice(0, 32);
    const val = `${m.valor < 0 ? "-" : "+"}${brlAbs(m.valor)}`.padStart(13, " ");
    desenhaLinha(
      `${String(m.dia).padStart(2, "0")}/08  ${hist} ${val}`,
      left,
      y,
      m.valor < 0 ? "#5a1414" : "#123f1f",
      "24px monospace",
    );
    y += 46;
  }

  y += 14;
  ctx.beginPath();
  ctx.moveTo(left, y - 30);
  ctx.lineTo(W - 90, y - 24);
  ctx.stroke();
  desenhaLinha(
    `SALDO DISPONIVEL EM 31/08 ${brlAbs(saldoFinal).padStart(36 - "SALDO DISPONIVEL EM 31/08 ".length, ".")}`,
    left,
    y + 8,
    "#161616",
    "bold 24px monospace",
  );

  ctx.restore();

  // Vinheta escura nas bordas.
  const vig = ctx.createRadialGradient(W / 2, H / 2, H * 0.36, W / 2, H / 2, H * 0.74);
  vig.addColorStop(0, "rgba(0,0,0,0)");
  vig.addColorStop(1, "rgba(0,0,0,0.16)");
  ctx.fillStyle = vig;
  ctx.fillRect(0, 0, W, H);

  // Brilho de flash no canto superior direito — sutil, longe do texto.
  const flash = ctx.createRadialGradient(W * 0.92, H * 0.06, 8, W * 0.92, H * 0.06, 230);
  flash.addColorStop(0, "rgba(255,255,255,0.16)");
  flash.addColorStop(1, "rgba(255,255,255,0)");
  ctx.fillStyle = flash;
  ctx.fillRect(0, 0, W, H);

  const buf = canvas.toBuffer("image/jpeg", 0.7);
  const caminho = join(AQUI, "extrato-foto.jpg");
  const { writeFileSync } = await import("node:fs");
  writeFileSync(caminho, buf);
  return caminho;
}

// --------------------------------------------------------------------------
async function main(): Promise<void> {
  const feitos: string[] = [];
  feitos.push(
    await renderPdf("extrato-alfa.pdf", { size: "A4", layout: "portrait", margin: 40 }, desenharAlfa),
  );
  feitos.push(
    await renderPdf("extrato-beta.pdf", { size: "A4", layout: "portrait", margin: 64 }, desenharBeta),
  );
  feitos.push(
    await renderPdf("extrato-gama.pdf", { size: "A4", layout: "landscape", margin: 36 }, desenharGama),
  );
  feitos.push(await gerarFoto());

  for (const f of feitos) {
    console.log(`  ✓ ${f}`);
  }
  console.log(`\n${feitos.length} fixtures gerados em ${AQUI}`);
}

main().catch((erro) => {
  console.error(erro);
  process.exit(1);
});
