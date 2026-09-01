-- SC-20 Etapa 1 — substituicao limpa do nucleo (ver docs/superpowers/specs/2026-09-01-sc-20-vencimento-certificado-etapa-1-design.md §3-4)
-- AvisoCertificado esta vazia em todo ambiente conhecido nesta migracao (o
-- processamento nunca gravou nada nela em producao) — dropamos as colunas
-- antigas e recriamos como "marco de e-mail" sem precisar de backfill ali.
-- Cliente e Certificado tem linhas de seed e recebem backfill explicito.

-- CreateEnum
CREATE TYPE "TipoCertificado" AS ENUM ('ECNPJ', 'ECPF', 'NFE');

-- CreateEnum
CREATE TYPE "BucketCertificado" AS ENUM ('OK', 'D60', 'D7', 'D3', 'VENCIDO', 'RENOVADO');

-- CreateEnum
CREATE TYPE "MarcoAviso" AS ENUM ('D60', 'D7');

-- CreateEnum
CREATE TYPE "StatusAviso" AS ENUM ('QUEUED', 'SENT', 'DELIVERED', 'BOUNCED', 'FAILED');

-- CreateEnum
CREATE TYPE "TipoNotificacao" AS ENUM ('D60_ENTROU', 'D7_ENTROU', 'D3_ENTROU');

-- AlterTable: Cliente.email (backfill) e Cliente.ativo
ALTER TABLE "Cliente" ADD COLUMN "email" TEXT NOT NULL DEFAULT '';
UPDATE "Cliente" SET "email" =
  regexp_replace(lower("razaoSocial"), '[^a-z0-9]+', '-', 'g') || '@example.com';
ALTER TABLE "Cliente" ALTER COLUMN "email" DROP DEFAULT;
ALTER TABLE "Cliente" ADD COLUMN "ativo" BOOLEAN NOT NULL DEFAULT true;

-- AlterTable: Certificado — tipo, titular, emitidoEm (backfill), ativo, observacao,
-- substituidoPorId, renovadoEm, bucket, atualizadoEm
ALTER TABLE "Certificado" ADD COLUMN "tipo" "TipoCertificado" NOT NULL DEFAULT 'ECNPJ';
ALTER TABLE "Certificado" ALTER COLUMN "tipo" DROP DEFAULT;

ALTER TABLE "Certificado" ADD COLUMN "titular" TEXT NOT NULL DEFAULT '';
UPDATE "Certificado" c SET "titular" = cl."razaoSocial"
  FROM "Cliente" cl WHERE cl."id" = c."clienteId";
ALTER TABLE "Certificado" ALTER COLUMN "titular" DROP DEFAULT;

ALTER TABLE "Certificado" ADD COLUMN "emitidoEm" TIMESTAMP(3) NOT NULL DEFAULT now();
UPDATE "Certificado" SET "emitidoEm" = "dataValidade" - INTERVAL '1 year';
ALTER TABLE "Certificado" ALTER COLUMN "emitidoEm" DROP DEFAULT;

ALTER TABLE "Certificado" ADD COLUMN "ativo" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "Certificado" ADD COLUMN "observacao" TEXT;
ALTER TABLE "Certificado" ADD COLUMN "substituidoPorId" TEXT;
ALTER TABLE "Certificado" ADD COLUMN "renovadoEm" TIMESTAMP(3);
ALTER TABLE "Certificado" ADD COLUMN "bucket" "BucketCertificado" NOT NULL DEFAULT 'OK';

ALTER TABLE "Certificado" ADD COLUMN "atualizadoEm" TIMESTAMP(3) NOT NULL DEFAULT now();
ALTER TABLE "Certificado" ALTER COLUMN "atualizadoEm" DROP DEFAULT;

-- DropIndex (indice antigo referenciava colunas que vao sumir de AvisoCertificado)
DROP INDEX "AvisoCertificado_certificadoId_criadoEm_idx";

-- AlterTable: AvisoCertificado recriado como marco de e-mail (tabela vazia)
ALTER TABLE "AvisoCertificado" DROP COLUMN "diasRestantes",
DROP COLUMN "faixa",
DROP COLUMN "mensagem",
ADD COLUMN     "clienteId" TEXT NOT NULL,
ADD COLUMN     "marco" "MarcoAviso" NOT NULL,
ADD COLUMN     "destinatarioEmail" TEXT NOT NULL,
ADD COLUMN     "status" "StatusAviso" NOT NULL DEFAULT 'QUEUED',
ADD COLUMN     "providerMessageId" TEXT,
ADD COLUMN     "enviadoEm" TIMESTAMP(3);

ALTER TABLE "AvisoCertificado" ADD COLUMN "atualizadoEm" TIMESTAMP(3) NOT NULL DEFAULT now();
ALTER TABLE "AvisoCertificado" ALTER COLUMN "atualizadoEm" DROP DEFAULT;

-- DropEnum (so depois de dropar a coluna "faixa" que o usava)
DROP TYPE "FaixaUrgencia";

-- CreateTable
CREATE TABLE "NotificacaoInApp" (
    "id" TEXT NOT NULL,
    "usuarioId" TEXT NOT NULL,
    "tipo" "TipoNotificacao" NOT NULL,
    "certificadoId" TEXT NOT NULL,
    "clienteId" TEXT NOT NULL,
    "lidaEm" TIMESTAMP(3),
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "NotificacaoInApp_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RegistroAuditoria" (
    "id" TEXT NOT NULL,
    "entidade" TEXT NOT NULL,
    "entidadeId" TEXT NOT NULL,
    "acao" TEXT NOT NULL,
    "descricao" TEXT NOT NULL,
    "autorId" TEXT,
    "autorEmail" TEXT,
    "clienteId" TEXT,
    "dadosAntes" JSONB,
    "dadosDepois" JSONB,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RegistroAuditoria_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "NotificacaoInApp_usuarioId_lidaEm_idx" ON "NotificacaoInApp"("usuarioId", "lidaEm");

-- CreateIndex
CREATE INDEX "NotificacaoInApp_usuarioId_tipo_criadoEm_idx" ON "NotificacaoInApp"("usuarioId", "tipo", "criadoEm");

-- CreateIndex
CREATE INDEX "RegistroAuditoria_criadoEm_idx" ON "RegistroAuditoria"("criadoEm");

-- CreateIndex
CREATE INDEX "RegistroAuditoria_entidade_entidadeId_criadoEm_idx" ON "RegistroAuditoria"("entidade", "entidadeId", "criadoEm");

-- CreateIndex
CREATE INDEX "RegistroAuditoria_clienteId_criadoEm_idx" ON "RegistroAuditoria"("clienteId", "criadoEm");

-- CreateIndex
CREATE INDEX "AvisoCertificado_clienteId_idx" ON "AvisoCertificado"("clienteId");

-- CreateIndex
CREATE UNIQUE INDEX "AvisoCertificado_certificadoId_marco_key" ON "AvisoCertificado"("certificadoId", "marco");

-- CreateIndex
CREATE UNIQUE INDEX "Certificado_substituidoPorId_key" ON "Certificado"("substituidoPorId");

-- CreateIndex
CREATE INDEX "Certificado_clienteId_idx" ON "Certificado"("clienteId");

-- CreateIndex
CREATE INDEX "Certificado_bucket_idx" ON "Certificado"("bucket");

-- AddForeignKey
ALTER TABLE "Certificado" ADD CONSTRAINT "Certificado_substituidoPorId_fkey" FOREIGN KEY ("substituidoPorId") REFERENCES "Certificado"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AvisoCertificado" ADD CONSTRAINT "AvisoCertificado_clienteId_fkey" FOREIGN KEY ("clienteId") REFERENCES "Cliente"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NotificacaoInApp" ADD CONSTRAINT "NotificacaoInApp_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "Usuario"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NotificacaoInApp" ADD CONSTRAINT "NotificacaoInApp_certificadoId_fkey" FOREIGN KEY ("certificadoId") REFERENCES "Certificado"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NotificacaoInApp" ADD CONSTRAINT "NotificacaoInApp_clienteId_fkey" FOREIGN KEY ("clienteId") REFERENCES "Cliente"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RegistroAuditoria" ADD CONSTRAINT "RegistroAuditoria_autorId_fkey" FOREIGN KEY ("autorId") REFERENCES "Usuario"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RegistroAuditoria" ADD CONSTRAINT "RegistroAuditoria_clienteId_fkey" FOREIGN KEY ("clienteId") REFERENCES "Cliente"("id") ON DELETE SET NULL ON UPDATE CASCADE;
