import type { PapelUsuario } from "@/generated/prisma/client";
import { LogoSheep } from "./LogoSheep";
import type { ReactNode } from "react";

type CabecalhoPortalProps = {
  nomeUsuario: string;
  papel: PapelUsuario;
  acaoSair?: ReactNode;
};

export function CabecalhoPortal({
  nomeUsuario,
  papel,
  acaoSair,
}: CabecalhoPortalProps) {
  return (
    <header className="flex items-center justify-between bg-petroleo px-6 py-4 text-nevoa">
      <div className="flex items-center gap-3">
        <LogoSheep className="h-8 w-8 text-turquesa" />
        <span
          data-testid="marca-sheepcontabil"
          className="font-titulo text-lg font-bold"
        >
          Sheep<span className="text-turquesa">Contabil</span>
        </span>
      </div>
      <div className="flex items-center gap-4 font-texto text-sm">
        <span>
          {nomeUsuario} · {papel === "ADMIN" ? "Administrador" : "Operador"}
        </span>
        {acaoSair}
      </div>
    </header>
  );
}
