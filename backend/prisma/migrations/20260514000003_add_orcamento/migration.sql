-- CreateTable: orcamento_ciclos
CREATE TABLE IF NOT EXISTS "orcamento_ciclos" (
  "id"              TEXT         NOT NULL,
  "ano"             INTEGER      NOT NULL,
  "descricao"       TEXT,
  "status"          TEXT         NOT NULL DEFAULT 'rascunho',
  "aprovado_por_id" TEXT,
  "criado_em"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "atualizado_em"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "orcamento_ciclos_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "orcamento_ciclos_ano_key" ON "orcamento_ciclos"("ano");
ALTER TABLE "orcamento_ciclos"
  ADD CONSTRAINT "orcamento_ciclos_aprovado_por_id_fkey"
  FOREIGN KEY ("aprovado_por_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- CreateTable: centros_custo
CREATE TABLE IF NOT EXISTS "centros_custo" (
  "id"             TEXT         NOT NULL,
  "codigo"         TEXT         NOT NULL,
  "nome"           TEXT         NOT NULL,
  "descricao"      TEXT,
  "cor"            TEXT         NOT NULL DEFAULT '#a78bfa',
  "ativo"          BOOLEAN      NOT NULL DEFAULT true,
  "responsavel_id" TEXT,
  "criado_em"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "centros_custo_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "centros_custo_codigo_key" ON "centros_custo"("codigo");
ALTER TABLE "centros_custo"
  ADD CONSTRAINT "centros_custo_responsavel_id_fkey"
  FOREIGN KEY ("responsavel_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- CreateTable: categorias_orcamento
CREATE TABLE IF NOT EXISTS "categorias_orcamento" (
  "id"        TEXT         NOT NULL,
  "tipo"      TEXT         NOT NULL,
  "codigo"    TEXT         NOT NULL,
  "nome"      TEXT         NOT NULL,
  "cor"       TEXT         NOT NULL DEFAULT '#a78bfa',
  "icone"     TEXT,
  "pai_id"    TEXT,
  "criado_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "categorias_orcamento_pkey" PRIMARY KEY ("id")
);
ALTER TABLE "categorias_orcamento"
  ADD CONSTRAINT "categorias_orcamento_pai_id_fkey"
  FOREIGN KEY ("pai_id") REFERENCES "categorias_orcamento"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- CreateTable: fornecedores_orcamento
CREATE TABLE IF NOT EXISTS "fornecedores_orcamento" (
  "id"        TEXT         NOT NULL,
  "nome"      TEXT         NOT NULL,
  "cnpj"      TEXT,
  "email"     TEXT,
  "telefone"  TEXT,
  "segmento"  TEXT,
  "ativo"     BOOLEAN      NOT NULL DEFAULT true,
  "criado_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "fornecedores_orcamento_pkey" PRIMARY KEY ("id")
);

-- CreateTable: itens_orcamento
CREATE TABLE IF NOT EXISTS "itens_orcamento" (
  "id"               TEXT         NOT NULL,
  "ciclo_id"         TEXT         NOT NULL,
  "centro_custo_id"  TEXT,
  "categoria_id"     TEXT         NOT NULL,
  "tipo"             TEXT         NOT NULL,
  "nome"             TEXT         NOT NULL,
  "descricao"        TEXT,
  "fornecedor_id"    TEXT,
  "recorrente"       BOOLEAN      NOT NULL DEFAULT false,
  "periodicidade"    TEXT         NOT NULL DEFAULT 'mensal',
  "status"           TEXT         NOT NULL DEFAULT 'ativo',
  "observacoes"      TEXT,
  "criado_por_id"    TEXT         NOT NULL,
  "criado_em"        TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "atualizado_em"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "itens_orcamento_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "itens_orcamento_ciclo_id_idx"      ON "itens_orcamento"("ciclo_id");
CREATE INDEX IF NOT EXISTS "itens_orcamento_categoria_id_idx"  ON "itens_orcamento"("categoria_id");
CREATE INDEX IF NOT EXISTS "itens_orcamento_tipo_idx"          ON "itens_orcamento"("tipo");
ALTER TABLE "itens_orcamento"
  ADD CONSTRAINT "itens_orcamento_ciclo_id_fkey"
  FOREIGN KEY ("ciclo_id") REFERENCES "orcamento_ciclos"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "itens_orcamento"
  ADD CONSTRAINT "itens_orcamento_centro_custo_id_fkey"
  FOREIGN KEY ("centro_custo_id") REFERENCES "centros_custo"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "itens_orcamento"
  ADD CONSTRAINT "itens_orcamento_categoria_id_fkey"
  FOREIGN KEY ("categoria_id") REFERENCES "categorias_orcamento"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "itens_orcamento"
  ADD CONSTRAINT "itens_orcamento_fornecedor_id_fkey"
  FOREIGN KEY ("fornecedor_id") REFERENCES "fornecedores_orcamento"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "itens_orcamento"
  ADD CONSTRAINT "itens_orcamento_criado_por_id_fkey"
  FOREIGN KEY ("criado_por_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- CreateTable: itens_orcamento_mes
CREATE TABLE IF NOT EXISTS "itens_orcamento_mes" (
  "id"               TEXT             NOT NULL,
  "item_id"          TEXT             NOT NULL,
  "mes"              INTEGER          NOT NULL,
  "valor_previsto"   DOUBLE PRECISION NOT NULL DEFAULT 0,
  "valor_realizado"  DOUBLE PRECISION,
  "status"           TEXT             NOT NULL DEFAULT 'pendente',
  "observacoes"      TEXT,
  "lancado_por_id"   TEXT,
  "lancado_em"       TIMESTAMP(3),
  CONSTRAINT "itens_orcamento_mes_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "itens_orcamento_mes_item_id_mes_key" ON "itens_orcamento_mes"("item_id", "mes");
CREATE INDEX IF NOT EXISTS "itens_orcamento_mes_item_id_idx" ON "itens_orcamento_mes"("item_id");
ALTER TABLE "itens_orcamento_mes"
  ADD CONSTRAINT "itens_orcamento_mes_item_id_fkey"
  FOREIGN KEY ("item_id") REFERENCES "itens_orcamento"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "itens_orcamento_mes"
  ADD CONSTRAINT "itens_orcamento_mes_lancado_por_id_fkey"
  FOREIGN KEY ("lancado_por_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- CreateTable: aprovacoes_orcamento
CREATE TABLE IF NOT EXISTS "aprovacoes_orcamento" (
  "id"                TEXT         NOT NULL,
  "item_id"           TEXT,
  "tipo"              TEXT         NOT NULL,
  "status"            TEXT         NOT NULL DEFAULT 'pendente',
  "solicitado_por_id" TEXT         NOT NULL,
  "aprovado_por_id"   TEXT,
  "observacoes"       TEXT,
  "criado_em"         TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "resolvido_em"      TIMESTAMP(3),
  CONSTRAINT "aprovacoes_orcamento_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "aprovacoes_orcamento_status_idx" ON "aprovacoes_orcamento"("status");
ALTER TABLE "aprovacoes_orcamento"
  ADD CONSTRAINT "aprovacoes_orcamento_item_id_fkey"
  FOREIGN KEY ("item_id") REFERENCES "itens_orcamento"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "aprovacoes_orcamento"
  ADD CONSTRAINT "aprovacoes_orcamento_solicitado_por_id_fkey"
  FOREIGN KEY ("solicitado_por_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "aprovacoes_orcamento"
  ADD CONSTRAINT "aprovacoes_orcamento_aprovado_por_id_fkey"
  FOREIGN KEY ("aprovado_por_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- CreateTable: orcamento_timeline
CREATE TABLE IF NOT EXISTS "orcamento_timeline" (
  "id"        TEXT         NOT NULL,
  "item_id"   TEXT         NOT NULL,
  "tipo"      TEXT         NOT NULL,
  "titulo"    TEXT         NOT NULL,
  "descricao" TEXT,
  "user_id"   TEXT,
  "criado_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "orcamento_timeline_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "orcamento_timeline_item_id_idx" ON "orcamento_timeline"("item_id");
ALTER TABLE "orcamento_timeline"
  ADD CONSTRAINT "orcamento_timeline_item_id_fkey"
  FOREIGN KEY ("item_id") REFERENCES "itens_orcamento"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "orcamento_timeline"
  ADD CONSTRAINT "orcamento_timeline_user_id_fkey"
  FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Seed: categorias padrão OPEX
INSERT INTO "categorias_orcamento" ("id","tipo","codigo","nome","cor") VALUES
  ('cat-opex-root-sw',   'OPEX','SW',  'Manutenção de Softwares',    '#a78bfa'),
  ('cat-opex-root-cloud','OPEX','CLD', 'Cloud & Infraestrutura',     '#22d3ee'),
  ('cat-opex-root-tel',  'OPEX','TEL', 'Telecom & Conectividade',    '#34d399'),
  ('cat-opex-root-svc',  'OPEX','SVC', 'Serviços & Contratos',       '#fbbf24'),
  ('cat-opex-root-sup',  'OPEX','SUP', 'Suporte & Manutenção',       '#f472b6')
ON CONFLICT DO NOTHING;

-- Seed: subcategorias OPEX - Softwares
INSERT INTO "categorias_orcamento" ("id","tipo","codigo","nome","cor","pai_id") VALUES
  ('cat-opex-sw-lic',  'OPEX','SW.LIC', 'Licenças',         '#a78bfa','cat-opex-root-sw'),
  ('cat-opex-sw-seg',  'OPEX','SW.SEG', 'Segurança',        '#f87171','cat-opex-root-sw'),
  ('cat-opex-sw-bkp',  'OPEX','SW.BKP', 'Backup',           '#34d399','cat-opex-root-sw'),
  ('cat-opex-sw-mon',  'OPEX','SW.MON', 'Monitoramento',    '#22d3ee','cat-opex-root-sw')
ON CONFLICT DO NOTHING;

-- Seed: categorias padrão CAPEX
INSERT INTO "categorias_orcamento" ("id","tipo","codigo","nome","cor") VALUES
  ('cat-capex-root-hw',  'CAPEX','HW',  'Hardware & Equipamentos',   '#60a5fa'),
  ('cat-capex-root-inf', 'CAPEX','INF', 'Infraestrutura',            '#34d399'),
  ('cat-capex-root-prj', 'CAPEX','PRJ', 'Projetos & Implantação',    '#fbbf24'),
  ('cat-capex-root-exp', 'CAPEX','EXP', 'Expansão & Obras',          '#f87171')
ON CONFLICT DO NOTHING;

-- Seed: subcategorias CAPEX - Hardware
INSERT INTO "categorias_orcamento" ("id","tipo","codigo","nome","cor","pai_id") VALUES
  ('cat-capex-hw-srv',  'CAPEX','HW.SRV', 'Servidores',       '#60a5fa','cat-capex-root-hw'),
  ('cat-capex-hw-net',  'CAPEX','HW.NET', 'Networking',       '#22d3ee','cat-capex-root-hw'),
  ('cat-capex-hw-ws',   'CAPEX','HW.WS',  'Workstations',     '#a78bfa','cat-capex-root-hw'),
  ('cat-capex-hw-str',  'CAPEX','HW.STR', 'Storage',          '#34d399','cat-capex-root-hw')
ON CONFLICT DO NOTHING;
