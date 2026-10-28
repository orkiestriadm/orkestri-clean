-- Cadastro iniciado no site e concluído pelo WhatsApp.
--
-- Aditiva: cria UMA tabela nova e não toca em nenhuma existente. Sem FK para
-- `users` nem para `organizations` de propósito — a linha nasce ANTES de haver
-- conta ou organização, e as duas colunas só são preenchidas na conclusão. Uma
-- chave estrangeira aqui obrigaria a ordem inversa.
--
-- `expira_em` não tem default: quem insere decide a validade da conversa, e um
-- default esconderia o esquecimento de defini-la.

CREATE TABLE IF NOT EXISTS "cadastros_whatsapp" (
    "id"              TEXT         NOT NULL,
    "nome"            TEXT         NOT NULL,
    "cpf"             TEXT         NOT NULL,
    "whatsapp"        TEXT         NOT NULL,
    "status"          TEXT         NOT NULL DEFAULT 'AGUARDANDO',
    "etapa"           TEXT         NOT NULL DEFAULT 'EMAIL',
    "respostas"       TEXT         NOT NULL DEFAULT '{}',
    "tentativas"      INTEGER      NOT NULL DEFAULT 0,
    "ip_origem"       TEXT,
    "organization_id" TEXT,
    "user_id"         TEXT,
    "expira_em"       TIMESTAMP(3) NOT NULL,
    "concluido_em"    TIMESTAMP(3),
    "criado_em"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizado_em"   TIMESTAMP(3) NOT NULL,

    CONSTRAINT "cadastros_whatsapp_pkey" PRIMARY KEY ("id")
);

-- Busca da conversa aberta pelo número de quem mandou a mensagem: é o caminho
-- quente, consultado a CADA mensagem recebida no webhook.
CREATE INDEX IF NOT EXISTS "cadastros_whatsapp_whatsapp_status_idx"
    ON "cadastros_whatsapp"("whatsapp", "status");

-- Varredura do expirador.
CREATE INDEX IF NOT EXISTS "cadastros_whatsapp_status_expira_em_idx"
    ON "cadastros_whatsapp"("status", "expira_em");

-- Limite por origem: quantos cadastros este IP abriu na última hora.
CREATE INDEX IF NOT EXISTS "cadastros_whatsapp_ip_origem_criado_em_idx"
    ON "cadastros_whatsapp"("ip_origem", "criado_em");
