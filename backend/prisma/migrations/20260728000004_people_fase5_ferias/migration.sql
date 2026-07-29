-- ============================================================================
-- Orkiestri People — Fase 5: períodos aquisitivos de férias
--
-- O CRUD e a aprovação de ausência já existiam. O que falta, e
-- PEOPLE_WORKFLOWS.md §6 exige, é saldo: hoje qualquer pessoa pode solicitar
-- quantos dias quiser.
--
-- As datas do período são determinísticas a partir da admissão, mas a tabela
-- existe porque `dias_direito` admite ajuste (faltas reduzem, abono vende) e
-- `dias_gozados` precisa ser agregável em relatório de passivo.
-- ============================================================================

CREATE TABLE IF NOT EXISTS "collaborator_vacation_periods" (
  "id"                TEXT NOT NULL,
  "organization_id"   TEXT NOT NULL,
  "collaborator_id"   TEXT NOT NULL,
  "inicio"            TIMESTAMP(3) NOT NULL,
  "fim"               TIMESTAMP(3) NOT NULL,
  "limite_concessivo" TIMESTAMP(3) NOT NULL,
  "dias_direito"      INTEGER NOT NULL DEFAULT 30,
  "dias_gozados"      INTEGER NOT NULL DEFAULT 0,
  "status"            TEXT NOT NULL DEFAULT 'EM_AQUISICAO',
  "observacoes"       TEXT,
  "criado_em"         TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "atualizado_em"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "collaborator_vacation_periods_pkey" PRIMARY KEY ("id")
);

-- Um período por colaborador por data de início: a regeneração a partir da
-- admissão é idempotente e não duplica em nova sincronização.
CREATE UNIQUE INDEX IF NOT EXISTS "collaborator_vacation_periods_collaborator_id_inicio_key"
  ON "collaborator_vacation_periods"("collaborator_id", "inicio");

CREATE INDEX IF NOT EXISTS "collaborator_vacation_periods_organization_id_status_idx"
  ON "collaborator_vacation_periods"("organization_id", "status");

-- Relatório de passivo varre por data-limite dentro da organização.
CREATE INDEX IF NOT EXISTS "collaborator_vacation_periods_organization_id_limite_idx"
  ON "collaborator_vacation_periods"("organization_id", "limite_concessivo");

ALTER TABLE "collaborator_vacation_periods" DROP CONSTRAINT IF EXISTS "collaborator_vacation_periods_organization_id_fkey";
ALTER TABLE "collaborator_vacation_periods"
  ADD CONSTRAINT "collaborator_vacation_periods_organization_id_fkey"
  FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "collaborator_vacation_periods" DROP CONSTRAINT IF EXISTS "collaborator_vacation_periods_collaborator_id_fkey";
ALTER TABLE "collaborator_vacation_periods"
  ADD CONSTRAINT "collaborator_vacation_periods_collaborator_id_fkey"
  FOREIGN KEY ("collaborator_id") REFERENCES "collaborators"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- ── Vínculo da ausência com o período ──────────────────────────────────────
-- Só para tipo=ferias. Atribuição explícita em vez de inferida por data:
-- férias podem cruzar a virada de período, e adivinhar produziria saldo errado.
-- SET NULL na exclusão do período — a ausência é o registro histórico e não
-- pode desaparecer junto.

ALTER TABLE "ausencias" ADD COLUMN IF NOT EXISTS "vacation_period_id" TEXT;

CREATE INDEX IF NOT EXISTS "ausencias_vacation_period_id_idx"
  ON "ausencias"("vacation_period_id");

ALTER TABLE "ausencias" DROP CONSTRAINT IF EXISTS "ausencias_vacation_period_id_fkey";
ALTER TABLE "ausencias"
  ADD CONSTRAINT "ausencias_vacation_period_id_fkey"
  FOREIGN KEY ("vacation_period_id") REFERENCES "collaborator_vacation_periods"("id") ON DELETE SET NULL ON UPDATE CASCADE;
