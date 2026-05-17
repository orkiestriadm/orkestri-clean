-- Sprint 2.5: Gestão de Contratos — enhance contratos table

CREATE SEQUENCE IF NOT EXISTS contratos_numero_seq START 1;

ALTER TABLE contratos
  ADD COLUMN IF NOT EXISTS numero        INT DEFAULT nextval('contratos_numero_seq'),
  ADD COLUMN IF NOT EXISTS titulo        TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS status        TEXT NOT NULL DEFAULT 'vigente',
  ADD COLUMN IF NOT EXISTS responsavel_id TEXT;

ALTER TABLE contratos
  ADD CONSTRAINT contratos_responsavel_fkey
    FOREIGN KEY (responsavel_id) REFERENCES users(id) ON DELETE SET NULL
  NOT VALID;

CREATE INDEX IF NOT EXISTS idx_contratos_status   ON contratos(status);
CREATE INDEX IF NOT EXISTS idx_contratos_vigencia ON contratos(vigencia_fim);
