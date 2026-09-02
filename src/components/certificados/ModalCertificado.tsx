"use client";

import { useActionState, useEffect, useMemo, useState } from "react";
import {
  criarCertificado,
  editarCertificado,
  type EstadoForm,
} from "@/lib/certificados/acoes";
import type { CertificadoLinha } from "@/lib/certificados/consultas";
import { dataParaInput } from "@/lib/certificados/formato";
import { SpecularButton } from "@/components/ui/SpecularButton";
import { Modal } from "./Modal";

type ClienteOpcao = { id: string; razaoSocial: string; telefone?: string | null };
type CertificadoOpcao = { id: string; titular: string; dataValidade: Date };

const CAMPO =
  "rounded border border-grafite/40 bg-white px-3 py-2 font-texto text-sm text-tinta outline-none transition-colors focus:border-turquesa focus:ring-2 focus:ring-turquesa/20 motion-reduce:transition-none";
const ROTULO = "flex flex-col gap-1.5 font-texto text-sm";
const ROTULO_TEXTO = "font-medium text-grafite";

function diasAte(iso: string): number | null {
  if (!iso) return null;
  const alvo = new Date(`${iso}T00:00:00.000Z`).getTime();
  const hoje = new Date();
  const hojeUTC = Date.UTC(hoje.getUTCFullYear(), hoje.getUTCMonth(), hoje.getUTCDate());
  return Math.round((alvo - hojeUTC) / (24 * 60 * 60 * 1000));
}

export function ModalCertificado({
  aberto,
  aoFechar,
  clientes,
  certificadosPorCliente,
  certificado,
}: {
  aberto: boolean;
  aoFechar: () => void;
  clientes: ClienteOpcao[];
  certificadosPorCliente: Record<string, CertificadoOpcao[]>;
  certificado: CertificadoLinha | null;
}) {
  const emEdicao = certificado !== null;
  const acao = emEdicao ? editarCertificado : criarCertificado;
  const [estado, acaoForm, pendente] = useActionState<EstadoForm, FormData>(acao, null);

  const clientePorRazao = useMemo(() => {
    const m = new Map<string, string>();
    for (const c of clientes) m.set(c.razaoSocial.toLowerCase(), c.id);
    return m;
  }, [clientes]);
  const telefonePorId = useMemo(() => {
    const m = new Map<string, string>();
    for (const c of clientes) if (c.telefone) m.set(c.id, c.telefone);
    return m;
  }, [clientes]);

  const [textoCliente, setTextoCliente] = useState(certificado?.razaoSocial ?? "");
  const [ehRenovacao, setEhRenovacao] = useState(false);
  const [validadeIso, setValidadeIso] = useState(
    certificado ? dataParaInput(certificado.dataValidade) : "",
  );

  useEffect(() => {
    if (estado && "ok" in estado && estado.ok) aoFechar();
  }, [estado, aoFechar]);

  const clienteId = clientePorRazao.get(textoCliente.trim().toLowerCase()) ?? "";

  // Telefone acompanha o cliente escolhido (ajuste de estado no render).
  const [telefone, setTelefone] = useState("");
  const [clienteTelAnterior, setClienteTelAnterior] = useState<string | null>(null);
  if (clienteId !== clienteTelAnterior) {
    setClienteTelAnterior(clienteId);
    setTelefone(telefonePorId.get(clienteId) ?? "");
  }
  const anteriores = clienteId ? (certificadosPorCliente[clienteId] ?? []) : [];
  const diasValidade = diasAte(validadeIso);
  const alertaJanela = diasValidade !== null && diasValidade <= 60;

  return (
    <Modal
      aberto={aberto}
      aoFechar={aoFechar}
      titulo={emEdicao ? "Editar certificado" : "Novo certificado"}
    >
      <form action={acaoForm} className="flex flex-col gap-4">
        {emEdicao ? <input type="hidden" name="id" value={certificado.id} /> : null}
        <input type="hidden" name="clienteId" value={clienteId} />

        <label className={ROTULO} htmlFor="mc-cliente">
          <span className={ROTULO_TEXTO}>Cliente</span>
          <input
            id="mc-cliente"
            list="mc-lista-clientes"
            value={textoCliente}
            onChange={(e) => setTextoCliente(e.target.value)}
            placeholder="Digite a razão social…"
            required
            className={CAMPO}
          />
          <datalist id="mc-lista-clientes">
            {clientes.map((c) => (
              <option key={c.id} value={c.razaoSocial} />
            ))}
          </datalist>
        </label>

        <label className={ROTULO} htmlFor="mc-telefone">
          <span className={ROTULO_TEXTO}>Telefone do cliente (WhatsApp)</span>
          <input
            id="mc-telefone"
            name="telefone"
            type="tel"
            value={telefone}
            onChange={(e) => setTelefone(e.target.value)}
            placeholder="+55 (11) 90000-0000"
            className={CAMPO}
          />
          <span className="font-texto text-xs text-grafite">
            Salvo no cadastro do cliente — usado no aviso da faixa de 3 dias.
          </span>
        </label>

        <div className="grid gap-4 sm:grid-cols-2">
          <label className={ROTULO} htmlFor="mc-tipo">
            <span className={ROTULO_TEXTO}>Tipo</span>
            <select
              id="mc-tipo"
              name="tipo"
              defaultValue={certificado?.tipo ?? "ECNPJ"}
              className={CAMPO}
            >
              <option value="ECNPJ">e-CNPJ</option>
              <option value="ECPF">e-CPF</option>
              <option value="NFE">NF-e</option>
            </select>
          </label>

          <label className={ROTULO} htmlFor="mc-titular">
            <span className={ROTULO_TEXTO}>Titular</span>
            <input
              id="mc-titular"
              name="titular"
              defaultValue={certificado?.titular ?? ""}
              required
              className={CAMPO}
            />
          </label>

          <label className={ROTULO} htmlFor="mc-emitido">
            <span className={ROTULO_TEXTO}>Emissão</span>
            <input
              id="mc-emitido"
              type="date"
              name="emitidoEm"
              defaultValue={certificado ? dataParaInput(certificado.emitidoEm) : ""}
              required
              className={CAMPO}
            />
          </label>

          <label className={ROTULO} htmlFor="mc-validade">
            <span className={ROTULO_TEXTO}>Validade</span>
            <input
              id="mc-validade"
              type="date"
              name="dataValidade"
              value={validadeIso}
              onChange={(e) => setValidadeIso(e.target.value)}
              required
              className={CAMPO}
            />
          </label>
        </div>

        {alertaJanela ? (
          <p className="rounded border border-ambar/40 bg-ambar/10 px-3 py-2 font-texto text-xs text-ambar">
            A validade escolhida já está dentro da janela de 60 dias — o
            certificado entra direto numa faixa de urgência.
          </p>
        ) : null}

        <label className={ROTULO} htmlFor="mc-obs">
          <span className={ROTULO_TEXTO}>Observação (opcional)</span>
          <textarea id="mc-obs" name="observacao" rows={2} className={CAMPO} />
        </label>

        {!emEdicao ? (
          <label className="flex items-center gap-2 font-texto text-sm text-tinta">
            <input
              type="checkbox"
              name="ehRenovacao"
              checked={ehRenovacao}
              onChange={(e) => setEhRenovacao(e.target.checked)}
              className="h-4 w-4 rounded border-grafite/40 text-petroleo focus:ring-turquesa/30"
            />
            É renovação de um certificado existente
          </label>
        ) : null}

        {!emEdicao && ehRenovacao ? (
          <label className={ROTULO} htmlFor="mc-anterior">
            <span className={ROTULO_TEXTO}>Certificado anterior</span>
            <select id="mc-anterior" name="certificadoAnteriorId" className={CAMPO} required>
              <option value="">Selecione…</option>
              {anteriores.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.titular} — vence {dataParaInput(c.dataValidade)}
                </option>
              ))}
            </select>
            {clienteId && anteriores.length === 0 ? (
              <span className="font-texto text-xs text-grafite">
                Este cliente não tem certificado ativo para renovar.
              </span>
            ) : null}
          </label>
        ) : null}

        {estado && "erro" in estado ? (
          <p
            role="alert"
            className="rounded border border-carmim/30 bg-carmim/10 px-3 py-2 font-texto text-sm text-carmim"
          >
            {estado.erro}
          </p>
        ) : null}

        <div className="flex items-center justify-end gap-2.5">
          <SpecularButton variante="fantasma" tamanho="sm" onClick={aoFechar}>
            Cancelar
          </SpecularButton>
          <SpecularButton type="submit" variante="primario" tamanho="sm" disabled={pendente}>
            {emEdicao ? (pendente ? "Salvando…" : "Salvar") : pendente ? "Adicionando…" : "Adicionar"}
          </SpecularButton>
        </div>
      </form>
    </Modal>
  );
}
