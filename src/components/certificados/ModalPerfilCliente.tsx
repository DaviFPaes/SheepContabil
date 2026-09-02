"use client";

import { useEffect, useState } from "react";
import { obterPerfilCliente } from "@/lib/certificados/acoes";
import type { CertificadoLinha } from "@/lib/certificados/consultas";
import type { LinhaAuditoria } from "@/lib/certificados/historico";
import { textoDias } from "@/lib/certificados/bucket";
import { formatarDataUTC } from "@/lib/certificados/formato";
import { Modal } from "./Modal";
import { SeloBucket } from "./SeloBucket";
import { TimelineHistorico } from "./TimelineHistorico";

type Perfil = {
  cliente: {
    id: string;
    razaoSocial: string;
    cnpj: string;
    email: string;
    telefone: string | null;
    ativo: boolean;
  };
  certificados: CertificadoLinha[];
  historico: LinhaAuditoria[];
};

export function ModalPerfilCliente({
  clienteId,
  aoFechar,
}: {
  clienteId: string | null;
  aoFechar: () => void;
}) {
  const [estado, setEstado] = useState<
    { fase: "carregando" } | { fase: "erro" } | { fase: "ok"; perfil: Perfil }
  >({ fase: "carregando" });

  useEffect(() => {
    if (!clienteId) return;
    let cancelado = false;
    setEstado({ fase: "carregando" });
    obterPerfilCliente(clienteId)
      .then((perfil) => {
        if (cancelado) return;
        setEstado(perfil ? { fase: "ok", perfil } : { fase: "erro" });
      })
      .catch(() => {
        if (!cancelado) setEstado({ fase: "erro" });
      });
    return () => {
      cancelado = true;
    };
  }, [clienteId]);

  return (
    <Modal aberto={clienteId !== null} aoFechar={aoFechar} titulo="Perfil do cliente">
      {estado.fase === "carregando" ? (
        <p className="py-8 text-center font-texto text-sm text-grafite">Carregando…</p>
      ) : estado.fase === "erro" ? (
        <p className="py-8 text-center font-texto text-sm text-carmim">
          Não foi possível carregar o perfil deste cliente.
        </p>
      ) : (
        <div className="flex flex-col gap-5">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="font-titulo text-base font-bold text-tinta">
                {estado.perfil.cliente.razaoSocial}
              </h3>
              {!estado.perfil.cliente.ativo ? (
                <span className="rounded-full bg-grafite/15 px-2 py-0.5 font-texto text-[11px] font-medium text-grafite">
                  inativo
                </span>
              ) : null}
            </div>
            <p className="mt-1 font-codigo text-xs text-grafite">
              {estado.perfil.cliente.cnpj} · {estado.perfil.cliente.email}
              {estado.perfil.cliente.telefone
                ? ` · ${estado.perfil.cliente.telefone}`
                : " · sem telefone"}
            </p>
          </div>

          <section>
            <h4 className="mb-2 font-titulo text-sm font-bold text-tinta">
              Certificados ({estado.perfil.certificados.length})
            </h4>
            {estado.perfil.certificados.length === 0 ? (
              <p className="font-texto text-sm text-grafite">Nenhum certificado.</p>
            ) : (
              <ul className="flex flex-col gap-2">
                {estado.perfil.certificados.map((c) => (
                  <li
                    key={c.id}
                    className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-grafite/20 bg-white p-3"
                  >
                    <div className="font-texto text-sm text-tinta">
                      {c.titular}
                      <span className="ml-2 font-codigo text-xs text-grafite">
                        {formatarDataUTC(c.dataValidade)} · {textoDias(c.diasRestantes)}
                      </span>
                    </div>
                    <SeloBucket bucket={c.bucket} />
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section>
            <div className="mb-2 flex items-center justify-between">
              <h4 className="font-titulo text-sm font-bold text-tinta">Histórico</h4>
              <a
                href={`/modulos/sc-20?aba=historico&cliente=${estado.perfil.cliente.id}`}
                className="font-texto text-xs font-medium text-turquesa underline-offset-2 hover:underline"
              >
                ver tudo
              </a>
            </div>
            <TimelineHistorico linhas={estado.perfil.historico} />
          </section>
        </div>
      )}
    </Modal>
  );
}
