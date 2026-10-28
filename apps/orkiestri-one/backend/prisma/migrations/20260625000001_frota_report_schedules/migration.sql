-- CreateTable
CREATE TABLE "frota_report_schedules" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "titulo" TEXT NOT NULL,
    "tipo_relatorio" TEXT NOT NULL,
    "formato" TEXT NOT NULL,
    "frequencia" TEXT NOT NULL,
    "filtros" JSONB NOT NULL DEFAULT '{}',
    "destinatarios" TEXT NOT NULL,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "ultimo_envio" TIMESTAMP(3),
    "criadoPorId" TEXT,
    "criado_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizado_em" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "frota_report_schedules_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "frota_report_schedules_organization_id_idx" ON "frota_report_schedules"("organization_id");

-- AddForeignKey
ALTER TABLE "frota_report_schedules" ADD CONSTRAINT "frota_report_schedules_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
