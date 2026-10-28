-- Auditoria de chamados (histórico de mudanças: claim, atribuição, status, etc.)
CREATE TABLE IF NOT EXISTS "chamado_auditoria" (
  "id"              TEXT      NOT NULL,
  "chamado_id"      TEXT      NOT NULL,
  "user_id"         TEXT,
  "acao"            TEXT      NOT NULL,
  "de"              TEXT,
  "para"            TEXT,
  "metadata"        JSONB,
  "criado_em"       TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "chamado_auditoria_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "chamado_auditoria_chamado_id_idx"
  ON "chamado_auditoria" ("chamado_id");
CREATE INDEX IF NOT EXISTS "chamado_auditoria_user_id_idx"
  ON "chamado_auditoria" ("user_id");
CREATE INDEX IF NOT EXISTS "chamado_auditoria_acao_idx"
  ON "chamado_auditoria" ("acao");

ALTER TABLE "chamado_auditoria"
  ADD CONSTRAINT "chamado_auditoria_chamado_id_fkey"
  FOREIGN KEY ("chamado_id") REFERENCES "chamados"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "chamado_auditoria"
  ADD CONSTRAINT "chamado_auditoria_user_id_fkey"
  FOREIGN KEY ("user_id") REFERENCES "users"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
