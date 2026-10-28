-- Coleta profunda (serviços + desempenho de hardware lidos do Zabbix)

-- CreateEnum
CREATE TYPE "MonServiceTipo" AS ENUM ('ZABBIX', 'TCP', 'HTTP');
CREATE TYPE "MonServiceEstado" AS ENUM ('UP', 'DOWN', 'DESCONHECIDO');

-- AlterTable
ALTER TABLE "mon_asset"
  ADD COLUMN "coleta_profunda" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "zabbix_host_id" TEXT;

-- CreateTable
CREATE TABLE "mon_service" (
  "id" TEXT NOT NULL,
  "organization_id" TEXT NOT NULL,
  "asset_id" TEXT NOT NULL,
  "nome" TEXT NOT NULL,
  "tipo" "MonServiceTipo" NOT NULL DEFAULT 'ZABBIX',
  "alvo" TEXT NOT NULL,
  "esperado" TEXT,
  "intervalo_seg" INTEGER NOT NULL DEFAULT 60,
  "ativo" BOOLEAN NOT NULL DEFAULT true,
  "estado" "MonServiceEstado" NOT NULL DEFAULT 'DESCONHECIDO',
  "ultimo_valor" TEXT,
  "ultimo_check_em" TIMESTAMP(3),
  "ultima_transicao" TIMESTAMP(3),
  "consecutivo_falhas" INTEGER NOT NULL DEFAULT 0,
  "consecutivo_sucessos" INTEGER NOT NULL DEFAULT 0,
  "abre_chamado_auto" BOOLEAN NOT NULL DEFAULT false,
  "chamado_aberto_id" TEXT,
  "criado_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "atualizado_em" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "mon_service_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "mon_service_event" (
  "id" TEXT NOT NULL,
  "organization_id" TEXT NOT NULL,
  "service_id" TEXT NOT NULL,
  "estado_anterior" "MonServiceEstado" NOT NULL,
  "estado_novo" "MonServiceEstado" NOT NULL,
  "iniciado_em" TIMESTAMP(3) NOT NULL,
  "finalizado_em" TIMESTAMP(3),
  "duracao_seg" INTEGER,
  "mensagem" TEXT,
  CONSTRAINT "mon_service_event_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "mon_metric" (
  "id" TEXT NOT NULL,
  "asset_id" TEXT NOT NULL,
  "chave" TEXT NOT NULL,
  "rotulo" TEXT NOT NULL DEFAULT '',
  "valor" DOUBLE PRECISION NOT NULL,
  "unidade" TEXT,
  "coletado_em" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "mon_metric_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "mon_metric_sample" (
  "id" BIGSERIAL NOT NULL,
  "asset_id" TEXT NOT NULL,
  "chave" TEXT NOT NULL,
  "rotulo" TEXT NOT NULL DEFAULT '',
  "valor" DOUBLE PRECISION NOT NULL,
  "ts" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "mon_metric_sample_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "mon_asset_organization_id_coleta_profunda_idx" ON "mon_asset"("organization_id", "coleta_profunda");
CREATE INDEX "mon_service_organization_id_idx" ON "mon_service"("organization_id");
CREATE INDEX "mon_service_asset_id_idx" ON "mon_service"("asset_id");
CREATE INDEX "mon_service_event_service_id_iniciado_em_idx" ON "mon_service_event"("service_id", "iniciado_em" DESC);
CREATE UNIQUE INDEX "mon_metric_asset_id_chave_rotulo_key" ON "mon_metric"("asset_id", "chave", "rotulo");
CREATE INDEX "mon_metric_asset_id_idx" ON "mon_metric"("asset_id");
CREATE INDEX "mon_metric_sample_asset_id_chave_ts_idx" ON "mon_metric_sample"("asset_id", "chave", "ts" DESC);

-- AddForeignKey
ALTER TABLE "mon_service" ADD CONSTRAINT "mon_service_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "mon_service" ADD CONSTRAINT "mon_service_asset_id_fkey" FOREIGN KEY ("asset_id") REFERENCES "mon_asset"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "mon_service_event" ADD CONSTRAINT "mon_service_event_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "mon_service_event" ADD CONSTRAINT "mon_service_event_service_id_fkey" FOREIGN KEY ("service_id") REFERENCES "mon_service"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "mon_metric" ADD CONSTRAINT "mon_metric_asset_id_fkey" FOREIGN KEY ("asset_id") REFERENCES "mon_asset"("id") ON DELETE CASCADE ON UPDATE CASCADE;
