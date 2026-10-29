## Referência após publicação autorizada em 28/10/2026

A base atual é `origin/codex/site-orange-gradients`. O frontend mantém a correção do login publicada em b790e15; o site foi publicado em 91b2292 com degradê laranja nos fundos escuros e o A girando atrás do WhatsApp. Cadastro e lembretes já estão publicados na API. Partir dessa referência enquanto o PR #19 estiver aberto. Main continua protegida. Ver `docs/DEPLOY_DEGRADE_LARANJA_2026-10-28.md`. Esta autorização não autoriza futuras publicações.

# Base compartilhada entre Codex e Claude

## Referência atual
- Usar a branch remota `codex/site-orange-gradients` enquanto o PR #19 estiver aberto; seguir a referência atualizada acima após integração.
- A base de código foi copiada dos fontes observados em produção em 28/10/2026: API e frontend 4.3.0; site 3.3.2. Os hashes dos 530 arquivos auditados constam em `docs/baselines/production-20261028.json`.
- Ler `docs/SINCRONIZACAO_GITHUB.md` e `docs/PARIDADE_PRODUCAO_2026-10-28.md` antes de trabalhar.
- A pasta antiga `C:/orkestri-clean` e as antigas pastas do Claude contêm linhas históricas/Hub preservadas. Não usá-las como fonte de uma nova alteração da versão atual nem copiá-las sobre esta base.

## Produção
- Sincronização Git não autoriza deploy. Não executar deploy, SSH de escrita, rsync/scp para servidor, migrations, seeds, testes com serviços reais ou reinício de containers sem autorização expressa para essa operação.
- Nesta sincronização, não fazer push direto, force-push ou merge na main. Usar branches codex/ e PRs em rascunho, sem auto-merge.
- Conferir workflows e integrações antes de push/PR. Se puderem afetar produção, interromper essa etapa e explicar.
- Nunca alterar produção para fazê-la coincidir com o Git. Nesta base, a direção autorizada foi produção para código local/GitHub.

## Fluxo obrigatório para ambas as IAs
1. Ler este arquivo, `CLAUDE.md` e os documentos de paridade/sincronização.
2. Conferir status, branch e worktrees. Preservar trabalho pendente de outras sessões; não usar reset --hard ou clean para trocar de versão.
3. Executar `git fetch origin`. Em árvore limpa da base correta, atualizar com `git pull --ff-only`. Partir da mesma referência remota indicada acima.
4. Criar uma branch de tarefa. Para trabalhos simultâneos, usar pastas separadas com a mesma base; não exigir que duas IAs editem a mesma árvore ao mesmo tempo.
5. Implementar e executar validações locais isoladas pertinentes. `node scripts/verify-source-baseline.cjs` confere o retrato inicial de produção; diferenças depois de uma tarefa são esperadas e precisam ser explicadas, sem reescrever o manifesto para esconder mudanças.
6. Revisar diff e arquivos novos, salvar commits e fazer push da branch autorizada. Nunca usar `git add .` sem revisar os arquivos.
7. Informar branch, SHA, testes e pendências. Registrar decisões e a nova referência compartilhada em documentação; o histórico do chat não acompanha o clone.

## Privacidade e histórico
- O repositório é público. Não publicar .env, tokens, chaves, dumps, dados de clientes, sessões, caches ou builds.
- Branches históricas `codex/sync-20261028/*` exceto `coordination` preservam trabalhos divergentes; não são a base atual nem releases aprovadas.
- Não substituir esta árvore pelas cópias apps/, work/ ou por fontes da linha Hub. Consultar o inventário para recuperar trabalho antigo seletivamente.
