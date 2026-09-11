-- Keep da tarefa (Projetos): o que cada membro fez na tarefa, com checklist.
--
-- Migration puramente ADITIVA: 2 tabelas novas, nenhum ALTER em coluna nem DROP
-- em tabela existente. As FKs apontam para tasks e users, mas as tabelas nascem
-- vazias — a validação da FK é instantânea e não trava a API no boot.
--
-- Gerada com `prisma migrate diff` contra o schema anterior.

-- CreateTable
CREATE TABLE "task_registros" (
    "id" TEXT NOT NULL,
    "task_id" TEXT NOT NULL,
    "autor_id" TEXT NOT NULL,
    "conteudo" TEXT,
    "cor" TEXT,
    "criado_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizado_em" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "task_registros_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "task_registro_itens" (
    "id" TEXT NOT NULL,
    "registro_id" TEXT NOT NULL,
    "descricao" TEXT NOT NULL,
    "concluido" BOOLEAN NOT NULL DEFAULT false,
    "ordem" INTEGER NOT NULL DEFAULT 0,
    "criado_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "task_registro_itens_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "task_registros_task_id_criado_em_idx" ON "task_registros"("task_id", "criado_em");

-- CreateIndex
CREATE INDEX "task_registro_itens_registro_id_ordem_idx" ON "task_registro_itens"("registro_id", "ordem");

-- AddForeignKey
ALTER TABLE "task_registros" ADD CONSTRAINT "task_registros_task_id_fkey" FOREIGN KEY ("task_id") REFERENCES "tasks"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "task_registros" ADD CONSTRAINT "task_registros_autor_id_fkey" FOREIGN KEY ("autor_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "task_registro_itens" ADD CONSTRAINT "task_registro_itens_registro_id_fkey" FOREIGN KEY ("registro_id") REFERENCES "task_registros"("id") ON DELETE CASCADE ON UPDATE CASCADE;

