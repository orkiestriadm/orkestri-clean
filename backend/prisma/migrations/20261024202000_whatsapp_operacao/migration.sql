ALTER TABLE whatsapp_recibos
  ADD COLUMN id TEXT NOT NULL DEFAULT gen_random_uuid()::text UNIQUE,
  ADD COLUMN user_id TEXT,
  ADD COLUMN organization_id TEXT,
  ADD COLUMN contexto TEXT,
  ADD COLUMN payload_protegido TEXT,
  ADD COLUMN efeitos_iniciados BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN tentativas INT NOT NULL DEFAULT 1;
CREATE INDEX whatsapp_recibos_user_idx ON whatsapp_recibos(user_id,criado_em);
ALTER TABLE whatsapp_recibos DROP CONSTRAINT whatsapp_recibos_estado_check;
ALTER TABLE whatsapp_recibos ADD CONSTRAINT whatsapp_recibos_estado_check CHECK (estado IN ('PROCESSANDO','PROCESSADO','REVISAR','RESOLVIDO'));
CREATE INDEX whatsapp_recibos_org_idx ON whatsapp_recibos(organization_id,contexto,criado_em);
CREATE TABLE whatsapp_atividade (
  instancia TEXT NOT NULL,
  mensagem_id TEXT NOT NULL,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  contexto TEXT NOT NULL CHECK (contexto IN ('PESSOAL','EMPRESA')),
  tipo TEXT NOT NULL,
  acao_util TEXT,
  criado_em TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY(instancia,mensagem_id,user_id)
);
CREATE INDEX whatsapp_atividade_user_idx ON whatsapp_atividade(user_id,criado_em);
CREATE INDEX whatsapp_atividade_org_idx ON whatsapp_atividade(organization_id,contexto,criado_em);
CREATE TABLE whatsapp_revisoes (
  id TEXT PRIMARY KEY,
  instancia TEXT NOT NULL,
  mensagem_id TEXT NOT NULL,
  autor_id TEXT NOT NULL,
  motivo TEXT NOT NULL,
  acao TEXT NOT NULL CHECK (acao IN ('REPROCESSAR','RESOLVER')),
  criado_em TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);
