-- Sprint 2.4: Apontamento de Horas — time tracking on chamados

CREATE TABLE IF NOT EXISTS apontamentos_horas (
  id          TEXT PRIMARY KEY,
  chamado_id  TEXT NOT NULL REFERENCES chamados(id) ON DELETE CASCADE,
  user_id     TEXT NOT NULL REFERENCES users(id)    ON DELETE CASCADE,
  minutos     INT  NOT NULL CHECK (minutos > 0),
  descricao   TEXT,
  data        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  criado_em   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_apontamentos_chamado ON apontamentos_horas(chamado_id);
CREATE INDEX IF NOT EXISTS idx_apontamentos_user    ON apontamentos_horas(user_id);
CREATE INDEX IF NOT EXISTS idx_apontamentos_data    ON apontamentos_horas(data DESC);
