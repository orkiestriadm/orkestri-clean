CREATE TABLE whatsapp_evento_alertas (
  event_id TEXT NOT NULL REFERENCES events(id) ON DELETE CASCADE ON UPDATE CASCADE,
  inicio TIMESTAMP(3) NOT NULL,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE ON UPDATE CASCADE,
  organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE ON UPDATE CASCADE,
  instancia TEXT NOT NULL,
  codigo TEXT NOT NULL UNIQUE,
  estado TEXT NOT NULL DEFAULT 'PENDENTE',
  envios JSONB NOT NULL DEFAULT '{}',
  expira_em TIMESTAMP(3) NOT NULL,
  atualizado_em TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (event_id, inicio),
  CONSTRAINT whatsapp_evento_alertas_estado CHECK (estado IN
    ('PENDENTE','MENU','AGUARDANDO_DATA','CONFIRMADO','ADIADO','SUSPENSO','EXPIRADO'))
);
CREATE INDEX whatsapp_evento_alertas_resposta_idx
  ON whatsapp_evento_alertas(user_id, organization_id, instancia, expira_em);
