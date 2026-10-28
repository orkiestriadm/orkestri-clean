-- CreateTable
CREATE TABLE "gastos" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "descricao" TEXT NOT NULL,
    "categoria" TEXT,
    "valor" DECIMAL(15,2) NOT NULL,
    "forma_pagamento" TEXT NOT NULL,
    "parcelas" INTEGER NOT NULL DEFAULT 1,
    "valor_parcela" DECIMAL(15,2),
    "data_gasto" TIMESTAMP(3) NOT NULL,
    "origem" TEXT NOT NULL DEFAULT 'WHATSAPP',
    "mensagem_original" TEXT,
    "criado_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizado_em" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "gastos_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "gastos_organization_id_user_id_idx" ON "gastos"("organization_id", "user_id");

-- CreateIndex
CREATE INDEX "gastos_organization_id_user_id_data_gasto_idx" ON "gastos"("organization_id", "user_id", "data_gasto");

-- AddForeignKey
ALTER TABLE "gastos" ADD CONSTRAINT "gastos_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "gastos" ADD CONSTRAINT "gastos_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
