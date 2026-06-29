-- Detalhamento do cadastro de veículos: centro de custo, unidade, responsável
-- e histórico de condutores. Idempotente.

ALTER TABLE veiculos ADD COLUMN IF NOT EXISTS centro_custo_id TEXT REFERENCES centros_custo(id) ON DELETE SET NULL;
ALTER TABLE veiculos ADD COLUMN IF NOT EXISTS responsavel_id  TEXT REFERENCES users(id) ON DELETE SET NULL;
ALTER TABLE veiculos ADD COLUMN IF NOT EXISTS unidade         TEXT;

CREATE INDEX IF NOT EXISTS idx_veiculos_centro_custo ON veiculos(centro_custo_id) WHERE centro_custo_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_veiculos_responsavel  ON veiculos(responsavel_id) WHERE responsavel_id IS NOT NULL;

-- Histórico de condutores do veículo
CREATE TABLE IF NOT EXISTS veiculo_condutores (
  id                TEXT PRIMARY KEY,
  organization_id   TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  veiculo_id        TEXT NOT NULL REFERENCES veiculos(id) ON DELETE CASCADE,
  motorista_id      TEXT NOT NULL REFERENCES motoristas(id) ON DELETE CASCADE,
  data_inicio       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  data_fim          TIMESTAMPTZ,
  km_inicial        INTEGER,
  km_final          INTEGER,
  motivo            TEXT,
  observacoes       TEXT,
  criado_por_id     TEXT,
  atualizado_por_id TEXT,
  deleted_at        TIMESTAMPTZ,
  criado_em         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  atualizado_em     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_veic_condutores_org_del ON veiculo_condutores(organization_id, deleted_at);
CREATE INDEX IF NOT EXISTS idx_veic_condutores_veic    ON veiculo_condutores(veiculo_id, data_inicio);
