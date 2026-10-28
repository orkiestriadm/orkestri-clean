-- Módulo Gestão de Frotas
-- Cadastro central: veiculos. Sub-cadastros vinculados por veiculo_id.
-- Padrão: exclusão lógica (deleted_at), auditoria de usuário (criado_por_id /
-- atualizado_por_id), criado_em / atualizado_em. Tudo escopado por organization_id.

-- ── Categorias de veículo (Configurações) ──────────────────────────────────────
CREATE TABLE IF NOT EXISTS categorias_veiculo (
  id                TEXT PRIMARY KEY,
  organization_id   TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  nome              TEXT NOT NULL,
  descricao         TEXT,
  icone             TEXT NOT NULL DEFAULT 'car',
  cor               TEXT NOT NULL DEFAULT '#0ea5e9',
  ativo             BOOLEAN NOT NULL DEFAULT true,
  criado_por_id     TEXT,
  atualizado_por_id TEXT,
  deleted_at        TIMESTAMPTZ,
  criado_em         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  atualizado_em     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE UNIQUE INDEX IF NOT EXISTS uq_categorias_veiculo_org_nome ON categorias_veiculo(organization_id, nome);
CREATE INDEX IF NOT EXISTS idx_categorias_veiculo_org_del ON categorias_veiculo(organization_id, deleted_at);

-- ── Motoristas ─────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS motoristas (
  id                TEXT PRIMARY KEY,
  organization_id   TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  nome              TEXT NOT NULL,
  cpf               TEXT,
  cnh               TEXT,
  categoria_cnh     TEXT,
  validade_cnh      TIMESTAMPTZ,
  telefone          TEXT,
  email             TEXT,
  user_id           TEXT,
  status            TEXT NOT NULL DEFAULT 'ativo',
  observacoes       TEXT,
  criado_por_id     TEXT,
  atualizado_por_id TEXT,
  deleted_at        TIMESTAMPTZ,
  criado_em         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  atualizado_em     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_motoristas_org_del    ON motoristas(organization_id, deleted_at);
CREATE INDEX IF NOT EXISTS idx_motoristas_org_status ON motoristas(organization_id, status);

-- ── Veículos (cadastro principal) ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS veiculos (
  id                TEXT PRIMARY KEY,
  organization_id   TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  codigo            TEXT NOT NULL,
  placa             TEXT NOT NULL,
  renavam           TEXT,
  chassi            TEXT,
  marca             TEXT,
  modelo            TEXT,
  ano_fabricacao    INTEGER,
  ano_modelo        INTEGER,
  cor               TEXT,
  tipo              TEXT NOT NULL DEFAULT 'carro',
  combustivel       TEXT NOT NULL DEFAULT 'flex',
  categoria_id      TEXT REFERENCES categorias_veiculo(id) ON DELETE SET NULL,
  status            TEXT NOT NULL DEFAULT 'ativo',
  km_atual          INTEGER NOT NULL DEFAULT 0,
  capacidade_tanque DOUBLE PRECISION,
  motorista_id      TEXT REFERENCES motoristas(id) ON DELETE SET NULL,
  setor_id          TEXT REFERENCES setores(id) ON DELETE SET NULL,
  ativo_id          TEXT REFERENCES ativos(id) ON DELETE SET NULL,
  data_aquisicao    TIMESTAMPTZ,
  valor_aquisicao   DOUBLE PRECISION,
  observacoes       TEXT,
  criado_por_id     TEXT,
  atualizado_por_id TEXT,
  deleted_at        TIMESTAMPTZ,
  criado_em         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  atualizado_em     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE UNIQUE INDEX IF NOT EXISTS uq_veiculos_org_placa  ON veiculos(organization_id, placa);
CREATE UNIQUE INDEX IF NOT EXISTS uq_veiculos_org_codigo ON veiculos(organization_id, codigo);
CREATE UNIQUE INDEX IF NOT EXISTS uq_veiculos_ativo      ON veiculos(ativo_id) WHERE ativo_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_veiculos_org_status ON veiculos(organization_id, status);
CREATE INDEX IF NOT EXISTS idx_veiculos_org_del    ON veiculos(organization_id, deleted_at);

-- ── Pneus ──────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS pneus (
  id                TEXT PRIMARY KEY,
  organization_id   TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  veiculo_id        TEXT REFERENCES veiculos(id) ON DELETE SET NULL,
  numero_serie      TEXT,
  marca             TEXT,
  modelo            TEXT,
  medida            TEXT,
  posicao           TEXT,
  data_instalacao   TIMESTAMPTZ,
  km_instalacao     INTEGER,
  km_atual          INTEGER,
  vida_util_km      INTEGER,
  status            TEXT NOT NULL DEFAULT 'em_uso',
  observacoes       TEXT,
  criado_por_id     TEXT,
  atualizado_por_id TEXT,
  deleted_at        TIMESTAMPTZ,
  criado_em         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  atualizado_em     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_pneus_org_del  ON pneus(organization_id, deleted_at);
CREATE INDEX IF NOT EXISTS idx_pneus_veiculo  ON pneus(veiculo_id);

-- ── Revisões ───────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS revisoes_veiculo (
  id                TEXT PRIMARY KEY,
  organization_id   TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  veiculo_id        TEXT NOT NULL REFERENCES veiculos(id) ON DELETE CASCADE,
  tipo              TEXT,
  descricao         TEXT,
  data_prevista     TIMESTAMPTZ,
  km_previsto       INTEGER,
  data_realizada    TIMESTAMPTZ,
  km_realizado      INTEGER,
  status            TEXT NOT NULL DEFAULT 'agendada',
  custo             DOUBLE PRECISION,
  oficina           TEXT,
  observacoes       TEXT,
  criado_por_id     TEXT,
  atualizado_por_id TEXT,
  deleted_at        TIMESTAMPTZ,
  criado_em         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  atualizado_em     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_revisoes_org_del    ON revisoes_veiculo(organization_id, deleted_at);
CREATE INDEX IF NOT EXISTS idx_revisoes_veiculo    ON revisoes_veiculo(veiculo_id);
CREATE INDEX IF NOT EXISTS idx_revisoes_org_status ON revisoes_veiculo(organization_id, status);

-- ── Manutenções ────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS manutencoes_veiculo (
  id                TEXT PRIMARY KEY,
  organization_id   TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  veiculo_id        TEXT NOT NULL REFERENCES veiculos(id) ON DELETE CASCADE,
  tipo              TEXT NOT NULL DEFAULT 'corretiva',
  descricao         TEXT,
  data              TIMESTAMPTZ,
  data_agendada     TIMESTAMPTZ,
  km                INTEGER,
  custo             DOUBLE PRECISION,
  fornecedor_id     TEXT,
  oficina           TEXT,
  pecas             JSONB NOT NULL DEFAULT '[]',
  status            TEXT NOT NULL DEFAULT 'aberta',
  observacoes       TEXT,
  criado_por_id     TEXT,
  atualizado_por_id TEXT,
  deleted_at        TIMESTAMPTZ,
  criado_em         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  atualizado_em     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_manutencoes_org_del    ON manutencoes_veiculo(organization_id, deleted_at);
CREATE INDEX IF NOT EXISTS idx_manutencoes_veiculo    ON manutencoes_veiculo(veiculo_id);
CREATE INDEX IF NOT EXISTS idx_manutencoes_org_status ON manutencoes_veiculo(organization_id, status);

-- ── Documentações ──────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS documentos_veiculo (
  id                TEXT PRIMARY KEY,
  organization_id   TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  veiculo_id        TEXT NOT NULL REFERENCES veiculos(id) ON DELETE CASCADE,
  tipo              TEXT NOT NULL DEFAULT 'crlv',
  numero            TEXT,
  descricao         TEXT,
  data_emissao      TIMESTAMPTZ,
  data_vencimento   TIMESTAMPTZ,
  valor             DOUBLE PRECISION,
  arquivo_url       TEXT,
  status            TEXT NOT NULL DEFAULT 'vigente',
  observacoes       TEXT,
  criado_por_id     TEXT,
  atualizado_por_id TEXT,
  deleted_at        TIMESTAMPTZ,
  criado_em         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  atualizado_em     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_documentos_org_del ON documentos_veiculo(organization_id, deleted_at);
CREATE INDEX IF NOT EXISTS idx_documentos_veiculo ON documentos_veiculo(veiculo_id);
CREATE INDEX IF NOT EXISTS idx_documentos_org_venc ON documentos_veiculo(organization_id, data_vencimento);

-- ── Abastecimentos ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS abastecimentos (
  id                TEXT PRIMARY KEY,
  organization_id   TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  veiculo_id        TEXT NOT NULL REFERENCES veiculos(id) ON DELETE CASCADE,
  motorista_id      TEXT REFERENCES motoristas(id) ON DELETE SET NULL,
  data              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  km_atual          INTEGER,
  litros            DOUBLE PRECISION,
  valor_litro       DOUBLE PRECISION,
  valor_total       DOUBLE PRECISION,
  tipo_combustivel  TEXT,
  posto             TEXT,
  tanque_cheio      BOOLEAN NOT NULL DEFAULT true,
  consumo_km_l      DOUBLE PRECISION,
  observacoes       TEXT,
  criado_por_id     TEXT,
  atualizado_por_id TEXT,
  deleted_at        TIMESTAMPTZ,
  criado_em         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  atualizado_em     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_abastecimentos_org_del   ON abastecimentos(organization_id, deleted_at);
CREATE INDEX IF NOT EXISTS idx_abastecimentos_veic_data ON abastecimentos(veiculo_id, data);
