-- Acesso de teste (trial de 7 dias) criado pela landing page.
-- Aditivo, com defaults: as contas existentes nascem como não-trial.
ALTER TABLE "users" ADD COLUMN "is_trial" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "users" ADD COLUMN "trial_expira_em" TIMESTAMP(3);
ALTER TABLE "users" ADD COLUMN "trial_modulo" TEXT;
ALTER TABLE "users" ADD COLUMN "trial_avisado_suporte" BOOLEAN NOT NULL DEFAULT false;
