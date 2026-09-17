-- Processos e Capacidade ganham permissão própria (pedido de 17/09/2026).
-- Até aqui o menu mostrava os dois para quem tinha `projetos:ver`, e a API nem
-- checava permissão. Dar acesso "só a Projetos" trazia o Quality junto.
--
-- Esta migration só preserva o acesso de quem já via: cada papel ou concessão
-- direta em `projetos:*` ganha o equivalente. O seed do boot cria o catálogo,
-- mas roda DEPOIS das migrations, por isso as permissões são criadas aqui.

INSERT INTO "permissions" ("id", "recurso", "acao", "descricao", "criado_em") VALUES
  (gen_random_uuid()::text, 'processos',  'ver',    'Ver modelos de processo (Quality)',           NOW()),
  (gen_random_uuid()::text, 'processos',  'editar', 'Criar, editar e excluir modelos de processo', NOW()),
  (gen_random_uuid()::text, 'capacidade', 'ver',    'Ver capacidade e carga de trabalho da equipe', NOW())
ON CONFLICT ("recurso", "acao") DO NOTHING;

-- projetos:ver → processos:ver + capacidade:ver ; projetos:editar → processos:editar
CREATE TEMP TABLE "_mapa_perm" AS
SELECT o."id" AS "origem", d."id" AS "destino"
FROM (VALUES ('projetos','ver','processos','ver'),
             ('projetos','ver','capacidade','ver'),
             ('projetos','editar','processos','editar')) m(ro, ao, rd, ad)
JOIN "permissions" o ON o."recurso" = m.ro AND o."acao" = m.ao
JOIN "permissions" d ON d."recurso" = m.rd AND d."acao" = m.ad;

INSERT INTO "role_permissions" ("role_id", "permission_id")
SELECT rp."role_id", mp."destino"
FROM "role_permissions" rp
JOIN "_mapa_perm" mp ON mp."origem" = rp."permission_id"
ON CONFLICT DO NOTHING;

-- Overrides por usuário seguem o mesmo sentido (concessão ou revogação), para
-- que ninguém passe a ver ou deixe de ver o que via ontem.
INSERT INTO "user_permission_overrides" ("id", "user_id", "permission_id", "conceder", "criado_em")
SELECT gen_random_uuid()::text, o."user_id", mp."destino", o."conceder", NOW()
FROM "user_permission_overrides" o
JOIN "_mapa_perm" mp ON mp."origem" = o."permission_id"
ON CONFLICT ("user_id", "permission_id") DO NOTHING;

DROP TABLE "_mapa_perm";
