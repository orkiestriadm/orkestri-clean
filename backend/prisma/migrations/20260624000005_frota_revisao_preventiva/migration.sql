-- Revisões preventivas: planos por modelo (base km/data/horímetro), horímetro
-- do veículo e da revisão. Idempotente.

ALTER TABLE veiculos        ADD COLUMN IF NOT EXISTS horimetro_atual INTEGER;
ALTER TABLE revisoes_veiculo ADD COLUMN IF NOT EXISTS horimetro      INTEGER;

CREATE TABLE IF NOT EXISTS planos_revisao (
  id                  TEXT PRIMARY KEY,
  organization_id     TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  modelo              TEXT NOT NULL,
  marca               TEXT,
  tipo                TEXT NOT NULL,
  base                TEXT NOT NULL DEFAULT 'km',
  intervalo_km        INTEGER,
  intervalo_dias      INTEGER,
  intervalo_horimetro INTEGER,
  ativo               BOOLEAN NOT NULL DEFAULT true,
  observacoes         TEXT,
  criado_por_id       TEXT,
  atualizado_por_id   TEXT,
  deleted_at          TIMESTAMPTZ,
  criado_em           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  atualizado_em       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_plano_revisao_org_del ON planos_revisao(organization_id, deleted_at);
CREATE INDEX IF NOT EXISTS idx_plano_revisao_modelo  ON planos_revisao(organization_id, modelo);
