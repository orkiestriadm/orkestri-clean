-- ============================================================================
-- Orkiestri People — remuneração e feedback contínuo
--
-- REMUNERAÇÃO não é folha de pagamento. A spec exclui cálculo, imposto e
-- eSocial, e continua excluído. O que entra aqui é o REGISTRO: quanto a pessoa
-- ganha, desde quando, e por quê mudou. Sem isso não há como medir mérito,
-- sustentar promoção nem saber o custo real de um time.
--
-- FEEDBACK fecha PEOPLE_HUB_BLUEPRINT.md §14, que pede "Evaluation cycles.
-- Goals. Feedback. Ratings. History." — as outras quatro já existiam.
-- ============================================================================

-- ── Histórico salarial ──────────────────────────────────────────────────────
-- Uma linha por mudança. A linha nunca é apagada nem editada em valor: o
-- histórico É o produto desta tabela. Corrigir um erro de digitação vira uma
-- nova vigência, porque o que foi pago no período passado não deixa de ter
-- sido pago.
CREATE TABLE IF NOT EXISTS "collaborator_salaries" (
  "id"              TEXT NOT NULL,
  "organization_id" TEXT NOT NULL,
  "collaborator_id" TEXT NOT NULL,
  "valor"           DECIMAL(12,2) NOT NULL,
  "vigencia_inicio" TIMESTAMP(3) NOT NULL,
  -- admissao | merito | promocao | dissidio | enquadramento | reducao | outro
  "motivo"          TEXT NOT NULL DEFAULT 'outro',
  -- Cargo na data da mudança. Guardado aqui e não lido de collaborators porque
  -- o cargo atual muda depois, e o histórico ficaria mentindo sobre o passado.
  "position_id"     TEXT,
  "observacoes"     TEXT,
  "criado_em"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "criado_por_id"   TEXT,
  CONSTRAINT "collaborator_salaries_pkey" PRIMARY KEY ("id")
);

-- Uma mudança por dia por pessoa: duas na mesma data tornam ambíguo qual vale.
CREATE UNIQUE INDEX IF NOT EXISTS "collaborator_salaries_collab_vigencia_key"
  ON "collaborator_salaries"("collaborator_id", "vigencia_inicio");

CREATE INDEX IF NOT EXISTS "collaborator_salaries_organization_id_idx"
  ON "collaborator_salaries"("organization_id");

-- O salário vigente é "o mais recente até hoje": esta ordem serve à consulta.
CREATE INDEX IF NOT EXISTS "collaborator_salaries_collab_vigencia_desc_idx"
  ON "collaborator_salaries"("collaborator_id", "vigencia_inicio" DESC);

-- ── Faixa salarial do cargo ─────────────────────────────────────────────────
-- Colunas em `positions` e não tabela nova: faixa é atributo do cargo, e não
-- tem histórico próprio — quando muda, vale para todo mundo dali em diante.
ALTER TABLE "positions" ADD COLUMN IF NOT EXISTS "salario_minimo" DECIMAL(12,2);
ALTER TABLE "positions" ADD COLUMN IF NOT EXISTS "salario_medio"  DECIMAL(12,2);
ALTER TABLE "positions" ADD COLUMN IF NOT EXISTS "salario_maximo" DECIMAL(12,2);

-- ── Feedback contínuo ───────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS "performance_feedbacks" (
  "id"              TEXT NOT NULL,
  "organization_id" TEXT NOT NULL,
  "collaborator_id" TEXT NOT NULL,
  -- Autor é colaborador, não usuário: quem dá feedback é o gestor no
  -- organograma, e gestor pode não ter login (ADR-001).
  "autor_id"        TEXT,
  -- elogio | correcao | um_a_um | reconhecimento | outro
  "tipo"            TEXT NOT NULL DEFAULT 'outro',
  -- privado  : só quem escreveu e o RH veem
  -- compartilhado : o avaliado também vê
  --
  -- O padrão é `compartilhado` de propósito: feedback que a pessoa não pode
  -- ler não muda comportamento nenhum, e o privado existe só para a anotação
  -- de gestor que ainda vai virar conversa.
  "visibilidade"    TEXT NOT NULL DEFAULT 'compartilhado',
  "conteudo"        TEXT NOT NULL,
  "ocorrido_em"     TIMESTAMP(3) NOT NULL,
  -- Amarra opcional ao ciclo de avaliação: permite abrir a avaliação já com o
  -- que foi registrado durante o período, em vez de depender de memória.
  "review_id"       TEXT,
  "criado_em"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "criado_por_id"   TEXT,
  CONSTRAINT "performance_feedbacks_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "performance_feedbacks_collaborator_id_idx"
  ON "performance_feedbacks"("collaborator_id", "ocorrido_em" DESC);

CREATE INDEX IF NOT EXISTS "performance_feedbacks_organization_id_idx"
  ON "performance_feedbacks"("organization_id");

CREATE INDEX IF NOT EXISTS "performance_feedbacks_review_id_idx"
  ON "performance_feedbacks"("review_id");

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'collaborator_salaries_organization_id_fkey') THEN
    ALTER TABLE "collaborator_salaries" ADD CONSTRAINT "collaborator_salaries_organization_id_fkey"
      FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'collaborator_salaries_collaborator_id_fkey') THEN
    ALTER TABLE "collaborator_salaries" ADD CONSTRAINT "collaborator_salaries_collaborator_id_fkey"
      FOREIGN KEY ("collaborator_id") REFERENCES "collaborators"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;

  -- SET NULL: apagar um cargo não pode apagar o histórico salarial de quem o
  -- ocupou, nem reescrever quanto se ganhava na época.
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'collaborator_salaries_position_id_fkey') THEN
    ALTER TABLE "collaborator_salaries" ADD CONSTRAINT "collaborator_salaries_position_id_fkey"
      FOREIGN KEY ("position_id") REFERENCES "positions"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'performance_feedbacks_organization_id_fkey') THEN
    ALTER TABLE "performance_feedbacks" ADD CONSTRAINT "performance_feedbacks_organization_id_fkey"
      FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'performance_feedbacks_collaborator_id_fkey') THEN
    ALTER TABLE "performance_feedbacks" ADD CONSTRAINT "performance_feedbacks_collaborator_id_fkey"
      FOREIGN KEY ("collaborator_id") REFERENCES "collaborators"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'performance_feedbacks_autor_id_fkey') THEN
    ALTER TABLE "performance_feedbacks" ADD CONSTRAINT "performance_feedbacks_autor_id_fkey"
      FOREIGN KEY ("autor_id") REFERENCES "collaborators"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'performance_feedbacks_review_id_fkey') THEN
    ALTER TABLE "performance_feedbacks" ADD CONSTRAINT "performance_feedbacks_review_id_fkey"
      FOREIGN KEY ("review_id") REFERENCES "performance_reviews"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;
