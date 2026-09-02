import { NextResponse } from "next/server";
import { obterSessao } from "@/lib/sessao-servidor";
import { filtrarModulosVisiveis } from "@/lib/modulos-catalogo";
import { obterPermissoesUsuario } from "@/lib/permissoes/consultas";
import { listarHistorico } from "@/lib/certificados/consultas";
import { gerarCsvHistorico } from "@/lib/certificados/csv-historico";
import { NATUREZAS, type AcaoAuditoria } from "@/lib/certificados/historico";

const ACOES_VALIDAS = new Set(NATUREZAS.map((n) => n.valor));

function dataOpcional(iso: string | null): Date | undefined {
  if (!iso || !/^\d{4}-\d{2}-\d{2}$/.test(iso)) return undefined;
  return new Date(`${iso}T00:00:00.000Z`);
}

export async function GET(request: Request) {
  const sessao = await obterSessao();
  const permissoes =
    sessao?.papel === "OPERADOR" ? await obterPermissoesUsuario(sessao.usuarioId) : undefined;
  const podeVer =
    sessao !== null &&
    filtrarModulosVisiveis(sessao.papel, sessao.setor, undefined, permissoes).some(
      (m) => m.codigo === "SC-20",
    );
  if (!sessao || !podeVer) {
    return NextResponse.json({ erro: "Não autorizado." }, { status: 401 });
  }

  const url = new URL(request.url);
  const evento = url.searchParams.get("evento");

  const { linhas } = await listarHistorico({
    clienteId: url.searchParams.get("cliente") || undefined,
    acao:
      evento && ACOES_VALIDAS.has(evento as AcaoAuditoria)
        ? (evento as AcaoAuditoria)
        : undefined,
    de: dataOpcional(url.searchParams.get("de")),
    ate: dataOpcional(url.searchParams.get("ate")),
    pagina: 1,
    porPagina: 100_000,
  });

  const csv = gerarCsvHistorico(linhas);
  return new NextResponse(csv, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": 'attachment; filename="historico-sc20.csv"',
    },
  });
}
