-- CreateTable
CREATE TABLE "PermissaoModulo" (
    "id" TEXT NOT NULL,
    "usuarioId" TEXT NOT NULL,
    "moduloCodigo" TEXT NOT NULL,
    "habilitado" BOOLEAN NOT NULL DEFAULT false,
    "atualizadoEm" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PermissaoModulo_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PermissaoSubArea" (
    "id" TEXT NOT NULL,
    "usuarioId" TEXT NOT NULL,
    "moduloCodigo" TEXT NOT NULL,
    "subArea" TEXT NOT NULL,
    "habilitado" BOOLEAN NOT NULL DEFAULT true,
    "atualizadoEm" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PermissaoSubArea_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PermissaoModulo_usuarioId_idx" ON "PermissaoModulo"("usuarioId");

-- CreateIndex
CREATE UNIQUE INDEX "PermissaoModulo_usuarioId_moduloCodigo_key" ON "PermissaoModulo"("usuarioId", "moduloCodigo");

-- CreateIndex
CREATE INDEX "PermissaoSubArea_usuarioId_idx" ON "PermissaoSubArea"("usuarioId");

-- CreateIndex
CREATE UNIQUE INDEX "PermissaoSubArea_usuarioId_moduloCodigo_subArea_key" ON "PermissaoSubArea"("usuarioId", "moduloCodigo", "subArea");

-- AddForeignKey
ALTER TABLE "PermissaoModulo" ADD CONSTRAINT "PermissaoModulo_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "Usuario"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PermissaoSubArea" ADD CONSTRAINT "PermissaoSubArea_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "Usuario"("id") ON DELETE CASCADE ON UPDATE CASCADE;
