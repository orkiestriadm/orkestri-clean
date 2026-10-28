# Entrada pelo WhatsApp e cadastro no Orkiestri

## Alterações

- Consulta de cadastro por WhatsApp vinculado ou LID verificado antes de orientar um remetente desconhecido. Compara DDD completo e variações válidas do nono dígito; telefone de contato isolado não autentica uma conta.
- Número novo recebe uma apresentação da Aurélia e o comando **CADASTRO**. Número cadastrado mantém seu fluxo normal; ao pedir cadastro, recebe orientação de acesso/menu. Contas bloqueadas e números ambíguos não abrem outra conta.
- Site envia **CADASTRO**, com a chamada **Cadastre-se é gratuito!**. Demonstrações e orientações explicam cadastro no sistema inteiro, sujeito ao plano e às permissões, sem prometer teste da agenda em todo cadastro.
- Abertura do cadastro: “Olá! Você foi direcionado para fazer seu cadastro no Orkiestri. Eu sou a Aurélia e vou te ajudar a começar.” Seguem nome completo, CPF, e-mail e empresa, uma pergunta por vez; uso pessoal aceita **Pessoal**.
- Repetir CADASTRO retoma a etapa e preserva respostas. Em conversa de teste ainda não concluída, escolher CADASTRO remove a origem de teste da agenda. Contas existentes não têm plano, papel ou permissões alterados.
- Convites explícitos de campanha da agenda continuam com suas condições próprias. Estar em uma lista de leads não transforma o cadastro geral em teste da agenda.
- Sem alteração de esquema ou migrações. Cadastro geral usa o fluxo existente de organização própria e não concede acesso de superadministrador global.

## Fontes e validação

Backend atual de produção obtido em `docs/orkiestri-backend-source-20261027.tar.gz`, modificado em `work/whatsapp-entry-20261027/backend`. Não foi usada a cópia antiga do backend da raiz para substituir a produção.

Website autoritativo: `.claude/worktrees/landing-page-audit-redesign-2a4359/Website`. Versão do site: **3.3.1**.

- 32 testes automatizados aprovados nos conjuntos `whatsapp-entrada` e `lead-onboarding`.
- TypeScript do backend e do site aprovados.
- Banco de produção: 114 migrações, esquema atualizado antes da publicação.
- Imagem candidata da API: 29 verificações com banco real aprovadas, incluindo cadastro completo e isolamento de organização/permissões. Transação revertida; usuário, perfil, cadastro e fila de boas-vindas de teste ausentes após rollback. Todos os envios simulados: zero mensagens reais.
- Manifesto de 17 arquivos: `docs/whatsapp-entry-release-20261027.json`; integridade conferida antes de aplicar e após extrair.
- Backup dos fontes anteriores: `/opt/orkestri/backups/whatsapp-entry-before-20261027T083231Z.tar.gz`.
- Imagens de retorno: `orkestri/api:rollback-whatsapp-entry-20261027` e `orkestri/website:rollback-before-3.3.1-20261027`.

## Publicação concluída

Ativação em **27/10/2026, 05:42 (America/Sao_Paulo)**. Apenas API e website recriados; frontend do sistema preservado. Nginx validado e recarregado, API saudável.

- Imagem ativa da API: `sha256:344452cc3beefea0a0fefd469d5d7ca54b9406fd1f026212343fe24fce8bcfa9`.
- Imagem ativa do website: `sha256:f89f512402f2dd6601241da1e407c4eef30211ae947674eea4c80e26ed195064`.
- Imagem candidata do site validada isoladamente: quatro rotas, 14 links com **CADASTRO**, redirecionamento `/entrar` para `/login` aprovado.
- Verificação pública após ativação: home, `/demo`, `/blog`, `/products/orkiestri-one`, `/login` e `/api/health` disponíveis; 14 links com comando **CADASTRO**, versão 3.3.1 confirmada.
- Os dois últimos ajustes de texto da demonstração também foram incluídos no manifesto final e passaram pelo build de produção com lint e TypeScript.

Para retomar uma conversa iniciada antes desta atualização, enviar **CADASTRO**. A etapa atual é preservada, e uma conversa de teste ainda não concluída passa a cadastro geral. O botão de uma página antiga já aberta pode conservar o texto anterior até atualizar a página.
