import { NextRequest, NextResponse } from "next/server";
import { cronAutorizado } from "@/lib/cron-logica";
import { executarModulo } from "@/lib/execucao";
import { processarAvisosCertificados } from "@/lib/certificados/processar";

export async function GET(request: NextRequest) {
  if (
    !cronAutorizado(
      request.headers.get("authorization"),
      process.env.CRON_SECRET,
    )
  ) {
    return NextResponse.json({ erro: "Não autorizado." }, { status: 401 });
  }

  try {
    const execucao = await executarModulo(
      "SC-20",
      "scheduler",
      processarAvisosCertificados,
    );

    return NextResponse.json({
      execucaoId: execucao.id,
      status: execucao.status,
      resumo: execucao.resumo,
      erro: execucao.erro,
    });
  } catch (erro) {
    // executarModulo lanca se nem o registro PENDENTE puder ser criado (ex.:
    // banco fora do ar). Sem este catch o cron devolveria um 500 cru, sem o
    // campo `erro` que o contrato JSON promete.
    console.error("[cron/sc-20] falha ao executar o módulo:", erro);
    return NextResponse.json(
      { erro: "Falha ao executar o módulo." },
      { status: 500 },
    );
  }
}
