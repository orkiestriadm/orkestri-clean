-- Add monitoring fields to ativos
ALTER TABLE "ativos" ADD COLUMN "ip" TEXT;
ALTER TABLE "ativos" ADD COLUMN "monitorar" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "ativos" ADD COLUMN "online" BOOLEAN;
ALTER TABLE "ativos" ADD COLUMN "ultimo_ping" TIMESTAMP(3);
ALTER TABLE "ativos" ADD COLUMN "latencia_ms" INTEGER;

-- Add monitoring key to organizations
ALTER TABLE "organizations" ADD COLUMN "monitoring_key" TEXT;

-- CreateTable ping_logs
CREATE TABLE "ping_logs" (
    "id" TEXT NOT NULL,
    "ativo_id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "online" BOOLEAN NOT NULL,
    "latencia_ms" INTEGER,
    "erro" TEXT,
    "criado_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ping_logs_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "ping_logs" ADD CONSTRAINT "ping_logs_ativo_id_fkey"
    FOREIGN KEY ("ativo_id") REFERENCES "ativos"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ping_logs" ADD CONSTRAINT "ping_logs_organization_id_fkey"
    FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- CreateIndex
CREATE INDEX "ativos_organization_id_monitorar_idx" ON "ativos"("organization_id", "monitorar");
CREATE INDEX "ping_logs_ativo_id_criado_em_idx" ON "ping_logs"("ativo_id", "criado_em" DESC);
CREATE INDEX "ping_logs_organization_id_criado_em_idx" ON "ping_logs"("organization_id", "criado_em" DESC);
