CREATE TABLE whatsapp_contextos (
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  instancia TEXT NOT NULL,
  conversa TEXT NOT NULL,
  contexto TEXT NOT NULL DEFAULT 'PESSOAL' CHECK (contexto IN ('PESSOAL','EMPRESA')),
  atualizado_em TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY(user_id,instancia,conversa)
);
