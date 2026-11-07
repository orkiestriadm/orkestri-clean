CREATE TABLE "personal_reminders" (
  "id" TEXT PRIMARY KEY, "user_id" TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  "organization_id" TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  "titulo" TEXT NOT NULL, "quando" TIMESTAMPTZ NOT NULL, "status" TEXT NOT NULL DEFAULT 'PENDENTE',
  "instancia" TEXT, "origem" TEXT UNIQUE, "enviado_em" TIMESTAMPTZ,
  "criado_em" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP, "atualizado_em" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX personal_reminders_user_id_organization_id_quando_idx ON personal_reminders(user_id, organization_id, quando);
CREATE INDEX personal_reminders_status_quando_idx ON personal_reminders(status, quando);
CREATE TABLE "personal_habits" (
  "id" TEXT PRIMARY KEY, "user_id" TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  "organization_id" TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  "titulo" TEXT NOT NULL, "nome_normalizado" TEXT NOT NULL, "dias" INTEGER NOT NULL DEFAULT 30 CHECK (dias BETWEEN 1 AND 366),
  "inicio" TEXT NOT NULL, "cor" TEXT NOT NULL DEFAULT '#f97316', "arquivado" BOOLEAN NOT NULL DEFAULT false,
  "criado_em" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(user_id, organization_id, nome_normalizado)
);
CREATE TABLE "habit_checkins" (
  "id" TEXT PRIMARY KEY, "habit_id" TEXT NOT NULL REFERENCES personal_habits(id) ON DELETE CASCADE,
  "dia" TEXT NOT NULL, "criado_em" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP, UNIQUE(habit_id, dia)
);
