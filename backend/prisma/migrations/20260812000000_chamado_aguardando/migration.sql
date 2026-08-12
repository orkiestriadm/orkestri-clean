-- "Aguardando" e o estado que mais apodrece: o chamado sai do radar porque
-- depende de terceiro, e nada registrava DE QUE nem HA QUANTO TEMPO. Sem esses
-- campos o contador da tela mediria a idade do chamado, nao a da espera.
ALTER TABLE "chamados" ADD COLUMN IF NOT EXISTS "aguardando_motivo" TEXT;
ALTER TABLE "chamados" ADD COLUMN IF NOT EXISTS "aguardando_desde" TIMESTAMP(3);

-- Quem ja esta aguardando ganha a data da ultima movimentacao: melhor
-- aproximacao existente, e melhor que nulo numa coluna que serve para contar
-- tempo.
UPDATE "chamados" SET "aguardando_desde" = "atualizado_em"
WHERE "status" = 'aguardando' AND "aguardando_desde" IS NULL;
