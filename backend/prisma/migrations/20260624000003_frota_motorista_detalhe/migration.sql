-- Módulo de motoristas: campos adicionais (matrícula, departamento, cargo,
-- dados de emissão da CNH), histórico de renovações e anexos. Idempotente.

ALTER TABLE motoristas ADD COLUMN IF NOT EXISTS matricula     TEXT;
ALTER TABLE motoristas ADD COLUMN IF NOT EXISTS departamento  TEXT;
ALTER TABLE motoristas ADD COLUMN IF NOT EXISTS cargo         TEXT;
ALTER TABLE motoristas ADD COLUMN IF NOT EXISTS cnh_emissao   TIMESTAMPTZ;
ALTER TABLE motoristas ADD COLUMN IF NOT EXISTS orgao_emissor TEXT;

-- Histórico de renovações da CNH
CREATE TABLE IF NOT EXISTS motorista_cnh_renovacoes (
  id                 TEXT PRIMARY KEY,
  organization_id    TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  motorista_id       TEXT NOT NULL REFERENCES motoristas(id) ON DELETE CASCADE,
  numero_anterior    TEXT,
  categoria_anterior TEXT,
  validade_anterior  TIMESTAMPTZ,
  numero_novo        TEXT,
  categoria_nova     TEXT,
  validade_nova      TIMESTAMPTZ,
  orgao_emissor      TEXT,
  data_renovacao     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  observacoes        TEXT,
  criado_por_id      TEXT,
  criado_em          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_mot_renov_mot ON motorista_cnh_renovacoes(motorista_id, data_renovacao);

-- Anexos do motorista (CNH frente/verso, exames, certificados)
CREATE TABLE IF NOT EXISTS motorista_anexos (
  id              TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  motorista_id    TEXT NOT NULL REFERENCES motoristas(id) ON DELETE CASCADE,
  tipo            TEXT NOT NULL,
  nome_arquivo    TEXT NOT NULL,
  nome_original   TEXT NOT NULL,
  mime            TEXT,
  tamanho         INTEGER,
  criado_por_id   TEXT,
  deleted_at      TIMESTAMPTZ,
  criado_em       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_mot_anexo_mot ON motorista_anexos(motorista_id, deleted_at);
