-- Anexos de projeto.
--
-- Idempotente (IF NOT EXISTS) porque os ambientes desta base têm histórico de
-- migration divergente: já houve deploy derrubado por uma migration que
-- assumiu estado limpo e encontrou o objeto já criado. Rodar de novo aqui não
-- causa dano.

CREATE TABLE IF NOT EXISTS "project_anexos" (
  "id"              TEXT NOT NULL,
  "organization_id" TEXT NOT NULL,
  "project_id"      TEXT NOT NULL,
  "titulo"          TEXT NOT NULL,
  "nome_original"   TEXT NOT NULL,
  "arquivo_ref"     TEXT NOT NULL,
  "mime"            TEXT,
  "tamanho"         INTEGER,
  "criado_por_id"   TEXT,
  "deleted_at"      TIMESTAMP(3),
  "criado_em"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "project_anexos_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "project_anexos_project_id_deleted_at_idx"
  ON "project_anexos"("project_id", "deleted_at");

CREATE INDEX IF NOT EXISTS "project_anexos_organization_id_idx"
  ON "project_anexos"("organization_id");

-- As FKs entram separadas e condicionadas: `ADD CONSTRAINT` não aceita
-- IF NOT EXISTS, e sem o DO block a segunda execução aborta a migration.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'project_anexos_organization_id_fkey'
  ) THEN
    ALTER TABLE "project_anexos"
      ADD CONSTRAINT "project_anexos_organization_id_fkey"
      FOREIGN KEY ("organization_id") REFERENCES "organizations"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'project_anexos_project_id_fkey'
  ) THEN
    ALTER TABLE "project_anexos"
      ADD CONSTRAINT "project_anexos_project_id_fkey"
      FOREIGN KEY ("project_id") REFERENCES "projects"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;

  -- SET NULL, não CASCADE: apagar o usuário não pode levar junto o anexo do
  -- projeto. O documento continua valendo mesmo sem o autor.
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'project_anexos_criado_por_id_fkey'
  ) THEN
    ALTER TABLE "project_anexos"
      ADD CONSTRAINT "project_anexos_criado_por_id_fkey"
      FOREIGN KEY ("criado_por_id") REFERENCES "users"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;
