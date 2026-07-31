-- Cria as tabelas do módulo de Monitoramento (Orkiestri Observe).
--
-- Os 15 models Mon* existiam no schema.prisma desde a implementação do módulo,
-- mas nenhuma migration os criava — mesmo drift silencioso do centro_custo.
-- Resultado: o módulo estava inoperante (tabelas inexistentes) e o
-- `prisma migrate status` reportava "up to date".
--
-- Extraído de `prisma migrate diff` mantendo APENAS as criações de
-- enums/tabelas/índices/FKs de monitoramento. Nenhum statement destrutivo.
-- CreateEnum
CREATE TYPE "MonCategoria" AS ENUM ('ITS', 'SERVIDORES', 'COMPUTADORES', 'PRACAS', 'INFRAESTRUTURA');

-- CreateEnum
CREATE TYPE "MonProtocolo" AS ENUM ('ICMP', 'TCP', 'HTTP', 'SNMP');

-- CreateEnum
CREATE TYPE "MonStatus" AS ENUM ('ONLINE', 'OFFLINE', 'INSTAVEL', 'NAO_MONITORADO');

-- CreateEnum
CREATE TYPE "MonSeveridade" AS ENUM ('INFO', 'ATENCAO', 'CRITICO');

-- CreateEnum
CREATE TYPE "MonMapTipo" AS ENUM ('GEO', 'INFRA');

-- CreateEnum
CREATE TYPE "MonAlertCanal" AS ENUM ('EMAIL', 'WHATSAPP', 'TELEGRAM', 'PUSH');

-- CreateEnum
CREATE TYPE "MonServiceTipo" AS ENUM ('ZABBIX', 'TCP', 'HTTP');

-- CreateEnum
CREATE TYPE "MonServiceEstado" AS ENUM ('UP', 'DOWN', 'DESCONHECIDO');

-- CreateTable
CREATE TABLE "mon_unidade" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "tipo" TEXT,
    "latitude" DOUBLE PRECISION,
    "longitude" DOUBLE PRECISION,
    "criado_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "mon_unidade_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "mon_asset" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "categoria" "MonCategoria" NOT NULL,
    "tipo" TEXT NOT NULL,
    "localizacao" TEXT,
    "unidade_id" TEXT,
    "responsavel_id" TEXT,
    "observacoes" TEXT,
    "ip" TEXT NOT NULL,
    "hostname" TEXT,
    "porta" INTEGER,
    "link" TEXT,
    "intervalo_seg" INTEGER NOT NULL DEFAULT 60,
    "timeout_seg" INTEGER NOT NULL DEFAULT 3,
    "protocolo" "MonProtocolo" NOT NULL DEFAULT 'ICMP',
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "ultimo_status" "MonStatus" NOT NULL DEFAULT 'NAO_MONITORADO',
    "ultimo_check_em" TIMESTAMP(3),
    "ultima_latencia_ms" INTEGER,
    "perda_pct_ultima_hora" DOUBLE PRECISION,
    "uptime_24h" DOUBLE PRECISION,
    "abre_chamado_auto" BOOLEAN NOT NULL DEFAULT false,
    "chamado_aberto_id" TEXT,
    "coleta_profunda" BOOLEAN NOT NULL DEFAULT false,
    "zabbix_host_id" TEXT,
    "depende_de_id" TEXT,
    "latencia_base_ms" DOUBLE PRECISION,
    "consecutivo_falhas" INTEGER NOT NULL DEFAULT 0,
    "consecutivo_sucessos" INTEGER NOT NULL DEFAULT 0,
    "criado_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizado_em" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "mon_asset_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "mon_probe_result" (
    "id" BIGSERIAL NOT NULL,
    "asset_id" TEXT NOT NULL,
    "ts" TIMESTAMP(3) NOT NULL,
    "ok" BOOLEAN NOT NULL,
    "latencia_ms" INTEGER,
    "erro" TEXT,

    CONSTRAINT "mon_probe_result_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "mon_rollup_minute" (
    "asset_id" TEXT NOT NULL,
    "bucket" TIMESTAMP(3) NOT NULL,
    "total" INTEGER NOT NULL,
    "ok" INTEGER NOT NULL,
    "avg_lat_ms" DOUBLE PRECISION,
    "max_lat_ms" INTEGER,

    CONSTRAINT "mon_rollup_minute_pkey" PRIMARY KEY ("asset_id","bucket")
);

-- CreateTable
CREATE TABLE "mon_rollup_hour" (
    "asset_id" TEXT NOT NULL,
    "bucket" TIMESTAMP(3) NOT NULL,
    "total" INTEGER NOT NULL,
    "ok" INTEGER NOT NULL,
    "avg_lat_ms" DOUBLE PRECISION,

    CONSTRAINT "mon_rollup_hour_pkey" PRIMARY KEY ("asset_id","bucket")
);

-- CreateTable
CREATE TABLE "mon_status_event" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "asset_id" TEXT NOT NULL,
    "status_anterior" "MonStatus" NOT NULL,
    "status_novo" "MonStatus" NOT NULL,
    "severidade" "MonSeveridade" NOT NULL,
    "iniciado_em" TIMESTAMP(3) NOT NULL,
    "finalizado_em" TIMESTAMP(3),
    "duracao_seg" INTEGER,
    "mensagem" TEXT,
    "reconhecido_por_id" TEXT,
    "reconhecido_em" TIMESTAMP(3),

    CONSTRAINT "mon_status_event_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "mon_map" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "tipo" "MonMapTipo" NOT NULL,
    "unidade_id" TEXT,
    "background_url" TEXT,
    "centro_lat" DOUBLE PRECISION,
    "centro_lng" DOUBLE PRECISION,
    "zoom" INTEGER,
    "criado_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizado_em" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "mon_map_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "mon_map_position" (
    "id" TEXT NOT NULL,
    "map_id" TEXT NOT NULL,
    "asset_id" TEXT NOT NULL,
    "x" DOUBLE PRECISION NOT NULL,
    "y" DOUBLE PRECISION NOT NULL,
    "z" INTEGER NOT NULL DEFAULT 0,
    "width" INTEGER NOT NULL DEFAULT 40,
    "height" INTEGER NOT NULL DEFAULT 40,
    "rotulo" TEXT,

    CONSTRAINT "mon_map_position_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "mon_alert_channel" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "tipo" "MonAlertCanal" NOT NULL,
    "nome" TEXT NOT NULL,
    "config_json" JSONB NOT NULL,
    "ativo" BOOLEAN NOT NULL DEFAULT false,
    "criado_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "mon_alert_channel_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "mon_sla_meta" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "categoria" TEXT NOT NULL,
    "meta_pct" DOUBLE PRECISION NOT NULL DEFAULT 99,
    "criado_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizado_em" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "mon_sla_meta_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "mon_alert_rule" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "condicao_json" JSONB NOT NULL,
    "channel_ids" TEXT[],
    "severidade" "MonSeveridade" NOT NULL,
    "ativo" BOOLEAN NOT NULL DEFAULT false,
    "criado_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "mon_alert_rule_pkey" PRIMARY KEY ("id")
);

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
CREATE INDEX "mon_unidade_organization_id_idx" ON "mon_unidade"("organization_id");

-- CreateIndex
CREATE INDEX "mon_asset_organization_id_ativo_idx" ON "mon_asset"("organization_id", "ativo");

-- CreateIndex
CREATE INDEX "mon_asset_organization_id_coleta_profunda_idx" ON "mon_asset"("organization_id", "coleta_profunda");

-- CreateIndex
CREATE INDEX "mon_asset_organization_id_categoria_idx" ON "mon_asset"("organization_id", "categoria");

-- CreateIndex
CREATE INDEX "mon_asset_organization_id_ultimo_status_idx" ON "mon_asset"("organization_id", "ultimo_status");

-- CreateIndex
CREATE INDEX "mon_probe_result_asset_id_ts_idx" ON "mon_probe_result"("asset_id", "ts" DESC);

-- CreateIndex
CREATE INDEX "mon_rollup_minute_bucket_idx" ON "mon_rollup_minute"("bucket");

-- CreateIndex
CREATE INDEX "mon_rollup_hour_bucket_idx" ON "mon_rollup_hour"("bucket");

-- CreateIndex
CREATE INDEX "mon_status_event_organization_id_iniciado_em_idx" ON "mon_status_event"("organization_id", "iniciado_em" DESC);

-- CreateIndex
CREATE INDEX "mon_status_event_asset_id_iniciado_em_idx" ON "mon_status_event"("asset_id", "iniciado_em" DESC);

-- CreateIndex
CREATE INDEX "mon_map_organization_id_idx" ON "mon_map"("organization_id");

-- CreateIndex
CREATE INDEX "mon_map_position_map_id_idx" ON "mon_map_position"("map_id");

-- CreateIndex
CREATE UNIQUE INDEX "mon_map_position_map_id_asset_id_key" ON "mon_map_position"("map_id", "asset_id");

-- CreateIndex
CREATE INDEX "mon_alert_channel_organization_id_idx" ON "mon_alert_channel"("organization_id");

-- CreateIndex
CREATE UNIQUE INDEX "mon_sla_meta_organization_id_categoria_key" ON "mon_sla_meta"("organization_id", "categoria");

-- CreateIndex
CREATE INDEX "mon_alert_rule_organization_id_idx" ON "mon_alert_rule"("organization_id");

-- CreateIndex
CREATE INDEX "mon_service_organization_id_idx" ON "mon_service"("organization_id");

-- CreateIndex
CREATE INDEX "mon_service_asset_id_idx" ON "mon_service"("asset_id");

-- CreateIndex
CREATE INDEX "mon_service_event_service_id_iniciado_em_idx" ON "mon_service_event"("service_id", "iniciado_em" DESC);

-- CreateIndex
CREATE INDEX "mon_metric_asset_id_idx" ON "mon_metric"("asset_id");

-- CreateIndex
CREATE UNIQUE INDEX "mon_metric_asset_id_chave_rotulo_key" ON "mon_metric"("asset_id", "chave", "rotulo");

-- CreateIndex
CREATE INDEX "mon_metric_sample_asset_id_chave_ts_idx" ON "mon_metric_sample"("asset_id", "chave", "ts" DESC);

-- AddForeignKey
ALTER TABLE "mon_unidade" ADD CONSTRAINT "mon_unidade_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mon_asset" ADD CONSTRAINT "mon_asset_depende_de_id_fkey" FOREIGN KEY ("depende_de_id") REFERENCES "mon_asset"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mon_asset" ADD CONSTRAINT "mon_asset_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mon_asset" ADD CONSTRAINT "mon_asset_unidade_id_fkey" FOREIGN KEY ("unidade_id") REFERENCES "mon_unidade"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mon_asset" ADD CONSTRAINT "mon_asset_responsavel_id_fkey" FOREIGN KEY ("responsavel_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mon_status_event" ADD CONSTRAINT "mon_status_event_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mon_status_event" ADD CONSTRAINT "mon_status_event_asset_id_fkey" FOREIGN KEY ("asset_id") REFERENCES "mon_asset"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mon_map" ADD CONSTRAINT "mon_map_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mon_map" ADD CONSTRAINT "mon_map_unidade_id_fkey" FOREIGN KEY ("unidade_id") REFERENCES "mon_unidade"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mon_map_position" ADD CONSTRAINT "mon_map_position_map_id_fkey" FOREIGN KEY ("map_id") REFERENCES "mon_map"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mon_map_position" ADD CONSTRAINT "mon_map_position_asset_id_fkey" FOREIGN KEY ("asset_id") REFERENCES "mon_asset"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mon_alert_channel" ADD CONSTRAINT "mon_alert_channel_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mon_sla_meta" ADD CONSTRAINT "mon_sla_meta_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mon_alert_rule" ADD CONSTRAINT "mon_alert_rule_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mon_service" ADD CONSTRAINT "mon_service_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mon_service" ADD CONSTRAINT "mon_service_asset_id_fkey" FOREIGN KEY ("asset_id") REFERENCES "mon_asset"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mon_service_event" ADD CONSTRAINT "mon_service_event_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mon_service_event" ADD CONSTRAINT "mon_service_event_service_id_fkey" FOREIGN KEY ("service_id") REFERENCES "mon_service"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mon_metric" ADD CONSTRAINT "mon_metric_asset_id_fkey" FOREIGN KEY ("asset_id") REFERENCES "mon_asset"("id") ON DELETE CASCADE ON UPDATE CASCADE;
