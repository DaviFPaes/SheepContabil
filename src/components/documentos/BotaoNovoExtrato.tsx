"use client";

import { useState } from "react";
import { SpecularButton } from "@/components/ui/SpecularButton";
import { ModalEnviarExtratos } from "./ModalEnviarExtratos";

type Cliente = { id: string; razaoSocial: string };
type Conta = { id: string; rotulo: string };

export function BotaoNovoExtrato({
  clientes,
  contasPorCliente,
}: {
  clientes: Cliente[];
  contasPorCliente: Record<string, Conta[]>;
}) {
  const [aberto, setAberto] = useState(false);
  return (
    <>
      <SpecularButton variante="primario" tom="escuro" tamanho="sm" onClick={() => setAberto(true)}>
        Enviar extratos
      </SpecularButton>
      {aberto ? (
        <ModalEnviarExtratos
          aberto={aberto}
          aoFechar={() => setAberto(false)}
          clientes={clientes}
          contasPorCliente={contasPorCliente}
        />
      ) : null}
    </>
  );
}
