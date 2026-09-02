"use client";

import { useMemo, useState } from "react";
import type { CertificadoLinha } from "@/lib/certificados/consultas";
import {
  contarNaoAvisados,
  montarColunasKanban,
  type OrdemKanban,
} from "@/lib/certificados/kanban";
import { estadoContato } from "@/lib/certificados/contato";
import { ROTULO_BUCKET } from "@/lib/certificados/bucket";
import {
  filtrarCertificados,
  ordenarCertificados,
  type FiltroFaixa,
  type FiltroTipo,
  type Ordenacao,
} from "@/lib/certificados/filtros";
import { SpecularButton } from "@/components/ui/SpecularButton";
import { AlternadorVisao, type Visao } from "./AlternadorVisao";
import { PainelCertificados } from "./PainelCertificados";
import { QuadroKanban, type FocoKanban } from "./QuadroKanban";
import { ModalCertificado } from "./ModalCertificado";
import { ModalPerfilCliente } from "./ModalPerfilCliente";
import { ModalEnvioLote, type DestinatarioLote } from "./ModalEnvioLote";
import { ModalRenovarVencido } from "./ModalRenovarVencido";
import { ModalAvisarWhatsApp } from "./ModalAvisarWhatsApp";

type ClienteOpcao = { id: string; razaoSocial: string; telefone?: string | null };
type ColunaOrd = "cliente" | "tipo" | "validade" | "dias";

const CAMPO =
  "rounded-lg border border-grafite/25 bg-white px-3 py-1.5 font-texto text-sm text-tinta outline-none transition-colors focus:border-turquesa focus:ring-2 focus:ring-turquesa/20 motion-reduce:transition-none";

// No Kanban não faz sentido filtrar por "Em dia" nem "Renovado" (não têm
// coluna); na Tabela todas as faixas valem.
const FAIXAS_KANBAN: FiltroFaixa[] = ["TODAS", "D60", "D7", "D3", "VENCIDO"];
const FAIXAS_TABELA: FiltroFaixa[] = ["TODAS", "OK", "D60", "D7", "D3", "VENCIDO", "RENOVADO"];

const TIPOS: { valor: FiltroTipo; rotulo: string }[] = [
  { valor: "TODOS", rotulo: "Todos os tipos" },
  { valor: "ECNPJ", rotulo: "e-CNPJ" },
  { valor: "ECPF", rotulo: "e-CPF" },
  { valor: "NFE", rotulo: "NF-e" },
];

function destinatarios(cards: CertificadoLinha[]): DestinatarioLote[] {
  return cards
    .filter((c) => estadoContato(c) !== "avisado")
    .map((c) => ({
      certificadoId: c.id,
      clienteId: c.clienteId,
      razaoSocial: c.razaoSocial,
      email: c.clienteEmail,
    }));
}

export function PainelSc20({
  certificados,
  clientes,
  visaoUrl,
  focoInicial,
  faixaInicial = "TODAS",
  tipoInicial = "TODOS",
}: {
  certificados: CertificadoLinha[];
  clientes: ClienteOpcao[];
  visaoUrl: Visao | null;
  focoInicial: FocoKanban;
  faixaInicial?: FiltroFaixa;
  tipoInicial?: FiltroTipo;
}) {
  const [visao, setVisao] = useState<Visao>(visaoUrl ?? "kanban");
  const [busca, setBusca] = useState("");
  const [tipo, setTipo] = useState<FiltroTipo>(tipoInicial);
  const [faixa, setFaixa] = useState<FiltroFaixa>(faixaInicial);
  const [ordenacao, setOrdenacao] = useState<Ordenacao>("validade-asc");
  const [ordemKanban, setOrdemKanban] = useState<OrdemKanban>("recentes");
  const [soPendentes, setSoPendentes] = useState(false);

  const [perfilClienteId, setPerfilClienteId] = useState<string | null>(null);
  const [certificadoModal, setCertificadoModal] = useState<"novo" | CertificadoLinha | null>(null);
  const [envioLote, setEnvioLote] = useState<"D60" | "D7" | null>(null);
  const [renovarCert, setRenovarCert] = useState<CertificadoLinha | null>(null);
  const [avisarCert, setAvisarCert] = useState<CertificadoLinha | null>(null);

  // O Kanban não tem faixa "Em dia"/"Renovado".
  const faixasDisponiveis = visao === "kanban" ? FAIXAS_KANBAN : FAIXAS_TABELA;
  const faixaEfetiva = faixasDisponiveis.includes(faixa) ? faixa : "TODAS";

  function aoMudarVisao(v: Visao) {
    setVisao(v);
    if (v === "kanban" && (faixa === "OK" || faixa === "RENOVADO")) setFaixa("TODAS");
  }

  const certificadosPorCliente = useMemo(() => {
    const mapa: Record<string, { id: string; titular: string; dataValidade: Date }[]> = {};
    for (const c of certificados) {
      if (!c.ativo) continue;
      (mapa[c.clienteId] ??= []).push({
        id: c.id,
        titular: c.titular,
        dataValidade: c.dataValidade,
      });
    }
    return mapa;
  }, [certificados]);

  const filtrados = useMemo(
    () => filtrarCertificados(certificados, { busca, tipo, faixa: faixaEfetiva }),
    [certificados, busca, tipo, faixaEfetiva],
  );

  const paraKanban = soPendentes
    ? filtrados.filter((c) => estadoContato(c) !== "avisado")
    : filtrados;
  const colunas = useMemo(
    () => montarColunasKanban(paraKanban, ordemKanban),
    [paraKanban, ordemKanban],
  );
  const contagem = contarNaoAvisados(colunas);
  const paraTabela = useMemo(
    () => ordenarCertificados(filtrados, ordenacao),
    [filtrados, ordenacao],
  );

  const totalVisivel =
    visao === "kanban"
      ? colunas.d60.length + colunas.d7.length + colunas.confirmar3.length + colunas.vencido.length
      : paraTabela.length;

  const filtroAtivo =
    busca.trim() !== "" ||
    tipo !== "TODOS" ||
    faixaEfetiva !== "TODAS" ||
    (visao === "kanban" && soPendentes);

  function limpar() {
    setBusca("");
    setTipo("TODOS");
    setFaixa("TODAS");
    setSoPendentes(false);
  }

  function aoOrdenar(coluna: ColunaOrd) {
    setOrdenacao((o) => (o === `${coluna}-asc` ? `${coluna}-desc` : `${coluna}-asc`));
  }

  const destinatariosLote =
    envioLote === "D60"
      ? destinatarios(colunas.d60)
      : envioLote === "D7"
        ? destinatarios(colunas.d7)
        : [];

  return (
    <div className="flex flex-col gap-4">
      {/* toolbar */}
      <div className="flex flex-wrap items-center gap-2.5">
        <AlternadorVisao visaoUrl={visaoUrl} aoMudar={aoMudarVisao} />

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
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            placeholder="Buscar cliente ou titular…"
            aria-label="Buscar cliente ou titular"
            className={`${CAMPO} w-56 pl-8`}
          />
        </div>

        <select
          value={tipo}
          onChange={(e) => setTipo(e.target.value as FiltroTipo)}
          aria-label="Filtrar por tipo"
          className={CAMPO}
        >
          {TIPOS.map((t) => (
            <option key={t.valor} value={t.valor}>
              {t.rotulo}
            </option>
          ))}
        </select>

        <div className="inline-flex items-center gap-2">
          <select
            value={faixaEfetiva}
            onChange={(e) => setFaixa(e.target.value as FiltroFaixa)}
            aria-label="Filtrar por faixa"
            className={CAMPO}
          >
            {faixasDisponiveis.map((f) => (
              <option key={f} value={f}>
                {f === "TODAS" ? "Todas as faixas" : ROTULO_BUCKET[f]}
              </option>
            ))}
          </select>
          <span
            className="rounded-full bg-petroleo/10 px-2 py-0.5 font-codigo text-xs font-bold tabular-nums text-petroleo"
            aria-label={`${totalVisivel} certificados no resultado`}
          >
            {totalVisivel}
          </span>
        </div>

        {visao === "kanban" ? (
          <>
            <SpecularButton
              variante="fantasma"
              tamanho="sm"
              onClick={() =>
                setOrdemKanban((o) => (o === "recentes" ? "antigos" : "recentes"))
              }
            >
              {ordemKanban === "recentes" ? "Recentes primeiro" : "Antigos primeiro"}
            </SpecularButton>
            <SpecularButton
              variante={soPendentes ? "primario" : "fantasma"}
              tamanho="sm"
              aria-pressed={soPendentes}
              onClick={() => setSoPendentes((v) => !v)}
            >
              Só pendentes
            </SpecularButton>
          </>
        ) : null}

        {filtroAtivo ? (
          <SpecularButton variante="fantasma" tamanho="sm" onClick={limpar}>
            Limpar
          </SpecularButton>
        ) : null}

        <div className="ml-auto">
          <SpecularButton
            variante="primario"
            tamanho="sm"
            onClick={() => setCertificadoModal("novo")}
          >
            <svg
              aria-hidden="true"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth={2.4}
              strokeLinecap="round"
              className="h-3.5 w-3.5"
            >
              <path d="M12 5v14M5 12h14" />
            </svg>
            Novo certificado
          </SpecularButton>
        </div>
      </div>

      {visao === "kanban" ? (
        <QuadroKanban
          colunas={colunas}
          contagem={contagem}
          aoAbrirCliente={setPerfilClienteId}
          aoEnviarLote={setEnvioLote}
          aoRenovar={setRenovarCert}
          aoAvisar={setAvisarCert}
          focoInicial={focoInicial}
        />
      ) : (
        <PainelCertificados
          certificados={paraTabela}
          ordenacao={ordenacao}
          aoOrdenar={aoOrdenar}
          aoEditar={(id) => setCertificadoModal(certificados.find((c) => c.id === id) ?? null)}
          aoAbrirCliente={setPerfilClienteId}
          aoRenovar={setRenovarCert}
          aoAvisar={setAvisarCert}
          temFiltro={filtroAtivo}
          aoLimpar={limpar}
        />
      )}

      <ModalCertificado
        aberto={certificadoModal !== null}
        aoFechar={() => setCertificadoModal(null)}
        clientes={clientes}
        certificadosPorCliente={certificadosPorCliente}
        certificado={certificadoModal === "novo" ? null : certificadoModal}
      />
      <ModalPerfilCliente
        clienteId={perfilClienteId}
        aoFechar={() => setPerfilClienteId(null)}
      />
      <ModalEnvioLote
        aberto={envioLote !== null}
        marco={envioLote}
        aoFechar={() => setEnvioLote(null)}
        destinatarios={destinatariosLote}
      />
      <ModalRenovarVencido certificado={renovarCert} aoFechar={() => setRenovarCert(null)} />
      <ModalAvisarWhatsApp certificado={avisarCert} aoFechar={() => setAvisarCert(null)} />
    </div>
  );
}
