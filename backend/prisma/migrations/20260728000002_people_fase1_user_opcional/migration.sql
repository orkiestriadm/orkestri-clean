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
-- Se um colaborador com usuário VÁLIDO ficou sem nome próprio, a migration
-- anterior não completou — abortar em vez de seguir com dado que a UI não sabe
-- exibir.
--
-- A checagem exclui de propósito quem aponta para usuário inexistente: esse
-- caso é dado corrompido, não migration faltando, e é reparado logo abaixo.

DO $$
DECLARE
  sem_nome INTEGER;
BEGIN
  SELECT count(*) INTO sem_nome
    FROM "collaborators" c
   WHERE c."nome_completo" IS NULL
     AND EXISTS (SELECT 1 FROM "users" u WHERE u."id" = c."user_id");

  IF sem_nome > 0 THEN
    RAISE EXCEPTION
      'Abortado: % colaborador(es) sem nome_completo. Rode a migration 20260728000001 antes desta.',
      sem_nome;
  END IF;
END $$;

-- ── 2. user_id passa a aceitar nulo ────────────────────────────────────────

ALTER TABLE "collaborators" ALTER COLUMN "user_id" DROP NOT NULL;

-- ── 2.1 Repara referências penduradas ──────────────────────────────────────
-- Há base com colaborador apontando para usuário inexistente — sobra de
-- organização removida sem cascata.
--
-- A ordem aqui não é negociável. `collaborators_user_id_fkey` pode existir como
-- NOT VALID, e constraint NOT VALID É verificada em UPDATE: qualquer alteração
-- na linha órfã dispara a violação. Por isso o reparo só é possível DEPOIS do
-- DROP NOT NULL acima — anular a referência é a única escrita que o Postgres
-- aceita nessa linha.
--
-- Anular é o estado correto: o usuário não existe, logo o vínculo não existe.
-- O registro funcional é preservado, e é exatamente o que o SetNull do passo 3
-- fará daqui em diante.

UPDATE "collaborators" c
   SET "user_id" = NULL
 WHERE c."user_id" IS NOT NULL
   AND NOT EXISTS (SELECT 1 FROM "users" u WHERE u."id" = c."user_id");

-- ── 2.2 Nomeia o que sobrou sem nome ───────────────────────────────────────
-- Agora que a referência pendurada virou NULL, a linha pode ser alterada sem
-- disparar a FK. Sem nome, a UI não teria o que exibir.

UPDATE "collaborators"
   SET "nome_completo" = 'Cadastro órfão (' || COALESCE("matricula", 'sem matrícula') || ') — organização removida'
 WHERE "nome_completo" IS NULL;

-- ── 3. Cascade → SetNull ───────────────────────────────────────────────────
-- Antes: excluir o User apagava o Collaborator junto, levando ausências,
-- skills e histórico. Agora o registro funcional sobrevive ao login.

ALTER TABLE "collaborators" DROP CONSTRAINT IF EXISTS "collaborators_user_id_fkey";
ALTER TABLE "collaborators"
  ADD CONSTRAINT "collaborators_user_id_fkey"
  FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
