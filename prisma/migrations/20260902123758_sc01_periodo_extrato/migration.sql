-- AlterTable: DocumentoEntrada — periodos de cobertura e competencia
ALTER TABLE "DocumentoEntrada" ADD COLUMN "periodoInicio" TIMESTAMP(3),
ADD COLUMN "periodoFim" TIMESTAMP(3),
ADD COLUMN "competencia" TEXT;

-- CreateIndex
CREATE INDEX "DocumentoEntrada_tipo_competencia_idx" ON "DocumentoEntrada"("tipo", "competencia");
