-- CreateEnum
CREATE TYPE "AliquotaPresuncao" AS ENUM ('P8', 'P32');

-- CreateEnum
CREATE TYPE "OrigemDecisao" AS ENUM ('REGRA', 'IA', 'MANUAL');

-- CreateEnum
CREATE TYPE "StatusItemNota" AS ENUM ('CONFIRMADO', 'PENDENTE_REVISAO');

-- CreateEnum
CREATE TYPE "AcaoAuditoria" AS ENUM ('CRIACAO', 'RECLASSIFICACAO', 'REMOCAO');

-- CreateTable
CREATE TABLE "TermoPresuncao" (
    "id" TEXT NOT NULL,
    "termo" TEXT NOT NULL,
    "aliquota" "AliquotaPresuncao" NOT NULL,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TermoPresuncao_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditoriaTermo" (
    "id" TEXT NOT NULL,
    "termoId" TEXT,
    "termoTexto" TEXT NOT NULL,
    "acao" "AcaoAuditoria" NOT NULL,
    "aliquotaAnterior" "AliquotaPresuncao",
    "aliquotaNova" "AliquotaPresuncao",
    "autorEmail" TEXT NOT NULL,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditoriaTermo_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "NotaServico" (
    "id" TEXT NOT NULL,
    "documentoEntradaId" TEXT NOT NULL,
    "numero" TEXT NOT NULL,
    "dataEmissao" TIMESTAMP(3) NOT NULL,
    "valorTotal" DECIMAL(14,2) NOT NULL,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "NotaServico_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ItemNota" (
    "id" TEXT NOT NULL,
    "notaServicoId" TEXT NOT NULL,
    "descricao" TEXT NOT NULL,
    "valor" DECIMAL(14,2) NOT NULL,
    "aliquota" "AliquotaPresuncao" NOT NULL,
    "origem" "OrigemDecisao" NOT NULL,
    "justificativa" TEXT NOT NULL,
    "confianca" DOUBLE PRECISION,
    "status" "StatusItemNota" NOT NULL DEFAULT 'CONFIRMADO',
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ItemNota_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "TermoPresuncao_termo_key" ON "TermoPresuncao"("termo");

-- CreateIndex
CREATE INDEX "AuditoriaTermo_criadoEm_idx" ON "AuditoriaTermo"("criadoEm");

-- CreateIndex
CREATE UNIQUE INDEX "NotaServico_documentoEntradaId_key" ON "NotaServico"("documentoEntradaId");

-- CreateIndex
CREATE INDEX "ItemNota_notaServicoId_idx" ON "ItemNota"("notaServicoId");

-- AddForeignKey
ALTER TABLE "NotaServico" ADD CONSTRAINT "NotaServico_documentoEntradaId_fkey" FOREIGN KEY ("documentoEntradaId") REFERENCES "DocumentoEntrada"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ItemNota" ADD CONSTRAINT "ItemNota_notaServicoId_fkey" FOREIGN KEY ("notaServicoId") REFERENCES "NotaServico"("id") ON DELETE CASCADE ON UPDATE CASCADE;
