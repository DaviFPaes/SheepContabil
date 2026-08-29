-- CreateEnum
CREATE TYPE "FaixaUrgencia" AS ENUM ('VENCIDO', 'CRITICO', 'ALERTA', 'PROXIMO', 'OK');

-- CreateTable
CREATE TABLE "Certificado" (
    "id" TEXT NOT NULL,
    "clienteId" TEXT NOT NULL,
    "dataValidade" TIMESTAMP(3) NOT NULL,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Certificado_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AvisoCertificado" (
    "id" TEXT NOT NULL,
    "certificadoId" TEXT NOT NULL,
    "faixa" "FaixaUrgencia" NOT NULL,
    "diasRestantes" INTEGER NOT NULL,
    "mensagem" TEXT NOT NULL,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AvisoCertificado_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Certificado_dataValidade_idx" ON "Certificado"("dataValidade");

-- CreateIndex
CREATE INDEX "AvisoCertificado_certificadoId_criadoEm_idx" ON "AvisoCertificado"("certificadoId", "criadoEm");

-- AddForeignKey
ALTER TABLE "Certificado" ADD CONSTRAINT "Certificado_clienteId_fkey" FOREIGN KEY ("clienteId") REFERENCES "Cliente"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AvisoCertificado" ADD CONSTRAINT "AvisoCertificado_certificadoId_fkey" FOREIGN KEY ("certificadoId") REFERENCES "Certificado"("id") ON DELETE CASCADE ON UPDATE CASCADE;
