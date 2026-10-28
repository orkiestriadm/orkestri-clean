CREATE TABLE "whatsapp_boas_vindas" (
  "user_id" TEXT PRIMARY KEY,
  "cadastro_id" TEXT NOT NULL UNIQUE,
  "telefone" TEXT NOT NULL,
  "instancia" TEXT NOT NULL,
  "estado" TEXT NOT NULL DEFAULT 'PENDENTE',
  "tentativas" INTEGER NOT NULL DEFAULT 0,
  "tentativa_id" TEXT,
  "proxima_tentativa" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "expira_em" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP + INTERVAL '24 hours',
  "criado_em" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "atualizado_em" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "whatsapp_boas_vindas_estado_check" CHECK ("estado" IN ('PENDENTE','ENVIANDO','ACEITA','FALHOU','EXPIRADA','DESCARTADA'))
);
CREATE INDEX "whatsapp_boas_vindas_pendentes_idx" ON "whatsapp_boas_vindas" ("estado", "proxima_tentativa");
CREATE TABLE "whatsapp_inicio" (
  "user_id" TEXT NOT NULL,
  "instancia" TEXT NOT NULL,
  "conversa" TEXT NOT NULL,
  "etapa" TEXT NOT NULL,
  "dados" JSONB NOT NULL DEFAULT '{}',
  "expira_em" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP + INTERVAL '30 minutes',
  PRIMARY KEY ("user_id", "instancia", "conversa")
);
CREATE INDEX "whatsapp_inicio_expira_idx" ON "whatsapp_inicio" ("expira_em");
CREATE INDEX "whatsapp_inicio_conversa_idx" ON "whatsapp_inicio" ("instancia", "conversa");
