-- Integração de calendário externo (Microsoft 365 / futuro Google).
-- Aditiva: cria enums, as tabelas de conexão/subscription e as colunas de
-- proveniência em "events". Nenhuma coluna existente é alterada/removida, então
-- é segura para rodar sobre a base de produção com dados.

-- CreateEnum
CREATE TYPE "CalendarProvider" AS ENUM ('microsoft', 'google');

-- CreateEnum
CREATE TYPE "CalendarConnectionStatus" AS ENUM ('connected', 'syncing', 'synced', 'error', 'disconnected', 'reauth_required');

-- AlterTable: proveniência de calendário externo em events
ALTER TABLE "events"
  ADD COLUMN "provider" TEXT DEFAULT 'internal',
  ADD COLUMN "connection_id" TEXT,
  ADD COLUMN "external_id" TEXT,
  ADD COLUMN "external_calendar_id" TEXT,
  ADD COLUMN "external_etag" TEXT,
  ADD COLUMN "sync_hash" TEXT,
  ADD COLUMN "synced_at" TIMESTAMP(3),
  ADD COLUMN "external_cancelled" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "calendar_connections" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "provider" "CalendarProvider" NOT NULL DEFAULT 'microsoft',
    "provider_account_id" TEXT,
    "provider_tenant_id" TEXT,
    "provider_email" TEXT,
    "external_calendar_id" TEXT,
    "external_calendar_name" TEXT,
    "status" "CalendarConnectionStatus" NOT NULL DEFAULT 'connected',
    "access_token_enc" TEXT,
    "refresh_token_enc" TEXT,
    "token_expires_at" TIMESTAMP(3),
    "scope" TEXT,
    "delta_link" TEXT,
    "last_sync_at" TIMESTAMP(3),
    "last_error" TEXT,
    "push_enabled" BOOLEAN NOT NULL DEFAULT true,
    "sync_enabled" BOOLEAN NOT NULL DEFAULT true,
    "criado_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizado_em" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "calendar_connections_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "calendar_subscriptions" (
    "id" TEXT NOT NULL,
    "connection_id" TEXT NOT NULL,
    "subscription_id" TEXT NOT NULL,
    "resource" TEXT NOT NULL,
    "client_state" TEXT NOT NULL,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "criado_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizado_em" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "calendar_subscriptions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "calendar_connections_organization_id_idx" ON "calendar_connections"("organization_id");

-- CreateIndex
CREATE INDEX "calendar_connections_status_idx" ON "calendar_connections"("status");

-- CreateIndex
CREATE UNIQUE INDEX "calendar_connections_user_id_provider_key" ON "calendar_connections"("user_id", "provider");

-- CreateIndex
CREATE UNIQUE INDEX "calendar_subscriptions_subscription_id_key" ON "calendar_subscriptions"("subscription_id");

-- CreateIndex
CREATE INDEX "calendar_subscriptions_connection_id_idx" ON "calendar_subscriptions"("connection_id");

-- CreateIndex
CREATE INDEX "calendar_subscriptions_expires_at_idx" ON "calendar_subscriptions"("expires_at");

-- CreateIndex
CREATE INDEX "events_provider_external_id_idx" ON "events"("provider", "external_id");

-- CreateIndex
CREATE UNIQUE INDEX "events_connection_id_external_id_key" ON "events"("connection_id", "external_id");

-- AddForeignKey
ALTER TABLE "events" ADD CONSTRAINT "events_connection_id_fkey" FOREIGN KEY ("connection_id") REFERENCES "calendar_connections"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "calendar_connections" ADD CONSTRAINT "calendar_connections_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "calendar_connections" ADD CONSTRAINT "calendar_connections_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "calendar_subscriptions" ADD CONSTRAINT "calendar_subscriptions_connection_id_fkey" FOREIGN KEY ("connection_id") REFERENCES "calendar_connections"("id") ON DELETE CASCADE ON UPDATE CASCADE;
