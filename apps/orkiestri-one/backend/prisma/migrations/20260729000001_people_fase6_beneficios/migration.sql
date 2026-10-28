-- ============================================================================
-- Orkiestri People — Fase 6: benefícios
--
-- Duas tabelas e não uma: o catálogo (`benefits`) é da organização e existe
-- mesmo sem ninguém usando; a concessão (`collaborator_benefits`) é da pessoa
-- e tem vigência própria. Guardar tudo junto impediria responder "quais
-- benefícios a empresa oferece" sem varrer colaborador.
--
-- Nome `collaborator_benefits` e não `employee_benefits` (como diz a spec):
-- o model interno é Collaborator — ADR-001. O contrato externo da API usa
-- `employees`, a tabela acompanha o model.
-- ============================================================================

CREATE TABLE IF NOT EXISTS "benefits" (
  "id"              TEXT NOT NULL,
  "organization_id" TEXT NOT NULL,
  "nome"            TEXT NOT NULL,
  "categoria"       TEXT NOT NULL DEFAULT 'outro',
  "descricao"       TEXT,
  -- Valor de referência do benefício. Nullable de propósito: plano de saúde
  -- varia por faixa etária e dependente, e fixar um número aqui seria mentira.
  "valor_referencia" DOUBLE PRECISION,
  "ativo"           BOOLEAN NOT NULL DEFAULT true,
  "criado_em"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "criado_por_id"   TEXT,
  "atualizado_em"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "atualizado_por_id" TEXT,
  "excluido_em"     TIMESTAMP(3),
  CONSTRAINT "benefits_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "benefits_organization_id_nome_key"
  ON "benefits"("organization_id", "nome");

CREATE INDEX IF NOT EXISTS "benefits_organization_id_ativo_idx"
  ON "benefits"("organization_id", "ativo");

CREATE TABLE IF NOT EXISTS "collaborator_benefits" (
  "id"              TEXT NOT NULL,
  "organization_id" TEXT NOT NULL,
  "collaborator_id" TEXT NOT NULL,
  "benefit_id"      TEXT NOT NULL,
  "inicio"          TIMESTAMP(3) NOT NULL,
  -- Nulo = vigente. Encerrar preenche a data em vez de apagar a linha: o
  -- histórico de quem teve o quê e quando é o próprio ponto da tabela.
  "fim"             TIMESTAMP(3),
  "valor"           DOUBLE PRECISION,
  "observacoes"     TEXT,
  "criado_em"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "criado_por_id"   TEXT,
  "atualizado_em"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "atualizado_por_id" TEXT,
  CONSTRAINT "collaborator_benefits_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "collaborator_benefits_collaborator_id_idx"
  ON "collaborator_benefits"("collaborator_id");

CREATE INDEX IF NOT EXISTS "collaborator_benefits_organization_id_idx"
  ON "collaborator_benefits"("organization_id");

CREATE INDEX IF NOT EXISTS "collaborator_benefits_benefit_id_idx"
  ON "collaborator_benefits"("benefit_id");

-- Impede conceder o mesmo benefício duas vezes com início igual. Sobreposição
-- de vigências fica com o serviço: em SQL exigiria exclusion constraint com
-- btree_gist, extensão que não está garantida nas bases existentes.
CREATE UNIQUE INDEX IF NOT EXISTS "collaborator_benefits_collab_benefit_inicio_key"
  ON "collaborator_benefits"("collaborator_id", "benefit_id", "inicio");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'benefits_organization_id_fkey'
  ) THEN
    ALTER TABLE "benefits"
      ADD CONSTRAINT "benefits_organization_id_fkey"
      FOREIGN KEY ("organization_id") REFERENCES "organizations"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'collaborator_benefits_organization_id_fkey'
  ) THEN
    ALTER TABLE "collaborator_benefits"
      ADD CONSTRAINT "collaborator_benefits_organization_id_fkey"
      FOREIGN KEY ("organization_id") REFERENCES "organizations"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'collaborator_benefits_collaborator_id_fkey'
  ) THEN
    ALTER TABLE "collaborator_benefits"
      ADD CONSTRAINT "collaborator_benefits_collaborator_id_fkey"
      FOREIGN KEY ("collaborator_id") REFERENCES "collaborators"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;

  -- RESTRICT e não CASCADE: apagar um benefício do catálogo não pode apagar
  -- o histórico de quem já o recebeu. O serviço desativa em vez de excluir.
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'collaborator_benefits_benefit_id_fkey'
  ) THEN
    ALTER TABLE "collaborator_benefits"
      ADD CONSTRAINT "collaborator_benefits_benefit_id_fkey"
      FOREIGN KEY ("benefit_id") REFERENCES "benefits"("id")
      ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
END $$;
