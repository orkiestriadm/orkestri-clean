-- Baixa da agenda de revisão.
--
-- O botão "Revisão feita" do card da Agenda registra a revisão E encerra a
-- projeção daquele plano sobre aquele veículo: o card sai da tela e fica só o
-- registro. `plano_id` diz QUAL projeção foi encerrada; `encerra_agenda`
-- distingue a baixa do registro comum, que segue reprojetando o próximo ciclo.
--
-- Aditiva e idempotente (o projeto não usa `prisma migrate dev`; o container
-- roda `prisma migrate deploy` no boot).
ALTER TABLE "revisoes_veiculo" ADD COLUMN IF NOT EXISTS "plano_id" TEXT;
ALTER TABLE "revisoes_veiculo" ADD COLUMN IF NOT EXISTS "encerra_agenda" BOOLEAN NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS "revisoes_veiculo_plano_id_idx" ON "revisoes_veiculo" ("plano_id");
CREATE INDEX IF NOT EXISTS "revisoes_veiculo_organization_id_encerra_agenda_idx" ON "revisoes_veiculo" ("organization_id", "encerra_agenda");
