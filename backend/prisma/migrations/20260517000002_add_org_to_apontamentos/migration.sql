-- Add organizationId to apontamentos_horas (missed in multi-tenancy migration)
ALTER TABLE "apontamentos_horas" ADD COLUMN "organization_id" TEXT;

-- Backfill: set org from the related chamado
UPDATE "apontamentos_horas" ah
SET "organization_id" = c."organization_id"
FROM "chamados" c
WHERE ah."chamado_id" = c.id
  AND c."organization_id" IS NOT NULL;

-- Fallback: any remaining rows go to default org
UPDATE "apontamentos_horas"
SET "organization_id" = '00000000-0000-0000-0000-000000000001'
WHERE "organization_id" IS NULL;

-- Index
CREATE INDEX "apontamentos_horas_organization_id_idx" ON "apontamentos_horas"("organization_id");
