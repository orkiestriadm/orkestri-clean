# Publicação do site 3.5.0 — 03/11/2026

Publicação expressamente autorizada pelo usuário, concluída em **03/11/2026, 08:49:34 (America/Sao_Paulo)**. Código: **2ac757a**, branch **claude/orkiestri-audit-benchmark-4a28b4**, PR #24 (rascunho).

## O que entrou

Cinco páginas novas — `/planos`, `/aurelia`, `/o-que-pedir`, `/funcionalidades` e `/seguranca` —, a demonstração clicável na home, a faixa do teste acima do cabeçalho e o CTA coerente em todo o site. Detalhe do conteúdo no PR #24.

**O preço passa a existir no site.** Até hoje o Orkiestri cobrava R$ 11,90 sem publicar esse valor em lugar nenhum: a pessoa só descobria na conversa com a Aurélia, no sétimo dia, depois de já ter dado CPF e e-mail.

## A base estava errada, e isso quase foi ao ar

O trabalho nasceu sobre `codex/aurelia-date-followup`, a base que `AGENTS.md` e `CLAUDE.md` indicam. O `.deploy-ref` do servidor diz outra coisa: produção roda **ffa1f2a**, sistema **5.1.1** de 02/11, seis commits à frente dessa base.

A diferença não era cosmética. Em 02/11 saiu **Contas a Pagar** junto com a dashboard do Financeiro — `financeiro.module.ts` removido inteiro, parser de `"Conta:"` inexistente, opção some do menu guiado — e o Finance virou "Meus gastos". Do Service saíram Catálogo, Horas, CSAT e Automações.

Publicar a versão anterior teria **reanunciado cinco módulos removidos** e sobrescrito a correção que a própria produção já tinha no `products.ts`. A branch foi rebaseada em `7b25aea` (ponta da linha de produção, sem alteração em `website/`) e o conteúdo refeito contra os parsers da 5.1.1: a parede foi de 45 para 42 pedidos, o catálogo trocou a funcionalidade de vencimento por metas e orçamento, e o rodapé e o quadro de avisos passaram a dizer "Meus gastos".

`docs/PARIDADE_PRODUCAO_2026-10-28.md` e as instruções de base continuam apontando para a referência antiga. **Enquanto não forem atualizados, todo trabalho que partir delas nasce desatualizado.**

## Procedimento

O `deploy.sh` não cobre `website/`. A imagem foi construída localmente para `linux/amd64` (o host de produção tem 1,9 GB de RAM e 717 MB livres no momento da publicação) e transferida pronta.

1. Build local com `--provenance=false --sbom=false`. Sem isso o buildx gera índice multi-plataforma com atestação — foi o que interrompeu a publicação de 28/10 ao divergir do manifesto no servidor.
2. Candidato exercitado localmente em container **idêntico ao de produção**: `read_only`, tmpfs `/app/.next/cache:mode=1777,size=64m` e `/tmp`. Dez rotas em 200, nenhum termo de módulo removido, e o otimizador de imagem respondendo `image/jpeg` em duas chamadas seguidas — é o teste que pega a armadilha do `ENOENT: mkdir` em `.next/cache`, que em 26/10 deixou oito capturas do hero em branco.
3. Transferência para `/home/ubuntu/deploy-in`, conferida por SHA-256 nas duas pontas: `a16ce68d7614788c43996ab111ec586c56499ee131d88701e1d8bc3bc8e9b42b`.
4. Tag de rollback da imagem em uso antes de qualquer troca.
5. `docker load`, confirmação do id e da plataforma, retag para `latest` e `up -d --force-recreate --no-build website`.

## Resultado

| | |
|---|---|
| Imagem ativa | `sha256:47d2e4ff3e887e2f9ffc154b6f7dba2a6bdd29ef1150ed06bc1b2c24f5f86df7` |
| Rollback | `orkestri/website:rollback-planos-20261103` → `sha256:722913f190e3a6c174ff11c4f9d186c5b73c6d14e59103a1a4f609ac22c02d1f` |
| Container | `orkestri_website` `e35ed217eb2e` → `6b389afa8311` |

**Só o website trocou.** Os outros nove containers — API, frontend, PostgreSQL, Redis, Evolution, media-worker, nginx, certbot e sa_panel — mantiveram o mesmo id. API seguiu `healthy`. Nginx não precisou de reload. Nenhuma migration, seed, alteração de conta ou envio de mensagem.

## Validação depois da troca

Oito rotas públicas em 200 por HTTPS através do nginx, rodapé em `v3.5.0`, nenhum termo de módulo removido no HTML servido, e conferência no navegador em `https://www.orkiestri.com/planos`: faixa do teste no topo, `Um plano. R$ 11,90 por mês.` no título e a navegação com Aurélia e Planos.

Rollback preparado e não acionado.

## Pendências que esta publicação não toca

- O PR #24 continua em rascunho e aponta para a base antiga; a troca da base ficou com o usuário.
- Orçamento/e-mail seguem só em homologação, fora da produção.
- O primeiro acesso (commit `35aa5c9`) continua não publicado.

Esta autorização cobre somente esta publicação.
