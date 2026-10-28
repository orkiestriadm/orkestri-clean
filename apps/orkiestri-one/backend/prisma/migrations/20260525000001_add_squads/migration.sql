-- CreateTable: squads
CREATE TABLE "squads" (
  "id"              TEXT NOT NULL,
  "organization_id" TEXT NOT NULL,
  "nome"            TEXT NOT NULL,
  "descricao"       TEXT,
  "cor"             TEXT,
  "lider_id"        TEXT,
  "ativo"           BOOLEAN NOT NULL DEFAULT true,
  "criado_em"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "atualizado_em"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "squads_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "squads_organization_id_nome_key" ON "squads"("organization_id", "nome");
CREATE INDEX "squads_organization_id_idx" ON "squads"("organization_id");

ALTER TABLE "squads" ADD CONSTRAINT "squads_organization_id_fkey"
  FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "squads" ADD CONSTRAINT "squads_lider_id_fkey"
  FOREIGN KEY ("lider_id") REFERENCES "collaborators"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- CreateTable: squad_members
CREATE TABLE "squad_members" (
  "id"               TEXT NOT NULL,
  "squad_id"         TEXT NOT NULL,
  "collaborator_id"  TEXT NOT NULL,
  "alocacao_percent" INTEGER NOT NULL DEFAULT 100,
  "papel"            TEXT NOT NULL DEFAULT 'membro',
  "criado_em"        TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "squad_members_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "squad_members_squad_id_collaborator_id_key" ON "squad_members"("squad_id", "collaborator_id");
CREATE INDEX "squad_members_squad_id_idx" ON "squad_members"("squad_id");
CREATE INDEX "squad_members_collaborator_id_idx" ON "squad_members"("collaborator_id");

ALTER TABLE "squad_members" ADD CONSTRAINT "squad_members_squad_id_fkey"
  FOREIGN KEY ("squad_id") REFERENCES "squads"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "squad_members" ADD CONSTRAINT "squad_members_collaborator_id_fkey"
  FOREIGN KEY ("collaborator_id") REFERENCES "collaborators"("id") ON DELETE CASCADE ON UPDATE CASCADE;
