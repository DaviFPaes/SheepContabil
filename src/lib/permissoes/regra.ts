import type { PapelUsuario } from "@/generated/prisma/client";
import type { ModuloCatalogo } from "../modulos-catalogo";

export type PermissoesUsuario = {
  // moduloCodigo dos módulos que o operador tem ligado.
  modulosLigados: Set<string>;
  // `${moduloCodigo}:${subArea}` das sub-áreas com override explícito
  // desligado — ausência da chave aqui significa "visível" (default).
  subAreasDesligadas: Set<string>;
};

// ADMIN sempre enxerga tudo — este sistema só restringe OPERADOR.
// Sem `permissoes` (call site que esqueceu de buscar) o operador não vê
// nada: falha fechada, nunca aberta.
export function moduloVisivel(
  papel: PapelUsuario,
  setor: string | null,
  modulo: ModuloCatalogo,
  permissoes?: PermissoesUsuario,
): boolean {
  if (papel === "ADMIN") return true;
  if (modulo.setorDono !== setor) return false;
  return permissoes?.modulosLigados.has(modulo.codigo) ?? false;
}

// Assume que o módulo em si já foi confirmado visível por quem chama
// (toda page.tsx de módulo só chega aqui depois do gate de `moduloVisivel`).
export function subAreaVisivel(
  papel: PapelUsuario,
  moduloCodigo: string,
  subArea: string,
  permissoes?: PermissoesUsuario,
): boolean {
  if (papel === "ADMIN") return true;
  return !permissoes?.subAreasDesligadas.has(`${moduloCodigo}:${subArea}`);
}
