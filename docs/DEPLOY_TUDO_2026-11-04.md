# Deploy conjunto — API 5.1.3, frontend 5.1.3, site 3.8.0 — 04/11/2026

Publicação expressamente autorizada ("publica e faz o deploy de tudo"). Código: **c552ef6**, branch **claude/orkiestri-audit-benchmark-4a28b4**.

Três serviços publicados de uma vez, na ordem **API → frontend → site**. A API vai primeiro porque o seletor de organização do frontend depende dela para responder `podeVerOrg`.

## O que entrou

- **Gastos da organização para quem administra** (API + frontend). Master vê um seletor "Meus · Organização"; na visão da organização aparecem os gastos de todas as pessoas, com o nome de quem lançou, e os cartões somam a organização. A equipe comum continua vendo só o que é dela, e o backend barra `escopo=org` de quem não é master.
- **Copy de privacidade corrigida** (site). `/seguranca`, `/privacy`, a funcionalidade em `config/aurelia` e um comentário diziam que nem quem administra vê o gasto pessoal — virou o oposto, então os quatro textos foram atualizados.
- **Seção "Para quem é o Orkiestri"** (site): cenários de uso dos cinco públicos, com exemplos reais. Não são depoimentos fabricados.
- Antes neste dia, só o frontend tinha ido a 5.1.2 (tela de gastos deixou de esconder o erro). Isso segue no ar, agora sob 5.1.3.

## Núcleo inerte do plano anual foi junto, de propósito

O build da API a partir desta branch carrega `b4a05ff` — o núcleo de regras do plano anual em `trial-renovacao.ts` (tipo `Plano`, valores, `somarMeses`, `proximaValidade(..., plano="MENSAL")`). É **aditivo e inerte**: nada chama o caminho ANUAL, o default preserva todo comportamento mensal, e a chave `PLANO.anualAtivo` do site segue `false`. A cobrança anual completa (migration, Mercado Pago, a Aurélia oferecendo) vive na outra branch (`claude/ecstatic-sammet-9e9b04`) e **não** foi publicada.

## Verificação antes de construir

Suíte do backend inteira: **549 testes, 46 suítes, tudo verde** — incluindo as de cobrança (`trial-renovacao`, `assinatura`, `webhook`, `aplicar-pagamento`). `tsc` limpo nos três projetos.

Candidatos exercitados em containers isolados: site (3.8.0, rotas 200, "Para quem" e a copy nova presentes), frontend (login 200, bundle 5.1.3, seletor no bundle, sem vazamento do Hub), API (health 5.1.3, **"No pending migrations to apply"**, Nest subiu sem erro). A feature de organização foi provada de ponta a ponta na stack local com dois usuários: master vê os 5 com a coluna Pessoa; usuário comum não vê o seletor e `?escopo=org` devolve só os dele.

## Procedimento

Mesma série: build local `linux/amd64` com `--provenance=false --sbom=false`, SHA-256 conferido nas duas pontas, tag de rollback antes de cada troca, troca de um container por vez.

| | Imagem ativa | Rollback | Container |
|---|---|---|---|
| API | `sha256:89e8ec7ebd4cd71c4c07fd1c40aa236e5086fa1720b42aad322865ed310012b2` | `orkestri/api:rollback-tudo-20261104` → `sha256:14b4c9ef…` | → `25c730571f0e` |
| Frontend | `sha256:1279413d143990aec31268038a36b1b22b4bdfb83c8d8563e652beba6968541e` | `orkestri/frontend:rollback-tudo-20261104` → `sha256:95189d35…` | → `a41dc21cd974` |
| Site | `sha256:d63cfc2e015526c3be4ee99e56f31a293ce20c6ada4e33f169d7028b13240f27` | `orkestri/website:rollback-tudo-20261104` → `sha256:d7eabee4…` | → `07be707c513d` |

SHA-256 dos pacotes: API `ebf842bc…`, frontend `63bf8ff2…`, site `9a479ed7…`.

Os outros seis containers (certbot, evolution, media_worker, nginx, postgres, redis, sa_panel) mantiveram o id. Nenhuma migration pendente — a mudança de gastos é só consulta. Sem seed, sem alteração de conta, sem mensagem.

## Verificação depois da troca (HTTPS, público)

Oito rotas em 200, site em **3.8.0**, "Para quem" na home, API em **5.1.3**, a copy nova em `/seguranca` presente e a antiga sumida em `/privacy`. O otimizador de imagem do site responde **200** no caminho real (`/_site/_next/image?...&q=92`) — um teste inicial deu 400 por eu bater sem o prefixo `/_site/`, não por falha. O hero renderiza as capturas no navegador.

Rollback preparado e não acionado.

## Pendências que este deploy não toca

- A cobrança anual completa segue em `claude/ecstatic-sammet-9e9b04`, não publicada; a chave do site continua `false`.
- Prova social com clientes reais e separar consultoria de produto seguem com o cliente.
