"use client";

import { useMemo, useState } from "react";
import type { DocumentoResumo } from "@/lib/documentos/consultas-sc01";
import {
  bancosDisponiveis,
  filtrarDocumentos,
  ordenarDocumentos,
  type FiltrosDocumento,
  type OrdenacaoDocumento,
} from "@/lib/documentos/filtros-documentos";
import { SpecularButton } from "@/components/ui/SpecularButton";
import { TabelaDocumentos } from "./TabelaDocumentos";

type ColunaOrdenavel = "cliente" | "chegada" | "status" | "linhas";

const CAMPO =
  "rounded-lg border border-grafite/25 bg-white px-3 py-1.5 font-texto text-sm text-tinta outline-none transition-colors focus:border-turquesa focus:ring-2 focus:ring-turquesa/20 motion-reduce:transition-none";

const STATUS_OPCOES: { valor: FiltrosDocumento["status"]; rotulo: string }[] = [
  { valor: "TODOS", rotulo: "Todos os status" },
  { valor: "PENDENTE", rotulo: "Pendente" },
  { valor: "PROCESSADO", rotulo: "Processado" },
  { valor: "ERRO", rotulo: "Erro" },
];

export function PainelDocumentos({
  documentos,
  competenciaInicial,
}: {
  documentos: DocumentoResumo[];
  competenciaInicial: string;
}) {
  const [filtros, setFiltros] = useState<FiltrosDocumento>({
    busca: "",
    status: "TODOS",
    banco: "TODOS",
    competencia: competenciaInicial,
  });
  const [ordenacao, setOrdenacao] =
    useState<OrdenacaoDocumento>("chegada-desc");

  const bancos = useMemo(() => bancosDisponiveis(documentos), [documentos]);

  const visiveis = useMemo(
    () => ordenarDocumentos(filtrarDocumentos(documentos, filtros), ordenacao),
    [documentos, filtros, ordenacao],
  );

  const filtroAtivo =
    filtros.busca.trim() !== "" ||
    filtros.status !== "TODOS" ||
    filtros.banco !== "TODOS" ||
    filtros.competencia !== competenciaInicial;

  function limpar() {
    setFiltros({
      busca: "",
      status: "TODOS",
      banco: "TODOS",
      competencia: competenciaInicial,
    });
  }

  function aoOrdenar(coluna: ColunaOrdenavel) {
    setOrdenacao((o) =>
      o === `${coluna}-asc` ? `${coluna}-desc` : `${coluna}-asc`,
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-2.5">
        <div className="relative">
          <svg
            aria-hidden="true"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth={2}
            strokeLinecap="round"
            className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-grafite"
          >
            <circle cx="11" cy="11" r="7" />
            <path d="m20 20-3.5-3.5" />
          </svg>
          <input
            type="search"
            value={filtros.busca}
            onChange={(e) =>
              setFiltros((f) => ({ ...f, busca: e.target.value }))
            }
            placeholder="Buscar cliente ou arquivo…"
            aria-label="Buscar cliente ou arquivo"
            className={`${CAMPO} w-60 pl-8`}
          />
        </div>

        <select
          value={filtros.status}
          onChange={(e) =>
            setFiltros((f) => ({
              ...f,
              status: e.target.value as FiltrosDocumento["status"],
            }))
          }
          aria-label="Filtrar por status"
          className={CAMPO}
        >
          {STATUS_OPCOES.map((s) => (
            <option key={s.valor} value={s.valor}>
              {s.rotulo}
            </option>
          ))}
        </select>

        <select
          value={filtros.banco}
          onChange={(e) =>
            setFiltros((f) => ({ ...f, banco: e.target.value }))
          }
          aria-label="Filtrar por banco"
          className={CAMPO}
        >
          <option value="TODOS">Todos os bancos</option>
          {bancos.map((b) => (
            <option key={b} value={b}>
              {b}
            </option>
          ))}
        </select>

        <input
          type="month"
          value={filtros.competencia}
          onChange={(e) =>
            setFiltros((f) => ({ ...f, competencia: e.target.value }))
          }
          aria-label="Filtrar por competência"
          className={`${CAMPO} font-codigo tabular-nums`}
        />

        <span
          className="rounded-full bg-petroleo/10 px-2 py-0.5 font-codigo text-xs font-bold tabular-nums text-petroleo"
          aria-label={`${visiveis.length} documentos no resultado`}
        >
          {visiveis.length}
        </span>

        {filtroAtivo ? (
          <SpecularButton variante="fantasma" tamanho="sm" onClick={limpar}>
            Limpar
          </SpecularButton>
        ) : null}
      </div>

      <TabelaDocumentos
        documentos={visiveis}
        ordenacao={ordenacao}
        aoOrdenar={aoOrdenar}
      />
    </div>
  );
}
