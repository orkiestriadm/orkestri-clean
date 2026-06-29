-- Gestão completa de pneus: identificação individual, eventos (instalação,
-- remoção, rodízio, recapagem, descarte) e layout de posições por tipo. Idempotente.

ALTER TABLE pneus ADD COLUMN IF NOT EXISTS numero_fogo     TEXT;
ALTER TABLE pneus ADD COLUMN IF NOT EXISTS codigo          TEXT;
ALTER TABLE pneus ADD COLUMN IF NOT EXISTS dot             TEXT;
ALTER TABLE pneus ADD COLUMN IF NOT EXISTS data_fabricacao TIMESTAMPTZ;
ALTER TABLE pneus ADD COLUMN IF NOT EXISTS fornecedor      TEXT;
ALTER TABLE pneus ADD COLUMN IF NOT EXISTS valor_compra    DOUBLE PRECISION;
ALTER TABLE pneus ADD COLUMN IF NOT EXISTS km_inicial      INTEGER;
ALTER TABLE pneus ADD COLUMN IF NOT EXISTS km_previsto     INTEGER;

-- Eventos do pneu (histórico completo)
CREATE TABLE IF NOT EXISTS pneu_eventos (
  id              TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  pneu_id         TEXT NOT NULL REFERENCES pneus(id) ON DELETE CASCADE,
  veiculo_id      TEXT,
  tipo            TEXT NOT NULL,
  data            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  km              INTEGER,
  posicao_de      TEXT,
  posicao_para    TEXT,
  custo           DOUBLE PRECISION,
  observacoes     TEXT,
  criado_por_id   TEXT,
  criado_em       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_pneu_evento_pneu ON pneu_eventos(pneu_id, data);
CREATE INDEX IF NOT EXISTS idx_pneu_evento_tipo ON pneu_eventos(organization_id, tipo);

-- Layout de posições por tipo de veículo (árvore visual)
CREATE TABLE IF NOT EXISTS pneu_layouts (
  id              TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  tipo            TEXT NOT NULL,
  posicoes        JSONB NOT NULL DEFAULT '[]',
  criado_em       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  atualizado_em   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE UNIQUE INDEX IF NOT EXISTS uq_pneu_layout_org_tipo ON pneu_layouts(organization_id, tipo);
