CREATE TABLE "chamados" (
  "id"             TEXT NOT NULL,
  "numero"         SERIAL,
  "titulo"         TEXT NOT NULL,
  "descricao"      TEXT NOT NULL,
  "status"         TEXT NOT NULL DEFAULT 'aberto',
  "prioridade"     TEXT NOT NULL DEFAULT 'media',
  "categoria"      TEXT,
  "tags"           TEXT,
  "solicitante_id" TEXT NOT NULL,
  "atendente_id"   TEXT,
  "cliente_id"     TEXT,
  "sla_horas"      INTEGER,
  "resolvido_em"   TIMESTAMP(3),
  "fechado_em"     TIMESTAMP(3),
  "avaliacao"      INTEGER,
  "avaliacao_nota" TEXT,
  "criado_em"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "atualizado_em"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "chamados_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "chamado_comentarios" (
  "id"         TEXT NOT NULL,
  "chamado_id" TEXT NOT NULL,
  "user_id"    TEXT NOT NULL,
  "texto"      TEXT NOT NULL,
  "interno"    BOOLEAN NOT NULL DEFAULT false,
  "criado_em"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "chamado_comentarios_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "chamados_status_idx"        ON "chamados"("status");
CREATE INDEX "chamados_prioridade_idx"    ON "chamados"("prioridade");
CREATE INDEX "chamados_solicitante_idx"   ON "chamados"("solicitante_id");
CREATE INDEX "chamados_atendente_idx"     ON "chamados"("atendente_id");

ALTER TABLE "chamados"
  ADD CONSTRAINT "chamados_solicitante_fkey"
    FOREIGN KEY ("solicitante_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "chamados_atendente_fkey"
    FOREIGN KEY ("atendente_id")   REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  ADD CONSTRAINT "chamados_cliente_fkey"
    FOREIGN KEY ("cliente_id")     REFERENCES "clientes"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "chamado_comentarios"
  ADD CONSTRAINT "chamado_comentarios_chamado_fkey"
    FOREIGN KEY ("chamado_id") REFERENCES "chamados"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT "chamado_comentarios_user_fkey"
    FOREIGN KEY ("user_id")    REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
