# Publicação em produção — 5.1.1, 02/11/2026

Autorizada expressamente pelo usuário nesta data. Esta autorização não vale
para as próximas.

## O que subiu

| | |
|---|---|
| Ref | `origin/claude/orquestra-dashboard-finance-refactor-2ce18c` |
| Commit | `ffa1f2a` |
| Versão | 5.1.1 (`VERSAO` e `VERSAO_API`) |
| Veio de | `5425127` (4.3.1) |
| Serviços | `api` e `frontend` (o `--build frontend` arrastou a `api` pelo `depends_on`) |

Três entregas: a agenda abrindo a Visão Geral com Finance/Budget/Service
reduzidos (5.0.0), o atalho instalável (5.1.0) e a voz das telas de entrada
(5.1.1).

## PRODUÇÃO NÃO ESTÁ MAIS EM `main`

`main` está em `3859c35` (4.0.0), **26 commits atrás**. Publicar `main` hoje
derrubaria sete versões. O próximo deploy parte de
`origin/claude/orquestra-dashboard-finance-refactor-2ce18c` ou de um merge
dela, nunca de `main`.

O `git log` do servidor continua mentindo: a cabeça em `/opt/orkestri` está em
`304e458`, 99 commits atrás, com centenas de arquivos modificados. O que vale é
`/opt/orkestri/.deploy-ref` — o `deploy.sh` o mantém, e ele estava correto.

## O que o `deploy.sh` NÃO cobriu

**1. nginx — feito à mão, precisa ser refeito se o arquivo for substituído.**

O escopo do deploy é `backend frontend`. O manifest e os ícones do atalho ficam
na RAIZ do domínio, e a raiz é do site institucional: antes da correção,
`/manifest.webmanifest` devolvia o HTML do site e `/icon-192.png` dava 404 —
sem erro nenhum, só a opção de instalar que nunca aparecia.

A regra ampliada (linha ~259 de `nginx/nginx-ssl.conf`):

    location ~ ^/(sw\.js|manifest\.webmanifest|apple-touch-icon\.png|icon-[0-9]+(-maskable)?\.png|logo-orkiestri-dark\.png)$

Aplicada com `tee` no mesmo arquivo, preservando o inode (267659 antes e
depois): `sed -i` criaria outro inode e o container seguiria lendo o antigo.
Conferida DENTRO do container com `nginx -t` e recarregada com `nginx -s reload`.
Backup em `/opt/orkestri/nginx/nginx-ssl.conf.bak-20261102`.

O arquivo do servidor tinha `assinatura` na lista de rotas do sistema e o do
repositório não. Copiar o do repo por cima teria derrubado
`/assinatura/<token>`. A rota foi trazida para o repositório neste commit, e os
dois arquivos agora são idênticos fora os comentários.

**2. O site institucional (`website/`) não subiu.**

As edições de texto de módulo em `website/src/config/products.ts` e
`website/src/app/page.tsx` (commit `ed78a34`) continuam só no git. Publicar o
site é operação à parte — ver `reference_deploy_website_prod`.

## Conferido no ar

- `/api/health` responde 5.1.1; paridade do script: 260 arquivos, idêntico ao ref
- os 12 arquivos dos módulos removidos foram apagados do disco do servidor
- `/manifest.webmanifest` → 200 `application/manifest+json`; os quatro ícones → 200 `image/png`
- em `https://orkiestri.com`, no Chrome: service worker `activated` no escopo da
  origem e o botão **Instalar** na barra de endereço
- `/api/agenda` → 200 com array real; o widget da agenda carrega do banco
- menu reduzido confirmado: Chamados, Conhecimento, Projetos, Agenda, Keep,
  Meus Gastos, Orçamento
- `/assinatura/<token>` → 200 pelo sistema (o 404 em `/assinatura` sem token é
  anterior e correto: a rota é `[token]`)

## NÃO conferido

**Login real.** Ninguém entrou com e-mail e senha depois do deploy. O token de
permissões mudou de tamanho (saíram `automacoes:*` e `financeiro:*`), e token
maior já derrubou o login com 502 no buffer do nginx — aqui ele diminuiu, o que
é o lado seguro, mas continua sem prova.

**Os módulos removidos do ponto de vista de quem usava.** Quem fechava chamado
pela avaliação de estrelas agora depende de mudar o status.
