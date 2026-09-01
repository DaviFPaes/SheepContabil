"use client";

import { useEffect, useState } from "react";

export type Visao = "tabela" | "kanban";

const CHAVE = "sc20:visao";

function lerLocalStorage(): Visao | null {
  try {
    const v = localStorage.getItem(CHAVE);
    return v === "tabela" || v === "kanban" ? v : null;
  } catch {
    return null;
  }
}

function gravarLocalStorage(v: Visao) {
  try {
    localStorage.setItem(CHAVE, v);
  } catch {
    // localStorage indisponivel (modo privado etc.) — a preferencia so
    // nao persiste entre visitas; a sessao atual segue funcionando.
  }
}

// Controle segmentado Tabela | Kanban. A pagina (server) passa `visaoUrl`
// = o que veio de ?visao (ou null). Quando ?visao existe, ele vence e e
// gravado no localStorage; quando nao, a preferencia salva decide.
export function AlternadorVisao({
  visaoUrl,
  aoMudar,
}: {
  visaoUrl: Visao | null;
  aoMudar: (v: Visao) => void;
}) {
  // Primeiro render alinhado com o SSR: usa a URL ou "tabela". O ajuste
  // pelo localStorage acontece no efeito abaixo, ja no cliente.
  const [visao, setVisao] = useState<Visao>(visaoUrl ?? "tabela");

  useEffect(() => {
    if (visaoUrl) {
      gravarLocalStorage(visaoUrl);
      if (visaoUrl !== visao) {
        setVisao(visaoUrl);
        aoMudar(visaoUrl);
      }
      return;
    }
    const salva = lerLocalStorage();
    if (salva && salva !== visao) {
      setVisao(salva);
      aoMudar(salva);
    }
    // Intencional: roda so no mount / quando ?visao muda.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visaoUrl]);

  function escolher(v: Visao) {
    if (v === visao) return;
    setVisao(v);
    gravarLocalStorage(v);
    aoMudar(v);
  }

  return (
    <div
      role="group"
      aria-label="Alternar visão"
      className="inline-flex rounded-lg border border-grafite/25 bg-nevoa p-0.5 font-texto text-sm"
    >
      {(["tabela", "kanban"] as const).map((v) => {
        const ativo = v === visao;
        return (
          <button
            key={v}
            type="button"
            aria-pressed={ativo}
            onClick={() => escolher(v)}
            className={`rounded-md px-3 py-1.5 font-medium capitalize transition-colors motion-reduce:transition-none ${
              ativo
                ? "bg-petroleo text-nevoa shadow-sm"
                : "text-grafite hover:text-tinta"
            }`}
          >
            {v}
          </button>
        );
      })}
    </div>
  );
}
