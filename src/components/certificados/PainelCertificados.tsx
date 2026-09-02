"use client";

import type { CertificadoLinha } from "@/lib/certificados/consultas";
import type { Ordenacao } from "@/lib/certificados/filtros";
import { textoDias } from "@/lib/certificados/bucket";
import { dataParaInput, formatarDataUTC } from "@/lib/certificados/formato";
import { SpecularButton } from "@/components/ui/SpecularButton";
import { SeloBucket } from "./SeloBucket";
import { BotaoRemover } from "./BotaoRemover";

const ROTULO_TIPO: Record<CertificadoLinha["tipo"], string> = {
  ECNPJ: "e-CNPJ",
  ECPF: "e-CPF",
  NFE: "NF-e",
};

type Coluna = "cliente" | "tipo" | "validade" | "dias";

const TH =
  "sticky top-0 z-10 bg-nevoa px-4 py-2.5 font-texto text-xs font-semibold uppercase tracking-wide text-grafite shadow-[0_1px_0_rgba(90,112,120,0.25)]";
const TD = "px-4 py-3 align-middle";

function Cabecalho({
  rotulo,
  coluna,
  ordenacao,
  aoOrdenar,
  className = "",
}: {
  rotulo: string;
  coluna: Coluna;
  ordenacao: Ordenacao;
  aoOrdenar: (c: Coluna) => void;
  className?: string;
}) {
  const asc = ordenacao === `${coluna}-asc`;
  const desc = ordenacao === `${coluna}-desc`;
  const ativo = asc || desc;
  return (
    <th scope="col" className={`${TH} ${className}`}>
      <button
        type="button"
        onClick={() => aoOrdenar(coluna)}
        className="inline-flex items-center gap-1 rounded font-semibold uppercase tracking-wide transition-colors hover:text-tinta focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-petroleo"
      >
        {rotulo}
        <span
          aria-hidden="true"
          className={`text-[0.7em] leading-none ${ativo ? "text-petroleo" : "text-grafite/35"}`}
        >
          {desc ? "▼" : "▲"}
        </span>
      </button>
    </th>
  );
}

export function PainelCertificados({
  certificados,
  ordenacao,
  aoOrdenar,
  aoEditar,
  aoAbrirCliente,
  aoRenovar,
  aoAvisar,
  temFiltro = false,
  aoLimpar,
}: {
  certificados: CertificadoLinha[];
  ordenacao: Ordenacao;
  aoOrdenar: (c: Coluna) => void;
  aoEditar: (id: string) => void;
  aoAbrirCliente: (clienteId: string) => void;
  aoRenovar: (certificado: CertificadoLinha) => void;
  aoAvisar: (certificado: CertificadoLinha) => void;
  temFiltro?: boolean;
  aoLimpar?: () => void;
}) {
  if (certificados.length === 0) {
    return (
      <div className="flex flex-col items-center gap-2 rounded-xl border border-grafite/15 bg-white px-6 py-14 text-center">
        <svg
          aria-hidden="true"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth={1.5}
          strokeLinecap="round"
          strokeLinejoin="round"
          className="h-8 w-8 text-grafite/50"
        >
          <path d="M7 3h7l5 5v13H7z" />
          <path d="M14 3v5h5" />
          <circle cx="11.5" cy="14" r="2.5" />
          <path d="M9.8 16 8 20l2.4-1.3L12.8 20 11 16" />
        </svg>
        <p className="font-titulo text-sm font-bold text-tinta">
          {temFiltro ? "Nenhum certificado com esses filtros" : "Nenhum certificado cadastrado"}
        </p>
        <p className="max-w-sm font-texto text-sm text-grafite">
          {temFiltro
            ? "Ajuste a busca ou os filtros para ver a carteira."
            : "Use o botão Novo certificado para adicionar o primeiro."}
        </p>
        {temFiltro && aoLimpar ? (
          <SpecularButton variante="secundario" tamanho="sm" onClick={aoLimpar} className="mt-1">
            Limpar filtros
          </SpecularButton>
        ) : null}
      </div>
    );
  }

  return (
    <div className="max-h-[68vh] overflow-auto rounded-xl border border-grafite/15 bg-white">
      <table className="w-full min-w-[720px] border-collapse font-texto text-sm">
        <caption className="sr-only">Certificados digitais da carteira</caption>
        <thead>
          <tr className="text-left">
            <Cabecalho rotulo="Cliente" coluna="cliente" ordenacao={ordenacao} aoOrdenar={aoOrdenar} />
            <th scope="col" className={TH}>Titular</th>
            <Cabecalho rotulo="Tipo" coluna="tipo" ordenacao={ordenacao} aoOrdenar={aoOrdenar} />
            <Cabecalho rotulo="Validade" coluna="validade" ordenacao={ordenacao} aoOrdenar={aoOrdenar} />
            <Cabecalho rotulo="Dias" coluna="dias" ordenacao={ordenacao} aoOrdenar={aoOrdenar} />
            <th scope="col" className={TH}>Faixa</th>
            <th scope="col" className={`${TH} text-right`}>
              <span className="sr-only">Ações</span>
            </th>
          </tr>
        </thead>
        <tbody>
          {certificados.map((c) => (
            <tr
              key={c.id}
              className="border-b border-grafite/10 transition-colors last:border-0 hover:bg-nevoa/50 motion-reduce:transition-none"
            >
              <td className={`${TD} font-medium`}>
                <button
                  type="button"
                  onClick={() => aoAbrirCliente(c.clienteId)}
                  className="rounded text-left text-turquesa underline-offset-2 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-turquesa"
                >
                  {c.razaoSocial}
                </button>
              </td>
              <td className={`${TD} text-grafite`}>{c.titular}</td>
              <td className={`${TD} text-grafite`}>{ROTULO_TIPO[c.tipo]}</td>
              <td className={`${TD} font-codigo text-xs tabular-nums text-grafite`}>
                <time dateTime={dataParaInput(c.dataValidade)}>{formatarDataUTC(c.dataValidade)}</time>
              </td>
              <td
                className={`${TD} whitespace-nowrap font-codigo text-xs tabular-nums ${
                  c.bucket === "VENCIDO" ? "text-carmim" : "text-grafite"
                }`}
              >
                {textoDias(c.diasRestantes)}
              </td>
              <td className={TD}>
                <SeloBucket bucket={c.bucket} />
              </td>
              <td className={`${TD} text-right`}>
                <div className="flex items-center justify-end gap-2">
                  {c.bucket === "VENCIDO" ? (
                    <SpecularButton variante="secundario" tamanho="sm" onClick={() => aoRenovar(c)}>
                      Renovar
                    </SpecularButton>
                  ) : null}
                  {c.bucket === "D3" && !c.avisoD3Em ? (
                    <SpecularButton variante="secundario" tamanho="sm" onClick={() => aoAvisar(c)}>
                      Avisar
                    </SpecularButton>
                  ) : null}
                  <SpecularButton variante="fantasma" tamanho="sm" onClick={() => aoEditar(c.id)}>
                    Editar
                  </SpecularButton>
                  <BotaoRemover id={c.id} />
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
