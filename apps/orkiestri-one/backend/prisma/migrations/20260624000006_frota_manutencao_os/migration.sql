-- Manutenção como Ordem de Serviço: nº OS, solicitante, datas, custos
-- (peças/serviços/terceiros), apontamento de mão de obra e anexos. Idempotente.

ALTER TABLE manutencoes_veiculo ADD COLUMN IF NOT EXISTS numero_os       TEXT;
ALTER TABLE manutencoes_veiculo ADD COLUMN IF NOT EXISTS solicitante_id  TEXT REFERENCES users(id) ON DELETE SET NULL;
ALTER TABLE manutencoes_veiculo ADD COLUMN IF NOT EXISTS data_abertura   TIMESTAMPTZ;
ALTER TABLE manutencoes_veiculo ADD COLUMN IF NOT EXISTS data_fechamento TIMESTAMPTZ;
ALTER TABLE manutencoes_veiculo ADD COLUMN IF NOT EXISTS custo_pecas     DOUBLE PRECISION;
ALTER TABLE manutencoes_veiculo ADD COLUMN IF NOT EXISTS custo_servicos  DOUBLE PRECISION;
ALTER TABLE manutencoes_veiculo ADD COLUMN IF NOT EXISTS custo_terceiros DOUBLE PRECISION;
ALTER TABLE manutencoes_veiculo ADD COLUMN IF NOT EXISTS fornecedor      TEXT;

CREATE INDEX IF NOT EXISTS idx_manut_solicitante ON manutencoes_veiculo(solicitante_id) WHERE solicitante_id IS NOT NULL;

-- Apontamento de mão de obra
CREATE TABLE IF NOT EXISTS manutencao_mao_obra (
  id              TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  manutencao_id   TEXT NOT NULL REFERENCES manutencoes_veiculo(id) ON DELETE CASCADE,
  descricao       TEXT NOT NULL,
  responsavel     TEXT,
  horas           DOUBLE PRECISION,
  valor_hora      DOUBLE PRECISION,
  custo           DOUBLE PRECISION,
  data            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  criado_por_id   TEXT,
  criado_em       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_manut_mo ON manutencao_mao_obra(manutencao_id);

-- Anexos (nota fiscal, fotos, orçamentos)
CREATE TABLE IF NOT EXISTS manutencao_anexos (
  id              TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  manutencao_id   TEXT NOT NULL REFERENCES manutencoes_veiculo(id) ON DELETE CASCADE,
  tipo            TEXT NOT NULL,
  nome_arquivo    TEXT NOT NULL,
  nome_original   TEXT NOT NULL,
  mime            TEXT,
  tamanho         INTEGER,
  criado_por_id   TEXT,
  deleted_at      TIMESTAMPTZ,
  criado_em       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_manut_anexo ON manutencao_anexos(manutencao_id, deleted_at);
