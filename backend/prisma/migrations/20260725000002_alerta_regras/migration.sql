-- Regras de alerta por organização (configurador do admin).

CREATE TABLE IF NOT EXISTS "alerta_regras" (
  "id" TEXT NOT NULL,
  "organization_id" TEXT NOT NULL,
  "tipo" TEXT NOT NULL,
  "ativo" BOOLEAN NOT NULL DEFAULT true,
  "canais" TEXT NOT NULL DEFAULT '["sistema"]',
  "destinatarios" TEXT NOT NULL DEFAULT '[]',
  "atualizado_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "alerta_regras_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "alerta_regras_organization_id_tipo_key"
  ON "alerta_regras"("organization_id", "tipo");

ALTER TABLE "alerta_regras" DROP CONSTRAINT IF EXISTS "alerta_regras_organization_id_fkey";
ALTER TABLE "alerta_regras"
  ADD CONSTRAINT "alerta_regras_organization_id_fkey"
  FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
