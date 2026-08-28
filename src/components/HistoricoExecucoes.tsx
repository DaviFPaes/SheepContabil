import { formatarDataHora, formatarDuracao } from "@/lib/formatar";
import type { ExecucaoRegistrada } from "@/lib/execucao";
import type { StatusExecucao } from "@/generated/prisma/client";

const ROTULO_STATUS: Record<StatusExecucao, string> = {
  PENDENTE: "Em andamento",
  SUCESSO: "Sucesso",
  ERRO: "Erro",
  PARCIAL: "Parcial",
};

const COR_STATUS: Record<StatusExecucao, string> = {
  PENDENTE: "text-grafite",
  SUCESSO: "text-turquesa",
  ERRO: "text-carmim",
  PARCIAL: "text-ambar",
};

export function HistoricoExecucoes({
  execucoes,
}: {
  execucoes: ExecucaoRegistrada[];
}) {
  if (execucoes.length === 0) {
    return (
      <p className="font-texto text-sm text-grafite">
        Nenhuma execução registrada ainda.
      </p>
    );
  }

  return (
    <table className="w-full border-collapse font-texto text-sm">
      <thead>
        <tr className="border-b border-grafite/20 text-left text-grafite">
          <th className="py-2 pr-4">Data</th>
          <th className="py-2 pr-4">Duração</th>
          <th className="py-2 pr-4">Disparado por</th>
          <th className="py-2 pr-4">Resultado</th>
        </tr>
      </thead>
      <tbody>
        {execucoes.map((execucao) => (
          <tr key={execucao.id} className="border-b border-grafite/10">
            <td className="py-2 pr-4 font-codigo">
              {formatarDataHora(execucao.iniciadoEm)}
            </td>
            <td className="py-2 pr-4 font-codigo">
              {formatarDuracao(execucao.iniciadoEm, execucao.finalizadoEm)}
            </td>
            <td className="py-2 pr-4">{execucao.disparadoPor}</td>
            <td
              className={`py-2 pr-4 font-medium ${COR_STATUS[execucao.status]}`}
            >
              {ROTULO_STATUS[execucao.status]}
              {execucao.status === "ERRO" && execucao.erro ? (
                <span className="block font-texto text-xs font-normal text-grafite">
                  {execucao.erro}
                </span>
              ) : null}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
