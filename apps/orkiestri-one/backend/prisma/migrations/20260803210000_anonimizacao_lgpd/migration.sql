-- Anonimização de ex-colaborador (LGPD art. 15 e 16).
--
-- Uma coluna só, anulável: marca QUANDO o cadastro foi anonimizado. Nula é o
-- estado normal, então a migration não toca em nenhuma linha existente e não
-- há janela de indisponibilidade.
--
-- Separada de `excluido_em` de propósito. Soft delete é "sumiu das telas" e é
-- reversível; anonimização é "o dado pessoal não existe mais" e não tem volta.
-- Uma coluna só para os dois estados obrigaria a adivinhar qual deles ocorreu.
ALTER TABLE "collaborators" ADD COLUMN IF NOT EXISTS "anonimizado_em" TIMESTAMP(3);

-- Consulta do painel: quem já passou do prazo de guarda. O índice parcial
-- cobre exatamente essa pergunta e não pesa nas linhas de quem está na ativa,
-- que são a maioria.
CREATE INDEX IF NOT EXISTS "collaborators_anonimizacao_idx"
  ON "collaborators" ("organization_id", "data_desligamento")
  WHERE "anonimizado_em" IS NULL AND "status" = 'DESLIGADO';
