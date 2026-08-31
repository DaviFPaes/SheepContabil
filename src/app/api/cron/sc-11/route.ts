import { NextRequest, NextResponse } from "next/server";
import { cronAutorizado } from "@/lib/cron-logica";
import { executarModulo } from "@/lib/execucao";
import { processarNotas } from "@/lib/presuncao/processar-sc11";

export async function GET(request: NextRequest) {
  if (
    !cronAutorizado(request.headers.get("authorization"), process.env.CRON_SECRET)
  ) {
    return NextResponse.json({ erro: "Não autorizado." }, { status: 401 });
  }
  try {
    const execucao = await executarModulo("SC-11", "scheduler", () =>
      processarNotas(),
    );
    return NextResponse.json({
      execucaoId: execucao.id,
      status: execucao.status,
      resumo: execucao.resumo,
      erro: execucao.erro,
    });
  } catch (erro) {
    console.error("[cron sc-11]", erro);
    return NextResponse.json(
      { erro: "Falha ao executar o módulo." },
      { status: 500 },
    );
  }
}
