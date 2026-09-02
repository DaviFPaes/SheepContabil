"use client";

import { Fragment, useActionState, useEffect, useRef, useState } from "react";
import {
  detectarCabecalho,
  enviarDocumentos,
  type EstadoEnvio,
} from "@/lib/documentos/acoes-sc01";
import { SpecularButton } from "@/components/ui/SpecularButton";
import { Modal } from "@/components/certificados/Modal";
import {
  BlocoUploadExtrato,
  type BlocoValor,
  type ClienteOpcao,
  type ContaOpcao,
} from "./BlocoUploadExtrato";

type Bloco = { id: number; file: File | null; valor: BlocoValor };

const VALOR_BASE: BlocoValor = {
  clienteId: "",
  contaBancariaId: "",
  nomeArquivo: null,
  deteccao: "idle",
};

export function ModalEnviarExtratos({
  aberto,
  aoFechar,
  clientes,
  contasPorCliente,
}: {
  aberto: boolean;
  aoFechar: () => void;
  clientes: ClienteOpcao[];
  contasPorCliente: Record<string, ContaOpcao[]>;
}) {
  const proximoId = useRef(1);
  const [blocos, setBlocos] = useState<Bloco[]>(() => [
    { id: 0, file: null, valor: VALOR_BASE },
  ]);
  const [estado, acaoFormulario, pendente] = useActionState<EstadoEnvio, FormData>(
    enviarDocumentos,
    null,
  );

  // O envio bem-sucedido fecha o modal; o erro fica visível (no bloco ou no topo).
  useEffect(() => {
    if (estado && "ok" in estado && estado.ok) aoFechar();
  }, [estado, aoFechar]);

  function mudarValor(i: number, patch: Partial<BlocoValor>) {
    setBlocos((prev) =>
      prev.map((b, idx) =>
        idx === i ? { ...b, valor: { ...b.valor, ...patch } } : b,
      ),
    );
  }

  // Anexar um arquivo: marca "lendo", pede a leitura do cabeçalho e devolve
  // cliente/conta já preenchidos (ou "manual" se a IA não casou nada).
  async function aoArquivo(i: number, file: File) {
    setBlocos((prev) =>
      prev.map((b, idx) =>
        idx === i
          ? {
              ...b,
              file,
              valor: { ...b.valor, nomeArquivo: file.name, deteccao: "lendo" },
            }
          : b,
      ),
    );

    const fd = new FormData();
    fd.append("arquivo", file);
    const resultado = await detectarCabecalho(fd);

    if ("erro" in resultado) {
      mudarValor(i, { deteccao: "manual" });
      return;
    }
    mudarValor(i, {
      clienteId: resultado.clienteId ?? "",
      contaBancariaId: resultado.contaBancariaId ?? "",
      nomeArquivo: file.name,
      deteccao: resultado.clienteId ? "ok" : "manual",
    });
  }

  function adicionar() {
    setBlocos((prev) => [
      ...prev,
      { id: proximoId.current++, file: null, valor: VALOR_BASE },
    ]);
  }

  function remover(i: number) {
    setBlocos((prev) => prev.filter((_, idx) => idx !== i));
  }

  const total = blocos.length;
  const erroTopo =
    estado && "erro" in estado && estado.indice === undefined ? estado.erro : null;

  return (
    <Modal aberto={aberto} aoFechar={aoFechar} titulo="Enviar extratos">
      <form action={acaoFormulario} className="flex flex-col gap-4">
        <input type="hidden" name="quantidade" value={total} />

        <div className="flex flex-col gap-3">
          {blocos.map((bloco, i) => (
            <Fragment key={bloco.id}>
              <input
                type="hidden"
                name={`clienteId-${i}`}
                value={bloco.valor.clienteId}
              />
              <input
                type="hidden"
                name={`contaBancariaId-${i}`}
                value={bloco.valor.contaBancariaId}
              />
              <BlocoUploadExtrato
                indice={i}
                clientes={clientes}
                contasPorCliente={contasPorCliente}
                valor={bloco.valor}
                aoMudar={(patch) => mudarValor(i, patch)}
                aoArquivo={(file) => aoArquivo(i, file)}
                aoRemover={total > 1 ? () => remover(i) : undefined}
                erro={
                  estado && "erro" in estado && estado.indice === i
                    ? estado.erro
                    : undefined
                }
              />
            </Fragment>
          ))}
        </div>

        <button
          type="button"
          onClick={adicionar}
          className="rounded-lg border border-dashed border-grafite/40 py-2.5 font-texto text-sm font-medium text-petroleo transition-colors hover:border-turquesa hover:bg-turquesa/5 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-petroleo motion-reduce:transition-none"
        >
          <span aria-hidden="true">＋ </span>Adicionar outro extrato
        </button>

        {erroTopo ? (
          <p
            role="alert"
            className="rounded border border-carmim/30 bg-carmim/10 px-3 py-2 font-texto text-sm text-carmim"
          >
            {erroTopo}
          </p>
        ) : null}

        <div className="flex items-center justify-end gap-2.5 border-t border-grafite/15 pt-4">
          <SpecularButton variante="fantasma" tamanho="sm" onClick={aoFechar}>
            Cancelar
          </SpecularButton>
          <SpecularButton
            type="submit"
            variante="primario"
            tamanho="sm"
            disabled={pendente}
          >
            Enviar {total} {total === 1 ? "extrato" : "extratos"}
          </SpecularButton>
        </div>
      </form>
    </Modal>
  );
}
