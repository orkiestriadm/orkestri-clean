-- AddColumns: organizations (multi-tenancy fields missing from schema)
ALTER TABLE "organizations" ADD COLUMN IF NOT EXISTS "crm_cliente_id"      TEXT;
ALTER TABLE "organizations" ADD COLUMN IF NOT EXISTS "status_comercial"     TEXT;
ALTER TABLE "organizations" ADD COLUMN IF NOT EXISTS "status_operacional"   TEXT;
ALTER TABLE "organizations" ADD COLUMN IF NOT EXISTS "modulos_ativos"       TEXT[] NOT NULL DEFAULT '{}';

CREATE UNIQUE INDEX IF NOT EXISTS "organizations_crm_cliente_id_key" ON "organizations"("crm_cliente_id");

-- AddColumns: clientes (pipeline / tenant fields missing from schema)
ALTER TABLE "clientes" ADD COLUMN IF NOT EXISTS "tenant_org_id"    TEXT;
ALTER TABLE "clientes" ADD COLUMN IF NOT EXISTS "valor_estimado"   DOUBLE PRECISION;
ALTER TABLE "clientes" ADD COLUMN IF NOT EXISTS "probabilidade"    INTEGER;
ALTER TABLE "clientes" ADD COLUMN IF NOT EXISTS "data_fechamento"  TIMESTAMP(3);

CREATE UNIQUE INDEX IF NOT EXISTS "clientes_tenant_org_id_key" ON "clientes"("tenant_org_id");
