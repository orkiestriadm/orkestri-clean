-- ────────────────────────────────────────────────────────────────────────────
-- Migration: billing_signup_sessions + isenção da org Default
-- ────────────────────────────────────────────────────────────────────────────

-- Tabela de sessões de auto-signup (landing page → MP → provisionamento)
CREATE TABLE "billing_signup_sessions" (
  "id"               TEXT NOT NULL PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "token"            TEXT NOT NULL UNIQUE DEFAULT gen_random_uuid()::text,
  "plano"            TEXT NOT NULL,
  "payer_email"      TEXT NOT NULL,
  "org_nome"         TEXT NOT NULL,
  "org_slug"         TEXT NOT NULL,
  "admin_nome"       TEXT NOT NULL,
  "admin_senha_hash" TEXT NOT NULL,
  "mp_preapproval_id" TEXT,
  "mp_checkout_url"  TEXT,
  "status"           TEXT NOT NULL DEFAULT 'pending',
  "organization_id"  TEXT,
  "criado_em"        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "expires_at"       TIMESTAMPTZ NOT NULL
);

CREATE INDEX "billing_signup_sessions_token_idx"           ON "billing_signup_sessions"("token");
CREATE INDEX "billing_signup_sessions_mp_preapproval_idx"  ON "billing_signup_sessions"("mp_preapproval_id");

-- ─── Isentar org "Default" (homologação) ────────────────────────────────────
-- Define status=enterprise_manual para a organização com slug='default'
-- ou nome='Default', garantindo que o trial/billing jamais a bloqueie.
UPDATE org_billing ob
SET
  status               = 'enterprise_manual',
  override_nota        = 'Organização de homologação — isenta de cobrança',
  atualizado_em        = NOW()
FROM organizations o
WHERE ob.organization_id = o.id
  AND (LOWER(o.slug) = 'default' OR LOWER(o.nome) = 'default');
