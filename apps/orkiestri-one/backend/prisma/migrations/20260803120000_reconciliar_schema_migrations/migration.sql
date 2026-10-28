-- ============================================================================
-- Reconciliação entre schema.prisma e as migrations
--
-- POR QUE EXISTE
--
-- Ao comparar homologação com produção, apareceram 6 tabelas que existiam num
-- ambiente e não no outro. A investigação mostrou a causa: elas estão
-- DECLARADAS em `schema.prisma` mas NENHUMA migration as cria. Chegaram aos
-- bancos de desenvolvimento por `prisma db push`, que aplica o schema direto
-- sem gerar histórico — e por isso nunca chegaram a produção.
--
-- O efeito prático: `osa_monitor` não existe em produção e o módulo OSA a
-- consulta em cinco pontos (`osa.module.ts`). A tela de monitoramento responde
-- 500 assim que alguém a abre. As outras cinco tabelas estão dormentes —
-- declaradas, sem código que as use ainda.
--
-- COMO FOI APURADO
--
-- Dois bancos descartáveis: um construído só com `prisma migrate deploy`,
-- outro só com `prisma db push`. Comparando a estrutura real dos dois:
--
--   6 tabelas    faltando nas migrations  → criadas aqui
--   1 coluna     faltando (clientes.portal_token) → criada aqui
--   2 colunas    sobrando (centro_custo_id) → DEIXADAS EM PAZ, ver abaixo
--   95 colunas   com diferença só de tipo (timestamptz × timestamp) → idem
--
-- O QUE ESTA MIGRATION NÃO FAZ, DE PROPÓSITO
--
-- Nada é apagado nem alterado. O `prisma migrate diff` cheio propunha derrubar
-- e recriar TODAS as chaves estrangeiras do projeto, porque as migrations
-- antigas nomearam constraints de um jeito e o Prisma nomearia de outro. Isso
-- é ruído de nomenclatura, não defeito de estrutura: aplicar aquilo em
-- produção significaria locks em 138 tabelas para renomear coisas que já
-- funcionam. `veiculos.centro_custo_id` e `reservas_veiculo.centro_custo_id`
-- são resquício de uma mudança anterior e ficam onde estão — coluna sobrando
-- não quebra nada, DROP em produção sim.
--
-- Idempotente do começo ao fim: roda sobre banco que já tem as tabelas (o de
-- desenvolvimento) sem reclamar.
-- ============================================================================

-- ── Campos customizados de chamado ──────────────────────────────────────────
CREATE TABLE IF NOT EXISTS "chamado_custom_fields" (
  "id"              TEXT NOT NULL,
  "organization_id" TEXT NOT NULL,
  "categoria"       TEXT,
  "label"           TEXT NOT NULL,
  "tipo"            TEXT NOT NULL,
  "obrigatorio"     BOOLEAN NOT NULL DEFAULT false,
  "ordem"           INTEGER NOT NULL DEFAULT 0,
  "opcoes_json"     JSONB,
  "ativo"           BOOLEAN NOT NULL DEFAULT true,
  "criado_em"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "chamado_custom_fields_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "chamado_custom_fields_organization_id_categoria_idx"
  ON "chamado_custom_fields"("organization_id", "categoria");

CREATE TABLE IF NOT EXISTS "chamado_custom_values" (
  "id"         TEXT NOT NULL,
  "chamado_id" TEXT NOT NULL,
  "field_id"   TEXT NOT NULL,
  "valor"      TEXT NOT NULL,
  CONSTRAINT "chamado_custom_values_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "chamado_custom_values_chamado_id_field_id_key"
  ON "chamado_custom_values"("chamado_id", "field_id");
CREATE INDEX IF NOT EXISTS "chamado_custom_values_chamado_id_idx"
  ON "chamado_custom_values"("chamado_id");

-- ── Vínculo entre chamados ──────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS "chamado_links" (
  "id"              TEXT NOT NULL,
  "from_chamado_id" TEXT NOT NULL,
  "to_chamado_id"   TEXT NOT NULL,
  "tipo"            TEXT NOT NULL,
  "criado_em"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "criado_por_id"   TEXT,
  CONSTRAINT "chamado_links_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "chamado_links_from_chamado_id_idx"
  ON "chamado_links"("from_chamado_id");
CREATE INDEX IF NOT EXISTS "chamado_links_to_chamado_id_idx"
  ON "chamado_links"("to_chamado_id");
CREATE UNIQUE INDEX IF NOT EXISTS "chamado_links_from_chamado_id_to_chamado_id_tipo_key"
  ON "chamado_links"("from_chamado_id", "to_chamado_id", "tipo");

-- ── Subtarefas ──────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS "chamado_subtasks" (
  "id"           TEXT NOT NULL,
  "chamado_id"   TEXT NOT NULL,
  "titulo"       TEXT NOT NULL,
  "concluido"    BOOLEAN NOT NULL DEFAULT false,
  "assignee_id"  TEXT,
  "ordem"        INTEGER NOT NULL DEFAULT 0,
  "criado_em"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "concluido_em" TIMESTAMP(3),
  CONSTRAINT "chamado_subtasks_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "chamado_subtasks_chamado_id_ordem_idx"
  ON "chamado_subtasks"("chamado_id", "ordem");

-- ── Observadores ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS "chamado_watchers" (
  "id"         TEXT NOT NULL,
  "chamado_id" TEXT NOT NULL,
  "user_id"    TEXT NOT NULL,
  "criado_em"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "chamado_watchers_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "chamado_watchers_chamado_id_user_id_key"
  ON "chamado_watchers"("chamado_id", "user_id");
CREATE INDEX IF NOT EXISTS "chamado_watchers_user_id_idx"
  ON "chamado_watchers"("user_id");

-- ── Monitor OSA ─────────────────────────────────────────────────────────────
-- Esta é a que está quebrando produção hoje. `senha_cifrada` guarda a
-- credencial SMB cifrada com APP_VAULT_KEY — nunca em claro.
CREATE TABLE IF NOT EXISTS "osa_monitor" (
  "id"                 TEXT NOT NULL,
  "organization_id"    TEXT NOT NULL,
  "descricao"          TEXT NOT NULL,
  "ip"                 TEXT NOT NULL,
  "zabbix_host_id"     TEXT,
  "item_key"           TEXT NOT NULL DEFAULT 'fadami.tag.recebido',
  "valor_atual"        TEXT,
  "servico_estado"     TEXT,
  "caminho"            TEXT,
  "share"              TEXT,
  "usuario"            TEXT,
  "dominio"            TEXT,
  "senha_cifrada"      TEXT,
  "filtro"             TEXT NOT NULL DEFAULT '*.tag',
  "tempo_max_min"      INTEGER NOT NULL DEFAULT 5,
  "intervalo_seg"      INTEGER NOT NULL DEFAULT 60,
  "ativo"              BOOLEAN NOT NULL DEFAULT true,
  "ultimo_arquivo"     TEXT,
  "serie"              TEXT,
  "sequencial"         TEXT,
  "ultima_atualizacao" TIMESTAMP(3),
  "ultimo_check_em"    TIMESTAMP(3),
  "status"             TEXT NOT NULL DEFAULT 'DESCONHECIDO',
  "ultimo_erro"        TEXT,
  "criado_em"          TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "atualizado_em"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "osa_monitor_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "osa_monitor_organization_id_ativo_idx"
  ON "osa_monitor"("organization_id", "ativo");

-- ── Token do portal do cliente ──────────────────────────────────────────────
ALTER TABLE "clientes" ADD COLUMN IF NOT EXISTS "portal_token" TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS "clientes_portal_token_key"
  ON "clientes"("portal_token");

-- ── Chaves estrangeiras ─────────────────────────────────────────────────────
-- NOT VALID em nenhuma: são tabelas recém-criadas e vazias, não há linha
-- antiga para violar a constraint. Diferente do caso de `collaborators`, onde
-- a base de produção tinha FK quebrada de antes.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chamado_custom_fields_organization_id_fkey') THEN
    ALTER TABLE "chamado_custom_fields" ADD CONSTRAINT "chamado_custom_fields_organization_id_fkey"
      FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chamado_custom_values_chamado_id_fkey') THEN
    ALTER TABLE "chamado_custom_values" ADD CONSTRAINT "chamado_custom_values_chamado_id_fkey"
      FOREIGN KEY ("chamado_id") REFERENCES "chamados"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chamado_custom_values_field_id_fkey') THEN
    ALTER TABLE "chamado_custom_values" ADD CONSTRAINT "chamado_custom_values_field_id_fkey"
      FOREIGN KEY ("field_id") REFERENCES "chamado_custom_fields"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chamado_links_from_chamado_id_fkey') THEN
    ALTER TABLE "chamado_links" ADD CONSTRAINT "chamado_links_from_chamado_id_fkey"
      FOREIGN KEY ("from_chamado_id") REFERENCES "chamados"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chamado_links_to_chamado_id_fkey') THEN
    ALTER TABLE "chamado_links" ADD CONSTRAINT "chamado_links_to_chamado_id_fkey"
      FOREIGN KEY ("to_chamado_id") REFERENCES "chamados"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chamado_links_criado_por_id_fkey') THEN
    ALTER TABLE "chamado_links" ADD CONSTRAINT "chamado_links_criado_por_id_fkey"
      FOREIGN KEY ("criado_por_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chamado_subtasks_chamado_id_fkey') THEN
    ALTER TABLE "chamado_subtasks" ADD CONSTRAINT "chamado_subtasks_chamado_id_fkey"
      FOREIGN KEY ("chamado_id") REFERENCES "chamados"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chamado_subtasks_assignee_id_fkey') THEN
    ALTER TABLE "chamado_subtasks" ADD CONSTRAINT "chamado_subtasks_assignee_id_fkey"
      FOREIGN KEY ("assignee_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chamado_watchers_chamado_id_fkey') THEN
    ALTER TABLE "chamado_watchers" ADD CONSTRAINT "chamado_watchers_chamado_id_fkey"
      FOREIGN KEY ("chamado_id") REFERENCES "chamados"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chamado_watchers_user_id_fkey') THEN
    ALTER TABLE "chamado_watchers" ADD CONSTRAINT "chamado_watchers_user_id_fkey"
      FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'osa_monitor_organization_id_fkey') THEN
    ALTER TABLE "osa_monitor" ADD CONSTRAINT "osa_monitor_organization_id_fkey"
      FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;
