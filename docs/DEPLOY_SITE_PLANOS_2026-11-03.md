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

## Segunda publicação do dia — site 3.6.0, às 09:28

Autorizada na sequência da primeira. Código **7a75b8e**, mesma branch.

Toda amostra do produto passou a acontecer dentro de uma moldura de celular, e a órbita de quatro pontos — que desde 29/10 era exclusiva do hero — passou a acompanhar todas elas: hero, galeria da home, `/demo`, `/aurelia` e a demonstração clicável de `/o-que-pedir`. O hero perdeu a órbita própria; com as duas, ficariam oito pontos em duas elipses.

Mesmo procedimento: build local `linux/amd64` sem atestação, candidato exercitado em container idêntico ao de produção (treze rotas em 200, otimizador de imagem respondendo `image/jpeg`, nenhum erro no log), SHA-256 conferido nas duas pontas (`040f45284a3ac559a78a8f55eb744b4fd58f6e7ae83a64f0680ef860b33dfbbe`) e troca só do container do site.

| | |
|---|---|
| Imagem ativa | `sha256:ec8437c1198fa254143df741682f0d872574637aa233cf7b2974ba57963ccdc6` |
| Rollback | `orkestri/website:rollback-celular-20261103` → `sha256:47d2e4ff…` (o 3.5.0 publicado às 08:49) |
| Container | `orkestri_website` `6b389afa8311` → `a46b70332cbc` |

Os outros nove containers mantiveram o id e a API seguiu `healthy`. Depois da troca: oito rotas públicas em 200 por HTTPS, rodapé em `3.6.0`, três molduras de celular e doze pontos de órbita no HTML da home, e as três molduras medidas no navegador com dimensão real.

**Uma captura headless do hero saiu em branco** e isso não é defeito: o conteúdo do hero entra por animação, e o `--screenshot` do Chrome fotografa antes de ela terminar. A conferência vale no navegador, forçando o estado final — foi assim que as três molduras foram medidas.

## Terceira e quarta publicações do dia — site 3.7.0 e 3.7.1

A moldura virou um iPhone de verdade (barra de status com sinal, wi-fi e bateria, ilha, botões laterais e barra de gestos) e entrou a linha do tempo "um dia normal", com seis momentos na home.

**A 3.7.1 saiu minutos depois da 3.7.0, e por um defeito meu.** A verificação pós-troca leu os horários renderizados no ar e eles estavam fora de ordem: `07:00 → 09:15 → 12:40 → 15:30 → 14:00 → 22:30`. O próprio comentário do componente diz que a ordem é a informação — a pessoa reconhece o próprio dia na lista antes de ler qualquer descrição. Corrigido e republicado; agora lê `07:00 → 09:15 → 12:40 → 14:00 → 15:30 → 22:30`.

| | 3.7.0 | 3.7.1 |
|---|---|---|
| Código | `f4dc13e` | `bd083a2` |
| Imagem | `sha256:43e0b7c4…` | `sha256:d7eabee4…` |
| SHA-256 do pacote | `ab22c746…` | `792dec5c…` |
| Container | `a46b70332cbc` → `21448c2ccfeb` | → novo |

Rollback da linha: `orkestri/website:rollback-dia-20261103` (o 3.6.0). Nas duas trocas só o container do site mudou de id; os outros nove ficaram iguais e a API seguiu `healthy`.

### O plano anual foi junto, e está desligado

O commit `f41fe9b` leva a página do plano anual pronta — R$ 119,90 no ano, R$ 9,99/mês, R$ 22,90 de economia — atrás da chave `PLANO.anualAtivo`, que está em `false`.

**O sistema não sabe cobrar um ano.** `modules/assinatura/mercadopago.ts` cria o preapproval com `frequency: 1, frequency_type: "months"`, e `trial-renovacao.ts` só conhece `VALOR_MENSALIDADE` e `somarUmMes`. Com a chave desligada nada disso aparece no site — conferido no candidato e no ar, zero ocorrências de "119,90" em `/planos`.

Ligar a chave antes de o backend cobrar anual faria a pessoa escolher o anual e receber cobrança mensal.

### Duas medições que enganaram

Uma captura headless do hero saiu em branco: o conteúdo entra por animação e o `--screenshot` fotografa antes de ela terminar. E uma leitura de overflow deu positivo porque o painel do navegador estava com largura zero; medido de novo a 390px e a 1440px, não há estouro. Nos dois casos a conferência válida foi no navegador, com viewport real.

## Pendências que esta publicação não toca

- O PR #24 continua em rascunho e aponta para a base antiga; a troca da base ficou com o usuário.
- Orçamento/e-mail seguem só em homologação, fora da produção.
- O primeiro acesso (commit `35aa5c9`) continua não publicado.

Esta autorização cobre somente esta publicação.
