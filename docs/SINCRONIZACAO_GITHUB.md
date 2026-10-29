## Referência após publicação autorizada em 29/10/2026

A base atual é `origin/codex/site-whatsapp-orbit-dots`. Site publicado em fa60e89 com pontos orbitando a captura do WhatsApp, sem monograma, e fundo laranja contínuo. Frontend mantém o login corrigido em b790e15; cadastro e lembretes já estão publicados na API. Partir dessa referência enquanto o PR #22 estiver aberto. Main continua protegida. Ver `docs/DEPLOY_PONTOS_ORBITAIS_2026-10-29.md`. Esta autorização não autoriza futuras publicações.

# Fluxo compartilhado de Git

A referência compartilhada atual é `origin/codex/site-whatsapp-orbit-dots`: fontes auditados da produção com as correções de cadastro, lembretes e login, capturas reais do site e o fundo laranja contínuo com pontos orbitais ao redor do WhatsApp, publicados até 29/10/2026 após autorização. Usar essa referência enquanto o PR #22 estiver aberto. A main permanece protegida nesta tarefa; futuras publicações exigem nova autorização.

Leia `AGENTS.md`, `CLAUDE.md` e `PARIDADE_PRODUCAO_2026-10-28.md`. O inventário das versões históricas está em `INVENTARIO_SINCRONIZACAO_2026-10-28.md`.

1. Conferir status e preservar pendências. Não partir de uma pasta antiga apenas porque ela já está aberta.
2. Fazer `git fetch origin`. Na branch correta e limpa, atualizar com `git pull --ff-only`.
3. Criar branch de tarefa a partir da referência compartilhada. Para trabalho simultâneo, usar pastas separadas com a mesma base.
4. Implementar e executar testes locais isolados. Conferir arquivos novos e diff antes de adicionar ao commit.
5. Salvar commits, fazer push da branch autorizada e registrar SHA, testes, decisões e pendências.
6. Abrir PR para revisão quando necessário. Não usar auto-merge e não executar deploy como parte da sincronização.

O repositório é público. Credenciais, dados de clientes, uploads, arquivos de ambiente, caches e builds ficam fora do Git. Código, migrations como arquivos e documentação técnica podem ser versionados após revisão.

A pasta antiga `C:/orkestri-clean`, as antigas worktrees do Claude e as branches históricas preservam outras linhas do produto, inclusive Hub. Não copiar essas árvores sobre a versão atual. Para recuperar algo antigo, revisar seletivamente contra a base compartilhada.

O retrato de 530 hashes em `baselines/production-20261028.json` pode ser conferido com `node scripts/verify-source-baseline.cjs`. A verificação não conecta ao servidor. Divergências depois de mudanças intencionais devem ser explicadas e revisadas.

Sincronizar código do servidor para o GitHub não muda o sistema ativo. Aplicar migrations, copiar arquivos para o servidor, construir/substituir imagens, reiniciar serviços e alterar configuração de produção são operações separadas e exigem autorização expressa. Conferir novamente workflows e integrações antes de qualquer futura publicação ou integração na main.
