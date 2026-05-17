-- ═══════════════════════════════════════════════════════════════════════════
-- Migration: add_multi_tenancy
-- Adds Organization model and organizationId to all tenant-scoped models
-- ═══════════════════════════════════════════════════════════════════════════

-- ── 1. Create Organizations table ─────────────────────────────────────────────
CREATE TABLE "organizations" (
    "id"           TEXT NOT NULL,
    "nome"         TEXT NOT NULL,
    "slug"         TEXT NOT NULL,
    "plano"        TEXT NOT NULL DEFAULT 'starter',
    "ativo"        BOOLEAN NOT NULL DEFAULT true,
    "criado_em"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizado_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "organizations_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "organizations_slug_key" ON "organizations"("slug");

-- ── 2. Create OrgWhatsappConfig table ────────────────────────────────────────
CREATE TABLE "org_whatsapp_configs" (
    "id"              TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "instance_name"   TEXT NOT NULL,
    "phone_number"    TEXT,
    "conectado"       BOOLEAN NOT NULL DEFAULT false,
    "ultima_conexao"  TIMESTAMP(3),
    "criado_em"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizado_em"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "org_whatsapp_configs_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "org_whatsapp_configs_organization_id_key" ON "org_whatsapp_configs"("organization_id");
CREATE UNIQUE INDEX "org_whatsapp_configs_instance_name_key" ON "org_whatsapp_configs"("instance_name");

-- ── 3. Create SuperAdmins table ───────────────────────────────────────────────
CREATE TABLE "super_admins" (
    "id"        TEXT NOT NULL,
    "user_id"   TEXT NOT NULL,
    "criado_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "super_admins_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "super_admins_user_id_key" ON "super_admins"("user_id");

-- ── 4. Insert default organization (for existing data backfill) ───────────────
INSERT INTO "organizations" ("id", "nome", "slug", "plano", "ativo", "criado_em", "atualizado_em")
VALUES ('00000000-0000-0000-0000-000000000001', 'Default', 'default', 'enterprise', true, NOW(), NOW());

-- ── 5. Add organization_id columns (nullable first for backfill) ───────────────

ALTER TABLE "users"               ADD COLUMN "organization_id" TEXT;
ALTER TABLE "chamados"            ADD COLUMN "organization_id" TEXT;
ALTER TABLE "clientes"            ADD COLUMN "organization_id" TEXT;
ALTER TABLE "contratos"           ADD COLUMN "organization_id" TEXT;
ALTER TABLE "faturas"             ADD COLUMN "organization_id" TEXT;
ALTER TABLE "projects"            ADD COLUMN "organization_id" TEXT;
ALTER TABLE "notes"               ADD COLUMN "organization_id" TEXT;
ALTER TABLE "note_labels"         ADD COLUMN "organization_id" TEXT;
ALTER TABLE "events"              ADD COLUMN "organization_id" TEXT;
ALTER TABLE "orcamento_ciclos"    ADD COLUMN "organization_id" TEXT;
ALTER TABLE "centros_custo"       ADD COLUMN "organization_id" TEXT;
ALTER TABLE "categorias_orcamento" ADD COLUMN "organization_id" TEXT;
ALTER TABLE "fornecedores_orcamento" ADD COLUMN "organization_id" TEXT;
ALTER TABLE "automacoes"          ADD COLUMN "organization_id" TEXT;
ALTER TABLE "ativos"              ADD COLUMN "organization_id" TEXT;
ALTER TABLE "categorias_ativo"    ADD COLUMN "organization_id" TEXT;
ALTER TABLE "artigos_conhecimento" ADD COLUMN "organization_id" TEXT;
ALTER TABLE "categorias_conhecimento" ADD COLUMN "organization_id" TEXT;
ALTER TABLE "suppliers"           ADD COLUMN "organization_id" TEXT;
ALTER TABLE "sla_regras"          ADD COLUMN "organization_id" TEXT;
ALTER TABLE "alert_configs"       ADD COLUMN "organization_id" TEXT;
ALTER TABLE "setores"             ADD COLUMN "organization_id" TEXT;
ALTER TABLE "audit_log"           ADD COLUMN "organization_id" TEXT;
ALTER TABLE "sistema_configs"     ADD COLUMN "organization_id" TEXT;
ALTER TABLE "user_requests"       ADD COLUMN "organization_id" TEXT;

-- ── 6. Backfill existing data with default org ────────────────────────────────
UPDATE "users"               SET "organization_id" = '00000000-0000-0000-0000-000000000001' WHERE "organization_id" IS NULL;
UPDATE "chamados"            SET "organization_id" = '00000000-0000-0000-0000-000000000001' WHERE "organization_id" IS NULL;
UPDATE "clientes"            SET "organization_id" = '00000000-0000-0000-0000-000000000001' WHERE "organization_id" IS NULL;
UPDATE "contratos"           SET "organization_id" = '00000000-0000-0000-0000-000000000001' WHERE "organization_id" IS NULL;
UPDATE "faturas"             SET "organization_id" = '00000000-0000-0000-0000-000000000001' WHERE "organization_id" IS NULL;
UPDATE "projects"            SET "organization_id" = '00000000-0000-0000-0000-000000000001' WHERE "organization_id" IS NULL;
UPDATE "notes"               SET "organization_id" = '00000000-0000-0000-0000-000000000001' WHERE "organization_id" IS NULL;
UPDATE "note_labels"         SET "organization_id" = '00000000-0000-0000-0000-000000000001' WHERE "organization_id" IS NULL;
UPDATE "events"              SET "organization_id" = '00000000-0000-0000-0000-000000000001' WHERE "organization_id" IS NULL;
UPDATE "orcamento_ciclos"    SET "organization_id" = '00000000-0000-0000-0000-000000000001' WHERE "organization_id" IS NULL;
UPDATE "centros_custo"       SET "organization_id" = '00000000-0000-0000-0000-000000000001' WHERE "organization_id" IS NULL;
UPDATE "categorias_orcamento" SET "organization_id" = '00000000-0000-0000-0000-000000000001' WHERE "organization_id" IS NULL;
UPDATE "fornecedores_orcamento" SET "organization_id" = '00000000-0000-0000-0000-000000000001' WHERE "organization_id" IS NULL;
UPDATE "automacoes"          SET "organization_id" = '00000000-0000-0000-0000-000000000001' WHERE "organization_id" IS NULL;
UPDATE "ativos"              SET "organization_id" = '00000000-0000-0000-0000-000000000001' WHERE "organization_id" IS NULL;
UPDATE "categorias_ativo"    SET "organization_id" = '00000000-0000-0000-0000-000000000001' WHERE "organization_id" IS NULL;
UPDATE "artigos_conhecimento" SET "organization_id" = '00000000-0000-0000-0000-000000000001' WHERE "organization_id" IS NULL;
UPDATE "categorias_conhecimento" SET "organization_id" = '00000000-0000-0000-0000-000000000001' WHERE "organization_id" IS NULL;
UPDATE "suppliers"           SET "organization_id" = '00000000-0000-0000-0000-000000000001' WHERE "organization_id" IS NULL;
UPDATE "sla_regras"          SET "organization_id" = '00000000-0000-0000-0000-000000000001' WHERE "organization_id" IS NULL;
UPDATE "alert_configs"       SET "organization_id" = '00000000-0000-0000-0000-000000000001' WHERE "organization_id" IS NULL;
UPDATE "setores"             SET "organization_id" = '00000000-0000-0000-0000-000000000001' WHERE "organization_id" IS NULL;
UPDATE "audit_log"           SET "organization_id" = '00000000-0000-0000-0000-000000000001' WHERE "organization_id" IS NULL;
UPDATE "sistema_configs"     SET "organization_id" = '00000000-0000-0000-0000-000000000001' WHERE "organization_id" IS NULL;

-- ── 7. Make organization_id NOT NULL (after backfill) ─────────────────────────
ALTER TABLE "users"               ALTER COLUMN "organization_id" SET NOT NULL;
ALTER TABLE "chamados"            ALTER COLUMN "organization_id" SET NOT NULL;
ALTER TABLE "clientes"            ALTER COLUMN "organization_id" SET NOT NULL;
ALTER TABLE "contratos"           ALTER COLUMN "organization_id" SET NOT NULL;
ALTER TABLE "faturas"             ALTER COLUMN "organization_id" SET NOT NULL;
ALTER TABLE "projects"            ALTER COLUMN "organization_id" SET NOT NULL;
ALTER TABLE "notes"               ALTER COLUMN "organization_id" SET NOT NULL;
ALTER TABLE "note_labels"         ALTER COLUMN "organization_id" SET NOT NULL;
ALTER TABLE "events"              ALTER COLUMN "organization_id" SET NOT NULL;
ALTER TABLE "orcamento_ciclos"    ALTER COLUMN "organization_id" SET NOT NULL;
ALTER TABLE "centros_custo"       ALTER COLUMN "organization_id" SET NOT NULL;
ALTER TABLE "categorias_orcamento" ALTER COLUMN "organization_id" SET NOT NULL;
ALTER TABLE "fornecedores_orcamento" ALTER COLUMN "organization_id" SET NOT NULL;
ALTER TABLE "automacoes"          ALTER COLUMN "organization_id" SET NOT NULL;
ALTER TABLE "ativos"              ALTER COLUMN "organization_id" SET NOT NULL;
ALTER TABLE "categorias_ativo"    ALTER COLUMN "organization_id" SET NOT NULL;
ALTER TABLE "artigos_conhecimento" ALTER COLUMN "organization_id" SET NOT NULL;
ALTER TABLE "categorias_conhecimento" ALTER COLUMN "organization_id" SET NOT NULL;
ALTER TABLE "suppliers"           ALTER COLUMN "organization_id" SET NOT NULL;
ALTER TABLE "sla_regras"          ALTER COLUMN "organization_id" SET NOT NULL;
ALTER TABLE "alert_configs"       ALTER COLUMN "organization_id" SET NOT NULL;
ALTER TABLE "setores"             ALTER COLUMN "organization_id" SET NOT NULL;
ALTER TABLE "audit_log"           ALTER COLUMN "organization_id" SET NOT NULL;
ALTER TABLE "sistema_configs"     ALTER COLUMN "organization_id" SET NOT NULL;

-- ── 8. Drop old single-column unique constraints broken by multi-tenancy ───────
ALTER TABLE "users" DROP CONSTRAINT IF EXISTS "users_email_key";
ALTER TABLE "orcamento_ciclos" DROP CONSTRAINT IF EXISTS "orcamento_ciclos_ano_key";
ALTER TABLE "centros_custo" DROP CONSTRAINT IF EXISTS "centros_custo_codigo_key";
ALTER TABLE "categorias_ativo" DROP CONSTRAINT IF EXISTS "categorias_ativo_nome_key";
ALTER TABLE "categorias_conhecimento" DROP CONSTRAINT IF EXISTS "categorias_conhecimento_nome_key";
ALTER TABLE "setores" DROP CONSTRAINT IF EXISTS "setores_nome_key";
ALTER TABLE "artigos_conhecimento" DROP CONSTRAINT IF EXISTS "artigos_conhecimento_slug_key";
ALTER TABLE "sla_regras" DROP CONSTRAINT IF EXISTS "sla_regras_prioridade_categoria_key";
ALTER TABLE "sistema_configs" DROP CONSTRAINT IF EXISTS "sistema_configs_chave_key";
ALTER TABLE "ativos" DROP CONSTRAINT IF EXISTS "ativos_codigo_key";

-- ── 9. Add new compound unique constraints ────────────────────────────────────
CREATE UNIQUE INDEX "users_organization_id_email_key" ON "users"("organization_id", "email");
CREATE UNIQUE INDEX "orcamento_ciclos_organization_id_ano_key" ON "orcamento_ciclos"("organization_id", "ano");
CREATE UNIQUE INDEX "centros_custo_organization_id_codigo_key" ON "centros_custo"("organization_id", "codigo");
CREATE UNIQUE INDEX "categorias_ativo_organization_id_nome_key" ON "categorias_ativo"("organization_id", "nome");
CREATE UNIQUE INDEX "categorias_conhecimento_organization_id_nome_key" ON "categorias_conhecimento"("organization_id", "nome");
CREATE UNIQUE INDEX "setores_organization_id_nome_key" ON "setores"("organization_id", "nome");
CREATE UNIQUE INDEX "artigos_conhecimento_organization_id_slug_key" ON "artigos_conhecimento"("organization_id", "slug");
CREATE UNIQUE INDEX "sla_regras_organization_id_prioridade_categoria_key" ON "sla_regras"("organization_id", "prioridade", "categoria");
CREATE UNIQUE INDEX "sistema_configs_organization_id_chave_key" ON "sistema_configs"("organization_id", "chave");
CREATE UNIQUE INDEX "ativos_organization_id_codigo_key" ON "ativos"("organization_id", "codigo");
CREATE UNIQUE INDEX "note_labels_organization_id_user_id_nome_key" ON "note_labels"("organization_id", "user_id", "nome");
CREATE UNIQUE INDEX "alert_configs_organization_id_minutos_key" ON "alert_configs"("organization_id", "minutos");

-- ── 10. Add organization indexes ──────────────────────────────────────────────
CREATE INDEX "users_organization_id_idx" ON "users"("organization_id");
CREATE INDEX "chamados_organization_id_status_idx" ON "chamados"("organization_id", "status");
CREATE INDEX "chamados_organization_id_prioridade_idx" ON "chamados"("organization_id", "prioridade");
CREATE INDEX "clientes_organization_id_idx" ON "clientes"("organization_id");
CREATE INDEX "contratos_organization_id_idx" ON "contratos"("organization_id");
CREATE INDEX "faturas_organization_id_status_idx" ON "faturas"("organization_id", "status");
CREATE INDEX "projects_organization_id_status_idx" ON "projects"("organization_id", "status");
CREATE INDEX "notes_organization_id_user_id_idx" ON "notes"("organization_id", "user_id", "arquivado", "lixeira");
CREATE INDEX "events_organization_id_inicio_idx" ON "events"("organization_id", "inicio");
CREATE INDEX "automacoes_organization_id_idx" ON "automacoes"("organization_id");
CREATE INDEX "ativos_organization_id_status_idx" ON "ativos"("organization_id", "status");
CREATE INDEX "artigos_organization_id_status_idx" ON "artigos_conhecimento"("organization_id", "status");
CREATE INDEX "audit_log_organization_id_idx" ON "audit_log"("organization_id", "criado_em" DESC);
CREATE INDEX "suppliers_organization_id_idx" ON "suppliers"("organization_id");
CREATE INDEX "categorias_orcamento_organization_id_idx" ON "categorias_orcamento"("organization_id");
CREATE INDEX "fornecedores_orcamento_organization_id_idx" ON "fornecedores_orcamento"("organization_id");

-- ── 11. Add Foreign Keys for organization_id ──────────────────────────────────
ALTER TABLE "org_whatsapp_configs" ADD CONSTRAINT "org_whatsapp_configs_organization_id_fkey"
    FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "super_admins" ADD CONSTRAINT "super_admins_user_id_fkey"
    FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "users" ADD CONSTRAINT "users_organization_id_fkey"
    FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "chamados" ADD CONSTRAINT "chamados_organization_id_fkey"
    FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "clientes" ADD CONSTRAINT "clientes_organization_id_fkey"
    FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "contratos" ADD CONSTRAINT "contratos_organization_id_fkey"
    FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "faturas" ADD CONSTRAINT "faturas_organization_id_fkey"
    FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "projects" ADD CONSTRAINT "projects_organization_id_fkey"
    FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "notes" ADD CONSTRAINT "notes_organization_id_fkey"
    FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "note_labels" ADD CONSTRAINT "note_labels_organization_id_fkey"
    FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "events" ADD CONSTRAINT "events_organization_id_fkey"
    FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "orcamento_ciclos" ADD CONSTRAINT "orcamento_ciclos_organization_id_fkey"
    FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "centros_custo" ADD CONSTRAINT "centros_custo_organization_id_fkey"
    FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "categorias_orcamento" ADD CONSTRAINT "categorias_orcamento_organization_id_fkey"
    FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "fornecedores_orcamento" ADD CONSTRAINT "fornecedores_orcamento_organization_id_fkey"
    FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "automacoes" ADD CONSTRAINT "automacoes_organization_id_fkey"
    FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "ativos" ADD CONSTRAINT "ativos_organization_id_fkey"
    FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "categorias_ativo" ADD CONSTRAINT "categorias_ativo_organization_id_fkey"
    FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "artigos_conhecimento" ADD CONSTRAINT "artigos_conhecimento_organization_id_fkey"
    FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "categorias_conhecimento" ADD CONSTRAINT "categorias_conhecimento_organization_id_fkey"
    FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "suppliers" ADD CONSTRAINT "suppliers_organization_id_fkey"
    FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "sla_regras" ADD CONSTRAINT "sla_regras_organization_id_fkey"
    FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "alert_configs" ADD CONSTRAINT "alert_configs_organization_id_fkey"
    FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "setores" ADD CONSTRAINT "setores_organization_id_fkey"
    FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "audit_log" ADD CONSTRAINT "audit_log_organization_id_fkey"
    FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "sistema_configs" ADD CONSTRAINT "sistema_configs_organization_id_fkey"
    FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- ── 12. Minor fixes from diff (rename constraints/indexes) ───────────────────
ALTER TABLE "faturas" ALTER COLUMN "atualizado_em" DROP DEFAULT;

DO $$ BEGIN
  ALTER TABLE "chamado_comentarios" RENAME CONSTRAINT "chamado_comentarios_chamado_fkey" TO "chamado_comentarios_chamado_id_fkey";
EXCEPTION WHEN undefined_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "chamado_comentarios" RENAME CONSTRAINT "chamado_comentarios_user_fkey" TO "chamado_comentarios_user_id_fkey";
EXCEPTION WHEN undefined_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "chamados" RENAME CONSTRAINT "chamados_atendente_fkey" TO "chamados_atendente_id_fkey";
EXCEPTION WHEN undefined_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "chamados" RENAME CONSTRAINT "chamados_cliente_fkey" TO "chamados_cliente_id_fkey";
EXCEPTION WHEN undefined_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "chamados" RENAME CONSTRAINT "chamados_solicitante_fkey" TO "chamados_solicitante_id_fkey";
EXCEPTION WHEN undefined_object THEN NULL; END $$;

-- Rename indexes (wrap in DO blocks to ignore if they don't exist)
-- Note: ALTER INDEX throws 42P01 (undefined_table), not 42704 (undefined_object), so use OTHERS
DO $$ BEGIN ALTER INDEX "idx_apontamentos_chamado" RENAME TO "apontamentos_horas_chamado_id_idx"; EXCEPTION WHEN others THEN NULL; END $$;
DO $$ BEGIN ALTER INDEX "idx_apontamentos_data" RENAME TO "apontamentos_horas_data_idx"; EXCEPTION WHEN others THEN NULL; END $$;
DO $$ BEGIN ALTER INDEX "idx_apontamentos_user" RENAME TO "apontamentos_horas_user_id_idx"; EXCEPTION WHEN others THEN NULL; END $$;
DO $$ BEGIN ALTER INDEX "idx_artigos_status" RENAME TO "artigos_conhecimento_status_idx"; EXCEPTION WHEN others THEN NULL; END $$;
DO $$ BEGIN ALTER INDEX "idx_ativos_status" RENAME TO "ativos_status_idx"; EXCEPTION WHEN others THEN NULL; END $$;
DO $$ BEGIN ALTER INDEX "idx_audit_criado_em" RENAME TO "audit_log_criado_em_idx"; EXCEPTION WHEN others THEN NULL; END $$;
DO $$ BEGIN ALTER INDEX "idx_audit_user_id" RENAME TO "audit_log_user_id_idx"; EXCEPTION WHEN others THEN NULL; END $$;
DO $$ BEGIN ALTER INDEX "idx_automacao_exec_dt" RENAME TO "automacao_execucoes_criado_em_idx"; EXCEPTION WHEN others THEN NULL; END $$;
DO $$ BEGIN ALTER INDEX "idx_automacao_exec_id" RENAME TO "automacao_execucoes_automacao_id_idx"; EXCEPTION WHEN others THEN NULL; END $$;
DO $$ BEGIN ALTER INDEX "chamados_atendente_idx" RENAME TO "chamados_atendente_id_idx"; EXCEPTION WHEN others THEN NULL; END $$;
DO $$ BEGIN ALTER INDEX "chamados_solicitante_idx" RENAME TO "chamados_solicitante_id_idx"; EXCEPTION WHEN others THEN NULL; END $$;
DO $$ BEGIN ALTER INDEX "cliente_timeline_idx" RENAME TO "cliente_timeline_cliente_id_criado_em_idx"; EXCEPTION WHEN others THEN NULL; END $$;
DO $$ BEGIN ALTER INDEX "idx_contratos_status" RENAME TO "contratos_status_idx"; EXCEPTION WHEN others THEN NULL; END $$;
DO $$ BEGIN ALTER INDEX "notes_user_arquivado_idx" RENAME TO "notes_user_id_arquivado_lixeira_idx"; EXCEPTION WHEN others THEN NULL; END $$;
DO $$ BEGIN ALTER INDEX "idx_transf_ativo" RENAME TO "transferencias_ativo_ativo_id_idx"; EXCEPTION WHEN others THEN NULL; END $$;
