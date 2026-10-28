-- Converte TODAS as foreign keys de organization_id para ON DELETE CASCADE.
-- Permite excluir uma organização e remover automaticamente todo o tenant
-- (usuários, clientes, chamados, colaboradores, skills, ausências, workflows, squads, etc).
-- Dinâmico: pega cada FK que referencia organizations via coluna organization_id.
DO $$
DECLARE r RECORD;
BEGIN
  FOR r IN
    SELECT tc.table_name, tc.constraint_name
    FROM information_schema.table_constraints tc
    JOIN information_schema.key_column_usage kcu
      ON tc.constraint_name = kcu.constraint_name
     AND tc.constraint_schema = kcu.constraint_schema
    WHERE tc.constraint_type = 'FOREIGN KEY'
      AND tc.constraint_schema = 'public'
      AND kcu.column_name = 'organization_id'
  LOOP
    EXECUTE format('ALTER TABLE %I DROP CONSTRAINT %I', r.table_name, r.constraint_name);
    EXECUTE format(
      'ALTER TABLE %I ADD CONSTRAINT %I FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE ON UPDATE CASCADE',
      r.table_name, r.constraint_name
    );
  END LOOP;
END $$;
