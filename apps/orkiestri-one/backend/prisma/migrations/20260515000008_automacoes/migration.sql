-- Sprint 2.3: Motor de Automações — rules engine tables

CREATE TABLE IF NOT EXISTS automacoes (
  id              TEXT PRIMARY KEY,
  nome            TEXT NOT NULL,
  descricao       TEXT,
  trigger         TEXT NOT NULL,
  condicoes       JSONB NOT NULL DEFAULT '[]',
  acoes           JSONB NOT NULL DEFAULT '[]',
  ativo           BOOLEAN NOT NULL DEFAULT true,
  total_execucoes INT NOT NULL DEFAULT 0,
  ultima_execucao TIMESTAMPTZ,
  criado_em       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  atualizado_em   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS automacao_execucoes (
  id           TEXT PRIMARY KEY,
  automacao_id TEXT NOT NULL REFERENCES automacoes(id) ON DELETE CASCADE,
  trigger      TEXT NOT NULL,
  context_id   TEXT NOT NULL,
  resultado    TEXT NOT NULL DEFAULT 'sucesso',
  detalhes     JSONB,
  criado_em    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_automacoes_trigger ON automacoes(trigger) WHERE ativo = true;
CREATE INDEX IF NOT EXISTS idx_automacao_exec_id  ON automacao_execucoes(automacao_id);
CREATE INDEX IF NOT EXISTS idx_automacao_exec_dt  ON automacao_execucoes(criado_em DESC);
