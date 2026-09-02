-- CreateTable
CREATE TABLE "gastos_recorrentes" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "descricao" TEXT NOT NULL,
    "categoria" TEXT,
    "valor" DECIMAL(15,2) NOT NULL,
    "forma_pagamento" TEXT NOT NULL DEFAULT 'NAO_INFORMADO',
    "dia_do_mes" INTEGER NOT NULL,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "ultimo_lancamento" TIMESTAMP(3),
    "criado_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizado_em" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "gastos_recorrentes_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "gastos_recorrentes_organization_id_user_id_idx" ON "gastos_recorrentes"("organization_id", "user_id");

-- AddForeignKey
ALTER TABLE "gastos_recorrentes" ADD CONSTRAINT "gastos_recorrentes_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "gastos_recorrentes" ADD CONSTRAINT "gastos_recorrentes_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
