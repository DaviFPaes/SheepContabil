-- CreateEnum
CREATE TYPE "TipoDocumento" AS ENUM ('EXTRATO', 'NFSE');

-- CreateEnum
CREATE TYPE "StatusDocumento" AS ENUM ('PENDENTE', 'PROCESSADO', 'ERRO');

-- CreateEnum
CREATE TYPE "StatusLancamento" AS ENUM ('CONFIRMADO', 'PENDENTE_REVISAO');

-- CreateTable
CREATE TABLE "ContaBancaria" (
    "id" TEXT NOT NULL,
    "clienteId" TEXT NOT NULL,
    "bancoNome" TEXT NOT NULL,
    "compe" TEXT NOT NULL,
    "agencia" TEXT NOT NULL,
    "numero" TEXT NOT NULL,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ContaBancaria_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DocumentoEntrada" (
    "id" TEXT NOT NULL,
    "tipo" "TipoDocumento" NOT NULL,
    "clienteId" TEXT NOT NULL,
    "contaBancariaId" TEXT,
    "nomeArquivo" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "arquivo" BYTEA NOT NULL,
    "status" "StatusDocumento" NOT NULL DEFAULT 'PENDENTE',
    "chegadaEm" TIMESTAMP(3) NOT NULL,
    "processadoEm" TIMESTAMP(3),
    "erro" TEXT,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DocumentoEntrada_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Lancamento" (
    "id" TEXT NOT NULL,
    "documentoEntradaId" TEXT NOT NULL,
    "data" TIMESTAMP(3) NOT NULL,
    "historico" TEXT NOT NULL,
    "valor" DECIMAL(14,2) NOT NULL,
    "confianca" DOUBLE PRECISION NOT NULL,
    "trechoOriginal" TEXT,
    "status" "StatusLancamento" NOT NULL DEFAULT 'CONFIRMADO',
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Lancamento_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ContaBancaria_clienteId_idx" ON "ContaBancaria"("clienteId");

-- CreateIndex
CREATE INDEX "DocumentoEntrada_tipo_status_idx" ON "DocumentoEntrada"("tipo", "status");

-- CreateIndex
CREATE INDEX "Lancamento_documentoEntradaId_idx" ON "Lancamento"("documentoEntradaId");

-- AddForeignKey
ALTER TABLE "ContaBancaria" ADD CONSTRAINT "ContaBancaria_clienteId_fkey" FOREIGN KEY ("clienteId") REFERENCES "Cliente"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DocumentoEntrada" ADD CONSTRAINT "DocumentoEntrada_clienteId_fkey" FOREIGN KEY ("clienteId") REFERENCES "Cliente"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DocumentoEntrada" ADD CONSTRAINT "DocumentoEntrada_contaBancariaId_fkey" FOREIGN KEY ("contaBancariaId") REFERENCES "ContaBancaria"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Lancamento" ADD CONSTRAINT "Lancamento_documentoEntradaId_fkey" FOREIGN KEY ("documentoEntradaId") REFERENCES "DocumentoEntrada"("id") ON DELETE CASCADE ON UPDATE CASCADE;
