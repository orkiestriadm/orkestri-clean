-- People é do RH (decisão do usuário, 18/09/2026).
--
-- Só o administrador e os papéis de RH ficam com o People. Meu RH e o Feedback
-- de desempenho passam a acompanhar TODA conta pelas permissões base
-- (auth.service.ts, BASE_PERMISSIONS), e por isso saem dos papéis também —
-- ficar no papel não faz diferença e confundiria quem lê a matriz.
--
-- Por que migration: a semente do boot só ADICIONA permissões aos papéis
-- padrão, nunca remove. Sem isto, gestor, supervisor, visualizador e auditor
-- continuariam com o People que ganharam antes.
--
-- Alcance, deliberadamente estreito:
--   - só os PAPÉIS PADRÃO do sistema, pelo nome;
--   - papéis personalizados (ex.: "Gestor de RH") e concessões diretas por
--     usuário NÃO são tocados — são escolha do administrador de cada cliente;
--   - administrador e master não são tocados.
--
-- `colaboradores:*` sai junto: é a permissão antiga que concede o People por
-- alias, e deixá-la devolveria o menu Colaboradores pela porta dos fundos.

DELETE FROM "role_permissions" rp
USING "roles" r, "permissions" p
WHERE rp."role_id" = r."id"
  AND rp."permission_id" = p."id"
  AND r."nome" IN ('gestor', 'supervisor', 'visualizador', 'auditor', 'analista', 'tecnico', 'operador', 'cliente_portal')
  AND (p."recurso" = 'colaboradores' OR p."recurso" LIKE 'people.%');
