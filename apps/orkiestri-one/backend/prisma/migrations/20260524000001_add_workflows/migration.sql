-- CreateTable: workflow_requests
CREATE TABLE "workflow_requests" (
  "id"                 TEXT NOT NULL,
  "organization_id"    TEXT NOT NULL,
  "solicitante_id"     TEXT NOT NULL,
  "tipo"               TEXT NOT NULL,
  "titulo"             TEXT NOT NULL,
  "descricao"          TEXT,
  "payload"            JSONB,
  "valor"              DOUBLE PRECISION,
  "status"             TEXT NOT NULL DEFAULT 'PENDENTE',
  "aprovador_atual_id" TEXT,
  "aprovado_por_id"    TEXT,
  "aprovado_em"        TIMESTAMP(3),
  "rejeitado_por_id"   TEXT,
  "rejeitado_em"       TIMESTAMP(3),
  "motivo_rejeicao"    TEXT,
  "criado_em"          TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "atualizado_em"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "workflow_requests_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "workflow_requests_organization_id_idx"     ON "workflow_requests"("organization_id");
CREATE INDEX "workflow_requests_solicitante_id_idx"     ON "workflow_requests"("solicitante_id");
CREATE INDEX "workflow_requests_aprovador_atual_id_idx" ON "workflow_requests"("aprovador_atual_id");
CREATE INDEX "workflow_requests_status_idx"             ON "workflow_requests"("status");
CREATE INDEX "workflow_requests_tipo_idx"               ON "workflow_requests"("tipo");

ALTER TABLE "workflow_requests" ADD CONSTRAINT "workflow_requests_organization_id_fkey"
  FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "workflow_requests" ADD CONSTRAINT "workflow_requests_solicitante_id_fkey"
  FOREIGN KEY ("solicitante_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "workflow_requests" ADD CONSTRAINT "workflow_requests_aprovador_atual_id_fkey"
  FOREIGN KEY ("aprovador_atual_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "workflow_requests" ADD CONSTRAINT "workflow_requests_aprovado_por_id_fkey"
  FOREIGN KEY ("aprovado_por_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "workflow_requests" ADD CONSTRAINT "workflow_requests_rejeitado_por_id_fkey"
  FOREIGN KEY ("rejeitado_por_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- CreateTable: workflow_approvals (log de aprovações multinível)
CREATE TABLE "workflow_approvals" (
  "id"           TEXT NOT NULL,
  "request_id"   TEXT NOT NULL,
  "aprovador_id" TEXT NOT NULL,
  "nivel"        INTEGER NOT NULL DEFAULT 1,
  "decisao"      TEXT NOT NULL,
  "observacoes"  TEXT,
  "criado_em"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "workflow_approvals_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "workflow_approvals_request_id_idx"  ON "workflow_approvals"("request_id");
CREATE INDEX "workflow_approvals_aprovador_id_idx" ON "workflow_approvals"("aprovador_id");

ALTER TABLE "workflow_approvals" ADD CONSTRAINT "workflow_approvals_request_id_fkey"
  FOREIGN KEY ("request_id") REFERENCES "workflow_requests"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "workflow_approvals" ADD CONSTRAINT "workflow_approvals_aprovador_id_fkey"
  FOREIGN KEY ("aprovador_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
