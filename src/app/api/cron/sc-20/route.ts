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
}
