-- Baseline migration: schema already exists in production database
-- This file documents the initial schema state

-- Enum types (idempotent)
DO $$ BEGIN
  CREATE TYPE "ProjectStatus" AS ENUM ('PLANEJAMENTO', 'EM_ANDAMENTO', 'PAUSADO', 'CONCLUIDO', 'CANCELADO');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE TYPE "Priority" AS ENUM ('BAIXA', 'MEDIA', 'ALTA', 'URGENTE');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE TYPE "TaskStatus" AS ENUM ('A_FAZER', 'EM_ANDAMENTO', 'EM_REVISAO', 'CONCLUIDA', 'CANCELADA');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE TYPE "EventType" AS ENUM ('PESSOAL', 'REUNIAO', 'PROJETO', 'EXTERNO');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE TYPE "NoteType" AS ENUM ('TEXTO', 'CHECKLIST');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE TYPE "Recurrence" AS ENUM ('DIARIA', 'SEMANAL', 'QUINZENAL', 'MENSAL');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS public.alert_configs (
    id text NOT NULL,
    minutos integer NOT NULL,
    ativo boolean DEFAULT true NOT NULL,
    emoji text DEFAULT '>>>'::text NOT NULL,
    titulo text NOT NULL,
    mensagem text NOT NULL,
    criado_em timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    atualizado_em timestamp(3) without time zone NOT NULL,
    CONSTRAINT alert_configs_pkey PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS public.audit_log (
    id text NOT NULL,
    user_id text,
    tabela text NOT NULL,
    registro_id text NOT NULL,
    acao text NOT NULL,
    criado_em timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    CONSTRAINT audit_log_pkey PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS public.roles (
    id text NOT NULL,
    nome text NOT NULL,
    descricao text,
    is_master boolean DEFAULT false NOT NULL,
    criado_em timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    CONSTRAINT roles_pkey PRIMARY KEY (id)
);

CREATE UNIQUE INDEX IF NOT EXISTS roles_nome_key ON public.roles USING btree (nome);

CREATE TABLE IF NOT EXISTS public.users (
    id text NOT NULL,
    nome text NOT NULL,
    email text NOT NULL,
    senha_hash text NOT NULL,
    ativo boolean DEFAULT true NOT NULL,
    avatar text,
    ultimo_login timestamp(3) without time zone,
    criado_em timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    atualizado_em timestamp(3) without time zone NOT NULL,
    CONSTRAINT users_pkey PRIMARY KEY (id)
);

CREATE UNIQUE INDEX IF NOT EXISTS users_email_key ON public.users USING btree (email);

CREATE TABLE IF NOT EXISTS public.user_roles (
    user_id text NOT NULL,
    role_id text NOT NULL,
    atribuido_por text,
    atribuido_em timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    CONSTRAINT user_roles_pkey PRIMARY KEY (user_id, role_id)
);

CREATE TABLE IF NOT EXISTS public.setores (
    id text NOT NULL,
    nome text NOT NULL,
    descricao text,
    cor text,
    ativo boolean DEFAULT true NOT NULL,
    criado_em timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    CONSTRAINT setores_pkey PRIMARY KEY (id)
);

CREATE UNIQUE INDEX IF NOT EXISTS setores_nome_key ON public.setores USING btree (nome);

CREATE TABLE IF NOT EXISTS public.user_profiles (
    id text NOT NULL,
    user_id text NOT NULL,
    whatsapp text,
    whatsapp_alertas boolean DEFAULT false NOT NULL,
    criado_em timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    two_factor_secret text,
    two_factor_ativo boolean DEFAULT false NOT NULL,
    two_factor_backup text,
    status_online text DEFAULT 'disponivel'::text,
    setor_id text,
    cargo text,
    telefone text,
    CONSTRAINT user_profiles_pkey PRIMARY KEY (id)
);

CREATE UNIQUE INDEX IF NOT EXISTS user_profiles_user_id_key ON public.user_profiles USING btree (user_id);

CREATE TABLE IF NOT EXISTS public.user_sessions (
    id text NOT NULL,
    user_id text NOT NULL,
    token_hash text NOT NULL,
    ip_address text,
    expira_em timestamp(3) without time zone NOT NULL,
    criado_em timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    CONSTRAINT user_sessions_pkey PRIMARY KEY (id)
);

CREATE INDEX IF NOT EXISTS user_sessions_token_hash_idx ON public.user_sessions USING btree (token_hash);

CREATE TABLE IF NOT EXISTS public.notifications (
    id text NOT NULL,
    user_id text NOT NULL,
    tipo text NOT NULL,
    titulo text NOT NULL,
    mensagem text,
    referencia_tipo text,
    referencia_id text,
    lida boolean DEFAULT false NOT NULL,
    criado_em timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    CONSTRAINT notifications_pkey PRIMARY KEY (id)
);

CREATE INDEX IF NOT EXISTS notifications_user_id_lida_idx ON public.notifications USING btree (user_id, lida);

CREATE TABLE IF NOT EXISTS public.events (
    id text NOT NULL,
    user_id text NOT NULL,
    created_by text NOT NULL,
    titulo text NOT NULL,
    descricao text,
    tipo "EventType" DEFAULT 'PESSOAL' NOT NULL,
    cor text,
    inicio timestamp(3) without time zone NOT NULL,
    fim timestamp(3) without time zone,
    dia_todo boolean DEFAULT false NOT NULL,
    origem_tipo text,
    origem_id text,
    confirmado boolean DEFAULT true NOT NULL,
    recorrencia "Recurrence",
    recorrencia_fim timestamp(3) without time zone,
    local text,
    ata text,
    criado_em timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    atualizado_em timestamp(3) without time zone NOT NULL,
    CONSTRAINT events_pkey PRIMARY KEY (id)
);

CREATE INDEX IF NOT EXISTS events_user_id_inicio_idx ON public.events USING btree (user_id, inicio);

CREATE TABLE IF NOT EXISTS public.event_participants (
    id text NOT NULL,
    event_id text NOT NULL,
    user_id text NOT NULL,
    status text DEFAULT 'pendente'::text NOT NULL,
    CONSTRAINT event_participants_pkey PRIMARY KEY (id)
);

CREATE UNIQUE INDEX IF NOT EXISTS event_participants_event_id_user_id_key ON public.event_participants USING btree (event_id, user_id);

CREATE TABLE IF NOT EXISTS public.projects (
    id text NOT NULL,
    created_by text NOT NULL,
    titulo text NOT NULL,
    descricao text,
    status "ProjectStatus" DEFAULT 'PLANEJAMENTO' NOT NULL,
    prioridade "Priority" DEFAULT 'MEDIA' NOT NULL,
    data_inicio timestamp(3) without time zone,
    data_fim timestamp(3) without time zone,
    progresso_pct integer DEFAULT 0 NOT NULL,
    cor text,
    criado_em timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    atualizado_em timestamp(3) without time zone NOT NULL,
    CONSTRAINT projects_pkey PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS public.project_members (
    project_id text NOT NULL,
    user_id text NOT NULL,
    papel text DEFAULT 'membro'::text NOT NULL,
    adicionado_em timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    CONSTRAINT project_members_pkey PRIMARY KEY (project_id, user_id)
);

CREATE TABLE IF NOT EXISTS public.milestones (
    id text NOT NULL,
    project_id text NOT NULL,
    titulo text NOT NULL,
    descricao text,
    data_alvo timestamp(3) without time zone NOT NULL,
    concluido boolean DEFAULT false NOT NULL,
    criado_em timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    CONSTRAINT milestones_pkey PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS public.tasks (
    id text NOT NULL,
    project_id text NOT NULL,
    milestone_id text,
    assignee_id text,
    created_by text NOT NULL,
    titulo text NOT NULL,
    descricao text,
    status "TaskStatus" DEFAULT 'A_FAZER' NOT NULL,
    prioridade "Priority" DEFAULT 'MEDIA' NOT NULL,
    data_vencimento timestamp(3) without time zone,
    criado_em timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    atualizado_em timestamp(3) without time zone NOT NULL,
    CONSTRAINT tasks_pkey PRIMARY KEY (id)
);

CREATE INDEX IF NOT EXISTS tasks_project_id_status_idx ON public.tasks USING btree (project_id, status);

CREATE TABLE IF NOT EXISTS public.task_comments (
    id text NOT NULL,
    task_id text NOT NULL,
    user_id text NOT NULL,
    conteudo text NOT NULL,
    criado_em timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    CONSTRAINT task_comments_pkey PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS public.notes (
    id text NOT NULL,
    user_id text NOT NULL,
    titulo text,
    conteudo text,
    cor text,
    fixado boolean DEFAULT false NOT NULL,
    arquivado boolean DEFAULT false NOT NULL,
    lixeira boolean DEFAULT false NOT NULL,
    tipo "NoteType" DEFAULT 'TEXTO' NOT NULL,
    ordem integer DEFAULT 0 NOT NULL,
    criado_em timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    atualizado_em timestamp(3) without time zone NOT NULL,
    CONSTRAINT notes_pkey PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS public.checklists (
    id text NOT NULL,
    note_id text NOT NULL,
    titulo text,
    ordem integer DEFAULT 0 NOT NULL,
    CONSTRAINT checklists_pkey PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS public.checklist_items (
    id text NOT NULL,
    checklist_id text NOT NULL,
    assignee_id text,
    descricao text NOT NULL,
    concluido boolean DEFAULT false NOT NULL,
    data_vencimento timestamp(3) without time zone,
    ordem integer DEFAULT 0 NOT NULL,
    criado_em timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    CONSTRAINT checklist_items_pkey PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS public.note_labels (
    id text NOT NULL,
    user_id text NOT NULL,
    nome text NOT NULL,
    cor text,
    CONSTRAINT note_labels_pkey PRIMARY KEY (id)
);

CREATE UNIQUE INDEX IF NOT EXISTS note_labels_user_id_nome_key ON public.note_labels USING btree (user_id, nome);

CREATE TABLE IF NOT EXISTS public.note_label_map (
    note_id text NOT NULL,
    label_id text NOT NULL,
    CONSTRAINT note_label_map_pkey PRIMARY KEY (note_id, label_id)
);

CREATE TABLE IF NOT EXISTS public.note_collaborators (
    note_id text NOT NULL,
    user_id text NOT NULL,
    permissao text DEFAULT 'leitura'::text NOT NULL,
    CONSTRAINT note_collaborators_pkey PRIMARY KEY (note_id, user_id)
);

CREATE TABLE IF NOT EXISTS public.daily_tasks (
    id text NOT NULL,
    user_id text NOT NULL,
    checklist_item_id text,
    titulo text NOT NULL,
    concluido boolean DEFAULT false NOT NULL,
    data date NOT NULL,
    tipo text DEFAULT 'TAREFA'::text NOT NULL,
    prioridade integer DEFAULT 0 NOT NULL,
    criado_em timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    CONSTRAINT daily_tasks_pkey PRIMARY KEY (id)
);

CREATE INDEX IF NOT EXISTS daily_tasks_user_id_data_idx ON public.daily_tasks USING btree (user_id, data);

CREATE TABLE IF NOT EXISTS public.alert_configs (
    id text NOT NULL,
    minutos integer NOT NULL,
    ativo boolean DEFAULT true NOT NULL,
    emoji text DEFAULT '>>>'::text NOT NULL,
    titulo text NOT NULL,
    mensagem text NOT NULL,
    criado_em timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    atualizado_em timestamp(3) without time zone NOT NULL,
    CONSTRAINT alert_configs_pkey PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS public.sistema_configs (
    id text NOT NULL,
    chave text NOT NULL,
    valor text NOT NULL,
    criado_em timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    atualizado_em timestamp(3) without time zone NOT NULL,
    CONSTRAINT sistema_configs_pkey PRIMARY KEY (id)
);

CREATE UNIQUE INDEX IF NOT EXISTS sistema_configs_chave_key ON public.sistema_configs USING btree (chave);
