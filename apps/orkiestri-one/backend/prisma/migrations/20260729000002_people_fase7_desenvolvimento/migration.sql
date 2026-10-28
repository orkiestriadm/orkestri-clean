-- ============================================================================
-- Orkiestri People — Fase 7: treinamentos, certificações e avaliações
--
-- Mesma separação de benefícios: catálogo da organização (`training_courses`)
-- separado da participação da pessoa (`collaborator_trainings`).
--
-- `performance_reviews` fica sozinha porque avaliação não tem catálogo: o
-- ciclo é um texto ("2026.1") e não uma entidade — criar uma tabela de ciclos
-- só se justifica quando houver janela de abertura/fechamento e metas por
-- ciclo, o que não está nesta fase.
-- ============================================================================

CREATE TABLE IF NOT EXISTS "training_courses" (
  "id"              TEXT NOT NULL,
  "organization_id" TEXT NOT NULL,
  "nome"            TEXT NOT NULL,
  "fornecedor"      TEXT,
  "categoria"       TEXT NOT NULL DEFAULT 'outro',
  "carga_horaria"   INTEGER,
  "descricao"       TEXT,
  -- Meses de validade da certificação. NBR, NR-10 e afins expiram; curso de
  -- ferramenta interna não. Nulo = não expira.
  "validade_meses"  INTEGER,
  "ativo"           BOOLEAN NOT NULL DEFAULT true,
  "criado_em"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "criado_por_id"   TEXT,
  "atualizado_em"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "atualizado_por_id" TEXT,
  "excluido_em"     TIMESTAMP(3),
  CONSTRAINT "training_courses_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "training_courses_organization_id_nome_key"
  ON "training_courses"("organization_id", "nome");

CREATE INDEX IF NOT EXISTS "training_courses_organization_id_ativo_idx"
  ON "training_courses"("organization_id", "ativo");

CREATE TABLE IF NOT EXISTS "collaborator_trainings" (
  "id"              TEXT NOT NULL,
  "organization_id" TEXT NOT NULL,
  "collaborator_id" TEXT NOT NULL,
  "training_id"     TEXT NOT NULL,
  "status"          TEXT NOT NULL DEFAULT 'PLANEJADO',
  "inicio"          TIMESTAMP(3),
  "conclusao"       TIMESTAMP(3),
  -- Calculada na conclusão a partir de validade_meses, mas gravada: mudar a
  -- validade do curso não pode reescrever certificado já emitido.
  "validade"        TIMESTAMP(3),
  "certificado_ref" TEXT,
  "nota"            DOUBLE PRECISION,
  "observacoes"     TEXT,
  "criado_em"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "criado_por_id"   TEXT,
  "atualizado_em"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "atualizado_por_id" TEXT,
  CONSTRAINT "collaborator_trainings_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "collaborator_trainings_collaborator_id_idx"
  ON "collaborator_trainings"("collaborator_id");

CREATE INDEX IF NOT EXISTS "collaborator_trainings_organization_id_status_idx"
  ON "collaborator_trainings"("organization_id", "status");

-- Relatório de certificação vencendo varre por validade dentro da organização.
CREATE INDEX IF NOT EXISTS "collaborator_trainings_organization_id_validade_idx"
  ON "collaborator_trainings"("organization_id", "validade");

CREATE INDEX IF NOT EXISTS "collaborator_trainings_training_id_idx"
  ON "collaborator_trainings"("training_id");

CREATE TABLE IF NOT EXISTS "performance_reviews" (
  "id"              TEXT NOT NULL,
  "organization_id" TEXT NOT NULL,
  "collaborator_id" TEXT NOT NULL,
  "ciclo"           TEXT NOT NULL,
  -- Avaliador é colaborador e não usuário: quem avalia é o gestor no
  -- organograma, e gestor pode não ter login (ADR-001, userId opcional).
  "avaliador_id"    TEXT,
  "status"          TEXT NOT NULL DEFAULT 'RASCUNHO',
  "nota"            DOUBLE PRECISION,
  "pontos_fortes"   TEXT,
  "pontos_melhoria" TEXT,
  "comentarios"     TEXT,
  "finalizada_em"   TIMESTAMP(3),
  "criado_em"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "criado_por_id"   TEXT,
  "atualizado_em"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "atualizado_por_id" TEXT,
  CONSTRAINT "performance_reviews_pkey" PRIMARY KEY ("id")
);

-- Uma avaliação por colaborador por ciclo. Reavaliar edita a existente.
CREATE UNIQUE INDEX IF NOT EXISTS "performance_reviews_collaborator_id_ciclo_key"
  ON "performance_reviews"("collaborator_id", "ciclo");

CREATE INDEX IF NOT EXISTS "performance_reviews_organization_id_ciclo_idx"
  ON "performance_reviews"("organization_id", "ciclo");

CREATE TABLE IF NOT EXISTS "performance_goals" (
  "id"              TEXT NOT NULL,
  "organization_id" TEXT NOT NULL,
  "review_id"       TEXT NOT NULL,
  "titulo"          TEXT NOT NULL,
  "descricao"       TEXT,
  "peso"            INTEGER NOT NULL DEFAULT 1,
  "progresso"       INTEGER NOT NULL DEFAULT 0,
  "status"          TEXT NOT NULL DEFAULT 'EM_ANDAMENTO',
  "prazo"           TIMESTAMP(3),
  "criado_em"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "atualizado_em"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "performance_goals_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "performance_goals_review_id_idx"
  ON "performance_goals"("review_id");

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'training_courses_organization_id_fkey') THEN
    ALTER TABLE "training_courses" ADD CONSTRAINT "training_courses_organization_id_fkey"
      FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'collaborator_trainings_organization_id_fkey') THEN
    ALTER TABLE "collaborator_trainings" ADD CONSTRAINT "collaborator_trainings_organization_id_fkey"
      FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'collaborator_trainings_collaborator_id_fkey') THEN
    ALTER TABLE "collaborator_trainings" ADD CONSTRAINT "collaborator_trainings_collaborator_id_fkey"
      FOREIGN KEY ("collaborator_id") REFERENCES "collaborators"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;

  -- RESTRICT: apagar curso não pode apagar o histórico de quem o fez.
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'collaborator_trainings_training_id_fkey') THEN
    ALTER TABLE "collaborator_trainings" ADD CONSTRAINT "collaborator_trainings_training_id_fkey"
      FOREIGN KEY ("training_id") REFERENCES "training_courses"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'performance_reviews_organization_id_fkey') THEN
    ALTER TABLE "performance_reviews" ADD CONSTRAINT "performance_reviews_organization_id_fkey"
      FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'performance_reviews_collaborator_id_fkey') THEN
    ALTER TABLE "performance_reviews" ADD CONSTRAINT "performance_reviews_collaborator_id_fkey"
      FOREIGN KEY ("collaborator_id") REFERENCES "collaborators"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;

  -- SET NULL: desligar o avaliador não pode apagar a avaliação que ele fez.
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'performance_reviews_avaliador_id_fkey') THEN
    ALTER TABLE "performance_reviews" ADD CONSTRAINT "performance_reviews_avaliador_id_fkey"
      FOREIGN KEY ("avaliador_id") REFERENCES "collaborators"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'performance_goals_review_id_fkey') THEN
    ALTER TABLE "performance_goals" ADD CONSTRAINT "performance_goals_review_id_fkey"
      FOREIGN KEY ("review_id") REFERENCES "performance_reviews"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'performance_goals_organization_id_fkey') THEN
    ALTER TABLE "performance_goals" ADD CONSTRAINT "performance_goals_organization_id_fkey"
      FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;
