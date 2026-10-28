-- Sprint 1.3: Audit Centralization — expand audit_log with module, description, payload, ip

ALTER TABLE audit_log ADD COLUMN IF NOT EXISTS modulo TEXT;
ALTER TABLE audit_log ADD COLUMN IF NOT EXISTS descricao TEXT;
ALTER TABLE audit_log ADD COLUMN IF NOT EXISTS dados JSONB;
ALTER TABLE audit_log ADD COLUMN IF NOT EXISTS ip TEXT;

CREATE INDEX IF NOT EXISTS idx_audit_criado_em ON audit_log(criado_em DESC);
CREATE INDEX IF NOT EXISTS idx_audit_user_id   ON audit_log(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_modulo    ON audit_log(modulo) WHERE modulo IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_audit_acao      ON audit_log(acao);
