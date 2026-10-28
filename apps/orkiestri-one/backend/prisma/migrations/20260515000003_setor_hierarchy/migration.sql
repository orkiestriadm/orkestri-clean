-- Sprint 1.5: Estrutura Organizacional — add hierarchy and responsavel to setores

ALTER TABLE setores ADD COLUMN IF NOT EXISTS parent_id TEXT;
ALTER TABLE setores ADD COLUMN IF NOT EXISTS responsavel_id TEXT;

ALTER TABLE setores
  ADD CONSTRAINT fk_setor_parent
  FOREIGN KEY (parent_id) REFERENCES setores(id) ON DELETE SET NULL;

ALTER TABLE setores
  ADD CONSTRAINT fk_setor_responsavel
  FOREIGN KEY (responsavel_id) REFERENCES users(id) ON DELETE SET NULL;
