import { NextRequest, NextResponse } from "next/server";
import { cronAutorizado } from "@/lib/cron-logica";
import { executarModulo } from "@/lib/execucao";
import { processarExtratos } from "@/lib/documentos/processar-sc01";

export async function GET(request: NextRequest) {
  if (
    !cronAutorizado(request.headers.get("authorization"), process.env.CRON_SECRET)
  ) {
    return NextResponse.json({ erro: "Não autorizado." }, { status: 401 });
  }
  try {
    const execucao = await executarModulo("SC-01", "scheduler", () =>
      processarExtratos(),
    );
    return NextResponse.json({
      execucaoId: execucao.id,
      status: execucao.status,
      resumo: execucao.resumo,
      erro: execucao.erro,
    });
  } catch (erro) {
    console.error("[cron sc-01]", erro);
    return NextResponse.json(
      { erro: "Falha ao executar o módulo." },
      { status: 500 },
    );
  }
}
