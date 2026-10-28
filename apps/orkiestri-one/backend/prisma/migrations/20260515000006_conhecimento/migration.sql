-- Sprint 2.1: Base de Conhecimento — categories + articles tables

CREATE TABLE IF NOT EXISTS categorias_conhecimento (
  id        TEXT PRIMARY KEY,
  nome      TEXT NOT NULL UNIQUE,
  descricao TEXT,
  icone     TEXT NOT NULL DEFAULT 'book',
  cor       TEXT NOT NULL DEFAULT '#7c3aed',
  ordem     INT  NOT NULL DEFAULT 0,
  ativo     BOOLEAN NOT NULL DEFAULT true,
  criado_em TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS artigos_conhecimento (
  id             TEXT PRIMARY KEY,
  titulo         TEXT NOT NULL,
  slug           TEXT NOT NULL UNIQUE,
  resumo         TEXT,
  conteudo       TEXT NOT NULL DEFAULT '',
  status         TEXT NOT NULL DEFAULT 'rascunho',
  categoria_id   TEXT REFERENCES categorias_conhecimento(id) ON DELETE SET NULL,
  tags           TEXT[] NOT NULL DEFAULT '{}',
  visualizacoes  INT NOT NULL DEFAULT 0,
  autor_id       TEXT NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  publicado_em   TIMESTAMPTZ,
  criado_em      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  atualizado_em  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_artigos_status      ON artigos_conhecimento(status);
CREATE INDEX IF NOT EXISTS idx_artigos_categoria   ON artigos_conhecimento(categoria_id) WHERE categoria_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_artigos_criado_em   ON artigos_conhecimento(criado_em DESC);

-- Seed a few default categories
INSERT INTO categorias_conhecimento (id, nome, descricao, icone, cor, ordem)
VALUES
  (gen_random_uuid(), 'Procedimentos',    'Processos e procedimentos internos',   'clipboard', '#7c3aed', 1),
  (gen_random_uuid(), 'Tutoriais',        'Guias passo a passo',                  'book-open',  '#0891b2', 2),
  (gen_random_uuid(), 'Politicas',        'Politicas e normas da empresa',         'shield',     '#059669', 3),
  (gen_random_uuid(), 'FAQ',              'Perguntas frequentes',                  'help-circle','#d97706', 4),
  (gen_random_uuid(), 'Tecnico',          'Documentacao tecnica',                  'code',       '#dc2626', 5)
ON CONFLICT (nome) DO NOTHING;
