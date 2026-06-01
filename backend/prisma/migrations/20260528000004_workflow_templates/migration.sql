-- CreateTable: workflow_templates (Fase 3 — Workflow Visual)
CREATE TABLE "workflow_templates" (
    "id"              TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "nome"            TEXT NOT NULL,
    "descricao"       TEXT,
    "tipo"            TEXT NOT NULL DEFAULT 'outro',
    "icone"           TEXT,
    "cor"             TEXT NOT NULL DEFAULT '#a78bfa',
    "ativo"           BOOLEAN NOT NULL DEFAULT true,
    "etapas"          JSONB NOT NULL DEFAULT '[]',
    "criado_por_id"   TEXT NOT NULL,
    "criado_em"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizado_em"   TIMESTAMP(3) NOT NULL,

    CONSTRAINT "workflow_templates_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "workflow_templates_organization_id_idx" ON "workflow_templates"("organization_id");

ALTER TABLE "workflow_templates" ADD CONSTRAINT "workflow_templates_organization_id_fkey"
  FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "workflow_templates" ADD CONSTRAINT "workflow_templates_criado_por_id_fkey"
  FOREIGN KEY ("criado_por_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
