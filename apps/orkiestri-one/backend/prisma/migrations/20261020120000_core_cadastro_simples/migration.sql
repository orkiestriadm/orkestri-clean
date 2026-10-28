-- Core: cadastro de usuario simples e fim de Setores/Organograma.
--
-- Acrescenta `users.cpf` e DERRUBA `setores` e `aprovadores_setor`.
--
-- POR QUE ESTA MIGRATION ABORTA EM VEZ DE SO AVISAR
--
-- `setores` e compartilhada com o Hub Transbrasiliana, que roda do MESMO
-- repositorio em branches hub/* e tem modulos vivos pendurados nela. As SETE
-- chaves estrangeiras que apontam para ela, lidas do `pg_constraint` do banco
-- e nao do schema.prisma:
--
--   setores.parent_id                          (hierarquia, a propria tabela)
--   collaborators.setor_id                     People
--   ativos.setor_id                            Ativos
--   transferencias_ativo.de_setor_id           Ativos
--   transferencias_ativo.para_setor_id         Ativos
--   veiculos.setor_id                          Frota
--   aprovadores_setor.setor_id                 Aprovacoes (NOT NULL, CASCADE)
--
-- As duas de `transferencias_ativo` NAO aparecem no schema.prisma: lá
-- `deSetorId`/`paraSetorId` sao escalares soltos, sem `@relation`. A FK existe
-- so no banco. Foi o `psql` que as encontrou, derrubando a primeira versao
-- desta migration com "cannot drop table setores because other objects depend
-- on it" -- e e por isso que a lista acima saiu do `pg_constraint`.
--
-- `user_profiles.setor_id`, ao contrario, tem `@relation` no Prisma e NAO tem
-- FK no banco. O schema e o banco divergem nos dois sentidos.
--
-- `scripts/deploy.sh homologacao` aponta para o Hub. Rodar este deploy a partir
-- da linha do Orkiestri executaria o DROP no banco VIVO do Hub e levaria o dado
-- desses quatro modulos junto, em silencio, porque migration que roda nao
-- pergunta.
--
-- Por isso o bloco abaixo e um GATE, nao um aviso: se achar UMA linha
-- dependente, levanta excecao, a transacao da migration volta inteira e o
-- deploy FALHA em voz alta. No banco do Orkiestri (onde esses quatro modulos
-- sairam em 2.0.0 por nao terem dado nenhum) ele passa e o DROP acontece.
--
-- `user_profiles.setor_id` NAO entra no gate de proposito: e a coluna do
-- proprio Orkiestri e apagar esse vinculo e exatamente o que foi pedido.
--
-- `user_requests.setor_id` FICA. E coluna TEXT solta, sem chave estrangeira
-- (ver 20260520000003_add_collaborator), escrita pelo Workforce do Hub. Nada no
-- DROP de `setores` a obriga a sair.

DO $$
DECLARE
  n_collab  bigint := 0;
  n_ativos  bigint := 0;
  n_veic    bigint := 0;
  n_aprov   bigint := 0;
  n_transf  bigint := 0;
BEGIN
  -- to_regclass em vez de assumir que a tabela existe: o schema de homologacao
  -- nao e o do git e ja divergiu antes.
  IF to_regclass('public.collaborators') IS NOT NULL THEN
    EXECUTE 'SELECT count(*) FROM public.collaborators WHERE setor_id IS NOT NULL' INTO n_collab;
  END IF;
  IF to_regclass('public.ativos') IS NOT NULL THEN
    EXECUTE 'SELECT count(*) FROM public.ativos WHERE setor_id IS NOT NULL' INTO n_ativos;
  END IF;
  IF to_regclass('public.veiculos') IS NOT NULL THEN
    EXECUTE 'SELECT count(*) FROM public.veiculos WHERE setor_id IS NOT NULL' INTO n_veic;
  END IF;
  IF to_regclass('public.aprovadores_setor') IS NOT NULL THEN
    EXECUTE 'SELECT count(*) FROM public.aprovadores_setor' INTO n_aprov;
  END IF;
  IF to_regclass('public.transferencias_ativo') IS NOT NULL THEN
    EXECUTE 'SELECT count(*) FROM public.transferencias_ativo WHERE de_setor_id IS NOT NULL OR para_setor_id IS NOT NULL' INTO n_transf;
  END IF;

  IF (n_collab + n_ativos + n_veic + n_aprov + n_transf) > 0 THEN
    RAISE EXCEPTION
      'ABORTADO: este banco tem modulo vivo pendurado em setores (collaborators=%, ativos=%, veiculos=%, aprovadores_setor=%, transferencias_ativo=%). Este e o banco do HUB, nao o do Orkiestri -- a linha do Orkiestri nao deve ser publicada aqui. Nada foi alterado.',
      n_collab, n_ativos, n_veic, n_aprov, n_transf;
  END IF;
END $$;

-- CPF do cadastro geral. Nulavel e sem default: aditiva, nao reescreve a tabela
-- nem revalida FK (a base tem linha orfa sob constraint NOT VALID). Sem UNIQUE
-- no banco -- a unicidade e por organizacao e quem a verifica e o controller,
-- como ja faz com o e-mail.
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "cpf" TEXT;
CREATE INDEX IF NOT EXISTS "users_organization_id_cpf_idx" ON "users"("organization_id", "cpf");

-- Dependentes de `setores`. DROP COLUMN leva a chave estrangeira junto, por isso
-- nao ha DROP CONSTRAINT explicito.
ALTER TABLE "user_profiles" DROP COLUMN IF EXISTS "setor_id";
ALTER TABLE "collaborators" DROP COLUMN IF EXISTS "setor_id";
ALTER TABLE "ativos"        DROP COLUMN IF EXISTS "setor_id";
ALTER TABLE "veiculos"      DROP COLUMN IF EXISTS "setor_id";

-- `transferencias_ativo` perde so a CHAVE, nao as colunas.
--
-- `de_setor_id` e `para_setor_id` sao escalares soltos no schema.prisma (sem
-- `@relation`), igual a `user_requests.setor_id`: o Prisma nao sabe que a FK
-- existe, e tirar a coluna reescreveria o historico de transferencia de ativo
-- do Hub. Soltar a constraint e o bastante para o DROP TABLE passar, e deixa
-- os ids gravados como registro historico nao mais verificado.
ALTER TABLE "transferencias_ativo" DROP CONSTRAINT IF EXISTS "transferencias_ativo_de_setor_id_fkey";
ALTER TABLE "transferencias_ativo" DROP CONSTRAINT IF EXISTS "transferencias_ativo_para_setor_id_fkey";

DROP TABLE IF EXISTS "aprovadores_setor";
DROP TABLE IF EXISTS "setores";
