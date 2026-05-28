-- ─────────────────────────────────────────────────────────────────────────────
-- Seed: 5 usuarios de teste na org Default para popular o seletor de membros
-- Senha temporaria: OrkiestriTest2026! (todos exigem troca no primeiro acesso)
-- Idempotente: ON CONFLICT(organization_id, email) DO NOTHING
-- ─────────────────────────────────────────────────────────────────────────────

INSERT INTO users (id, nome, email, senha_hash, ativo, organization_id, primeiro_acesso, bloqueado, tentativas_falhas, criado_em, atualizado_em)
VALUES
  (gen_random_uuid()::text, 'Ana Costa',         'ana.costa@orkiestri.local',        '$2a$10$wV1wEyDoF.B2nCVDBf5w3es1BPUJtTdPmya6pUuRiVsnbMTXU9TMa', true, '00000000-0000-0000-0000-000000000001', true, false, 0, NOW(), NOW()),
  (gen_random_uuid()::text, 'Carlos Souza',      'carlos.souza@orkiestri.local',     '$2a$10$wV1wEyDoF.B2nCVDBf5w3es1BPUJtTdPmya6pUuRiVsnbMTXU9TMa', true, '00000000-0000-0000-0000-000000000001', true, false, 0, NOW(), NOW()),
  (gen_random_uuid()::text, 'Beatriz Lima',      'beatriz.lima@orkiestri.local',     '$2a$10$wV1wEyDoF.B2nCVDBf5w3es1BPUJtTdPmya6pUuRiVsnbMTXU9TMa', true, '00000000-0000-0000-0000-000000000001', true, false, 0, NOW(), NOW()),
  (gen_random_uuid()::text, 'Diego Pereira',     'diego.pereira@orkiestri.local',    '$2a$10$wV1wEyDoF.B2nCVDBf5w3es1BPUJtTdPmya6pUuRiVsnbMTXU9TMa', true, '00000000-0000-0000-0000-000000000001', true, false, 0, NOW(), NOW()),
  (gen_random_uuid()::text, 'Fernanda Alves',    'fernanda.alves@orkiestri.local',   '$2a$10$wV1wEyDoF.B2nCVDBf5w3es1BPUJtTdPmya6pUuRiVsnbMTXU9TMa', true, '00000000-0000-0000-0000-000000000001', true, false, 0, NOW(), NOW())
ON CONFLICT (organization_id, email) DO NOTHING;

SELECT nome, email, ativo
  FROM users
  WHERE organization_id = '00000000-0000-0000-0000-000000000001'
  ORDER BY nome;
