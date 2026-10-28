CREATE TABLE "whatsapp_rotina" (
  "user_id" TEXT PRIMARY KEY,
  "ativo" BOOLEAN NOT NULL DEFAULT false,
  "horario" TEXT NOT NULL DEFAULT '08:00',
  "dias_uteis" BOOLEAN NOT NULL DEFAULT false,
  "telefone" TEXT NOT NULL,
  "instancia" TEXT NOT NULL,
  "revisao" TEXT NOT NULL,
  "atualizado_em" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "whatsapp_rotina_horario_check" CHECK (horario ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$')
);
CREATE TABLE "whatsapp_rotina_envios" (
  "user_id" TEXT NOT NULL,
  "dia" DATE NOT NULL,
  "revisao" TEXT NOT NULL,
  "estado" TEXT NOT NULL DEFAULT 'ENVIANDO',
  "criado_em" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "atualizado_em" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY ("user_id", "dia"),
  CONSTRAINT "whatsapp_rotina_envios_estado_check" CHECK (estado IN ('ENVIANDO','ACEITA','FALHOU','CANCELADA','SEM_ACESSO','REVISAR'))
);
CREATE INDEX "whatsapp_rotina_ativos_idx" ON "whatsapp_rotina" ("ativo", "horario");
CREATE INDEX "whatsapp_rotina_envios_estado_idx" ON "whatsapp_rotina_envios" ("estado", "criado_em");
