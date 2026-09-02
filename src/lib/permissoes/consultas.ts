import { prisma } from "@/lib/prisma";
import { CATALOGO_MODULOS, type ModuloCatalogo } from "@/lib/modulos-catalogo";
import type { PermissoesUsuario } from "./regra";

export async function obterPermissoesUsuario(usuarioId: string): Promise<PermissoesUsuario> {
  const [modulos, subAreas] = await Promise.all([
    prisma.permissaoModulo.findMany({
      where: { usuarioId, habilitado: true },
      select: { moduloCodigo: true },
    }),
    prisma.permissaoSubArea.findMany({
      where: { usuarioId, habilitado: false },
      select: { moduloCodigo: true, subArea: true },
    }),
  ]);

  return {
    modulosLigados: new Set(modulos.map((m) => m.moduloCodigo)),
    subAreasDesligadas: new Set(subAreas.map((s) => `${s.moduloCodigo}:${s.subArea}`)),
  };
}

export type OperadorGestao = {
  id: string;
  nome: string;
  email: string;
  setor: string | null;
  modulosElegiveis: ModuloCatalogo[];
  permissoes: PermissoesUsuario;
};

// Elegível = mesmo par de condições que `filtrarModulosVisiveis` já aplica
// hoje (implementado + setor dono bate) — é o "catálogo oferecível" pro
// ADMIN configurar aquele operador, não a visibilidade efetiva.
export async function listarOperadoresParaGestao(): Promise<OperadorGestao[]> {
  const operadores = await prisma.usuario.findMany({
    where: { papel: "OPERADOR" },
    orderBy: { nome: "asc" },
    select: { id: true, nome: true, email: true, setor: true },
  });

  return Promise.all(
    operadores.map(async (operador) => {
      const modulosElegiveis = CATALOGO_MODULOS.filter(
        (m) => m.implementado && m.setorDono === operador.setor,
      );
      const permissoes = await obterPermissoesUsuario(operador.id);
      return { ...operador, modulosElegiveis, permissoes };
    }),
  );
}
