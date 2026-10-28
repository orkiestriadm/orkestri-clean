-- RBAC: permissions, role_permissions, user_permission_overrides
-- Adiciona campo nivel à tabela roles

ALTER TABLE "roles" ADD COLUMN IF NOT EXISTS "nivel" INTEGER NOT NULL DEFAULT 0;

CREATE TABLE IF NOT EXISTS "permissions" (
  "id"        TEXT NOT NULL,
  "recurso"   TEXT NOT NULL,
  "acao"      TEXT NOT NULL,
  "descricao" TEXT,
  "criado_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "permissions_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "permissions_recurso_acao_key" ON "permissions"("recurso", "acao");

CREATE TABLE IF NOT EXISTS "role_permissions" (
  "role_id"       TEXT NOT NULL,
  "permission_id" TEXT NOT NULL,
  CONSTRAINT "role_permissions_pkey" PRIMARY KEY ("role_id", "permission_id")
);

CREATE TABLE IF NOT EXISTS "user_permission_overrides" (
  "id"            TEXT NOT NULL,
  "user_id"       TEXT NOT NULL,
  "permission_id" TEXT NOT NULL,
  "conceder"      BOOLEAN NOT NULL DEFAULT true,
  "criado_em"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "user_permission_overrides_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "user_permission_overrides_user_id_permission_id_key"
  ON "user_permission_overrides"("user_id", "permission_id");

ALTER TABLE "role_permissions"
  ADD CONSTRAINT "role_permissions_role_id_fkey"
    FOREIGN KEY ("role_id") REFERENCES "roles"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT "role_permissions_permission_id_fkey"
    FOREIGN KEY ("permission_id") REFERENCES "permissions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "user_permission_overrides"
  ADD CONSTRAINT "user_permission_overrides_user_id_fkey"
    FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT "user_permission_overrides_permission_id_fkey"
    FOREIGN KEY ("permission_id") REFERENCES "permissions"("id") ON DELETE CASCADE ON UPDATE CASCADE;
