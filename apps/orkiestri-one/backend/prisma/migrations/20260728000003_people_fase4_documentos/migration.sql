-- ============================================================================
-- Orkiestri People — Fase 4: documentos do colaborador
--
-- Dado classificado como RESTRITO em PEOPLE_PERMISSIONS.md §21. O arquivo
-- físico fica fora de UPLOAD_DIR (servido estaticamente sem autenticação) e
-- só é alcançável pelo endpoint de download, que valida escopo e permissão.
--
-- `arquivo_ref` guarda caminho relativo, nunca URL: o acesso é sempre mediado.
-- ============================================================================

CREATE TABLE IF NOT EXISTS "collaborator_documents" (
  "id"                TEXT NOT NULL,
  "organization_id"   TEXT NOT NULL,
  "collaborator_id"   TEXT NOT NULL,
  "categoria"         TEXT NOT NULL,
  "titulo"            TEXT NOT NULL,
  "descricao"         TEXT,
  "arquivo_ref"       TEXT NOT NULL,
  "nome_arquivo"      TEXT NOT NULL,
  "mime_type"         TEXT,
  "tamanho_bytes"     INTEGER,
  "data_emissao"      TIMESTAMP(3),
  "data_validade"     TIMESTAMP(3),
  "aprovacao"         TEXT NOT NULL DEFAULT 'PENDENTE',
  "aprovado_por_id"   TEXT,
  "aprovado_em"       TIMESTAMP(3),
  "motivo_rejeicao"   TEXT,
  "enviado_por_id"    TEXT,
  "criado_em"         TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "atualizado_em"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "atualizado_por_id" TEXT,
  "excluido_em"       TIMESTAMP(3),
  CONSTRAINT "collaborator_documents_pkey" PRIMARY KEY ("id")
);

-- Listagem por colaborador já filtrando excluídos.
CREATE INDEX IF NOT EXISTS "collaborator_documents_collaborator_id_excluido_em_idx"
  ON "collaborator_documents"("collaborator_id", "excluido_em");

-- Varredura de vencimento: o alerta roda por organização olhando data_validade.
CREATE INDEX IF NOT EXISTS "collaborator_documents_organization_id_data_validade_idx"
  ON "collaborator_documents"("organization_id", "data_validade");

CREATE INDEX IF NOT EXISTS "collaborator_documents_aprovacao_idx"
  ON "collaborator_documents"("aprovacao");

ALTER TABLE "collaborator_documents" DROP CONSTRAINT IF EXISTS "collaborator_documents_organization_id_fkey";
ALTER TABLE "collaborator_documents"
  ADD CONSTRAINT "collaborator_documents_organization_id_fkey"
  FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "collaborator_documents" DROP CONSTRAINT IF EXISTS "collaborator_documents_collaborator_id_fkey";
ALTER TABLE "collaborator_documents"
  ADD CONSTRAINT "collaborator_documents_collaborator_id_fkey"
  FOREIGN KEY ("collaborator_id") REFERENCES "collaborators"("id") ON DELETE CASCADE ON UPDATE CASCADE;
