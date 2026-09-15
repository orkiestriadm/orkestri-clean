-- Lembrete da agenda: um aviso só, 15 minutos antes (pedido de 15/09/2026).
-- As regras continuam editáveis pela tela; aqui só muda o ponto de partida.

-- Quem tinha regras mas nenhuma de 15 minutos ganha uma.
INSERT INTO "alert_configs" ("id", "organization_id", "minutos", "ativo", "emoji", "titulo", "mensagem", "criado_em", "atualizado_em")
SELECT gen_random_uuid()::text, o."organization_id", 15, true, '⏰', 'Lembrete — 15 minutos',
       E'Seu compromisso começa em 15 minutos:\n\n📅 *{evento}*\n🕐 {horario}\n\n🔗 {url}', NOW(), NOW()
FROM (SELECT DISTINCT "organization_id" FROM "alert_configs") o
WHERE NOT EXISTS (SELECT 1 FROM "alert_configs" c WHERE c."organization_id" = o."organization_id" AND c."minutos" = 15);

UPDATE "alert_configs" SET "ativo" = ("minutos" = 15), "atualizado_em" = NOW();

-- Os textos gravados tinham emoji corrompido ("☺" no lugar do original) e
-- nenhum acento. Reescreve os conhecidos; outro minuto fica como está.
UPDATE "alert_configs" SET "emoji" = '🔔', "titulo" = 'Lembrete — 1 hora',
  "mensagem" = E'Seu compromisso começa em 1 hora:\n\n📅 *{evento}*\n🕐 {horario}\n\n🔗 {url}' WHERE "minutos" = 60;
UPDATE "alert_configs" SET "emoji" = '⏰', "titulo" = 'Lembrete — 30 minutos',
  "mensagem" = E'Seu compromisso começa em 30 minutos:\n\n📅 *{evento}*\n🕐 {horario}\n\n🔗 {url}' WHERE "minutos" = 30;
UPDATE "alert_configs" SET "emoji" = '⏰', "titulo" = 'Lembrete — 15 minutos',
  "mensagem" = E'Seu compromisso começa em 15 minutos:\n\n📅 *{evento}*\n🕐 {horario}\n\n🔗 {url}' WHERE "minutos" = 15;
UPDATE "alert_configs" SET "emoji" = '⚠️', "titulo" = 'Faltam 5 minutos',
  "mensagem" = E'Faltam 5 minutos para o seu compromisso:\n\n📅 *{evento}*\n🕐 {horario}\n\n🔗 {url}' WHERE "minutos" = 5;
UPDATE "alert_configs" SET "emoji" = '🚨', "titulo" = 'Começando agora',
  "mensagem" = E'Seu compromisso está começando agora:\n\n📅 *{evento}*\n\n🔗 {url}' WHERE "minutos" = 0;
