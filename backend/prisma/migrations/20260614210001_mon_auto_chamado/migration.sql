-- Monitoramento: abertura automatica de chamado quando ativo fica OFFLINE.
ALTER TABLE "mon_asset" ADD COLUMN "abre_chamado_auto" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "mon_asset" ADD COLUMN "chamado_aberto_id" TEXT;
