-- CreateTable: skills (catálogo da org)
CREATE TABLE "skills" (
  "id"              TEXT NOT NULL,
  "organization_id" TEXT NOT NULL,
  "nome"            TEXT NOT NULL,
  "categoria"       TEXT,
  "descricao"       TEXT,
  "cor"             TEXT,
  "ativo"           BOOLEAN NOT NULL DEFAULT true,
  "criado_em"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "atualizado_em"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "skills_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "skills_organization_id_nome_key" ON "skills"("organization_id", "nome");
CREATE INDEX "skills_organization_id_idx" ON "skills"("organization_id");
CREATE INDEX "skills_categoria_idx" ON "skills"("categoria");

ALTER TABLE "skills" ADD CONSTRAINT "skills_organization_id_fkey"
  FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- CreateTable: collaborator_skills (matriz colab × skill)
CREATE TABLE "collaborator_skills" (
  "id"               TEXT NOT NULL,
  "collaborator_id"  TEXT NOT NULL,
  "skill_id"         TEXT NOT NULL,
  "nivel"            TEXT NOT NULL DEFAULT 'pleno',
  "certificado_em"   TIMESTAMP(3),
  "validade"         TIMESTAMP(3),
  "observacoes"      TEXT,
  "criado_em"        TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "collaborator_skills_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "collaborator_skills_collaborator_id_skill_id_key" ON "collaborator_skills"("collaborator_id", "skill_id");
CREATE INDEX "collaborator_skills_collaborator_id_idx" ON "collaborator_skills"("collaborator_id");
CREATE INDEX "collaborator_skills_skill_id_idx" ON "collaborator_skills"("skill_id");

ALTER TABLE "collaborator_skills" ADD CONSTRAINT "collaborator_skills_collaborator_id_fkey"
  FOREIGN KEY ("collaborator_id") REFERENCES "collaborators"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "collaborator_skills" ADD CONSTRAINT "collaborator_skills_skill_id_fkey"
  FOREIGN KEY ("skill_id") REFERENCES "skills"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AlterTable: chamados (skill requerida pra smart routing)
ALTER TABLE "chamados" ADD COLUMN IF NOT EXISTS "skill_requerida_id" TEXT;
ALTER TABLE "chamados" ADD COLUMN IF NOT EXISTS "nivel_minimo"       TEXT;

CREATE INDEX IF NOT EXISTS "chamados_skill_requerida_id_idx" ON "chamados"("skill_requerida_id");

ALTER TABLE "chamados" ADD CONSTRAINT "chamados_skill_requerida_id_fkey"
  FOREIGN KEY ("skill_requerida_id") REFERENCES "skills"("id") ON DELETE SET NULL ON UPDATE CASCADE;
