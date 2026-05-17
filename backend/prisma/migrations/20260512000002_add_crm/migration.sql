-- CreateEnum
CREATE TYPE "ProjectTipo" AS ENUM ('PROJETO', 'NEGOCIO');

-- CreateTable clientes
CREATE TABLE "clientes" (
    "id" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "empresa" TEXT,
    "email" TEXT,
    "telefone" TEXT,
    "cargo" TEXT,
    "notas" TEXT,
    "criado_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizado_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "clientes_pkey" PRIMARY KEY ("id")
);

-- AlterTable projects: add CRM columns
ALTER TABLE "projects"
    ADD COLUMN IF NOT EXISTS "tipo" "ProjectTipo" NOT NULL DEFAULT 'PROJETO',
    ADD COLUMN IF NOT EXISTS "cliente_id" TEXT,
    ADD COLUMN IF NOT EXISTS "valor" DOUBLE PRECISION;

-- CreateIndex
CREATE INDEX "projects_tipo_idx" ON "projects"("tipo");

-- AddForeignKey
ALTER TABLE "projects"
    ADD CONSTRAINT "projects_cliente_id_fkey"
    FOREIGN KEY ("cliente_id") REFERENCES "clientes"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;
