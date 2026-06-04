-- ChamadoAnexo: arquivos anexados a chamados
CREATE TABLE "chamado_anexos" (
    "id"             TEXT NOT NULL,
    "chamado_id"     TEXT NOT NULL,
    "uploader_id"    TEXT NOT NULL,
    "nome_original"  TEXT NOT NULL,
    "nome_arquivo"   TEXT NOT NULL,
    "mime_type"      TEXT NOT NULL,
    "tamanho_bytes"  INTEGER NOT NULL,
    "criado_em"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "chamado_anexos_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "chamado_anexos_chamado_id_idx" ON "chamado_anexos"("chamado_id");
ALTER TABLE "chamado_anexos" ADD CONSTRAINT "chamado_anexos_chamado_id_fkey"
  FOREIGN KEY ("chamado_id") REFERENCES "chamados"("id") ON DELETE CASCADE;
ALTER TABLE "chamado_anexos" ADD CONSTRAINT "chamado_anexos_uploader_id_fkey"
  FOREIGN KEY ("uploader_id") REFERENCES "users"("id") ON DELETE RESTRICT;

-- ChamadoTemplate: templates persistidos no banco
CREATE TABLE "chamado_templates" (
    "id"              TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "criado_por_id"   TEXT NOT NULL,
    "nome"            TEXT NOT NULL,
    "titulo"          TEXT NOT NULL,
    "descricao"       TEXT,
    "prioridade"      TEXT NOT NULL DEFAULT 'media',
    "categoria"       TEXT,
    "tags"            TEXT,
    "criado_em"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizado_em"   TIMESTAMP(3) NOT NULL,
    CONSTRAINT "chamado_templates_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "chamado_templates_organization_id_idx" ON "chamado_templates"("organization_id");
ALTER TABLE "chamado_templates" ADD CONSTRAINT "chamado_templates_organization_id_fkey"
  FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE;
ALTER TABLE "chamado_templates" ADD CONSTRAINT "chamado_templates_criado_por_id_fkey"
  FOREIGN KEY ("criado_por_id") REFERENCES "users"("id") ON DELETE RESTRICT;
