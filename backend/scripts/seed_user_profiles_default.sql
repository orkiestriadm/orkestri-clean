-- ─────────────────────────────────────────────────────────────────────────────
-- Vincula os 5 usuarios fake da org Default a setores via UserProfile.
-- Sem configurar a matriz aprovadores_setor — isso fica pro user testar na UI.
-- Idempotente: ON CONFLICT(user_id) DO UPDATE.
-- ─────────────────────────────────────────────────────────────────────────────
\set ON_ERROR_STOP on

DO $$
DECLARE
  v_org      TEXT := '00000000-0000-0000-0000-000000000001';
  v_ti       TEXT;
  v_op       TEXT;
  v_fin      TEXT;
  v_admin    TEXT;
  v_carlos   TEXT;
  v_diego    TEXT;
  v_ana      TEXT;
  v_fernanda TEXT;
  v_beatriz  TEXT;
BEGIN
  -- Resolve setores
  SELECT id INTO v_ti    FROM setores WHERE organization_id = v_org AND nome = 'Tecnologia da Informação';
  SELECT id INTO v_op    FROM setores WHERE organization_id = v_org AND nome = 'Operações';
  SELECT id INTO v_fin   FROM setores WHERE organization_id = v_org AND nome = 'Financeiro';
  SELECT id INTO v_admin FROM setores WHERE organization_id = v_org AND nome = 'Administrativo';
  IF v_ti IS NULL OR v_op IS NULL OR v_fin IS NULL THEN
    RAISE EXCEPTION 'Setores TI/Operacoes/Financeiro nao encontrados — confira nomes';
  END IF;

  -- Resolve users fake
  SELECT id INTO v_ana      FROM users WHERE email = 'ana.costa@orkiestri.local';
  SELECT id INTO v_carlos   FROM users WHERE email = 'carlos.souza@orkiestri.local';
  SELECT id INTO v_beatriz  FROM users WHERE email = 'beatriz.lima@orkiestri.local';
  SELECT id INTO v_diego    FROM users WHERE email = 'diego.pereira@orkiestri.local';
  SELECT id INTO v_fernanda FROM users WHERE email = 'fernanda.alves@orkiestri.local';

  -- Mapeamento:
  --   TI:         Carlos + Diego
  --   Operacoes:  Ana + Fernanda
  --   Financeiro: Beatriz
  -- UserProfile tem user_id UNIQUE — usar ON CONFLICT pra reidempotencia
  INSERT INTO user_profiles (id, user_id, setor_id, cargo, whatsapp_alertas, status_online, criado_em, modulos)
  VALUES
    (gen_random_uuid()::text, v_carlos,   v_ti,  'Analista de Suporte', false, 'disponivel', NOW(), '["projetos","keep","gantt","relatorios"]'),
    (gen_random_uuid()::text, v_diego,    v_ti,  'Desenvolvedor',       false, 'disponivel', NOW(), '["projetos","keep","gantt","relatorios"]'),
    (gen_random_uuid()::text, v_ana,      v_op,  'Atendente',           false, 'disponivel', NOW(), '["projetos","keep","gantt","relatorios"]'),
    (gen_random_uuid()::text, v_fernanda, v_op,  'Designer',            false, 'disponivel', NOW(), '["projetos","keep","gantt","relatorios"]'),
    (gen_random_uuid()::text, v_beatriz,  v_fin, 'Gerente',             false, 'disponivel', NOW(), '["projetos","keep","gantt","relatorios"]')
  ON CONFLICT (user_id) DO UPDATE
    SET setor_id = EXCLUDED.setor_id,
        cargo    = EXCLUDED.cargo;

  RAISE NOTICE 'UserProfiles vinculados aos setores TI / Operacoes / Financeiro.';
END $$;

SELECT u.nome AS usuario, s.nome AS setor, p.cargo
  FROM users u
  JOIN user_profiles p ON p.user_id = u.id
  LEFT JOIN setores s ON s.id = p.setor_id
  WHERE u.email LIKE '%@orkiestri.local'
  ORDER BY s.nome, u.nome;
