-- People › Avaliação de Desempenho › Feedback (pedido do RH, 17/09/2026).
--
-- Tabelas NOVAS, nenhuma coluna alterada: o feedback contínuo
-- (performance_feedbacks) segue exatamente como estava. Este é o registro
-- formal — registro, reunião, ciência e encerramento — que vai se ligar ao
-- modelo de avaliação de desempenho.
--
-- As permissões `people.feedback_desempenho:*` NÃO entram aqui: nenhuma
-- concessão existente precisa ser copiada, e o seed do boot cria o catálogo e
-- as dá aos papéis padrão (administrador e gestor).

CREATE TABLE IF NOT EXISTS "feedbacks_desempenho" (
  "id"                      TEXT NOT NULL,
  "organization_id"         TEXT NOT NULL,
  "collaborator_id"         TEXT NOT NULL,
  "gestor_id"               TEXT NOT NULL,
  "status"                  TEXT NOT NULL DEFAULT 'REGISTRADO',
  "pontos_fortes"           TEXT NOT NULL,
  "oportunidades"           TEXT NOT NULL,
  "reuniao_inicio"          TIMESTAMP(3),
  "reuniao_local"           TEXT,
  "reuniao_realizada_em"    TIMESTAMP(3),
  "alinhamentos"            TEXT,
  "ciencia_em"              TIMESTAMP(3),
  "comentario_colaborador"  TEXT,
  "exclusao_status"         TEXT,
  "exclusao_motivo"         TEXT,
  "exclusao_solicitada_por" TEXT,
  "exclusao_solicitada_em"  TIMESTAMP(3),
  "exclusao_decidida_por"   TEXT,
  "exclusao_decidida_em"    TIMESTAMP(3),
  "exclusao_parecer"        TEXT,
  "excluido_em"             TIMESTAMP(3),
  "criado_em"               TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "criado_por_id"           TEXT,
  "atualizado_em"           TIMESTAMP(3) NOT NULL,
  CONSTRAINT "feedbacks_desempenho_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "feedbacks_desempenho_organization_id_status_idx"
  ON "feedbacks_desempenho" ("organization_id", "status");
CREATE INDEX IF NOT EXISTS "feedbacks_desempenho_collaborator_id_idx"
  ON "feedbacks_desempenho" ("collaborator_id");
CREATE INDEX IF NOT EXISTS "feedbacks_desempenho_gestor_id_idx"
  ON "feedbacks_desempenho" ("gestor_id");

-- Linha do tempo: só recebe INSERT.
CREATE TABLE IF NOT EXISTS "feedbacks_desempenho_eventos" (
  "id"          TEXT NOT NULL,
  "feedback_id" TEXT NOT NULL,
  "tipo"        TEXT NOT NULL,
  "user_id"     TEXT,
  "autor_nome"  TEXT,
  "detalhe"     TEXT,
  "criado_em"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "feedbacks_desempenho_eventos_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "feedbacks_desempenho_eventos_feedback_id_criado_em_idx"
  ON "feedbacks_desempenho_eventos" ("feedback_id", "criado_em");

-- NOT VALID por consistência com o resto do schema (ver 20260803230000):
-- as tabelas nascem vazias, então não muda nada hoje.
ALTER TABLE "feedbacks_desempenho"
  ADD CONSTRAINT "feedbacks_desempenho_organization_id_fkey"
  FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE NOT VALID;

ALTER TABLE "feedbacks_desempenho"
  ADD CONSTRAINT "feedbacks_desempenho_collaborator_id_fkey"
  FOREIGN KEY ("collaborator_id") REFERENCES "collaborators"("id") ON DELETE CASCADE NOT VALID;

ALTER TABLE "feedbacks_desempenho"
  ADD CONSTRAINT "feedbacks_desempenho_gestor_id_fkey"
  FOREIGN KEY ("gestor_id") REFERENCES "collaborators"("id") ON DELETE CASCADE NOT VALID;

ALTER TABLE "feedbacks_desempenho_eventos"
  ADD CONSTRAINT "feedbacks_desempenho_eventos_feedback_id_fkey"
  FOREIGN KEY ("feedback_id") REFERENCES "feedbacks_desempenho"("id") ON DELETE CASCADE NOT VALID;
