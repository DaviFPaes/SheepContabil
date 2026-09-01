"use client";

import type { CertificadoLinha } from "@/lib/certificados/consultas";
import { textoDias } from "@/lib/certificados/bucket";
import { dataParaInput, formatarDataUTC } from "@/lib/certificados/formato";
import { SeloBucket } from "./SeloBucket";
import { BotaoRemover } from "./BotaoRemover";

const ROTULO_TIPO: Record<CertificadoLinha["tipo"], string> = {
  ECNPJ: "e-CNPJ",
  ECPF: "e-CPF",
  NFE: "NF-e",
};

const CELULA = "px-4 py-3 align-middle";
const TH =
  "px-4 py-2.5 font-texto text-xs font-semibold uppercase tracking-wide text-grafite";

export function PainelCertificados({
  certificados,
  aoEditar,
  aoAbrirCliente,
}: {
  certificados: CertificadoLinha[];
  aoEditar: (id: string) => void;
  aoAbrirCliente: (clienteId: string) => void;
}) {
  if (certificados.length === 0) {
    return (
      <div className="flex flex-col items-center gap-2 rounded-lg border border-grafite/20 bg-white px-6 py-10 text-center shadow-sm">
        <svg
          aria-hidden="true"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth={1.5}
          strokeLinecap="round"
          strokeLinejoin="round"
          className="h-8 w-8 text-grafite/60"
        >
          <path d="M7 3h7l5 5v13H7z" />
          <path d="M14 3v5h5" />
          <circle cx="11.5" cy="14" r="2.5" />
          <path d="M9.8 16 8 20l2.4-1.3L12.8 20 11 16" />
        </svg>
        <p className="font-titulo text-sm font-bold text-tinta">
          Nenhum certificado cadastrado
        </p>
        <p className="max-w-sm font-texto text-sm text-grafite">
          Use o botão <strong>Novo certificado</strong> para adicionar o primeiro.
        </p>
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-lg border border-grafite/20 bg-white shadow-sm">
      <div className="overflow-x-auto">
        <table className="w-full border-collapse font-texto text-sm">
          <caption className="sr-only">
            Certificados digitais cadastrados, ordenados por validade
          </caption>
          <thead>
            <tr className="border-b border-grafite/20 bg-nevoa/60 text-left">
              <th scope="col" className={TH}>Cliente</th>
              <th scope="col" className={TH}>Titular</th>
              <th scope="col" className={TH}>Tipo</th>
              <th scope="col" className={TH}>Validade</th>
              <th scope="col" className={TH}>Situação</th>
              <th scope="col" className={TH}>Faixa</th>
              <th scope="col" className="px-4 py-2.5 text-right">
                <span className="sr-only">Ações</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {certificados.map((certificado) => (
              <tr
                key={certificado.id}
                className="border-b border-grafite/10 transition-colors last:border-0 hover:bg-nevoa/70 motion-reduce:transition-none"
              >
                <td className={`${CELULA} font-medium text-tinta`}>
                  <button
                    type="button"
                    onClick={() => aoAbrirCliente(certificado.clienteId)}
                    className="rounded text-left text-turquesa underline-offset-2 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-turquesa"
                  >
                    {certificado.razaoSocial}
                  </button>
                </td>
                <td className={`${CELULA} text-grafite`}>{certificado.titular}</td>
                <td className={`${CELULA} text-grafite`}>
                  {ROTULO_TIPO[certificado.tipo]}
                </td>
                <td className={`${CELULA} font-codigo text-xs tabular-nums text-grafite`}>
                  <time dateTime={dataParaInput(certificado.dataValidade)}>
                    {formatarDataUTC(certificado.dataValidade)}
                  </time>
                </td>
                <td className={`${CELULA} whitespace-nowrap font-codigo text-xs tabular-nums text-grafite`}>
                  {textoDias(certificado.diasRestantes)}
                </td>
                <td className={CELULA}>
                  <SeloBucket bucket={certificado.bucket} />
                </td>
                <td className={`${CELULA} text-right`}>
                  <div className="flex items-center justify-end gap-4">
                    <button
                      type="button"
                      onClick={() => aoEditar(certificado.id)}
                      className="inline-flex items-center gap-1 rounded font-texto text-xs font-medium text-turquesa underline-offset-2 transition-colors hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-turquesa motion-reduce:transition-none"
                    >
                      <svg
                        aria-hidden="true"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth={1.75}
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        className="h-3.5 w-3.5"
                      >
                        <path d="M4 20h4L18.5 9.5a2.12 2.12 0 0 0-3-3L5 17v3Z" />
                        <path d="M13.5 6.5l3 3" />
                      </svg>
                      Editar
                    </button>
                    <BotaoRemover id={certificado.id} />
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
