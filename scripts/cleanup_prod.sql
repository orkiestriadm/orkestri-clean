BEGIN;

-- =====================================================
-- LIMPEZA PRODUÇÃO — mantém só administrator@orkiestri.com
-- =====================================================

SET session_replication_role = replica;

-- 1. DELETA ORG MELLO
DELETE FROM billing_payments WHERE org_billing_id IN (SELECT id FROM org_billing WHERE organization_id = '717a6bc1-eb24-49df-9c22-64ca260ea3ae');
DELETE FROM org_billing WHERE organization_id = '717a6bc1-eb24-49df-9c22-64ca260ea3ae';
DELETE FROM org_whatsapp_configs WHERE organization_id = '717a6bc1-eb24-49df-9c22-64ca260ea3ae';
DELETE FROM users WHERE organization_id = '717a6bc1-eb24-49df-9c22-64ca260ea3ae';
DELETE FROM organizations WHERE id = '717a6bc1-eb24-49df-9c22-64ca260ea3ae';

-- 2. LIMPA DADOS OPERACIONAIS da org Default

-- Chamados
DELETE FROM chamado_auditoria WHERE chamado_id IN (SELECT id FROM chamados WHERE organization_id = '00000000-0000-0000-0000-000000000001');
DELETE FROM chamado_comentarios WHERE chamado_id IN (SELECT id FROM chamados WHERE organization_id = '00000000-0000-0000-0000-000000000001');
DELETE FROM chamados WHERE organization_id = '00000000-0000-0000-0000-000000000001';

-- Projetos (task_comments e project_members cascadeiam das tasks/projects)
DELETE FROM task_comments WHERE task_id IN (SELECT t.id FROM tasks t JOIN projects p ON t.project_id = p.id WHERE p.organization_id = '00000000-0000-0000-0000-000000000001');
DELETE FROM tasks WHERE project_id IN (SELECT id FROM projects WHERE organization_id = '00000000-0000-0000-0000-000000000001');
DELETE FROM milestones WHERE project_id IN (SELECT id FROM projects WHERE organization_id = '00000000-0000-0000-0000-000000000001');
DELETE FROM project_members WHERE project_id IN (SELECT id FROM projects WHERE organization_id = '00000000-0000-0000-0000-000000000001');
DELETE FROM projects WHERE organization_id = '00000000-0000-0000-0000-000000000001';

-- Ativos
DELETE FROM transferencias_ativo WHERE ativo_id IN (SELECT id FROM ativos WHERE organization_id = '00000000-0000-0000-0000-000000000001');
DELETE FROM ativos WHERE organization_id = '00000000-0000-0000-0000-000000000001';
DELETE FROM categorias_ativo WHERE organization_id = '00000000-0000-0000-0000-000000000001';

-- Agenda e notas
DELETE FROM event_participants WHERE event_id IN (SELECT id FROM events WHERE organization_id = '00000000-0000-0000-0000-000000000001');
DELETE FROM events WHERE organization_id = '00000000-0000-0000-0000-000000000001';
DELETE FROM note_collaborators WHERE note_id IN (SELECT id FROM notes WHERE organization_id = '00000000-0000-0000-0000-000000000001');
DELETE FROM note_label_map WHERE note_id IN (SELECT id FROM notes WHERE organization_id = '00000000-0000-0000-0000-000000000001');
DELETE FROM notes WHERE organization_id = '00000000-0000-0000-0000-000000000001';
DELETE FROM note_labels WHERE organization_id = '00000000-0000-0000-0000-000000000001';
DELETE FROM daily_tasks WHERE user_id IN (SELECT id FROM users WHERE organization_id = '00000000-0000-0000-0000-000000000001');

-- Horas
DELETE FROM apontamentos_horas WHERE organization_id = '00000000-0000-0000-0000-000000000001';

-- CRM / Contratos / Faturas
DELETE FROM cliente_timeline WHERE cliente_id IN (SELECT id FROM clientes WHERE organization_id = '00000000-0000-0000-0000-000000000001');
DELETE FROM clientes WHERE organization_id = '00000000-0000-0000-0000-000000000001';
DELETE FROM contrato_anexos WHERE contrato_id IN (SELECT id FROM contratos WHERE organization_id = '00000000-0000-0000-0000-000000000001');
DELETE FROM contratos WHERE organization_id = '00000000-0000-0000-0000-000000000001';
DELETE FROM faturas WHERE organization_id = '00000000-0000-0000-0000-000000000001';

-- Conhecimento
DELETE FROM artigos_conhecimento WHERE organization_id = '00000000-0000-0000-0000-000000000001';
DELETE FROM categorias_conhecimento WHERE organization_id = '00000000-0000-0000-0000-000000000001';

-- Fornecedores/Suppliers
DELETE FROM supplier_contacts WHERE supplier_id IN (SELECT id FROM suppliers WHERE organization_id = '00000000-0000-0000-0000-000000000001');
DELETE FROM supplier_documents WHERE supplier_id IN (SELECT id FROM suppliers WHERE organization_id = '00000000-0000-0000-0000-000000000001');
DELETE FROM supplier_history WHERE supplier_id IN (SELECT id FROM suppliers WHERE organization_id = '00000000-0000-0000-0000-000000000001');
DELETE FROM suppliers WHERE organization_id = '00000000-0000-0000-0000-000000000001';

-- Orcamento
DELETE FROM aprovacoes_orcamento WHERE item_id IN (SELECT i.id FROM itens_orcamento i JOIN orcamento_ciclos c ON i.ciclo_id = c.id WHERE c.organization_id = '00000000-0000-0000-0000-000000000001');
DELETE FROM orcamento_timeline WHERE item_id IN (SELECT i.id FROM itens_orcamento i JOIN orcamento_ciclos c ON i.ciclo_id = c.id WHERE c.organization_id = '00000000-0000-0000-0000-000000000001');
DELETE FROM itens_orcamento_mes WHERE item_id IN (SELECT i.id FROM itens_orcamento i JOIN orcamento_ciclos c ON i.ciclo_id = c.id WHERE c.organization_id = '00000000-0000-0000-0000-000000000001');
DELETE FROM itens_orcamento WHERE ciclo_id IN (SELECT id FROM orcamento_ciclos WHERE organization_id = '00000000-0000-0000-0000-000000000001');
DELETE FROM orcamento_ciclos WHERE organization_id = '00000000-0000-0000-0000-000000000001';
DELETE FROM categorias_orcamento WHERE organization_id = '00000000-0000-0000-0000-000000000001';
DELETE FROM centros_custo WHERE organization_id = '00000000-0000-0000-0000-000000000001';
DELETE FROM fornecedores_orcamento WHERE organization_id = '00000000-0000-0000-0000-000000000001';

-- Automacoes e SLA
DELETE FROM automacao_execucoes WHERE automacao_id IN (SELECT id FROM automacoes WHERE organization_id = '00000000-0000-0000-0000-000000000001');
DELETE FROM automacoes WHERE organization_id = '00000000-0000-0000-0000-000000000001';
DELETE FROM sla_regras WHERE organization_id = '00000000-0000-0000-0000-000000000001';

-- Workforce
DELETE FROM squad_members WHERE squad_id IN (SELECT id FROM squads WHERE organization_id = '00000000-0000-0000-0000-000000000001');
DELETE FROM squads WHERE organization_id = '00000000-0000-0000-0000-000000000001';
DELETE FROM aprovadores_setor WHERE organization_id = '00000000-0000-0000-0000-000000000001';
DELETE FROM setores WHERE organization_id = '00000000-0000-0000-0000-000000000001';
DELETE FROM ausencias WHERE organization_id = '00000000-0000-0000-0000-000000000001';
DELETE FROM collaborator_skills WHERE collaborator_id IN (SELECT id FROM collaborators WHERE organization_id = '00000000-0000-0000-0000-000000000001');
DELETE FROM collaborators WHERE organization_id = '00000000-0000-0000-0000-000000000001';
DELETE FROM skills WHERE organization_id = '00000000-0000-0000-0000-000000000001';

-- Workflows
DELETE FROM workflow_approvals WHERE request_id IN (SELECT id FROM workflow_requests WHERE organization_id = '00000000-0000-0000-0000-000000000001');
DELETE FROM workflow_requests WHERE organization_id = '00000000-0000-0000-0000-000000000001';

-- Audit / Notificacoes / Sessions / Alerts
DELETE FROM audit_log WHERE organization_id = '00000000-0000-0000-0000-000000000001';
DELETE FROM notifications WHERE user_id IN (SELECT id FROM users WHERE organization_id = '00000000-0000-0000-0000-000000000001');
DELETE FROM alert_configs WHERE organization_id = '00000000-0000-0000-0000-000000000001';

-- Usuarios de teste (mantém so administrator@orkiestri.com)
DELETE FROM user_sessions WHERE user_id IN (SELECT id FROM users WHERE organization_id = '00000000-0000-0000-0000-000000000001' AND email != 'administrator@orkiestri.com');
DELETE FROM user_roles WHERE user_id IN (SELECT id FROM users WHERE organization_id = '00000000-0000-0000-0000-000000000001' AND email != 'administrator@orkiestri.com');
DELETE FROM user_permission_overrides WHERE user_id IN (SELECT id FROM users WHERE organization_id = '00000000-0000-0000-0000-000000000001' AND email != 'administrator@orkiestri.com');
DELETE FROM user_profiles WHERE user_id IN (SELECT id FROM users WHERE organization_id = '00000000-0000-0000-0000-000000000001' AND email != 'administrator@orkiestri.com');
DELETE FROM user_requests WHERE organization_id = '00000000-0000-0000-0000-000000000001';
DELETE FROM password_reset_otps WHERE user_id IN (SELECT id FROM users WHERE organization_id = '00000000-0000-0000-0000-000000000001' AND email != 'administrator@orkiestri.com');
DELETE FROM users WHERE organization_id = '00000000-0000-0000-0000-000000000001' AND email != 'administrator@orkiestri.com';

-- Cadastros e signup sessions de teste
DELETE FROM cadastro_requests;
DELETE FROM billing_signup_sessions;

-- Sessoes do administrator tambem limpas (forca novo login)
DELETE FROM user_sessions WHERE user_id IN (SELECT id FROM users WHERE email = 'administrator@orkiestri.com');

-- Re-habilita FK
SET session_replication_role = DEFAULT;

-- 3. ATUALIZA SENHA DO ADMINISTRATOR
UPDATE users
SET senha_hash = '$2a$12$IeigPf84J6/A5cwpcGJQTOqsvQcC4Cx4O9HbVTUeZi4chGj4hx6Im',
    primeiro_acesso = false,
    tentativas_falhas = 0,
    bloqueado = false,
    ultimo_login = NULL
WHERE email = 'administrator@orkiestri.com';

COMMIT;

-- Verificação final
SELECT 'ORGANIZACOES:' as check; SELECT id, nome FROM organizations;
SELECT 'USUARIOS:' as check; SELECT email, nome FROM users;
