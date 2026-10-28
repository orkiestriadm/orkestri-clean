-- ─────────────────────────────────────────────────────────────────────────────
-- Matriz de aprovadores por setor (1 primário + 1 backup com vigência)
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS "aprovadores_setor" (
  "id"                  TEXT      NOT NULL,
  "organization_id"     TEXT      NOT NULL,
  "setor_id"            TEXT      NOT NULL,
  "aprovador_id"        TEXT      NOT NULL,
  "backup_aprovador_id" TEXT,
  "backup_inicio"       TIMESTAMP,
  "backup_fim"          TIMESTAMP,
  "configurado_por_id"  TEXT,
  "criado_em"           TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "atualizado_em"       TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "aprovadores_setor_pkey" PRIMARY KEY ("id")
);

-- 1 aprovador primário por setor (per-org garantido via setor.organizationId)
CREATE UNIQUE INDEX IF NOT EXISTS "aprovadores_setor_setor_id_key"
  ON "aprovadores_setor" ("setor_id");

CREATE INDEX IF NOT EXISTS "aprovadores_setor_organization_id_idx"
  ON "aprovadores_setor" ("organization_id");
CREATE INDEX IF NOT EXISTS "aprovadores_setor_aprovador_id_idx"
  ON "aprovadores_setor" ("aprovador_id");
CREATE INDEX IF NOT EXISTS "aprovadores_setor_backup_aprovador_id_idx"
  ON "aprovadores_setor" ("backup_aprovador_id");

ALTER TABLE "aprovadores_setor"
  ADD CONSTRAINT "aprovadores_setor_organization_id_fkey"
  FOREIGN KEY ("organization_id") REFERENCES "organizations"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "aprovadores_setor"
  ADD CONSTRAINT "aprovadores_setor_setor_id_fkey"
  FOREIGN KEY ("setor_id") REFERENCES "setores"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "aprovadores_setor"
  ADD CONSTRAINT "aprovadores_setor_aprovador_id_fkey"
  FOREIGN KEY ("aprovador_id") REFERENCES "users"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "aprovadores_setor"
  ADD CONSTRAINT "aprovadores_setor_backup_aprovador_id_fkey"
  FOREIGN KEY ("backup_aprovador_id") REFERENCES "users"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "aprovadores_setor"
  ADD CONSTRAINT "aprovadores_setor_configurado_por_id_fkey"
  FOREIGN KEY ("configurado_por_id") REFERENCES "users"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
