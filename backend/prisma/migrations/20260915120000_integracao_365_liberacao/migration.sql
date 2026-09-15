-- Liberação da integração com o Outlook: o usuário solicita, o administrador libera.
CREATE TABLE "calendar_integration_access" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "provider" "CalendarProvider" NOT NULL DEFAULT 'microsoft',
    "status" TEXT NOT NULL,
    "solicitado_em" TIMESTAMP(3),
    "decidido_por_id" TEXT,
    "decidido_em" TIMESTAMP(3),
    "criado_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizado_em" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "calendar_integration_access_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "calendar_integration_access_user_id_provider_key" ON "calendar_integration_access"("user_id", "provider");
CREATE INDEX "calendar_integration_access_organization_id_status_idx" ON "calendar_integration_access"("organization_id", "status");

ALTER TABLE "calendar_integration_access" ADD CONSTRAINT "calendar_integration_access_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Quem já tem conta conectada antes da regra continua liberado: a liberação
-- não pode derrubar uma integração que já funciona. O JOIN em users descarta
-- conexão órfã (a base já teve FK quebrada apesar das constraints).
INSERT INTO "calendar_integration_access" ("id", "organization_id", "user_id", "provider", "status", "decidido_em", "atualizado_em")
SELECT gen_random_uuid()::text, c."organization_id", c."user_id", c."provider", 'liberado', NOW(), NOW()
FROM "calendar_connections" c
JOIN "users" u ON u."id" = c."user_id"
WHERE c."status" <> 'disconnected'
ON CONFLICT ("user_id", "provider") DO NOTHING;
