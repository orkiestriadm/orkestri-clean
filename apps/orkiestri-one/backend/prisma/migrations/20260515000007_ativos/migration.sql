-- Sprint 2.2: Gestão de Ativos — categories + assets + transfer history

CREATE TABLE IF NOT EXISTS categorias_ativo (
  id        TEXT PRIMARY KEY,
  nome      TEXT NOT NULL UNIQUE,
  descricao TEXT,
  icone     TEXT NOT NULL DEFAULT 'monitor',
  cor       TEXT NOT NULL DEFAULT '#7c3aed',
  ativo     BOOLEAN NOT NULL DEFAULT true,
  criado_em TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS ativos (
  id                TEXT PRIMARY KEY,
  codigo            TEXT NOT NULL UNIQUE,
  nome              TEXT NOT NULL,
  descricao         TEXT,
  categoria_id      TEXT REFERENCES categorias_ativo(id) ON DELETE SET NULL,
  status            TEXT NOT NULL DEFAULT 'ativo',
  marca             TEXT,
  modelo            TEXT,
  numero_serie      TEXT,
  localizacao       TEXT,
  responsavel_id    TEXT REFERENCES users(id) ON DELETE SET NULL,
  setor_id          TEXT REFERENCES setores(id) ON DELETE SET NULL,
  data_aquisicao    TIMESTAMPTZ,
  valor_aquisicao   NUMERIC(15,2),
  data_garantia_fim TIMESTAMPTZ,
  observacoes       TEXT,
  criado_em         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  atualizado_em     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS transferencias_ativo (
  id                  TEXT PRIMARY KEY,
  ativo_id            TEXT NOT NULL REFERENCES ativos(id) ON DELETE CASCADE,
  de_responsavel_id   TEXT REFERENCES users(id) ON DELETE SET NULL,
  para_responsavel_id TEXT REFERENCES users(id) ON DELETE SET NULL,
  de_setor_id         TEXT REFERENCES setores(id) ON DELETE SET NULL,
  para_setor_id       TEXT REFERENCES setores(id) ON DELETE SET NULL,
  motivo              TEXT,
  realizado_por_id    TEXT NOT NULL REFERENCES users(id),
  criado_em           TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ativos_status       ON ativos(status);
CREATE INDEX IF NOT EXISTS idx_ativos_responsavel  ON ativos(responsavel_id) WHERE responsavel_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_ativos_setor        ON ativos(setor_id) WHERE setor_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_transf_ativo        ON transferencias_ativo(ativo_id);

-- Default asset categories
INSERT INTO categorias_ativo (id, nome, descricao, icone, cor) VALUES
  (gen_random_uuid(), 'Computadores',    'Desktops, notebooks e workstations',  'monitor',    '#0891b2'),
  (gen_random_uuid(), 'Periféricos',     'Teclados, mouses, monitores, etc.',   'mouse',      '#7c3aed'),
  (gen_random_uuid(), 'Rede',            'Switches, roteadores, access points', 'wifi',       '#059669'),
  (gen_random_uuid(), 'Moveis',          'Mesas, cadeiras, armarios',           'package',    '#d97706'),
  (gen_random_uuid(), 'Telefonia',       'Telefones, celulares corporativos',   'phone',      '#dc2626'),
  (gen_random_uuid(), 'Software',        'Licencas e softwares',                'code',       '#6366f1')
ON CONFLICT (nome) DO NOTHING;
