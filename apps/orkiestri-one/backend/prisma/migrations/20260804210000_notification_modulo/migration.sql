-- ============================================================================
-- Módulo de origem na notificação in-app
--
-- Sem esta coluna o sino não consegue oferecer a mesma separação por módulo que
-- o WhatsApp passou a ter com `notificacao_preferencias`. Nulo nas notificações
-- criadas antes do despachante — não há como inferir o módulo delas
-- retroativamente a partir do `tipo`, e chutar seria pior que deixar vazio.
--
-- ⚠️ POR QUE ESTA MIGRATION EXISTE SEPARADA
--
-- Estas duas linhas foram primeiro ANEXADAS à migration
-- `20260804200000_notificacoes_por_modulo`, que já estava aplicada. O Prisma não
-- re-executa migration marcada como concluída, então o ALTER nunca rodou — mas
-- o `schema.prisma` já declarava o campo e o cliente gerado passou a enviá-lo em
-- todo INSERT.
--
-- Resultado: `notification.create` quebrou no sistema INTEIRO (não só no
-- despachante), com "The column `modulo` does not exist". E como praticamente
-- todos os chamadores usam `.catch(() => {})`, o sino simplesmente parou de
-- registrar sem nenhum erro visível.
--
-- Regra que fica: migration aplicada é imutável. Mudança de schema depois disso
-- exige arquivo novo, sempre.
-- ============================================================================

ALTER TABLE "notifications" ADD COLUMN IF NOT EXISTS "modulo" TEXT;

CREATE INDEX IF NOT EXISTS "notifications_user_id_modulo_idx"
  ON "notifications" ("user_id", "modulo");
