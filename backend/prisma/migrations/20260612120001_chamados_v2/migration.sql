-- Chamados v2: watchers, subtasks, links, custom fields, reopen counter
-- Inspirado em sistemas como Movidesk pra dar ao modulo recursos completos.

-- 1) Reabertura counter
ALTER TABLE "chamados" ADD COLUMN "reaberturas_count" INTEGER NOT NULL DEFAULT 0;

-- 2) Watchers / Seguidores
CREATE TABLE "chamado_watchers" (
    "id"         TEXT PRIMARY KEY,
    "chamado_id" TEXT NOT NULL,
    "user_id"    TEXT NOT NULL,
    "criado_em"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "chamado_watchers_chamado_id_fkey"
      FOREIGN KEY ("chamado_id") REFERENCES "chamados"("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "chamado_watchers_user_id_fkey"
      FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "chamado_watchers_chamado_user_uq" UNIQUE ("chamado_id", "user_id")
);
CREATE INDEX "chamado_watchers_user_id_idx" ON "chamado_watchers"("user_id");

-- 3) Subtasks / Checklist
CREATE TABLE "chamado_subtasks" (
    "id"           TEXT PRIMARY KEY,
    "chamado_id"   TEXT NOT NULL,
    "titulo"       TEXT NOT NULL,
    "concluido"    BOOLEAN NOT NULL DEFAULT false,
    "assignee_id"  TEXT,
    "ordem"        INTEGER NOT NULL DEFAULT 0,
    "criado_em"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "concluido_em" TIMESTAMP(3),
    CONSTRAINT "chamado_subtasks_chamado_id_fkey"
      FOREIGN KEY ("chamado_id") REFERENCES "chamados"("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "chamado_subtasks_assignee_id_fkey"
      FOREIGN KEY ("assignee_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE
);
CREATE INDEX "chamado_subtasks_chamado_ordem_idx" ON "chamado_subtasks"("chamado_id", "ordem");

-- 4) Links entre chamados
CREATE TABLE "chamado_links" (
    "id"              TEXT PRIMARY KEY,
    "from_chamado_id" TEXT NOT NULL,
    "to_chamado_id"   TEXT NOT NULL,
    "tipo"            TEXT NOT NULL,
    "criado_em"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "criado_por_id"   TEXT,
    CONSTRAINT "chamado_links_from_fkey"
      FOREIGN KEY ("from_chamado_id") REFERENCES "chamados"("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "chamado_links_to_fkey"
      FOREIGN KEY ("to_chamado_id") REFERENCES "chamados"("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "chamado_links_criador_fkey"
      FOREIGN KEY ("criado_por_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "chamado_links_from_to_tipo_uq" UNIQUE ("from_chamado_id","to_chamado_id","tipo")
);
CREATE INDEX "chamado_links_from_idx" ON "chamado_links"("from_chamado_id");
CREATE INDEX "chamado_links_to_idx"   ON "chamado_links"("to_chamado_id");

-- 5) Custom fields por categoria
CREATE TABLE "chamado_custom_fields" (
    "id"              TEXT PRIMARY KEY,
    "organization_id" TEXT NOT NULL,
    "categoria"       TEXT,
    "label"           TEXT NOT NULL,
    "tipo"            TEXT NOT NULL,
    "obrigatorio"     BOOLEAN NOT NULL DEFAULT false,
    "ordem"           INTEGER NOT NULL DEFAULT 0,
    "opcoes_json"     JSONB,
    "ativo"           BOOLEAN NOT NULL DEFAULT true,
    "criado_em"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "chamado_custom_fields_organization_id_fkey"
      FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX "chamado_custom_fields_org_categoria_idx" ON "chamado_custom_fields"("organization_id","categoria");

CREATE TABLE "chamado_custom_values" (
    "id"         TEXT PRIMARY KEY,
    "chamado_id" TEXT NOT NULL,
    "field_id"   TEXT NOT NULL,
    "valor"      TEXT NOT NULL,
    CONSTRAINT "chamado_custom_values_chamado_id_fkey"
      FOREIGN KEY ("chamado_id") REFERENCES "chamados"("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "chamado_custom_values_field_id_fkey"
      FOREIGN KEY ("field_id") REFERENCES "chamado_custom_fields"("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "chamado_custom_values_chamado_field_uq" UNIQUE ("chamado_id","field_id")
);
CREATE INDEX "chamado_custom_values_chamado_idx" ON "chamado_custom_values"("chamado_id");
