-- Monitoramento: meta de SLA (disponibilidade alvo) por categoria.
CREATE TABLE "mon_sla_meta" (
    "id"              TEXT PRIMARY KEY,
    "organization_id" TEXT NOT NULL,
    "categoria"       TEXT NOT NULL,
    "meta_pct"        DOUBLE PRECISION NOT NULL DEFAULT 99,
    "criado_em"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizado_em"   TIMESTAMP(3) NOT NULL,
    CONSTRAINT "mon_sla_meta_organization_id_fkey"
      FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "mon_sla_meta_org_categoria_uq" UNIQUE ("organization_id","categoria")
);
