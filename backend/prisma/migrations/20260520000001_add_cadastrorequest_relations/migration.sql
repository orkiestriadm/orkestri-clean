-- CreateTable: cadastro_requests
CREATE TABLE "cadastro_requests" (
  "id"                  TEXT NOT NULL,
  "organization_id"     TEXT NOT NULL,
  "cliente_id"          TEXT,
  "nome_org"            TEXT NOT NULL,
  "slug_org"            TEXT,
  "plano_solicitado"    TEXT NOT NULL DEFAULT 'starter',
  "contato_nome"        TEXT,
  "contato_email"       TEXT NOT NULL,
  "contato_whatsapp"    TEXT,
  "status"              TEXT NOT NULL DEFAULT 'PENDENTE',
  "aprovado_por_id"     TEXT,
  "aprovado_em"         TIMESTAMP(3),
  "provisionado_em"     TIMESTAMP(3),
  "org_provisionada_id" TEXT,
  "rejection_reason"    TEXT,
  "observacoes"         TEXT,
  "criado_por_id"       TEXT,
  "criado_em"           TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "atualizado_em"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "cadastro_requests_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "cadastro_requests_organization_id_idx" ON "cadastro_requests"("organization_id");
CREATE INDEX "cadastro_requests_status_idx" ON "cadastro_requests"("status");

-- CreateTable: contrato_anexos
CREATE TABLE "contrato_anexos" (
  "id"            TEXT NOT NULL,
  "contrato_id"   TEXT NOT NULL,
  "nome"          TEXT NOT NULL,
  "url"           TEXT NOT NULL,
  "tamanho"       INTEGER,
  "tipo"          TEXT,
  "criado_por_id" TEXT,
  "criado_em"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "contrato_anexos_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "contrato_anexos_contrato_id_idx" ON "contrato_anexos"("contrato_id");

-- AddForeignKey: cadastro_requests
ALTER TABLE "cadastro_requests" ADD CONSTRAINT "cadastro_requests_organization_id_fkey"
  FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "cadastro_requests" ADD CONSTRAINT "cadastro_requests_cliente_id_fkey"
  FOREIGN KEY ("cliente_id") REFERENCES "clientes"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "cadastro_requests" ADD CONSTRAINT "cadastro_requests_aprovado_por_id_fkey"
  FOREIGN KEY ("aprovado_por_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "cadastro_requests" ADD CONSTRAINT "cadastro_requests_criado_por_id_fkey"
  FOREIGN KEY ("criado_por_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey: contrato_anexos
ALTER TABLE "contrato_anexos" ADD CONSTRAINT "contrato_anexos_contrato_id_fkey"
  FOREIGN KEY ("contrato_id") REFERENCES "contratos"("id") ON DELETE CASCADE ON UPDATE CASCADE;
