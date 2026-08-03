-- Autoavaliação e avaliação de pares (360).
--
-- Tabela NOVA e nenhuma coluna alterada: o ciclo que já existe continua
-- funcionando exatamente como antes, e um deploy sem ninguém usar 360 não
-- muda comportamento nenhum. A nota do gestor segue em performance_reviews —
-- as entradas aqui são insumo da conversa, não votos numa média.
CREATE TABLE IF NOT EXISTS "performance_review_inputs" (
  "id"              TEXT NOT NULL,
  "organization_id" TEXT NOT NULL,
  "review_id"       TEXT NOT NULL,
  "avaliador_id"    TEXT NOT NULL,
  "origem"          TEXT NOT NULL,
  "nota"            DOUBLE PRECISION,
  "pontos_fortes"   TEXT,
  "pontos_melhoria" TEXT,
  "comentarios"     TEXT,
  "status"          TEXT NOT NULL DEFAULT 'CONVIDADO',
  "respondido_em"   TIMESTAMP(3),
  "criado_em"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "criado_por_id"   TEXT,
  "atualizado_em"   TIMESTAMP(3) NOT NULL,
  CONSTRAINT "performance_review_inputs_pkey" PRIMARY KEY ("id")
);

-- Um convite por pessoa por ciclo: convidar duas vezes daria dois pesos à
-- mesma opinião.
CREATE UNIQUE INDEX IF NOT EXISTS "performance_review_inputs_review_avaliador_key"
  ON "performance_review_inputs" ("review_id", "avaliador_id");

CREATE INDEX IF NOT EXISTS "performance_review_inputs_org_status_idx"
  ON "performance_review_inputs" ("organization_id", "status");

-- As FKs vão como NOT VALID: a base de produção tem linhas com integridade
-- quebrada apesar das constraints, e uma validação em tabela grande segura a
-- migration com lock. Aqui a tabela nasce vazia, então NOT VALID não muda
-- nada hoje — é consistência com o resto do schema, e evita a surpresa se
-- alguém copiar este arquivo como modelo.
ALTER TABLE "performance_review_inputs"
  ADD CONSTRAINT "performance_review_inputs_organization_id_fkey"
  FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE NOT VALID;

ALTER TABLE "performance_review_inputs"
  ADD CONSTRAINT "performance_review_inputs_review_id_fkey"
  FOREIGN KEY ("review_id") REFERENCES "performance_reviews"("id") ON DELETE CASCADE NOT VALID;

ALTER TABLE "performance_review_inputs"
  ADD CONSTRAINT "performance_review_inputs_avaliador_id_fkey"
  FOREIGN KEY ("avaliador_id") REFERENCES "collaborators"("id") ON DELETE CASCADE NOT VALID;
