-- CreateTable
CREATE TABLE "reservas_veiculo" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "veiculo_id" TEXT NOT NULL,
    "solicitante_id" TEXT NOT NULL,
    "data_inicio" TIMESTAMP(3) NOT NULL,
    "data_fim" TIMESTAMP(3) NOT NULL,
    "destino" TEXT NOT NULL,
    "motivo" TEXT NOT NULL,
    "projeto_id" TEXT,
    "centro_custo_id" TEXT,
    "observacoes" TEXT,
    "status" TEXT NOT NULL DEFAULT 'SOLICITADA',
    "km_inicial" INTEGER,
    "km_final" INTEGER,
    "criado_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizado_em" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "reservas_veiculo_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "reservas_veiculo_organization_id_idx" ON "reservas_veiculo"("organization_id");

-- CreateIndex
CREATE INDEX "reservas_veiculo_veiculo_id_idx" ON "reservas_veiculo"("veiculo_id");

-- CreateIndex
CREATE INDEX "reservas_veiculo_solicitante_id_idx" ON "reservas_veiculo"("solicitante_id");

-- CreateIndex
CREATE INDEX "reservas_veiculo_data_inicio_idx" ON "reservas_veiculo"("data_inicio");

-- CreateIndex
CREATE INDEX "reservas_veiculo_data_fim_idx" ON "reservas_veiculo"("data_fim");

-- AddForeignKey
ALTER TABLE "reservas_veiculo" ADD CONSTRAINT "reservas_veiculo_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reservas_veiculo" ADD CONSTRAINT "reservas_veiculo_veiculo_id_fkey" FOREIGN KEY ("veiculo_id") REFERENCES "veiculos"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reservas_veiculo" ADD CONSTRAINT "reservas_veiculo_solicitante_id_fkey" FOREIGN KEY ("solicitante_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reservas_veiculo" ADD CONSTRAINT "reservas_veiculo_projeto_id_fkey" FOREIGN KEY ("projeto_id") REFERENCES "projects"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reservas_veiculo" ADD CONSTRAINT "reservas_veiculo_centro_custo_id_fkey" FOREIGN KEY ("centro_custo_id") REFERENCES "centros_custo"("id") ON DELETE SET NULL ON UPDATE CASCADE;
