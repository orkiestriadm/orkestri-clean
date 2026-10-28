-- As chaves estrangeiras de `tasks` e `task_comments`, que o schema declara e o
-- banco não tinha.
--
-- Descoberto em 10/08/2026: excluir um projeto deixava as tarefas dele para
-- trás. O schema declara `onDelete: Cascade` em `tasks → projects`, mas a
-- constraint não existia — o Prisma conta com o BANCO para aplicar o cascade,
-- e sem ela o `DELETE` do projeto simplesmente não alcança as tarefas.
--
-- Efeito visível era nenhum: as telas fazem join com projeto, então a órfã some
-- da interface. Ela só aparece em consulta que não junta — foi assim que eu
-- reportei "existem outros projetos" quando não existiam.
--
-- ORDEM IMPORTA: adicionar FK numa tabela com órfão FALHA e aborta a migration.
-- A limpeza vem antes, e é por isso que este arquivo não é só um ALTER.

-- ── 1. Limpeza ──────────────────────────────────────────────────────────────
-- Comentário de tarefa órfã sai primeiro: se a tarefa vai embora, o comentário
-- dela não tem a quem pertencer.
DELETE FROM "task_comments"
WHERE NOT EXISTS (SELECT 1 FROM "tasks" t WHERE t.id = "task_comments"."task_id");

DELETE FROM "tasks"
WHERE NOT EXISTS (SELECT 1 FROM "projects" p WHERE p.id = "tasks"."project_id");

-- Referências opcionais que apontam para registro inexistente viram NULL em vez
-- de levar a linha junto: a tarefa continua válida sem responsável.
UPDATE "tasks" SET "assignee_id" = NULL
WHERE "assignee_id" IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM "users" u WHERE u.id = "tasks"."assignee_id");

UPDATE "tasks" SET "milestone_id" = NULL
WHERE "milestone_id" IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM "milestones" m WHERE m.id = "tasks"."milestone_id");

-- Criador é obrigatório e não pode virar NULL. Se algum dia houver órfão aqui,
-- a linha sai — mas hoje são zero, e apagar em silêncio o que não se previu
-- seria pior que falhar.
DELETE FROM "tasks"
WHERE NOT EXISTS (SELECT 1 FROM "users" u WHERE u.id = "tasks"."created_by");

DELETE FROM "task_comments"
WHERE NOT EXISTS (SELECT 1 FROM "users" u WHERE u.id = "task_comments"."user_id");

-- ── 2. As constraints ───────────────────────────────────────────────────────
-- `ADD CONSTRAINT` não aceita IF NOT EXISTS; sem o DO block, a segunda execução
-- aborta. Idempotência importa aqui: os três ambientes têm histórico de
-- migration divergente, e uma migration que assume estado limpo já derrubou a
-- API de homologação por 8 minutos.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'tasks_project_id_fkey') THEN
    ALTER TABLE "tasks" ADD CONSTRAINT "tasks_project_id_fkey"
      FOREIGN KEY ("project_id") REFERENCES "projects"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'tasks_milestone_id_fkey') THEN
    ALTER TABLE "tasks" ADD CONSTRAINT "tasks_milestone_id_fkey"
      FOREIGN KEY ("milestone_id") REFERENCES "milestones"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'tasks_assignee_id_fkey') THEN
    ALTER TABLE "tasks" ADD CONSTRAINT "tasks_assignee_id_fkey"
      FOREIGN KEY ("assignee_id") REFERENCES "users"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;

  -- Criador NÃO cascateia: apagar um usuário não pode levar junto o trabalho
  -- que ele criou. RESTRICT força quem for excluir a decidir o que fazer.
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'tasks_created_by_fkey') THEN
    ALTER TABLE "tasks" ADD CONSTRAINT "tasks_created_by_fkey"
      FOREIGN KEY ("created_by") REFERENCES "users"("id")
      ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'task_comments_task_id_fkey') THEN
    ALTER TABLE "task_comments" ADD CONSTRAINT "task_comments_task_id_fkey"
      FOREIGN KEY ("task_id") REFERENCES "tasks"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;

  -- RESTRICT, como o autor da tarefa: no schema esta relação é obrigatória e
  -- não declara `onDelete`, o que no Prisma significa Restrict. Pôr CASCADE
  -- aqui faria o banco apagar comentários que o Prisma acha que estão
  -- protegidos — os dois passariam a discordar sobre o mesmo dado.
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'task_comments_user_id_fkey') THEN
    ALTER TABLE "task_comments" ADD CONSTRAINT "task_comments_user_id_fkey"
      FOREIGN KEY ("user_id") REFERENCES "users"("id")
      ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
END $$;
