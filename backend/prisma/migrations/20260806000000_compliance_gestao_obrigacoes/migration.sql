-- Orkiestri Compliance — Gestão de Obrigações
--
-- Migration puramente ADITIVA: 20 tabelas novas, nenhum ALTER e nenhum DROP em
-- tabela existente. As chaves estrangeiras apontam para organizations, users,
-- collaborators, projects e suppliers, mas as tabelas filhas nascem vazias —
-- a validação da FK é instantânea e não trava a API, ao contrário do que
-- aconteceu no deploy do People (ver docs/people/).

-- CreateTable
CREATE TABLE "compliance_categorias" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "descricao" TEXT,
    "icone" TEXT NOT NULL DEFAULT 'shield-check',
    "cor" TEXT NOT NULL DEFAULT '#7c3aed',
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "ordem" INTEGER NOT NULL DEFAULT 0,
    "folgaInternaDias" INTEGER NOT NULL DEFAULT 60,
    "criado_por_id" TEXT,
    "deleted_at" TIMESTAMP(3),
    "criado_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizado_em" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "compliance_categorias_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "compliance_campo_definicoes" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "categoria_id" TEXT NOT NULL,
    "chave" TEXT NOT NULL,
    "rotulo" TEXT NOT NULL,
    "tipo" TEXT NOT NULL DEFAULT 'texto',
    "opcoes" JSONB NOT NULL DEFAULT '[]',
    "obrigatorio" BOOLEAN NOT NULL DEFAULT false,
    "ajuda" TEXT,
    "ordem" INTEGER NOT NULL DEFAULT 0,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "deleted_at" TIMESTAMP(3),
    "criado_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizado_em" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "compliance_campo_definicoes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "compliance_orgaos" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "sigla" TEXT,
    "contato" TEXT,
    "telefone" TEXT,
    "email" TEXT,
    "site" TEXT,
    "endereco" TEXT,
    "observacoes" TEXT,
    "deleted_at" TIMESTAMP(3),
    "criado_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizado_em" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "compliance_orgaos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "compliance_obrigacoes" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "codigo" TEXT NOT NULL,
    "categoria_id" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "sigla" TEXT,
    "numero_documento" TEXT,
    "descricao" TEXT,
    "orgao_id" TEXT,
    "empresa" TEXT,
    "filial" TEXT,
    "unidade" TEXT,
    "departamento" TEXT,
    "centro_custo" TEXT,
    "ativo_identificador" TEXT,
    "project_id" TEXT,
    "criticidade" TEXT NOT NULL DEFAULT 'media',
    "status" TEXT NOT NULL DEFAULT 'ativa',
    "data_emissao" TIMESTAMP(3),
    "data_validade" TIMESTAMP(3),
    "data_aprovacao" TIMESTAMP(3),
    "data_ultima_renovacao" TIMESTAMP(3),
    "validade_meses" INTEGER,
    "prazo_minimo_dias" INTEGER NOT NULL DEFAULT 0,
    "folga_interna_dias" INTEGER,
    "prazo_fatal_em" TIMESTAMP(3),
    "prazo_interno_em" TIMESTAMP(3),
    "prazo_fatal_manual" TIMESTAMP(3),
    "prazo_interno_manual" TIMESTAMP(3),
    "renovacao_automatica" BOOLEAN NOT NULL DEFAULT false,
    "protocolo_numero" TEXT,
    "protocolo_em" TIMESTAMP(3),
    "protocolo_observacao" TEXT,
    "prorrogacao_vigente" BOOLEAN NOT NULL DEFAULT false,
    "valor_licenca" DECIMAL(14,2),
    "valor_renovacao" DECIMAL(14,2),
    "supplier_id" TEXT,
    "nota_fiscal" TEXT,
    "observacoes" TEXT,
    "versao_atual" INTEGER NOT NULL DEFAULT 1,
    "etapa_id" TEXT,
    "criado_por_id" TEXT,
    "atualizado_por_id" TEXT,
    "deleted_at" TIMESTAMP(3),
    "criado_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizado_em" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "compliance_obrigacoes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "compliance_campo_valores" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "obrigacao_id" TEXT NOT NULL,
    "campo_id" TEXT NOT NULL,
    "valor_texto" TEXT,
    "valor_numero" DOUBLE PRECISION,
    "valor_data" TIMESTAMP(3),
    "valor_bool" BOOLEAN,
    "criado_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizado_em" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "compliance_campo_valores_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "compliance_responsaveis" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "obrigacao_id" TEXT NOT NULL,
    "papel" TEXT NOT NULL DEFAULT 'equipe',
    "user_id" TEXT,
    "collaborator_id" TEXT,
    "nome" TEXT,
    "email" TEXT,
    "telefone" TEXT,
    "notificar" BOOLEAN NOT NULL DEFAULT true,
    "criado_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "compliance_responsaveis_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "compliance_versoes" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "obrigacao_id" TEXT NOT NULL,
    "versao" INTEGER NOT NULL,
    "numero_documento" TEXT,
    "data_emissao" TIMESTAMP(3),
    "data_validade" TIMESTAMP(3),
    "prazo_minimo_dias" INTEGER NOT NULL DEFAULT 0,
    "prazo_fatal_em" TIMESTAMP(3),
    "prazo_interno_em" TIMESTAMP(3),
    "valor" DECIMAL(14,2),
    "observacao" TEXT,
    "snapshot" JSONB NOT NULL DEFAULT '{}',
    "encerrada_em" TIMESTAMP(3),
    "criado_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "criado_por_id" TEXT,

    CONSTRAINT "compliance_versoes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "compliance_arquivos" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "obrigacao_id" TEXT NOT NULL,
    "versao_id" TEXT,
    "titulo" TEXT NOT NULL,
    "nome_original" TEXT NOT NULL,
    "arquivo_ref" TEXT NOT NULL,
    "mime" TEXT,
    "tamanho" INTEGER,
    "versao" INTEGER NOT NULL DEFAULT 1,
    "observacoes" TEXT,
    "criado_por_id" TEXT,
    "deleted_at" TIMESTAMP(3),
    "criado_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "compliance_arquivos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "compliance_historico" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "obrigacao_id" TEXT NOT NULL,
    "user_id" TEXT,
    "acao" TEXT NOT NULL,
    "campo" TEXT,
    "valorAnterior" TEXT,
    "valorNovo" TEXT,
    "descricao" TEXT,
    "ip" TEXT,
    "origem" TEXT NOT NULL DEFAULT 'web',
    "criado_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "compliance_historico_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "compliance_comentarios" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "obrigacao_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "conteudo" TEXT NOT NULL,
    "deleted_at" TIMESTAMP(3),
    "criado_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "compliance_comentarios_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "compliance_favoritos" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "obrigacao_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "criado_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "compliance_favoritos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "compliance_tags" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "cor" TEXT NOT NULL DEFAULT '#64748b',
    "criado_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "compliance_tags_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "compliance_obrigacao_tags" (
    "obrigacao_id" TEXT NOT NULL,
    "tag_id" TEXT NOT NULL,

    CONSTRAINT "compliance_obrigacao_tags_pkey" PRIMARY KEY ("obrigacao_id","tag_id")
);

-- CreateTable
CREATE TABLE "compliance_alerta_regras" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "categoria_id" TEXT,
    "obrigacao_id" TEXT,
    "nome" TEXT NOT NULL DEFAULT 'Régua padrão',
    "base_data" TEXT NOT NULL DEFAULT 'prazo_interno',
    "dias_antes" INTEGER[] DEFAULT ARRAY[180, 120, 90, 60, 30, 15, 7, 3, 1, 0]::INTEGER[],
    "dias_depois" INTEGER[] DEFAULT ARRAY[1, 3, 7, 15, 30]::INTEGER[],
    "canais" TEXT[] DEFAULT ARRAY['interno', 'email']::TEXT[],
    "destinatarios" TEXT[] DEFAULT ARRAY['responsavel', 'gestor']::TEXT[],
    "emails_extras" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "whatsapps_extras" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "template_id" TEXT,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "criado_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizado_em" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "compliance_alerta_regras_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "compliance_templates" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "canal" TEXT NOT NULL DEFAULT 'email',
    "assunto" TEXT,
    "corpo" TEXT NOT NULL,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "criado_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizado_em" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "compliance_templates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "compliance_escalonamentos" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "categoria_id" TEXT,
    "aposDias" INTEGER NOT NULL,
    "alvo" TEXT NOT NULL DEFAULT 'gestor',
    "user_id" TEXT,
    "emails" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "ordem" INTEGER NOT NULL DEFAULT 0,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "criado_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "compliance_escalonamentos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "compliance_notificacao_envios" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "obrigacao_id" TEXT NOT NULL,
    "regra_id" TEXT,
    "marco" TEXT NOT NULL,
    "canal" TEXT NOT NULL,
    "destino" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'enviado',
    "erro" TEXT,
    "chave" TEXT NOT NULL,
    "enviado_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "compliance_notificacao_envios_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "compliance_fluxos" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "categoria_id" TEXT,
    "nome" TEXT NOT NULL,
    "descricao" TEXT,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "deleted_at" TIMESTAMP(3),
    "criado_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizado_em" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "compliance_fluxos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "compliance_fluxo_etapas" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "fluxo_id" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "ordem" INTEGER NOT NULL DEFAULT 0,
    "papel_aprovador" TEXT,
    "exige_aprovacao" BOOLEAN NOT NULL DEFAULT true,
    "status_ao_entrar" TEXT,
    "criado_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "compliance_fluxo_etapas_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "compliance_aprovacoes" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "obrigacao_id" TEXT NOT NULL,
    "etapa_id" TEXT NOT NULL,
    "decisao" TEXT NOT NULL DEFAULT 'pendente',
    "aprovador_id" TEXT,
    "motivo" TEXT,
    "decidido_em" TIMESTAMP(3),
    "criado_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "compliance_aprovacoes_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "compliance_categorias_organization_id_deleted_at_idx" ON "compliance_categorias"("organization_id", "deleted_at");

-- CreateIndex
CREATE UNIQUE INDEX "compliance_categorias_organization_id_nome_key" ON "compliance_categorias"("organization_id", "nome");

-- CreateIndex
CREATE INDEX "compliance_campo_definicoes_organization_id_deleted_at_idx" ON "compliance_campo_definicoes"("organization_id", "deleted_at");

-- CreateIndex
CREATE UNIQUE INDEX "compliance_campo_definicoes_categoria_id_chave_key" ON "compliance_campo_definicoes"("categoria_id", "chave");

-- CreateIndex
CREATE INDEX "compliance_orgaos_organization_id_deleted_at_idx" ON "compliance_orgaos"("organization_id", "deleted_at");

-- CreateIndex
CREATE UNIQUE INDEX "compliance_orgaos_organization_id_nome_key" ON "compliance_orgaos"("organization_id", "nome");

-- CreateIndex
CREATE INDEX "compliance_obrigacoes_organization_id_deleted_at_idx" ON "compliance_obrigacoes"("organization_id", "deleted_at");

-- CreateIndex
CREATE INDEX "compliance_obrigacoes_organization_id_categoria_id_deleted__idx" ON "compliance_obrigacoes"("organization_id", "categoria_id", "deleted_at");

-- CreateIndex
CREATE INDEX "compliance_obrigacoes_organization_id_data_validade_idx" ON "compliance_obrigacoes"("organization_id", "data_validade");

-- CreateIndex
CREATE INDEX "compliance_obrigacoes_organization_id_prazo_interno_em_idx" ON "compliance_obrigacoes"("organization_id", "prazo_interno_em");

-- CreateIndex
CREATE INDEX "compliance_obrigacoes_organization_id_status_idx" ON "compliance_obrigacoes"("organization_id", "status");

-- CreateIndex
CREATE UNIQUE INDEX "compliance_obrigacoes_organization_id_codigo_key" ON "compliance_obrigacoes"("organization_id", "codigo");

-- CreateIndex
CREATE INDEX "compliance_campo_valores_organization_id_idx" ON "compliance_campo_valores"("organization_id");

-- CreateIndex
CREATE UNIQUE INDEX "compliance_campo_valores_obrigacao_id_campo_id_key" ON "compliance_campo_valores"("obrigacao_id", "campo_id");

-- CreateIndex
CREATE INDEX "compliance_responsaveis_obrigacao_id_papel_idx" ON "compliance_responsaveis"("obrigacao_id", "papel");

-- CreateIndex
CREATE INDEX "compliance_responsaveis_organization_id_user_id_idx" ON "compliance_responsaveis"("organization_id", "user_id");

-- CreateIndex
CREATE INDEX "compliance_versoes_organization_id_idx" ON "compliance_versoes"("organization_id");

-- CreateIndex
CREATE UNIQUE INDEX "compliance_versoes_obrigacao_id_versao_key" ON "compliance_versoes"("obrigacao_id", "versao");

-- CreateIndex
CREATE INDEX "compliance_arquivos_obrigacao_id_deleted_at_idx" ON "compliance_arquivos"("obrigacao_id", "deleted_at");

-- CreateIndex
CREATE INDEX "compliance_arquivos_organization_id_idx" ON "compliance_arquivos"("organization_id");

-- CreateIndex
CREATE INDEX "compliance_historico_obrigacao_id_criado_em_idx" ON "compliance_historico"("obrigacao_id", "criado_em" DESC);

-- CreateIndex
CREATE INDEX "compliance_historico_organization_id_criado_em_idx" ON "compliance_historico"("organization_id", "criado_em" DESC);

-- CreateIndex
CREATE INDEX "compliance_comentarios_obrigacao_id_deleted_at_idx" ON "compliance_comentarios"("obrigacao_id", "deleted_at");

-- CreateIndex
CREATE INDEX "compliance_favoritos_user_id_idx" ON "compliance_favoritos"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "compliance_favoritos_obrigacao_id_user_id_key" ON "compliance_favoritos"("obrigacao_id", "user_id");

-- CreateIndex
CREATE UNIQUE INDEX "compliance_tags_organization_id_nome_key" ON "compliance_tags"("organization_id", "nome");

-- CreateIndex
CREATE INDEX "compliance_obrigacao_tags_tag_id_idx" ON "compliance_obrigacao_tags"("tag_id");

-- CreateIndex
CREATE INDEX "compliance_alerta_regras_organization_id_ativo_idx" ON "compliance_alerta_regras"("organization_id", "ativo");

-- CreateIndex
CREATE INDEX "compliance_alerta_regras_categoria_id_idx" ON "compliance_alerta_regras"("categoria_id");

-- CreateIndex
CREATE INDEX "compliance_alerta_regras_obrigacao_id_idx" ON "compliance_alerta_regras"("obrigacao_id");

-- CreateIndex
CREATE UNIQUE INDEX "compliance_templates_organization_id_nome_key" ON "compliance_templates"("organization_id", "nome");

-- CreateIndex
CREATE INDEX "compliance_escalonamentos_organization_id_ativo_idx" ON "compliance_escalonamentos"("organization_id", "ativo");

-- CreateIndex
CREATE INDEX "compliance_notificacao_envios_obrigacao_id_enviado_em_idx" ON "compliance_notificacao_envios"("obrigacao_id", "enviado_em" DESC);

-- CreateIndex
CREATE INDEX "compliance_notificacao_envios_organization_id_enviado_em_idx" ON "compliance_notificacao_envios"("organization_id", "enviado_em" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "compliance_notificacao_envios_chave_key" ON "compliance_notificacao_envios"("chave");

-- CreateIndex
CREATE INDEX "compliance_fluxos_organization_id_deleted_at_idx" ON "compliance_fluxos"("organization_id", "deleted_at");

-- CreateIndex
CREATE INDEX "compliance_fluxo_etapas_organization_id_idx" ON "compliance_fluxo_etapas"("organization_id");

-- CreateIndex
CREATE UNIQUE INDEX "compliance_fluxo_etapas_fluxo_id_ordem_key" ON "compliance_fluxo_etapas"("fluxo_id", "ordem");

-- CreateIndex
CREATE INDEX "compliance_aprovacoes_obrigacao_id_decisao_idx" ON "compliance_aprovacoes"("obrigacao_id", "decisao");

-- CreateIndex
CREATE INDEX "compliance_aprovacoes_organization_id_decisao_idx" ON "compliance_aprovacoes"("organization_id", "decisao");

-- AddForeignKey
ALTER TABLE "compliance_categorias" ADD CONSTRAINT "compliance_categorias_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "compliance_campo_definicoes" ADD CONSTRAINT "compliance_campo_definicoes_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "compliance_campo_definicoes" ADD CONSTRAINT "compliance_campo_definicoes_categoria_id_fkey" FOREIGN KEY ("categoria_id") REFERENCES "compliance_categorias"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "compliance_orgaos" ADD CONSTRAINT "compliance_orgaos_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "compliance_obrigacoes" ADD CONSTRAINT "compliance_obrigacoes_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "compliance_obrigacoes" ADD CONSTRAINT "compliance_obrigacoes_categoria_id_fkey" FOREIGN KEY ("categoria_id") REFERENCES "compliance_categorias"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "compliance_obrigacoes" ADD CONSTRAINT "compliance_obrigacoes_orgao_id_fkey" FOREIGN KEY ("orgao_id") REFERENCES "compliance_orgaos"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "compliance_obrigacoes" ADD CONSTRAINT "compliance_obrigacoes_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "compliance_obrigacoes" ADD CONSTRAINT "compliance_obrigacoes_supplier_id_fkey" FOREIGN KEY ("supplier_id") REFERENCES "suppliers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "compliance_obrigacoes" ADD CONSTRAINT "compliance_obrigacoes_etapa_id_fkey" FOREIGN KEY ("etapa_id") REFERENCES "compliance_fluxo_etapas"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "compliance_campo_valores" ADD CONSTRAINT "compliance_campo_valores_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "compliance_campo_valores" ADD CONSTRAINT "compliance_campo_valores_obrigacao_id_fkey" FOREIGN KEY ("obrigacao_id") REFERENCES "compliance_obrigacoes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "compliance_campo_valores" ADD CONSTRAINT "compliance_campo_valores_campo_id_fkey" FOREIGN KEY ("campo_id") REFERENCES "compliance_campo_definicoes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "compliance_responsaveis" ADD CONSTRAINT "compliance_responsaveis_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "compliance_responsaveis" ADD CONSTRAINT "compliance_responsaveis_obrigacao_id_fkey" FOREIGN KEY ("obrigacao_id") REFERENCES "compliance_obrigacoes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "compliance_responsaveis" ADD CONSTRAINT "compliance_responsaveis_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "compliance_responsaveis" ADD CONSTRAINT "compliance_responsaveis_collaborator_id_fkey" FOREIGN KEY ("collaborator_id") REFERENCES "collaborators"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "compliance_versoes" ADD CONSTRAINT "compliance_versoes_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "compliance_versoes" ADD CONSTRAINT "compliance_versoes_obrigacao_id_fkey" FOREIGN KEY ("obrigacao_id") REFERENCES "compliance_obrigacoes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "compliance_arquivos" ADD CONSTRAINT "compliance_arquivos_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "compliance_arquivos" ADD CONSTRAINT "compliance_arquivos_obrigacao_id_fkey" FOREIGN KEY ("obrigacao_id") REFERENCES "compliance_obrigacoes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "compliance_arquivos" ADD CONSTRAINT "compliance_arquivos_versao_id_fkey" FOREIGN KEY ("versao_id") REFERENCES "compliance_versoes"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "compliance_historico" ADD CONSTRAINT "compliance_historico_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "compliance_historico" ADD CONSTRAINT "compliance_historico_obrigacao_id_fkey" FOREIGN KEY ("obrigacao_id") REFERENCES "compliance_obrigacoes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "compliance_historico" ADD CONSTRAINT "compliance_historico_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "compliance_comentarios" ADD CONSTRAINT "compliance_comentarios_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "compliance_comentarios" ADD CONSTRAINT "compliance_comentarios_obrigacao_id_fkey" FOREIGN KEY ("obrigacao_id") REFERENCES "compliance_obrigacoes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "compliance_comentarios" ADD CONSTRAINT "compliance_comentarios_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "compliance_favoritos" ADD CONSTRAINT "compliance_favoritos_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "compliance_favoritos" ADD CONSTRAINT "compliance_favoritos_obrigacao_id_fkey" FOREIGN KEY ("obrigacao_id") REFERENCES "compliance_obrigacoes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "compliance_favoritos" ADD CONSTRAINT "compliance_favoritos_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "compliance_tags" ADD CONSTRAINT "compliance_tags_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "compliance_obrigacao_tags" ADD CONSTRAINT "compliance_obrigacao_tags_obrigacao_id_fkey" FOREIGN KEY ("obrigacao_id") REFERENCES "compliance_obrigacoes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "compliance_obrigacao_tags" ADD CONSTRAINT "compliance_obrigacao_tags_tag_id_fkey" FOREIGN KEY ("tag_id") REFERENCES "compliance_tags"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "compliance_alerta_regras" ADD CONSTRAINT "compliance_alerta_regras_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "compliance_alerta_regras" ADD CONSTRAINT "compliance_alerta_regras_categoria_id_fkey" FOREIGN KEY ("categoria_id") REFERENCES "compliance_categorias"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "compliance_alerta_regras" ADD CONSTRAINT "compliance_alerta_regras_obrigacao_id_fkey" FOREIGN KEY ("obrigacao_id") REFERENCES "compliance_obrigacoes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "compliance_alerta_regras" ADD CONSTRAINT "compliance_alerta_regras_template_id_fkey" FOREIGN KEY ("template_id") REFERENCES "compliance_templates"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "compliance_templates" ADD CONSTRAINT "compliance_templates_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "compliance_escalonamentos" ADD CONSTRAINT "compliance_escalonamentos_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "compliance_escalonamentos" ADD CONSTRAINT "compliance_escalonamentos_categoria_id_fkey" FOREIGN KEY ("categoria_id") REFERENCES "compliance_categorias"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "compliance_escalonamentos" ADD CONSTRAINT "compliance_escalonamentos_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "compliance_notificacao_envios" ADD CONSTRAINT "compliance_notificacao_envios_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "compliance_notificacao_envios" ADD CONSTRAINT "compliance_notificacao_envios_obrigacao_id_fkey" FOREIGN KEY ("obrigacao_id") REFERENCES "compliance_obrigacoes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "compliance_fluxos" ADD CONSTRAINT "compliance_fluxos_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "compliance_fluxo_etapas" ADD CONSTRAINT "compliance_fluxo_etapas_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "compliance_fluxo_etapas" ADD CONSTRAINT "compliance_fluxo_etapas_fluxo_id_fkey" FOREIGN KEY ("fluxo_id") REFERENCES "compliance_fluxos"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "compliance_aprovacoes" ADD CONSTRAINT "compliance_aprovacoes_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "compliance_aprovacoes" ADD CONSTRAINT "compliance_aprovacoes_obrigacao_id_fkey" FOREIGN KEY ("obrigacao_id") REFERENCES "compliance_obrigacoes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "compliance_aprovacoes" ADD CONSTRAINT "compliance_aprovacoes_etapa_id_fkey" FOREIGN KEY ("etapa_id") REFERENCES "compliance_fluxo_etapas"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "compliance_aprovacoes" ADD CONSTRAINT "compliance_aprovacoes_aprovador_id_fkey" FOREIGN KEY ("aprovador_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

