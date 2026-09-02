"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { NATUREZAS } from "@/lib/documentos/historico";
import { SpecularButton } from "@/components/ui/SpecularButton";

const CAMPO =
  "rounded-lg border border-grafite/25 bg-white px-3 py-1.5 font-texto text-sm text-tinta outline-none transition-colors focus:border-turquesa focus:ring-2 focus:ring-turquesa/20 motion-reduce:transition-none";
const ROTULO =
  "flex flex-col gap-1 font-codigo text-[11px] font-medium uppercase tracking-wide text-grafite";

const LEGENDA: { cor: string; classe: string; texto: string }[] = [
  { cor: "turquesa", classe: "bg-turquesa", texto: "Envio, leitura e OFX" },
  {
    cor: "ambar",
    classe: "bg-ambar",
    texto: "Conferência, reprocesso, cobrança e configuração",
  },
  { cor: "carmim", classe: "bg-carmim", texto: "Falha e exclusão" },
];

export function FiltrosAuditoriaDocumentos({
  clientes,
  valores,
}: {
  clientes: { id: string; razaoSocial: string }[];
  valores: { cliente?: string; evento?: string; de?: string; ate?: string };
}) {
  const router = useRouter();
  const [cliente, setCliente] = useState(valores.cliente ?? "");
  const [evento, setEvento] = useState(valores.evento ?? "");
  const [de, setDe] = useState(valores.de ?? "");
  const [ate, setAte] = useState(valores.ate ?? "");

  function montarParams() {
    const p = new URLSearchParams({ aba: "auditoria" });
    if (cliente) p.set("cliente", cliente);
    if (evento) p.set("evento", evento);
    if (de) p.set("de", de);
    if (ate) p.set("ate", ate);
    return p;
  }

  function aplicar() {
    router.push(`/modulos/sc-01?${montarParams().toString()}`);
  }

  function limpar() {
    setCliente("");
    setEvento("");
    setDe("");
    setAte("");
    router.push("/modulos/sc-01?aba=auditoria");
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-end gap-3 rounded-xl border border-grafite/15 bg-white p-4">
        <label className={ROTULO}>
          Cliente
          <select
            value={cliente}
            onChange={(e) => setCliente(e.target.value)}
            className={CAMPO}
          >
            <option value="">Todos</option>
            {clientes.map((c) => (
              <option key={c.id} value={c.id}>
                {c.razaoSocial}
              </option>
            ))}
          </select>
        </label>

        <label className={ROTULO}>
          Evento
          <select
            value={evento}
            onChange={(e) => setEvento(e.target.value)}
            className={CAMPO}
          >
            <option value="">Todos</option>
            {NATUREZAS.map((n) => (
              <option key={n.valor} value={n.valor}>
                {n.rotulo}
              </option>
            ))}
          </select>
        </label>

        <label className={ROTULO}>
          De
          <input
            type="date"
            value={de}
            onChange={(e) => setDe(e.target.value)}
            className={CAMPO}
          />
        </label>

        <label className={ROTULO}>
          Até
          <input
            type="date"
            value={ate}
            onChange={(e) => setAte(e.target.value)}
            className={CAMPO}
          />
        </label>

        <SpecularButton variante="primario" tamanho="sm" onClick={aplicar}>
          Filtrar
        </SpecularButton>
        <SpecularButton variante="fantasma" tamanho="sm" onClick={limpar}>
          Limpar
        </SpecularButton>
        <a
          href={`/modulos/sc-01/historico/relatorio?${montarParams().toString()}`}
          className="ml-auto inline-flex items-center gap-1.5 font-texto text-sm font-medium text-turquesa underline-offset-2 hover:underline"
        >
          <svg
            aria-hidden="true"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth={1.75}
            strokeLinecap="round"
            strokeLinejoin="round"
            className="h-4 w-4"
          >
            <path d="M12 3v12m0 0 4-4m-4 4-4-4M5 21h14" />
          </svg>
          Baixar CSV
        </a>
      </div>

      <div className="flex flex-wrap items-center gap-x-5 gap-y-1.5 px-1 font-texto text-xs text-grafite">
        <span className="font-codigo text-[11px] font-medium uppercase tracking-wide text-grafite/70">
          Legenda
        </span>
        {LEGENDA.map((l) => (
          <span key={l.cor} className="inline-flex items-center gap-1.5">
            <span
              aria-hidden="true"
              className={`h-2 w-2 rounded-full ${l.classe}`}
            />
            {l.texto}
          </span>
        ))}
      </div>
    </div>
  );
}
