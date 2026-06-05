-- CreateTable
CREATE TABLE "webhooks" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "descricao" TEXT,
    "url" TEXT NOT NULL,
    "evento" TEXT NOT NULL,
    "headers" JSONB NOT NULL DEFAULT '{}',
    "secret" TEXT,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "total_envios" INTEGER NOT NULL DEFAULT 0,
    "ultimo_envio" TIMESTAMP(3),
    "ultimo_status" INTEGER,
    "criado_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizado_em" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "webhooks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "webhook_logs" (
    "id" TEXT NOT NULL,
    "webhook_id" TEXT NOT NULL,
    "evento" TEXT NOT NULL,
    "payload" JSONB,
    "status_code" INTEGER,
    "response" TEXT,
    "sucesso" BOOLEAN NOT NULL DEFAULT false,
    "erro" TEXT,
    "criado_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "webhook_logs_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "webhooks" ADD CONSTRAINT "webhooks_organization_id_fkey"
    FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "webhook_logs" ADD CONSTRAINT "webhook_logs_webhook_id_fkey"
    FOREIGN KEY ("webhook_id") REFERENCES "webhooks"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- CreateIndex
CREATE INDEX "webhooks_organization_id_evento_idx" ON "webhooks"("organization_id", "evento");
CREATE INDEX "webhooks_evento_ativo_idx" ON "webhooks"("evento", "ativo");
CREATE INDEX "webhook_logs_webhook_id_criado_em_idx" ON "webhook_logs"("webhook_id", "criado_em" DESC);
