import { writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const AQUI = dirname(fileURLToPath(import.meta.url));

const OITO = [
  "Tomografia computadorizada de crânio",
  "Ressonância magnética de joelho",
  "Ultrassonografia abdominal total",
  "Radiografia de tórax PA e perfil",
  "Mamografia bilateral",
  "Densitometria óssea de coluna e fêmur",
  "Endoscopia digestiva alta",
  "Colonoscopia com biópsia",
  "Hemograma completo",
  "Dosagem de glicose e perfil lipídico",
  "Eletrocardiograma de repouso",
  "Sessão de quimioterapia",
  "Sessão de radioterapia",
  "Sessão de hemodiálise",
  "Análises clínicas - painel tireoidiano",
];
const TRINTA_E_DOIS = [
  "Consulta médica em consultório",
  "Consulta de retorno com especialista",
  "Perícia médica para seguradora",
  "Elaboração de laudo médico avulso",
  "Junta médica para avaliação de afastamento",
  "Parecer técnico em prontuário",
];

type ItemFix = { descricao: string; valor: number };

function preco(seed: number): number {
  return 60 + ((seed * 37) % 900) + 0.5;
}

function xmlDoItem(it: ItemFix): string {
  return `      <Item><Discriminacao>${it.descricao}</Discriminacao><Valor>${it.valor.toFixed(2)}</Valor></Item>`;
}

function nota(numero: string, dataEmissao: string, itens: ItemFix[]): string {
  const total = itens.reduce((s, i) => s + i.valor, 0);
  return [
    `<?xml version="1.0" encoding="UTF-8"?>`,
    `<NFSe>`,
    `  <InfNfse>`,
    `    <Numero>${numero}</Numero>`,
    `    <DataEmissao>${dataEmissao}</DataEmissao>`,
    `    <PrestadorServico><RazaoSocial>Clínica Vida Plena Diagnósticos</RazaoSocial></PrestadorServico>`,
    `    <ListaItens>`,
    ...itens.map(xmlDoItem),
    `    </ListaItens>`,
    `    <ValorTotal>${total.toFixed(2)}</ValorTotal>`,
    `  </InfNfse>`,
    `</NFSe>`,
    ``,
  ].join("\n");
}

// pequena: 6 itens, mistura clara
const pequena: ItemFix[] = [
  { descricao: OITO[0], valor: 480 },
  { descricao: OITO[3], valor: 120 },
  { descricao: TRINTA_E_DOIS[0], valor: 200 },
  { descricao: OITO[8], valor: 45 },
  { descricao: TRINTA_E_DOIS[2], valor: 350 },
  { descricao: OITO[5], valor: 190 },
];
writeFileSync(join(AQUI, "nfse-pequena.xml"), nota("2026-000101", "2026-08-05", pequena));

// media: ~20 itens, alguns fora do vocabulário dos termos (forçam a IA)
const mediaDescr = [
  ...OITO.slice(0, 10),
  ...TRINTA_E_DOIS,
  "Procedimento ambulatorial não especificado",
  "Atendimento de urgência - avaliação inicial",
  "Aplicação de medicação intravenosa",
  "Curativo especial com desbridamento",
];
const media: ItemFix[] = mediaDescr.map((descricao, i) => ({
  descricao,
  valor: preco(i + 3),
}));
writeFileSync(join(AQUI, "nfse-media.xml"), nota("2026-000102", "2026-08-12", media));

// grande: 387 itens, ciclando o pool + variações
const pool = [...OITO, ...TRINTA_E_DOIS];
const grande: ItemFix[] = Array.from({ length: 387 }, (_, i) => {
  const base = pool[i % pool.length];
  const sufixo = i % 5 === 0 ? ` - sessão ${Math.floor(i / pool.length) + 1}` : "";
  return { descricao: `${base}${sufixo}`, valor: preco(i) };
});
writeFileSync(join(AQUI, "nfse-grande.xml"), nota("2026-000103", "2026-08-20", grande));

console.log("Gerados: nfse-pequena.xml, nfse-media.xml, nfse-grande.xml");
