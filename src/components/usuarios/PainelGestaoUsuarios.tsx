"use client";

import { useState } from "react";
import { SpecularButton } from "@/components/ui/SpecularButton";
import { SUBAREAS_MODULO } from "@/lib/permissoes/catalogo";
import { alternarPermissaoModulo, alternarPermissaoSubArea } from "@/lib/permissoes/acoes";

export type OperadorGestaoView = {
  id: string;
  nome: string;
  email: string;
  setor: string | null;
  modulosElegiveis: { codigo: string; nome: string }[];
  modulosLigados: string[];
  subAreasDesligadas: string[];
};

type EstadoOperador = {
  modulosLigados: Set<string>;
  subAreasDesligadas: Set<string>;
};

function paraEstado(o: OperadorGestaoView): EstadoOperador {
  return {
    modulosLigados: new Set(o.modulosLigados),
    subAreasDesligadas: new Set(o.subAreasDesligadas),
  };
}

function ToggleLinha({
  rotulo,
  ligado,
  desabilitado = false,
  onClick,
}: {
  rotulo: string;
  ligado: boolean;
  desabilitado?: boolean;
  onClick: () => void;
}) {
  return (
    <div className="flex items-center justify-between gap-3 py-1.5">
      <span className={`font-texto text-sm ${desabilitado ? "text-grafite/45" : "text-tinta"}`}>
        {rotulo}
      </span>
      <SpecularButton
        variante={ligado ? "primario" : "fantasma"}
        tamanho="sm"
        aria-pressed={ligado}
        aria-label={`${rotulo}: ${ligado ? "ligado" : "desligado"}`}
        disabled={desabilitado}
        onClick={onClick}
      >
        {ligado ? "Ligado" : "Desligado"}
      </SpecularButton>
    </div>
  );
}

export function PainelGestaoUsuarios({ operadores }: { operadores: OperadorGestaoView[] }) {
  const [selecionadoId, setSelecionadoId] = useState<string | null>(operadores[0]?.id ?? null);
  const [estados, setEstados] = useState<Record<string, EstadoOperador>>(() =>
    Object.fromEntries(operadores.map((o) => [o.id, paraEstado(o)])),
  );
  const [erro, setErro] = useState<string | null>(null);

  const selecionado = operadores.find((o) => o.id === selecionadoId) ?? null;
  const estado = selecionado ? estados[selecionado.id] : null;

  async function aoAlternarModulo(usuarioId: string, moduloCodigo: string, ligar: boolean) {
    setErro(null);
    setEstados((atual) => {
      const proximo = new Set(atual[usuarioId].modulosLigados);
      ligar ? proximo.add(moduloCodigo) : proximo.delete(moduloCodigo);
      return { ...atual, [usuarioId]: { ...atual[usuarioId], modulosLigados: proximo } };
    });

    const resultado = await alternarPermissaoModulo(usuarioId, moduloCodigo, ligar);
    if ("erro" in resultado) {
      setErro(resultado.erro);
      setEstados((atual) => {
        const proximo = new Set(atual[usuarioId].modulosLigados);
        ligar ? proximo.delete(moduloCodigo) : proximo.add(moduloCodigo);
        return { ...atual, [usuarioId]: { ...atual[usuarioId], modulosLigados: proximo } };
      });
    }
  }

  async function aoAlternarSubArea(
    usuarioId: string,
    moduloCodigo: string,
    subArea: string,
    ligar: boolean,
  ) {
    setErro(null);
    const chave = `${moduloCodigo}:${subArea}`;
    setEstados((atual) => {
      const proximo = new Set(atual[usuarioId].subAreasDesligadas);
      ligar ? proximo.delete(chave) : proximo.add(chave);
      return { ...atual, [usuarioId]: { ...atual[usuarioId], subAreasDesligadas: proximo } };
    });

    const resultado = await alternarPermissaoSubArea(usuarioId, moduloCodigo, subArea, ligar);
    if ("erro" in resultado) {
      setErro(resultado.erro);
      setEstados((atual) => {
        const proximo = new Set(atual[usuarioId].subAreasDesligadas);
        ligar ? proximo.add(chave) : proximo.delete(chave);
        return { ...atual, [usuarioId]: { ...atual[usuarioId], subAreasDesligadas: proximo } };
      });
    }
  }

  if (operadores.length === 0) {
    return <p className="font-texto text-sm text-grafite">Nenhum operador cadastrado ainda.</p>;
  }

  return (
    <div className="grid gap-6 sm:grid-cols-[16rem_1fr]">
      <ul className="flex flex-col gap-1">
        {operadores.map((o) => {
          const est = estados[o.id];
          const total = o.modulosElegiveis.filter((m) => est.modulosLigados.has(m.codigo)).length;
          return (
            <li key={o.id}>
              <button
                type="button"
                onClick={() => setSelecionadoId(o.id)}
                aria-pressed={o.id === selecionadoId}
                className={`w-full rounded-lg border px-3 py-2 text-left transition-colors motion-reduce:transition-none ${
                  o.id === selecionadoId
                    ? "border-petroleo bg-petroleo/5"
                    : "border-transparent hover:bg-nevoa"
                }`}
              >
                <span className="block font-texto text-sm font-semibold text-tinta">
                  {o.nome}
                </span>
                <span className="block font-codigo text-xs text-grafite">
                  {o.setor ?? "Sem setor"} · {total} de {o.modulosElegiveis.length} módulos
                </span>
              </button>
            </li>
          );
        })}
      </ul>

      {selecionado && estado ? (
        <div className="flex flex-col gap-5">
          <div>
            <h2 className="font-titulo text-lg font-bold text-tinta">{selecionado.nome}</h2>
            <p className="font-texto text-sm text-grafite">
              {selecionado.email} · {selecionado.setor ?? "Sem setor"}
            </p>
          </div>

          {erro ? (
            <p className="rounded-lg border border-carmim/30 bg-carmim/5 px-3 py-2 font-texto text-sm text-carmim">
              {erro}
            </p>
          ) : null}

          {selecionado.modulosElegiveis.length === 0 ? (
            <p className="font-texto text-sm text-grafite">
              Nenhum módulo do setor deste operador está implementado ainda.
            </p>
          ) : (
            <div className="flex flex-col divide-y divide-grafite/10">
              {selecionado.modulosElegiveis.map((modulo) => {
                const ligado = estado.modulosLigados.has(modulo.codigo);
                const subAreas = SUBAREAS_MODULO[modulo.codigo] ?? [];
                return (
                  <div key={modulo.codigo} className="py-3">
                    <ToggleLinha
                      rotulo={`${modulo.codigo} · ${modulo.nome}`}
                      ligado={ligado}
                      onClick={() => aoAlternarModulo(selecionado.id, modulo.codigo, !ligado)}
                    />
                    {subAreas.length > 0 ? (
                      <div className="mt-1 flex flex-col gap-0.5 border-l border-grafite/15 pl-4">
                        {subAreas.map((sub) => {
                          const chave = `${modulo.codigo}:${sub.chave}`;
                          const subLigada = !estado.subAreasDesligadas.has(chave);
                          return (
                            <ToggleLinha
                              key={sub.chave}
                              rotulo={sub.rotulo}
                              ligado={subLigada}
                              desabilitado={!ligado}
                              onClick={() =>
                                aoAlternarSubArea(
                                  selecionado.id,
                                  modulo.codigo,
                                  sub.chave,
                                  !subLigada,
                                )
                              }
                            />
                          );
                        })}
                      </div>
                    ) : null}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      ) : null}
    </div>
  );
}
