CREATE TABLE whatsapp_anexos (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  nome TEXT NOT NULL,
  mime TEXT NOT NULL CHECK (mime IN ('application/pdf','image/jpeg','image/png','image/webp')),
  tamanho INT NOT NULL CHECK (tamanho>0 AND tamanho<=5242880),
  criado_em TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  expira_em TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP+INTERVAL '30 days'
);
CREATE INDEX whatsapp_anexos_user_idx ON whatsapp_anexos(user_id,criado_em);
CREATE INDEX whatsapp_anexos_expira_idx ON whatsapp_anexos(expira_em);
