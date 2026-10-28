-- Papeis passam a ser POR ORGANIZACAO.
--
-- Antes: `roles.nome` era unico GLOBALMENTE e a tabela nao tinha
-- organization_id. Duas organizacoes nao conseguiam ter duas linhas "gestor" —
-- compartilhavam a mesma. Um master do cliente A editava as permissoes daquela
-- linha e mudava o que os usuarios do cliente B podiam fazer.
--
-- Esta migration duplica cada papel global para cada organizacao, remapeia os
-- vinculos e so entao aperta as restricoes.
--
-- ORDEM IMPORTA: apertar antes de remapear deixaria user_roles apontando para
-- papel que vai sumir, e o FK aborta a migration inteira.

-- 0. Vinculos usuario→papel apontando para usuario que nao existe mais.
--
--    A base de producao TEM essas linhas — verificado em 11/08/2026: 1 linha,
--    apesar de `user_roles_user_id_fkey` estar marcada como validada. Nao da
--    para remapear o que nao tem dono: o passo 4 junta com `users` para
--    descobrir a organizacao, e sem usuario nao ha organizacao a escolher.
--
--    Elas seriam descartadas de qualquer forma pelo INNER JOIN do passo 4 e
--    apagadas no passo seguinte. Fazer isso aqui, explicito, e a diferenca
--    entre "decidimos remover" e "sumiu por efeito colateral do JOIN".
DELETE FROM "user_roles" ur
WHERE NOT EXISTS (SELECT 1 FROM "users" u WHERE u.id = ur.user_id);

-- 1. Coluna nova, ainda NULL: nenhuma linha existente e invalidada agora.
ALTER TABLE "roles" ADD COLUMN "organization_id" TEXT;

-- 1b. O unico GLOBAL sai AGORA, antes de duplicar.
--
--     Tem que ser aqui e nao no fim: o passo 2 cria uma copia de "master",
--     "gestor" etc. para cada organizacao, e com `roles_nome_key` ainda de pe
--     a segunda copia colide com a primeira. Descoberto rodando esta migration
--     contra uma copia dos dados de producao — a ordem "natural" (apertar
--     restricoes no fim) aborta o deploy no primeiro tenant duplicado.
DROP INDEX IF EXISTS "roles_nome_key";

-- 2. Uma copia de cada papel global para cada organizacao.
--    Papeis que JA tenham organization_id (reexecucao) ficam de fora.
CREATE TEMP TABLE _mapa_papeis (
  papel_antigo TEXT NOT NULL,
  papel_novo   TEXT NOT NULL,
  org_id       TEXT NOT NULL
);

INSERT INTO _mapa_papeis (papel_antigo, papel_novo, org_id)
SELECT r.id, gen_random_uuid()::text, o.id
FROM "roles" r
CROSS JOIN "organizations" o
WHERE r."organization_id" IS NULL;

INSERT INTO "roles" (id, "organization_id", nome, descricao, is_master, nivel, criado_em)
SELECT m.papel_novo, m.org_id, r.nome, r.descricao, r.is_master, r.nivel, r.criado_em
FROM _mapa_papeis m
JOIN "roles" r ON r.id = m.papel_antigo;

-- 3. Permissoes de cada papel, copiadas para a copia correspondente.
INSERT INTO "role_permissions" (role_id, permission_id)
SELECT m.papel_novo, rp.permission_id
FROM _mapa_papeis m
JOIN "role_permissions" rp ON rp.role_id = m.papel_antigo
ON CONFLICT DO NOTHING;

-- 4. Vinculos usuario→papel apontam para a copia da organizacao DO USUARIO.
--    Como (user_id, role_id) e a chave primaria, insere o novo e apaga o velho
--    em vez de atualizar no lugar — um UPDATE colidiria com a PK se o usuario
--    ja tivesse ambos.
INSERT INTO "user_roles" (user_id, role_id, atribuido_por, atribuido_em)
SELECT ur.user_id, m.papel_novo, ur.atribuido_por, ur.atribuido_em
FROM "user_roles" ur
JOIN "users" u       ON u.id = ur.user_id
JOIN _mapa_papeis m  ON m.papel_antigo = ur.role_id AND m.org_id = u."organization_id"
ON CONFLICT DO NOTHING;

DELETE FROM "user_roles" ur
USING _mapa_papeis m
WHERE ur.role_id = m.papel_antigo;

-- 5. Papeis globais originais saem. As permissoes e vinculos deles caem por
--    CASCADE — a essa altura ja foram copiados acima.
DELETE FROM "roles" WHERE "organization_id" IS NULL;

DROP TABLE _mapa_papeis;

-- 6. Se sobrou algum papel sem organizacao (base sem nenhuma organization, o
--    que so acontece em instalacao vazia), nao ha o que apertar: o NOT NULL
--    abaixo falharia. Como o passo 5 apagou todos os orfaos, o caminho esta
--    limpo nos dois casos.
ALTER TABLE "roles" ALTER COLUMN "organization_id" SET NOT NULL;

-- 7. O nome passa a ser unico DENTRO da organizacao. (O unico global ja saiu
--    no passo 1b — precisava sair antes da duplicacao.)
CREATE UNIQUE INDEX "roles_organization_id_nome_key" ON "roles"("organization_id", nome);
CREATE INDEX "roles_organization_id_idx" ON "roles"("organization_id");

-- 8. Integridade referencial com a organizacao.
--    NOT VALID de proposito: a base de producao ja teve linhas com FK quebrada
--    apesar das constraints, e validar o passado aqui arriscaria abortar o
--    deploy. Vale para toda escrita nova, que e o que importa.
ALTER TABLE "roles"
  ADD CONSTRAINT "roles_organization_id_fkey"
  FOREIGN KEY ("organization_id") REFERENCES "organizations"(id)
  ON DELETE CASCADE ON UPDATE CASCADE NOT VALID;
