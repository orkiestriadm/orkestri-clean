-- Modulo Monitoramento Operacional
-- Tabelas mon_* independentes do modulo Ativos. Suporta ICMP agora, arquitetura
-- preparada para SNMP/TCP/HTTP futuramente sem reescrita.

-- ── Enums ────────────────────────────────────────────────────────────────────
CREATE TYPE "MonCategoria"  AS ENUM ('ITS','SERVIDORES','COMPUTADORES','PRACAS','INFRAESTRUTURA');
CREATE TYPE "MonProtocolo"  AS ENUM ('ICMP','TCP','HTTP','SNMP');
CREATE TYPE "MonStatus"     AS ENUM ('ONLINE','OFFLINE','INSTAVEL','NAO_MONITORADO');
CREATE TYPE "MonSeveridade" AS ENUM ('INFO','ATENCAO','CRITICO');
CREATE TYPE "MonMapTipo"    AS ENUM ('GEO','INFRA');
CREATE TYPE "MonAlertCanal" AS ENUM ('EMAIL','WHATSAPP','TELEGRAM','PUSH');

-- ── mon_unidade ──────────────────────────────────────────────────────────────
CREATE TABLE "mon_unidade" (
    "id"              TEXT PRIMARY KEY,
    "organization_id" TEXT NOT NULL,
    "nome"            TEXT NOT NULL,
    "tipo"            TEXT,
    "latitude"        DOUBLE PRECISION,
    "longitude"       DOUBLE PRECISION,
    "criado_em"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "mon_unidade_organization_id_fkey"
        FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX "mon_unidade_organization_id_idx" ON "mon_unidade"("organization_id");

-- ── mon_asset ────────────────────────────────────────────────────────────────
CREATE TABLE "mon_asset" (
    "id"                     TEXT PRIMARY KEY,
    "organization_id"        TEXT NOT NULL,
    "nome"                   TEXT NOT NULL,
    "categoria"              "MonCategoria" NOT NULL,
    "tipo"                   TEXT NOT NULL,
    "localizacao"            TEXT,
    "unidade_id"             TEXT,
    "responsavel_id"         TEXT,
    "observacoes"            TEXT,
    "ip"                     TEXT NOT NULL,
    "hostname"               TEXT,
    "porta"                  INTEGER,
    "intervalo_seg"          INTEGER NOT NULL DEFAULT 60,
    "timeout_seg"            INTEGER NOT NULL DEFAULT 3,
    "protocolo"              "MonProtocolo" NOT NULL DEFAULT 'ICMP',
    "ativo"                  BOOLEAN NOT NULL DEFAULT true,
    "ultimo_status"          "MonStatus" NOT NULL DEFAULT 'NAO_MONITORADO',
    "ultimo_check_em"        TIMESTAMP(3),
    "ultima_latencia_ms"     INTEGER,
    "perda_pct_ultima_hora"  DOUBLE PRECISION,
    "uptime_24h"             DOUBLE PRECISION,
    "consecutivo_falhas"     INTEGER NOT NULL DEFAULT 0,
    "consecutivo_sucessos"   INTEGER NOT NULL DEFAULT 0,
    "criado_em"              TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizado_em"          TIMESTAMP(3) NOT NULL,
    CONSTRAINT "mon_asset_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "mon_asset_unidade_id_fkey"      FOREIGN KEY ("unidade_id")      REFERENCES "mon_unidade"("id")    ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "mon_asset_responsavel_id_fkey"  FOREIGN KEY ("responsavel_id")  REFERENCES "users"("id")           ON DELETE SET NULL ON UPDATE CASCADE
);
CREATE INDEX "mon_asset_org_ativo_idx"      ON "mon_asset"("organization_id","ativo");
CREATE INDEX "mon_asset_org_categoria_idx"  ON "mon_asset"("organization_id","categoria");
CREATE INDEX "mon_asset_org_status_idx"     ON "mon_asset"("organization_id","ultimo_status");

-- ── mon_probe_result (raw history, alta cardinalidade) ──────────────────────
CREATE TABLE "mon_probe_result" (
    "id"          BIGSERIAL PRIMARY KEY,
    "asset_id"    TEXT NOT NULL,
    "ts"          TIMESTAMP(3) NOT NULL,
    "ok"          BOOLEAN NOT NULL,
    "latencia_ms" INTEGER,
    "erro"        TEXT
);
CREATE INDEX "mon_probe_result_asset_ts_idx" ON "mon_probe_result"("asset_id","ts" DESC);

-- ── mon_rollup_minute ────────────────────────────────────────────────────────
CREATE TABLE "mon_rollup_minute" (
    "asset_id"   TEXT NOT NULL,
    "bucket"     TIMESTAMP(3) NOT NULL,
    "total"      INTEGER NOT NULL,
    "ok"         INTEGER NOT NULL,
    "avg_lat_ms" DOUBLE PRECISION,
    "max_lat_ms" INTEGER,
    PRIMARY KEY ("asset_id","bucket")
);
CREATE INDEX "mon_rollup_minute_bucket_idx" ON "mon_rollup_minute"("bucket");

-- ── mon_rollup_hour ──────────────────────────────────────────────────────────
CREATE TABLE "mon_rollup_hour" (
    "asset_id"   TEXT NOT NULL,
    "bucket"     TIMESTAMP(3) NOT NULL,
    "total"      INTEGER NOT NULL,
    "ok"         INTEGER NOT NULL,
    "avg_lat_ms" DOUBLE PRECISION,
    PRIMARY KEY ("asset_id","bucket")
);
CREATE INDEX "mon_rollup_hour_bucket_idx" ON "mon_rollup_hour"("bucket");

-- ── mon_status_event (transitions) ───────────────────────────────────────────
CREATE TABLE "mon_status_event" (
    "id"               TEXT PRIMARY KEY,
    "organization_id"  TEXT NOT NULL,
    "asset_id"         TEXT NOT NULL,
    "status_anterior"  "MonStatus" NOT NULL,
    "status_novo"      "MonStatus" NOT NULL,
    "severidade"       "MonSeveridade" NOT NULL,
    "iniciado_em"      TIMESTAMP(3) NOT NULL,
    "finalizado_em"    TIMESTAMP(3),
    "duracao_seg"      INTEGER,
    "mensagem"         TEXT,
    CONSTRAINT "mon_status_event_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "mon_status_event_asset_id_fkey"        FOREIGN KEY ("asset_id")        REFERENCES "mon_asset"("id")     ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX "mon_status_event_org_iniciado_idx"   ON "mon_status_event"("organization_id","iniciado_em" DESC);
CREATE INDEX "mon_status_event_asset_iniciado_idx" ON "mon_status_event"("asset_id","iniciado_em" DESC);

-- ── mon_map ──────────────────────────────────────────────────────────────────
CREATE TABLE "mon_map" (
    "id"               TEXT PRIMARY KEY,
    "organization_id"  TEXT NOT NULL,
    "nome"             TEXT NOT NULL,
    "tipo"             "MonMapTipo" NOT NULL,
    "unidade_id"       TEXT,
    "background_url"   TEXT,
    "centro_lat"       DOUBLE PRECISION,
    "centro_lng"       DOUBLE PRECISION,
    "zoom"             INTEGER,
    "criado_em"        TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizado_em"    TIMESTAMP(3) NOT NULL,
    CONSTRAINT "mon_map_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "mon_map_unidade_id_fkey"      FOREIGN KEY ("unidade_id")      REFERENCES "mon_unidade"("id")    ON DELETE SET NULL ON UPDATE CASCADE
);
CREATE INDEX "mon_map_organization_id_idx" ON "mon_map"("organization_id");

-- ── mon_map_position ─────────────────────────────────────────────────────────
CREATE TABLE "mon_map_position" (
    "id"       TEXT PRIMARY KEY,
    "map_id"   TEXT NOT NULL,
    "asset_id" TEXT NOT NULL,
    "x"        DOUBLE PRECISION NOT NULL,
    "y"        DOUBLE PRECISION NOT NULL,
    "z"        INTEGER NOT NULL DEFAULT 0,
    "width"    INTEGER NOT NULL DEFAULT 40,
    "height"   INTEGER NOT NULL DEFAULT 40,
    "rotulo"   TEXT,
    CONSTRAINT "mon_map_position_map_id_fkey"   FOREIGN KEY ("map_id")   REFERENCES "mon_map"("id")   ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "mon_map_position_asset_id_fkey" FOREIGN KEY ("asset_id") REFERENCES "mon_asset"("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "mon_map_position_map_asset_uq"  UNIQUE ("map_id","asset_id")
);
CREATE INDEX "mon_map_position_map_id_idx" ON "mon_map_position"("map_id");

-- ── mon_alert_channel / mon_alert_rule (preparacao, dispatch OFF) ────────────
CREATE TABLE "mon_alert_channel" (
    "id"              TEXT PRIMARY KEY,
    "organization_id" TEXT NOT NULL,
    "tipo"            "MonAlertCanal" NOT NULL,
    "nome"            TEXT NOT NULL,
    "config_json"     JSONB NOT NULL,
    "ativo"           BOOLEAN NOT NULL DEFAULT false,
    "criado_em"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "mon_alert_channel_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX "mon_alert_channel_org_idx" ON "mon_alert_channel"("organization_id");

CREATE TABLE "mon_alert_rule" (
    "id"              TEXT PRIMARY KEY,
    "organization_id" TEXT NOT NULL,
    "nome"            TEXT NOT NULL,
    "condicao_json"   JSONB NOT NULL,
    "channel_ids"     TEXT[],
    "severidade"      "MonSeveridade" NOT NULL,
    "ativo"           BOOLEAN NOT NULL DEFAULT false,
    "criado_em"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "mon_alert_rule_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX "mon_alert_rule_org_idx" ON "mon_alert_rule"("organization_id");

-- ── Cleanup automatico (retencao) ────────────────────────────────────────────
-- Probe results: retencao curta (raw = 14 dias). Roll-ups guardam o resto.
-- Pode rodar via pg_cron quando habilitar. Por enquanto cleanup roda pelo worker.
