CREATE TABLE whatsapp_previas (
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  instancia TEXT NOT NULL,
  conversa TEXT NOT NULL,
  comando TEXT NOT NULL CHECK (length(comando)<=2000),
  expira_em TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP+INTERVAL '10 minutes',
  PRIMARY KEY(user_id,instancia,conversa)
);
CREATE INDEX whatsapp_previas_expira_idx ON whatsapp_previas(expira_em);
