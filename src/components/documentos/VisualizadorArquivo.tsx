"use client";

import { useState } from "react";

// Visualizador do arquivo ORIGINAL do documento (coluna esquerda da tela de
// detalhe do SC-01). PDF vai num <iframe> com #view=FitH; imagem (JPG/PNG) vai
// num <img> com zoom por transform:scale, controlado por uma barra de botões.
// Só tokens da paleta.

const ZOOM_MIN = 0.5;
const ZOOM_MAX = 4;
const ZOOM_PASSO = 0.25;

const MOLDURA = "rounded-lg border border-grafite/20 bg-white";

const BOTAO_ZOOM =
  "inline-flex items-center gap-1 rounded-md border border-grafite/25 bg-white px-2.5 py-1 font-texto text-xs font-medium text-grafite transition-colors hover:border-petroleo hover:text-petroleo focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-petroleo disabled:cursor-not-allowed disabled:opacity-40 motion-reduce:transition-none";

function fixar(valor: number): number {
  return Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, Number(valor.toFixed(2))));
}

export function VisualizadorArquivo({
  src,
  mimeType,
  nomeArquivo,
}: {
  src: string;
  mimeType: string;
  nomeArquivo: string;
}) {
  const [zoom, setZoom] = useState(1);

  if (mimeType === "application/pdf") {
    return (
      <iframe
        src={`${src}#view=FitH`}
        title={nomeArquivo}
        className={`h-[min(78vh,880px)] w-full ${MOLDURA}`}
      />
    );
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-1.5">
        <button
          type="button"
          onClick={() => setZoom((z) => fixar(z - ZOOM_PASSO))}
          disabled={zoom <= ZOOM_MIN}
          className={BOTAO_ZOOM}
        >
          <span aria-hidden="true" className="font-codigo text-sm leading-none">
            −
          </span>
          Afastar
        </button>
        <button
          type="button"
          onClick={() => setZoom(1)}
          className={BOTAO_ZOOM}
        >
          Ajustar
        </button>
        <button
          type="button"
          onClick={() => setZoom((z) => fixar(z + ZOOM_PASSO))}
          disabled={zoom >= ZOOM_MAX}
          className={BOTAO_ZOOM}
        >
          <span aria-hidden="true" className="font-codigo text-sm leading-none">
            +
          </span>
          Aproximar
        </button>
        <span className="ml-auto font-codigo text-[11px] tabular-nums text-grafite">
          {Math.round(zoom * 100)}%
        </span>
      </div>

      <div className={`h-[min(78vh,880px)] overflow-auto ${MOLDURA}`}>
        <img
          src={src}
          alt={nomeArquivo}
          style={{ transform: `scale(${zoom})`, transformOrigin: "top left" }}
        />
      </div>
    </div>
  );
}
