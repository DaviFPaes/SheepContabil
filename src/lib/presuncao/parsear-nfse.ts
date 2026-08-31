import { XMLParser, XMLValidator } from "fast-xml-parser";

export class XmlInvalidoError extends Error {
  constructor(mensagem = "XML da NFS-e ilegível ou fora do formato esperado.") {
    super(mensagem);
    this.name = "XmlInvalidoError";
  }
}

export type ItemNfse = { descricao: string; valor: number };
export type NfseParseada = {
  numero: string;
  dataEmissao: string; // ISO yyyy-mm-dd
  valorTotal: number;
  itens: ItemNfse[];
};

const parser = new XMLParser({
  ignoreAttributes: true,
  removeNSPrefix: true, // <ns2:InfNfse> -> InfNfse
  parseTagValue: false, // manter tudo string; a conversão de número é nossa
  trimValues: true,
});

function texto(v: unknown): string {
  if (v === null || v === undefined) return "";
  return String(v).trim();
}

function paraNumero(v: unknown): number {
  const s = texto(v);
  if (s === "") return NaN; // vazio/ausente não é zero
  // vírgula presente => formato pt-BR: ponto é separador de milhar, vírgula é decimal.
  // sem vírgula => já é número simples (ponto é o decimal, ou não há decimal).
  const normalizado = s.includes(",") ? s.replace(/\./g, "").replace(",", ".") : s;
  return Number(normalizado);
}

function comoLista<T>(v: T | T[] | undefined): T[] {
  if (v === undefined || v === null) return [];
  return Array.isArray(v) ? v : [v];
}

export function parsearNfse(xml: string): NfseParseada {
  if (XMLValidator.validate(xml) !== true) {
    throw new XmlInvalidoError();
  }

  let raiz: Record<string, unknown>;
  try {
    raiz = parser.parse(xml) as Record<string, unknown>;
  } catch {
    throw new XmlInvalidoError();
  }

  // desce até InfNfse esteja onde estiver (NFSe > InfNfse, ou direto)
  const nfse = (raiz.NFSe ?? raiz) as Record<string, unknown>;
  const inf = (nfse.InfNfse ?? (raiz as Record<string, unknown>).InfNfse) as
    | Record<string, unknown>
    | undefined;
  if (!inf || typeof inf !== "object") throw new XmlInvalidoError();

  const numero = texto(inf.Numero);
  const dataEmissao = texto(inf.DataEmissao).slice(0, 10);
  const valorTotal = paraNumero(inf.ValorTotal);
  if (!Number.isFinite(valorTotal)) {
    throw new XmlInvalidoError("NFS-e sem valor total numérico.");
  }
  if (!numero || !/^\d{4}-\d{2}-\d{2}$/.test(dataEmissao)) {
    throw new XmlInvalidoError();
  }

  const lista = (inf.ListaItens ?? {}) as Record<string, unknown>;
  const brutos = comoLista(lista.Item as unknown);
  if (brutos.length === 0) throw new XmlInvalidoError("A NFS-e não tem itens.");

  const itens: ItemNfse[] = brutos.map((b) => {
    const item = b as Record<string, unknown>;
    const descricao = texto(item.Discriminacao);
    const valor = paraNumero(item.Valor);
    if (!descricao || !Number.isFinite(valor)) {
      throw new XmlInvalidoError("Item da NFS-e sem descrição ou valor válido.");
    }
    return { descricao, valor };
  });

  return { numero, dataEmissao, valorTotal, itens };
}
