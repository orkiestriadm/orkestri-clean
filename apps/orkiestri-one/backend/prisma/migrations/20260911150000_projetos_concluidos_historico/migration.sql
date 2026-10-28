-- Projetos: histórico do quadro (quem moveu cada tarefa) e Projetos Concluídos.
--
-- Aditiva: 1 tabela nova e 1 coluna NULÁVEL em projects. ADD COLUMN sem default
-- não reescreve a tabela nem revalida as FKs existentes — importa porque a base
-- tem linhas órfãs sob constraints NOT VALID (ver memória do deploy do People).
-- Nenhum UPDATE em dado existente: projeto que já estava em 100% é tratado como
-- concluído pela listagem (derivado das tarefas), sem precisar de backfill.
--
-- Gerada com `prisma migrate diff` contra o schema anterior.

-- AlterTable
ALTER TABLE "projects" ADD COLUMN     "concluido_em" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "project_historico" (
    "id" TEXT NOT NULL,
    "project_id" TEXT NOT NULL,
    "task_id" TEXT,
    "task_titulo" TEXT,
    "user_id" TEXT,
    "tipo" TEXT NOT NULL,
    "de" TEXT,
    "para" TEXT,
    "criado_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "project_historico_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "project_historico_project_id_criado_em_idx" ON "project_historico"("project_id", "criado_em");

-- CreateIndex
CREATE INDEX "project_historico_task_id_criado_em_idx" ON "project_historico"("task_id", "criado_em");

-- AddForeignKey
ALTER TABLE "project_historico" ADD CONSTRAINT "project_historico_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "project_historico" ADD CONSTRAINT "project_historico_task_id_fkey" FOREIGN KEY ("task_id") REFERENCES "tasks"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "project_historico" ADD CONSTRAINT "project_historico_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

