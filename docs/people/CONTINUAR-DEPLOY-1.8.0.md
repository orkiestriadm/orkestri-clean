# Deploy do People 1.8.0 em produção — **feito**

> Escrito como plano ao fim da sessão de 04/08/2026 e reescrito no mesmo dia,
> depois do deploy. **Produção comercial está em 1.8.0 desde 04/08/2026, 10:51**
> (horário de São Paulo). O que segue abaixo é o registro do que aconteceu, o
> que o plano original dizia errado, e o que continua não provado.

---

## Onde as coisas estão agora

| | |
|---|---|
| `main` | `ba5d73e` |
| Produção (54.159.107.250) | **1.8.0** — sistema e API |
| Homologação (localhost) | 1.8.0 |
| Site institucional | 1.1.0, **intocado de propósito** (outro container, outro ciclo) |
| Backup pré-deploy | `/home/ubuntu/backups-deploy-180/` |
| Disco em produção | 47 GB livres (19%), depois do prune |

---

## O que o plano original dizia errado

Vale registrar, porque o mesmo tipo de erro se repete: o handoff foi escrito de
memória, sem conferir a produção.

| O plano dizia | Era |
|---|---|
| Produção em **1.5.0**, commit `59125f8`, **intocada** | Rodava **1.6.0**; o People já tinha ido parcialmente por cópia de arquivos em 03/08 |
| **Três** migrations pendentes | **Duas** — a `reconciliar_schema_migrations` já estava aplicada desde 03/08 14:56 |
| Banco de ~7 GB, cuidado com `execSync` | **25 MB**. O banco de 7 GB é o da homologação; o dump levou segundos |

O commit `59125f8` continuava sendo o `HEAD` do git em produção, e foi daí que
veio a confusão: **o `HEAD` não descrevia o que estava rodando**, porque os
deploys anteriores foram por cópia de arquivo por cima da árvore. A verdade
estava no `/api/health` e na tabela `_prisma_migrations`, não no `git log`.

---

## O que foi feito, na ordem

**1. Backup, antes de qualquer coisa.** `pg_dump --format=custom` para
`/home/ubuntu/backups-deploy-180/orkestri-pre-1.8.0.dump` (749 KB), conferido
com `pg_restore --list` — 1044 objetos, arquivo íntegro. Junto,
`infra-prod.tgz` com `docker-compose*.yml`, `nginx/` e o `.env`.

**2. Código, só `backend/` e `frontend/`.**

```bash
cd /opt/orkestri
sudo git fetch origin
sudo git checkout origin/main -- backend frontend
sudo git diff --stat origin/main -- backend frontend   # saiu vazio
sudo git clean -nd backend frontend                    # nada sobrando
sudo git reset --soft origin/main                      # HEAD passa a dizer a verdade
```

O `reset --soft` não toca em arquivo: serve para o `HEAD` finalmente refletir o
que está no ar, e para o próximo deploy conseguir calcular um delta de verdade.

**Por que não `git pull` nem `reset --hard`:** a árvore de `/opt/orkestri` tem
~660 arquivos permanentemente "modificados" só por CRLF (herança das cópias
feitas a partir do Windows), e os arquivos de infra são customizações reais de
produção. Um `reset --hard` devolveria o `docker-compose.yml` e o
`nginx/nginx-ssl.conf` do repositório por cima dos de produção — e derrubaria o
TLS em silêncio, que é exatamente a armadilha que o plano avisava.

**3. Migrations.** Rodaram sozinhas na partida da API — o `CMD` do backend é
`npx prisma migrate deploy && node dist/main`. As duas pendentes aplicaram sem
erro:

```
Applying migration `20260803210000_anonimizacao_lgpd`
Applying migration `20260803230000_avaliacao_360`
All migrations have been successfully applied.
```

**4. Subida.** `docker compose build api frontend` e depois
`up -d --no-deps api frontend`. Postgres, Redis, nginx, website e Evolution
**não** foram reiniciados. Em seguida, `nginx -s reload`: os containers
recriados trocam de IP e o nginx resolve o upstream na subida.

Detalhe que custa tempo se for esquecido: os containers de produção sobem com
`docker-compose.yml` + **`docker-compose.override.yml`** — o `prod.yml` não está
no jogo, e quem traz o 80/443 é o próprio `docker-compose.yml` de produção. Para
não adivinhar:

```bash
docker inspect orkestri_nginx --format '{{index .Config.Labels "com.docker.compose.project.config_files"}}'
```

**5. Limpeza.** `docker builder prune -af` liberou 4,4 GB; o disco voltou de 26%
para 19%.

---

## Verificações

| Checagem | Resultado |
|---|---|
| `GET /api/health`, interno e público via HTTPS | `1.8.0` |
| Versão compilada no frontend | 1.8.0 em `sobre/page.js` — sem divergência tela × API |
| `people.privacidade:gerenciar` semeada na subida | sim, 13:51:23 UTC |
| `performance_review_inputs` criada, `collaborators.anonimizado_em` criada | sim |
| Erros nos logs da API | nenhum |
| HTTPS e site institucional em `/` | de pé; `<title>` continua o do site |
| Rotas `/dashboard/people/{meu-rh,avaliacoes,privacidade}` | 307 de autenticação, nenhum 500 |

**A checagem de férias passou por vacuidade.** A query do plano deu
`obsoletos = 0`, mas com `total = 0`: produção tem **um único colaborador
cadastrado, e sem data de admissão**. O log confirma — "Férias sincronizadas na
subida: 0 colaborador(es), 0 falha(s)". A poda de períodos obsoletos, que era o
maior risco do deploy, **não foi exercitada**. Ela só será testada de verdade no
primeiro deploy depois que houver gente cadastrada em produção. Guardar a query:

```sql
SELECT count(*) total,
  count(*) FILTER (WHERE NOT (EXTRACT(MONTH FROM p.inicio)=EXTRACT(MONTH FROM c.data_admissao)
                          AND EXTRACT(DAY FROM p.inicio)=EXTRACT(DAY FROM c.data_admissao))) obsoletos
FROM collaborator_vacation_periods p JOIN collaborators c ON c.id=p.collaborator_id;
```

---

## Se precisar voltar atrás

As duas migrations são aditivas e idempotentes (`IF NOT EXISTS` em tudo): uma
coluna anulável e uma tabela nova que nasceu vazia. **Nenhum dado existente foi
tocado**, então voltar o código para a imagem anterior já resolve — não é
preciso restaurar o banco. Se ainda assim for necessário:

```bash
sudo docker exec -i orkestri_postgres pg_restore -U orkestri -d orkestri --clean \
  < /home/ubuntu/backups-deploy-180/orkestri-pre-1.8.0.dump
```

E a infra, se alguém sobrescrever compose ou nginx:
`sudo tar xzf /home/ubuntu/backups-deploy-180/infra-prod.tgz -C /opt/orkestri`.

---

## O que 1.8.0 levou

**Meu RH** — cada pessoa vê o próprio saldo de férias, documentos, carreira,
avaliações e pendências. Nenhuma rota recebe `collaboratorId`: o alvo sai do
token, e nenhuma exige permissão `people.*` (ver o próprio saldo não é
privilégio a conceder).

**Avaliação 360** — autoavaliação, pares e calibração entre gestores. A nota do
gestor não vira média com as outras. Comentários de pares chegam sem autor, e a
média some para o avaliado abaixo de 3 respostas.

**Privacidade (LGPD)** — eliminação de dado pessoal de ex-colaborador após o
prazo de guarda de 5 anos. **Não existe expurgo automático**, de propósito: uma
ação trabalhista em curso obriga a guardar tudo e o sistema não sabe que ela
existe.

**Correções que foram junto:**

- **IDOR**: `where: { ...where, id }` fazia o id literal sobrescrever o filtro
  de escopo — qualquer usuário autenticado abria o perfil completo de qualquer
  colega pela URL.
- **Erro de um dia**: quatro implementações de "início do dia" usavam
  `setHours(0,0,0,0)` sobre coluna DATE (meia-noite UTC). Em UTC-3 todo prazo
  recuava um dia.
- **Modal atrás do menu** em 27 telas (contexto de empilhamento da `.main-area`).
- **Conformidade documental** quebrava sempre (`porAprovacao.map is not a function`).
- **Filtro de setor** escondia 10 de 18 pessoas (só listava setores ativos).

---

## Decisões pendentes suas

Todas de **homologação** — não foram tocadas no deploy e não afetam produção.

1. **`administrator@orkiestri.com` vinculado à colaboradora Helena Braga**, para
   testar o Meu RH. Reverter?
   ```sql
   UPDATE collaborators SET user_id = NULL
   WHERE id = '8c1b63e2-edf4-4fac-b8bc-8bc5d16b2082';
   ```
2. **`guilumagaro@hotmail.com` vinculado ao Rafael Nogueira** (gestor com 7
   liderados), pelo mesmo motivo.
3. **Ciclo 2026.2 da Helena** tem um 360 preenchido (autoavaliação 5, gestor
   3.5, dois pares). Massa de teste — manter ou apagar?
4. Senha do `administrator` em homologação foi redefinida em 04/08.

---

## O que ainda NÃO está provado

O deploy não mudou nada disto:

- **Não existe um único teste de frontend.** Os 530 testes (373 unitários + 157
  de integração) são de backend. Toda regressão de tela depende de alguém abrir
  a página.
- **Nenhuma tela do People foi validada em produção.** O smoke test feito no
  deploy prova que as rotas não estouram no SSR — não que funcionam.
- Produção tem **1 colaborador cadastrado**. Nunca rodou com volume, com vários
  usuários simultâneos, nem com o cron das 07:00 disparando de verdade.
- Em ~21 telas abertas na sessão de desenvolvimento, **5 defeitos** apareceram —
  três anteriores, dois introduzidos ali. Nenhum foi pego por teste.
- **Fora do escopo, por decisão:** folha de pagamento, ponto, eSocial e
  recrutamento.

## Próximo passo

O que mais reduziria risco daqui em diante continua sendo **teste de frontend**
— nem que seja um smoke test que abre cada tela do People e falha se aparecer
"Application error". Dos cinco defeitos da sessão de desenvolvimento, dois
seriam pegos por isso sozinho.

Depois disso, o segundo item é **cadastrar gente de verdade em produção**: quase
todo o módulo está no ar sem nunca ter visto dado real, e a reconciliação de
férias na subida é a parte que mais preocupa.
