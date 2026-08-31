import { describe, expect, it } from "vitest";
import { parsearNfse, XmlInvalidoError } from "./parsear-nfse";

const XML_OK = `<?xml version="1.0" encoding="UTF-8"?>
<NFSe>
  <InfNfse>
    <Numero>2026-000123</Numero>
    <DataEmissao>2026-08-07</DataEmissao>
    <ListaItens>
      <Item><Discriminacao>Tomografia computadorizada de crânio</Discriminacao><Valor>450.00</Valor></Item>
      <Item><Discriminacao>Consulta médica em consultório</Discriminacao><Valor>200,50</Valor></Item>
    </ListaItens>
    <ValorTotal>650.50</ValorTotal>
  </InfNfse>
</NFSe>`;

const XML_NAMESPACE = `<ns2:NFSe xmlns:ns2="http://x">
  <ns2:InfNfse>
    <ns2:Numero>9</ns2:Numero>
    <ns2:DataEmissao>2026-08-01</ns2:DataEmissao>
    <ns2:ListaItens>
      <ns2:Item><ns2:Discriminacao>Raio-X</ns2:Discriminacao><ns2:Valor>80</ns2:Valor></ns2:Item>
    </ns2:ListaItens>
    <ns2:ValorTotal>80</ns2:ValorTotal>
  </ns2:InfNfse>
</ns2:NFSe>`;

describe("parsearNfse", () => {
  it("extrai número, data e itens (valor com ponto ou vírgula)", () => {
    const nota = parsearNfse(XML_OK);
    expect(nota.numero).toBe("2026-000123");
    expect(nota.dataEmissao).toBe("2026-08-07");
    expect(nota.valorTotal).toBe(650.5);
    expect(nota.itens).toEqual([
      { descricao: "Tomografia computadorizada de crânio", valor: 450 },
      { descricao: "Consulta médica em consultório", valor: 200.5 },
    ]);
  });

  it("tolera prefixo de namespace e um único Item", () => {
    const nota = parsearNfse(XML_NAMESPACE);
    expect(nota.numero).toBe("9");
    expect(nota.itens).toHaveLength(1);
    expect(nota.itens[0]).toEqual({ descricao: "Raio-X", valor: 80 });
  });

  it("lança XmlInvalidoError em XML quebrado", () => {
    expect(() => parsearNfse("<NFSe><InfNfse>")).toThrow(XmlInvalidoError);
  });

  it("lança XmlInvalidoError quando falta InfNfse", () => {
    expect(() => parsearNfse("<NFSe></NFSe>")).toThrow(XmlInvalidoError);
  });

  it("lança XmlInvalidoError quando a lista de itens está vazia", () => {
    const xml = `<NFSe><InfNfse><Numero>1</Numero><DataEmissao>2026-08-01</DataEmissao><ListaItens></ListaItens><ValorTotal>0</ValorTotal></InfNfse></NFSe>`;
    expect(() => parsearNfse(xml)).toThrow(XmlInvalidoError);
  });

  it("lança XmlInvalidoError quando um item não tem valor numérico", () => {
    const xml = `<NFSe><InfNfse><Numero>1</Numero><DataEmissao>2026-08-01</DataEmissao><ListaItens><Item><Discriminacao>X</Discriminacao><Valor>abc</Valor></Item></ListaItens><ValorTotal>0</ValorTotal></InfNfse></NFSe>`;
    expect(() => parsearNfse(xml)).toThrow(XmlInvalidoError);
  });

  it("lança XmlInvalidoError quando um item tem <Valor> vazio", () => {
    const xml = `<NFSe><InfNfse><Numero>1</Numero><DataEmissao>2026-08-01</DataEmissao><ListaItens><Item><Discriminacao>X</Discriminacao><Valor></Valor></Item></ListaItens><ValorTotal>0</ValorTotal></InfNfse></NFSe>`;
    expect(() => parsearNfse(xml)).toThrow(XmlInvalidoError);
  });

  it("lança XmlInvalidoError quando falta <ValorTotal>", () => {
    const xml = `<NFSe><InfNfse><Numero>1</Numero><DataEmissao>2026-08-01</DataEmissao><ListaItens><Item><Discriminacao>X</Discriminacao><Valor>10</Valor></Item></ListaItens></InfNfse></NFSe>`;
    expect(() => parsearNfse(xml)).toThrow(XmlInvalidoError);
  });
});
