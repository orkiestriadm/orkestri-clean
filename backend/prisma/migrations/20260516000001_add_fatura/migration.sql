-- CreateTable
CREATE TABLE "faturas" (
    "id" TEXT NOT NULL,
    "numero" SERIAL NOT NULL,
    "contrato_id" TEXT,
    "cliente_id" TEXT NOT NULL,
    "criado_por_id" TEXT,
    "descricao" TEXT,
    "valor" DOUBLE PRECISION NOT NULL,
    "data_emissao" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "data_vencimento" TIMESTAMP(3) NOT NULL,
    "data_pagamento" TIMESTAMP(3),
    "status" TEXT NOT NULL DEFAULT 'pendente',
    "observacoes" TEXT,
    "criado_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizado_em" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "faturas_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "faturas_cliente_id_idx" ON "faturas"("cliente_id");

-- CreateIndex
CREATE INDEX "faturas_contrato_id_idx" ON "faturas"("contrato_id");

-- CreateIndex
CREATE INDEX "faturas_status_idx" ON "faturas"("status");

-- CreateIndex
CREATE INDEX "faturas_data_vencimento_idx" ON "faturas"("data_vencimento" DESC);

-- AddForeignKey
ALTER TABLE "faturas" ADD CONSTRAINT "faturas_contrato_id_fkey" FOREIGN KEY ("contrato_id") REFERENCES "contratos"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "faturas" ADD CONSTRAINT "faturas_cliente_id_fkey" FOREIGN KEY ("cliente_id") REFERENCES "clientes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "faturas" ADD CONSTRAINT "faturas_criado_por_id_fkey" FOREIGN KEY ("criado_por_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
