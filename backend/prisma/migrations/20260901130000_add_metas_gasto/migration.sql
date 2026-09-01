-- CreateTable
CREATE TABLE "metas_gasto" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "categoria" TEXT NOT NULL,
    "limite_mensal" DECIMAL(15,2) NOT NULL,
    "criado_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizado_em" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "metas_gasto_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "metas_gasto_organization_id_user_id_categoria_key" ON "metas_gasto"("organization_id", "user_id", "categoria");

-- CreateIndex
CREATE INDEX "metas_gasto_organization_id_user_id_idx" ON "metas_gasto"("organization_id", "user_id");

-- AddForeignKey
ALTER TABLE "metas_gasto" ADD CONSTRAINT "metas_gasto_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "metas_gasto" ADD CONSTRAINT "metas_gasto_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
