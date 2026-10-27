CREATE TABLE "whatsapp_recibos" (
  "instancia" TEXT NOT NULL,
  "conversa" TEXT NOT NULL,
  "mensagem_id" TEXT NOT NULL,
  "estado" TEXT NOT NULL DEFAULT 'PROCESSANDO',
  "criado_em" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "atualizado_em" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY ("instancia", "conversa", "mensagem_id"),
  CONSTRAINT "whatsapp_recibos_estado_check" CHECK ("estado" IN ('PROCESSANDO', 'PROCESSADO', 'REVISAR'))
);
CREATE INDEX "whatsapp_recibos_estado_criado_idx" ON "whatsapp_recibos" ("estado", "criado_em");
