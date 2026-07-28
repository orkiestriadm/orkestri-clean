-- ============================================================================
-- Orkiestri People — Fase 1, Passo 3
--
-- Torna o vínculo com User opcional: o colaborador passa a existir sem acesso
-- ao sistema. Pré-requisito: a migration 20260728000001 já deu identidade
-- própria ao colaborador (nome_completo backfilled), e os consumidores de
-- `collaborator.user` já foram blindados.
--
-- Ver docs/people/ADR-001-modelo-employee.md §"Estratégia de migração".
--
-- ATENÇÃO: reverter esta migration só é trivial enquanto não existir nenhum
-- colaborador com user_id nulo. Depois disso, o rollback exige decidir o que
-- fazer com esses registros.
-- ============================================================================

-- ── 1. Guarda de segurança ─────────────────────────────────────────────────
-- Se algum colaborador ficou sem nome próprio, a migration anterior não
-- completou. Abortar em vez de criar registros que a UI não sabe exibir.

DO $$
DECLARE
  sem_nome INTEGER;
BEGIN
  SELECT count(*) INTO sem_nome
    FROM "collaborators"
   WHERE "nome_completo" IS NULL AND "user_id" IS NOT NULL;

  IF sem_nome > 0 THEN
    RAISE EXCEPTION
      'Abortado: % colaborador(es) sem nome_completo. Rode a migration 20260728000001 antes desta.',
      sem_nome;
  END IF;
END $$;

-- ── 2. user_id passa a aceitar nulo ────────────────────────────────────────

ALTER TABLE "collaborators" ALTER COLUMN "user_id" DROP NOT NULL;

-- ── 3. Cascade → SetNull ───────────────────────────────────────────────────
-- Antes: excluir o User apagava o Collaborator junto, levando ausências,
-- skills e histórico. Agora o registro funcional sobrevive ao login.

ALTER TABLE "collaborators" DROP CONSTRAINT IF EXISTS "collaborators_user_id_fkey";
ALTER TABLE "collaborators"
  ADD CONSTRAINT "collaborators_user_id_fkey"
  FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
