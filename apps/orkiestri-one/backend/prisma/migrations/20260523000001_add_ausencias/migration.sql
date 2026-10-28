-- CreateTable: ausencias (workforce time-off / absences)
CREATE TABLE "ausencias" (
  "id"                TEXT NOT NULL,
  "organization_id"   TEXT NOT NULL,
  "collaborator_id"   TEXT NOT NULL,
  "tipo"              TEXT NOT NULL,
  "data_inicio"       TIMESTAMP(3) NOT NULL,
  "data_fim"          TIMESTAMP(3) NOT NULL,
  "dia_inteiro"       BOOLEAN NOT NULL DEFAULT true,
  "horas_dia"         DOUBLE PRECISION,
  "descricao"         TEXT,
  "documento_url"     TEXT,
  "status"            TEXT NOT NULL DEFAULT 'PENDENTE',
  "solicitada_por_id" TEXT,
  "aprovada_por_id"   TEXT,
  "aprovada_em"       TIMESTAMP(3),
  "motivo_rejeicao"   TEXT,
  "criado_em"         TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "atualizado_em"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "ausencias_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "ausencias_organization_id_idx"  ON "ausencias"("organization_id");
CREATE INDEX "ausencias_collaborator_id_idx"  ON "ausencias"("collaborator_id");
CREATE INDEX "ausencias_data_inicio_idx"      ON "ausencias"("data_inicio");
CREATE INDEX "ausencias_status_idx"           ON "ausencias"("status");

ALTER TABLE "ausencias" ADD CONSTRAINT "ausencias_organization_id_fkey"
  FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "ausencias" ADD CONSTRAINT "ausencias_collaborator_id_fkey"
  FOREIGN KEY ("collaborator_id") REFERENCES "collaborators"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ausencias" ADD CONSTRAINT "ausencias_solicitada_por_id_fkey"
  FOREIGN KEY ("solicitada_por_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "ausencias" ADD CONSTRAINT "ausencias_aprovada_por_id_fkey"
  FOREIGN KEY ("aprovada_por_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
