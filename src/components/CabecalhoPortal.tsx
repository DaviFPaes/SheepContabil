import type { PapelUsuario } from "@/generated/prisma/client";
import Link from "next/link";
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
    <header className="sticky top-0 z-20 flex items-center justify-between border-b border-turquesa/25 bg-petroleo/95 px-6 py-3.5 text-nevoa backdrop-blur-md">
      <div className="flex items-center gap-3">
        <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-tinta/70 ring-1 ring-white/10">
          <LogoSheep className="h-6 w-6 text-turquesa" />
        </span>
        <span
          data-testid="marca-sheepcontabil"
          className="font-titulo text-lg font-extrabold tracking-tight"
        >
          Sheep<span className="text-turquesa">Contabil</span>
        </span>
      </div>
      <div className="flex items-center gap-4 font-texto text-sm text-nevoa/85">
        <span className="hidden sm:inline">
          {nomeUsuario} · {papel === "ADMIN" ? "Administrador" : "Operador"}
        </span>
        {papel === "ADMIN" ? (
          <Link
            href="/admin/usuarios"
            className="hidden font-texto text-sm text-nevoa/85 underline-offset-2 transition-colors hover:text-nevoa hover:underline sm:inline motion-reduce:transition-none"
          >
            Gerenciar usuários
          </Link>
        ) : null}
        {acaoSair}
      </div>
    </header>
  );
}
