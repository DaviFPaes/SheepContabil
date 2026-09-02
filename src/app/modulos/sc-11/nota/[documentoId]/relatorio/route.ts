import { NextResponse } from "next/server";
import { obterSessao } from "@/lib/sessao-servidor";
import { filtrarModulosVisiveis } from "@/lib/modulos-catalogo";
import { obterPermissoesUsuario } from "@/lib/permissoes/consultas";
import { obterNotaComItens } from "@/lib/presuncao/consultas-sc11";
import { gerarCsvRelatorio } from "@/lib/presuncao/relatorio-csv";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ documentoId: string }> },
) {
  const sessao = await obterSessao();
  const permissoes =
    sessao?.papel === "OPERADOR" ? await obterPermissoesUsuario(sessao.usuarioId) : undefined;
  const podeVer =
    sessao !== null &&
    filtrarModulosVisiveis(sessao.papel, sessao.setor, undefined, permissoes).some(
      (m) => m.codigo === "SC-11",
    );
  if (!sessao || !podeVer) {
    return NextResponse.json({ erro: "Não autorizado." }, { status: 401 });
  }

  const { documentoId } = await params;
  const nota = await obterNotaComItens(documentoId);
  if (!nota || nota.status !== "PROCESSADO") {
    return NextResponse.json({ erro: "Nota não encontrada." }, { status: 404 });
  }
  if (!nota.podeExportar) {
    return NextResponse.json(
      { erro: nota.motivoBloqueio ?? "Conferência pendente." },
      { status: 403 },
    );
  }

  const csv = gerarCsvRelatorio(nota);
  const arquivo = `nfse-${(nota.numero ?? documentoId).replace(/[^\w-]+/g, "_")}-presuncao.csv`;
  return new NextResponse(csv, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${arquivo}"`,
    },
  });
}
