-- Anexos de documentos do veículo (apólice, comprovantes, laudos, etc.). Idempotente.

CREATE TABLE IF NOT EXISTS documento_anexos (
  id              TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  documento_id    TEXT NOT NULL REFERENCES documentos_veiculo(id) ON DELETE CASCADE,
  nome_arquivo    TEXT NOT NULL,
  nome_original   TEXT NOT NULL,
  mime            TEXT,
  tamanho         INTEGER,
  criado_por_id   TEXT,
  deleted_at      TIMESTAMPTZ,
  criado_em       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_doc_anexo ON documento_anexos(documento_id, deleted_at);
