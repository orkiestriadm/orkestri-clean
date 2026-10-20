-- O cadastro passa a ser feito INTEIRO no WhatsApp.
--
-- Antes a pessoa preenchia nome, CPF e WhatsApp num formulário do site e o
-- sistema escrevia para ela. Agora ela clica, o WhatsApp abre já na conversa, e
-- a Aurélia pergunta tudo. Duas consequências no schema:
--
--   `nome` e `cpf` deixam de ser obrigatórios na criação da linha, porque a
--   linha nasce antes de a pessoa responder qualquer coisa.
--
--   A etapa inicial passa de EMAIL para NOME.
--
-- Nenhuma linha existente precisa de conversão: as que houver já têm nome e CPF
-- preenchidos, e afrouxar NOT NULL não as invalida. O default muda só para as
-- próximas.

ALTER TABLE "cadastros_whatsapp" ALTER COLUMN "nome" DROP NOT NULL;
ALTER TABLE "cadastros_whatsapp" ALTER COLUMN "cpf"  DROP NOT NULL;
ALTER TABLE "cadastros_whatsapp" ALTER COLUMN "etapa" SET DEFAULT 'NOME';
