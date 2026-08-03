-- ============================================================================
-- Orkiestri People — checklist de admissão e desligamento
--
-- O módulo sabia registrar a admissão, mas não sabia responder a pergunta que
-- o RH faz na segunda-feira: "o que ainda falta para essa pessoa entrar?".
-- Documento entregue, crachá, acesso ao sistema, exame admissional, integração
-- — cada um vivia na cabeça de alguém ou numa planilha paralela.
--
-- DECISÃO CENTRAL: a instância COPIA os itens do modelo, não aponta para ele.
-- Mudar o modelo depois não pode reescrever o checklist de quem já foi
-- admitido — senão o histórico passa a mentir sobre o que foi de fato exigido
-- na época. É o mesmo princípio do `position_id` gravado no registro salarial.
-- ============================================================================

-- ── Modelo ──────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS "checklist_templates" (
  "id"               TEXT NOT NULL,
  "organization_id"  TEXT NOT NULL,
  "nome"             TEXT NOT NULL,
  -- admissao | desligamento
  "evento"           TEXT NOT NULL,
  "descricao"        TEXT,
  "ativo"            BOOLEAN NOT NULL DEFAULT true,
  "criado_em"        TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "criado_por_id"    TEXT,
  "atualizado_em"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "atualizado_por_id" TEXT,
  CONSTRAINT "checklist_templates_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "checklist_templates_org_nome_key"
  ON "checklist_templates"("organization_id", "nome");

CREATE INDEX IF NOT EXISTS "checklist_templates_org_evento_idx"
  ON "checklist_templates"("organization_id", "evento");

CREATE TABLE IF NOT EXISTS "checklist_template_items" (
  "id"              TEXT NOT NULL,
  "organization_id" TEXT NOT NULL,
  "template_id"     TEXT NOT NULL,
  "ordem"           INTEGER NOT NULL,
  "titulo"          TEXT NOT NULL,
  "descricao"       TEXT,
  -- rh | gestor | colaborador — quem tem que fazer, não quem confere.
  "responsavel"     TEXT NOT NULL DEFAULT 'rh',
  -- Item não obrigatório não trava a conclusão do checklist.
  "obrigatorio"     BOOLEAN NOT NULL DEFAULT true,
  -- Prazo em dias a contar do evento. Nulo = sem prazo definido, que é
  -- diferente de zero ("no mesmo dia").
  "prazo_dias"      INTEGER,
  "criado_em"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "checklist_template_items_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "checklist_template_items_template_ordem_key"
  ON "checklist_template_items"("template_id", "ordem");

CREATE INDEX IF NOT EXISTS "checklist_template_items_org_idx"
  ON "checklist_template_items"("organization_id");

-- ── Instância ───────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS "collaborator_checklists" (
  "id"              TEXT NOT NULL,
  "organization_id" TEXT NOT NULL,
  "collaborator_id" TEXT NOT NULL,
  -- Guardado além do template: o modelo pode ser excluído, e o checklist
  -- precisa continuar sabendo de que evento ele é.
  "evento"          TEXT NOT NULL,
  "template_id"     TEXT,
  "nome"            TEXT NOT NULL,
  "iniciado_em"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "concluido_em"    TIMESTAMP(3),
  "criado_por_id"   TEXT,
  CONSTRAINT "collaborator_checklists_pkey" PRIMARY KEY ("id")
);

-- Um checklist por evento por pessoa: dois de admissão tornariam ambíguo qual
-- é "o" progresso de entrada dela.
CREATE UNIQUE INDEX IF NOT EXISTS "collaborator_checklists_collab_evento_key"
  ON "collaborator_checklists"("collaborator_id", "evento");

CREATE INDEX IF NOT EXISTS "collaborator_checklists_org_idx"
  ON "collaborator_checklists"("organization_id");

CREATE TABLE IF NOT EXISTS "collaborator_checklist_items" (
  "id"                TEXT NOT NULL,
  "organization_id"   TEXT NOT NULL,
  "checklist_id"      TEXT NOT NULL,
  "ordem"             INTEGER NOT NULL,
  -- Cópia do modelo no momento da abertura, de propósito: ver o comentário do
  -- topo. O que foi exigido na época não muda quando o modelo muda.
  "titulo"            TEXT NOT NULL,
  "descricao"         TEXT,
  "responsavel"       TEXT NOT NULL DEFAULT 'rh',
  "obrigatorio"       BOOLEAN NOT NULL DEFAULT true,
  "prazo_dias"        INTEGER,
  "concluido_em"      TIMESTAMP(3),
  "concluido_por_id"  TEXT,
  "observacoes"       TEXT,
  CONSTRAINT "collaborator_checklist_items_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "collaborator_checklist_items_checklist_idx"
  ON "collaborator_checklist_items"("checklist_id", "ordem");

CREATE INDEX IF NOT EXISTS "collaborator_checklist_items_org_idx"
  ON "collaborator_checklist_items"("organization_id");

-- ── Chaves estrangeiras ─────────────────────────────────────────────────────
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'checklist_templates_organization_id_fkey') THEN
    ALTER TABLE "checklist_templates" ADD CONSTRAINT "checklist_templates_organization_id_fkey"
      FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'checklist_template_items_organization_id_fkey') THEN
    ALTER TABLE "checklist_template_items" ADD CONSTRAINT "checklist_template_items_organization_id_fkey"
      FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'checklist_template_items_template_id_fkey') THEN
    ALTER TABLE "checklist_template_items" ADD CONSTRAINT "checklist_template_items_template_id_fkey"
      FOREIGN KEY ("template_id") REFERENCES "checklist_templates"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'collaborator_checklists_organization_id_fkey') THEN
    ALTER TABLE "collaborator_checklists" ADD CONSTRAINT "collaborator_checklists_organization_id_fkey"
      FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'collaborator_checklists_collaborator_id_fkey') THEN
    ALTER TABLE "collaborator_checklists" ADD CONSTRAINT "collaborator_checklists_collaborator_id_fkey"
      FOREIGN KEY ("collaborator_id") REFERENCES "collaborators"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;

  -- SET NULL: excluir o modelo não pode levar junto o checklist de quem já foi
  -- admitido. A instância é autônoma — tem nome e itens próprios.
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'collaborator_checklists_template_id_fkey') THEN
    ALTER TABLE "collaborator_checklists" ADD CONSTRAINT "collaborator_checklists_template_id_fkey"
      FOREIGN KEY ("template_id") REFERENCES "checklist_templates"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'collaborator_checklist_items_organization_id_fkey') THEN
    ALTER TABLE "collaborator_checklist_items" ADD CONSTRAINT "collaborator_checklist_items_organization_id_fkey"
      FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'collaborator_checklist_items_checklist_id_fkey') THEN
    ALTER TABLE "collaborator_checklist_items" ADD CONSTRAINT "collaborator_checklist_items_checklist_id_fkey"
      FOREIGN KEY ("checklist_id") REFERENCES "collaborator_checklists"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;
