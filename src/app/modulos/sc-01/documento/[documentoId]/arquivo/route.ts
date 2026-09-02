import { NextResponse } from "next/server";
import { obterSessao } from "@/lib/sessao-servidor";
import { filtrarModulosVisiveis } from "@/lib/modulos-catalogo";
import { prisma } from "@/lib/prisma";

// mimeTypes que podem ser renderizados inline com segurança. Qualquer coisa fora
// desta lista (ex. text/html, image/svg+xml chegando por um bug do allow-list de
// upload, seed ou escrita direta no banco) é forçada como download para nunca
// executar script na própria origem da aplicação — defense-in-depth contra XSS
// armazenado entre usuários.
const VISUALIZAVEIS = ["application/pdf", "image/jpeg", "image/png"];

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ documentoId: string }> },
) {
  const sessao = await obterSessao();
  const podeVer =
    sessao !== null &&
    filtrarModulosVisiveis(sessao.papel, sessao.setor).some(
      (m) => m.codigo === "SC-01",
    );
  if (!sessao || !podeVer) {
    return NextResponse.json({ erro: "Não autorizado." }, { status: 401 });
  }

  const { documentoId } = await params;
  const doc = await prisma.documentoEntrada.findUnique({
    where: { id: documentoId },
    select: { arquivo: true, mimeType: true, nomeArquivo: true },
  });
  if (!doc) {
    return NextResponse.json(
      { erro: "Documento não encontrado." },
      { status: 404 },
    );
  }

  const nome = doc.nomeArquivo.replace(/"/g, "");
  const visualizavel = VISUALIZAVEIS.includes(doc.mimeType);
  const contentType = visualizavel ? doc.mimeType : "application/octet-stream";
  const disposicao = visualizavel ? "inline" : "attachment";

  return new NextResponse(Buffer.from(doc.arquivo), {
    status: 200,
    headers: {
      "Content-Type": contentType,
      "Content-Disposition": `${disposicao}; filename="${nome}"`,
      "X-Content-Type-Options": "nosniff",
      "Cache-Control": "private, no-store",
    },
  });
}
