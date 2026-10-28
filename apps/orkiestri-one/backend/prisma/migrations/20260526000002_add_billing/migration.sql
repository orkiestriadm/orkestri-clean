-- CreateTable: OrgBilling (ciclo de vida de assinatura SaaS por tenant)
CREATE TABLE "org_billing" (
    "id"                      TEXT NOT NULL,
    "organization_id"         TEXT NOT NULL,
    "plano"                   TEXT NOT NULL DEFAULT 'business_cloud',
    "status"                  TEXT NOT NULL DEFAULT 'trial',
    "trial_ends_at"           TIMESTAMP(3),
    "current_period_start"    TIMESTAMP(3),
    "current_period_end"      TIMESTAMP(3),
    "next_billing_date"       TIMESTAMP(3),
    "valor_mensal"            DOUBLE PRECISION,
    "mp_preapproval_id"       TEXT,
    "mp_payer_email"          TEXT,
    "mp_checkout_url"         TEXT,
    "override_status_by_sa_id" TEXT,
    "override_nota"           TEXT,
    "criado_em"               TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizado_em"           TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "org_billing_pkey" PRIMARY KEY ("id")
);

-- CreateTable: BillingPayment (histórico de pagamentos)
CREATE TABLE "billing_payments" (
    "id"             TEXT NOT NULL,
    "org_billing_id" TEXT NOT NULL,
    "mp_payment_id"  TEXT,
    "valor"          DOUBLE PRECISION NOT NULL,
    "status"         TEXT NOT NULL,
    "metodo"         TEXT,
    "data_vencimento" TIMESTAMP(3),
    "data_pagamento"  TIMESTAMP(3),
    "referencia"     TEXT,
    "criado_em"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "billing_payments_pkey" PRIMARY KEY ("id")
);

-- Unique: uma org tem um único registro de billing
CREATE UNIQUE INDEX "org_billing_organization_id_key" ON "org_billing"("organization_id");

-- Indexes
CREATE INDEX "org_billing_status_idx" ON "org_billing"("status");
CREATE INDEX "billing_payments_org_billing_id_idx" ON "billing_payments"("org_billing_id");
CREATE INDEX "billing_payments_status_idx" ON "billing_payments"("status");

-- FK: org_billing → organizations (cascade delete)
ALTER TABLE "org_billing"
    ADD CONSTRAINT "org_billing_organization_id_fkey"
    FOREIGN KEY ("organization_id")
    REFERENCES "organizations"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;

-- FK: billing_payments → org_billing (cascade delete)
ALTER TABLE "billing_payments"
    ADD CONSTRAINT "billing_payments_org_billing_id_fkey"
    FOREIGN KEY ("org_billing_id")
    REFERENCES "org_billing"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;

-- Trigger para atualizar atualizado_em automaticamente
CREATE OR REPLACE FUNCTION update_org_billing_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.atualizado_em = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER org_billing_updated_at
  BEFORE UPDATE ON "org_billing"
  FOR EACH ROW EXECUTE FUNCTION update_org_billing_updated_at();

-- Provisionar OrgBilling com trial de 14 dias para orgs existentes que não têm billing
INSERT INTO "org_billing" ("id", "organization_id", "plano", "status", "trial_ends_at", "criado_em", "atualizado_em")
SELECT
  gen_random_uuid()::text,
  o."id",
  'business_cloud',
  'trial',
  CURRENT_TIMESTAMP + INTERVAL '14 days',
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
FROM "organizations" o
WHERE NOT EXISTS (
  SELECT 1 FROM "org_billing" b WHERE b."organization_id" = o."id"
);
