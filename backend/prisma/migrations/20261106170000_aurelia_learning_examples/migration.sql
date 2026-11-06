CREATE TABLE "aurelia_learning_examples" (
  "id" TEXT NOT NULL,
  "organization_id" TEXT NOT NULL,
  "user_id" TEXT,
  "entrada" TEXT NOT NULL,
  "intencao" TEXT NOT NULL DEFAULT 'DESCONHECIDA',
  "resposta" TEXT NOT NULL DEFAULT '',
  "status" TEXT NOT NULL DEFAULT 'PENDENTE',
  "criado_em" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "revisado_em" TIMESTAMPTZ(6),
  CONSTRAINT "aurelia_learning_examples_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "aurelia_learning_examples_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "aurelia_learning_examples_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE
);
CREATE INDEX "aurelia_learning_review_idx" ON "aurelia_learning_examples"("organization_id", "status", "criado_em");
