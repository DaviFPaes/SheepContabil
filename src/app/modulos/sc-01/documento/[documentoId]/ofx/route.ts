import { NextResponse } from "next/server";
import { obterSessao } from "@/lib/sessao-servidor";
import { filtrarModulosVisiveis } from "@/lib/modulos-catalogo";
import { obterPermissoesUsuario } from "@/lib/permissoes/consultas";
import { obterDocumentoComLancamentos } from "@/lib/documentos/consultas-sc01";
import { gerarOfx } from "@/lib/documentos/ofx";
import { prisma } from "@/lib/prisma";

function slug(texto: string): string {
  return texto
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "")
    .toLowerCase();
}

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
      (m) => m.codigo === "SC-01",
    );
  if (!sessao || !podeVer) {
    return NextResponse.json({ erro: "Não autorizado." }, { status: 401 });
  }

  const { documentoId } = await params;
  const doc = await obterDocumentoComLancamentos(documentoId);
  if (!doc) {
    return NextResponse.json(
      { erro: "Documento não encontrado." },
      { status: 404 },
    );
  }
  if (!doc.podeBaixarOfx || !doc.conta) {
    return NextResponse.json(
      {
        erro:
          doc.motivoBloqueio ??
          "Documento sem conta bancária associada; não é possível gerar o OFX.",
      },
      { status: 403 },
    );
  }

  const ofx = gerarOfx(
    doc.conta,
    doc.lancamentos.map((l) => ({
      data: l.data,
      historico: l.historico,
      valor: l.valor,
    })),
  );

  await prisma.registroAuditoria.create({
    data: {
      entidade: "DocumentoEntrada",
      entidadeId: documentoId,
      acao: "OFX_BAIXADO",
      descricao: `OFX de ${doc.cliente.razaoSocial} baixado`,
      autorId: sessao.usuarioId,
      autorEmail: sessao.email,
      clienteId: doc.cliente.id,
    },
  });

  const nome = `extrato-${slug(doc.cliente.razaoSocial)}-${documentoId.slice(0, 6)}.ofx`;
  return new NextResponse(ofx, {
    status: 200,
    headers: {
      "Content-Type": "application/x-ofx; charset=windows-1252",
      "Content-Disposition": `attachment; filename="${nome}"`,
    },
  });
}
