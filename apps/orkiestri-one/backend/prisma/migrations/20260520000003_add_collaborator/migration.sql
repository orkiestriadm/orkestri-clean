-- AlterTable: user_requests (workforce fields populated on approval)
ALTER TABLE "user_requests" ADD COLUMN IF NOT EXISTS "setor_id"           TEXT;
ALTER TABLE "user_requests" ADD COLUMN IF NOT EXISTS "gestor_id"          TEXT;
ALTER TABLE "user_requests" ADD COLUMN IF NOT EXISTS "jornada_horas_dia"  DOUBLE PRECISION;
ALTER TABLE "user_requests" ADD COLUMN IF NOT EXISTS "squad"              TEXT;
ALTER TABLE "user_requests" ADD COLUMN IF NOT EXISTS "perfil_role_id"     TEXT;
ALTER TABLE "user_requests" ADD COLUMN IF NOT EXISTS "senioridade"        TEXT;
ALTER TABLE "user_requests" ADD COLUMN IF NOT EXISTS "tipo_vinculo"       TEXT;

-- CreateTable: collaborators
CREATE TABLE "collaborators" (
  "id"                 TEXT NOT NULL,
  "organization_id"    TEXT NOT NULL,
  "user_id"            TEXT NOT NULL,
  "matricula"          TEXT,
  "foto_url"           TEXT,
  "email_corporativo"  TEXT,
  "telefone"           TEXT,
  "cargo"              TEXT,
  "departamento"       TEXT,
  "setor_id"           TEXT,
  "squad"              TEXT,
  "especialidade"      TEXT,
  "senioridade"        TEXT,
  "gestor_id"          TEXT,
  "jornada_horas_dia"  DOUBLE PRECISION,
  "jornada_horas_mes"  DOUBLE PRECISION,
  "turno"              TEXT,
  "escala"             TEXT,
  "tipo_vinculo"       TEXT,
  "skills"             JSONB,
  "certificacoes"      JSONB,
  "ativo"              BOOLEAN NOT NULL DEFAULT true,
  "criado_em"          TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "atualizado_em"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "collaborators_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "collaborators_user_id_key" ON "collaborators"("user_id");
CREATE UNIQUE INDEX "collaborators_organization_id_matricula_key" ON "collaborators"("organization_id", "matricula");
CREATE INDEX "collaborators_organization_id_idx" ON "collaborators"("organization_id");
CREATE INDEX "collaborators_setor_id_idx" ON "collaborators"("setor_id");
CREATE INDEX "collaborators_gestor_id_idx" ON "collaborators"("gestor_id");

-- FKs
ALTER TABLE "collaborators" ADD CONSTRAINT "collaborators_organization_id_fkey"
  FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "collaborators" ADD CONSTRAINT "collaborators_user_id_fkey"
  FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "collaborators" ADD CONSTRAINT "collaborators_setor_id_fkey"
  FOREIGN KEY ("setor_id") REFERENCES "setores"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "collaborators" ADD CONSTRAINT "collaborators_gestor_id_fkey"
  FOREIGN KEY ("gestor_id") REFERENCES "collaborators"("id") ON DELETE SET NULL ON UPDATE CASCADE;
