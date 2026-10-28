ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS modulos text NOT NULL DEFAULT '["projetos","keep","gantt","relatorios"]';
