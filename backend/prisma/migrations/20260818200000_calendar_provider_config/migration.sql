-- Configuração do app do provedor (credenciais do Entra) editável por tela.
-- Aditiva. organization_id nulo = padrão da plataforma; com valor = app da org.

-- CreateTable
CREATE TABLE "calendar_provider_configs" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT,
    "provider" "CalendarProvider" NOT NULL DEFAULT 'microsoft',
    "client_id" TEXT,
    "tenant_id" TEXT,
    "client_secret_enc" TEXT,
    "redirect_uri" TEXT,
    "webhook_url" TEXT,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "atualizado_por" TEXT,
    "criado_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizado_em" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "calendar_provider_configs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex: unicidade por (org, provider). No Postgres, linhas com
-- organization_id NULL são distintas entre si nesse índice — por isso a linha de
-- plataforma ganha um índice parcial próprio abaixo.
CREATE UNIQUE INDEX "calendar_provider_configs_organization_id_provider_key" ON "calendar_provider_configs"("organization_id", "provider");

-- Garante NO MÁXIMO uma linha de plataforma (organization_id IS NULL) por provider.
CREATE UNIQUE INDEX "calendar_provider_configs_platform_provider_key" ON "calendar_provider_configs"("provider") WHERE "organization_id" IS NULL;

-- AddForeignKey
ALTER TABLE "calendar_provider_configs" ADD CONSTRAINT "calendar_provider_configs_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
