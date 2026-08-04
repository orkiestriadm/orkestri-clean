# Continuar daqui — deploy do People 1.8.0 em produção

> Escrito ao fim da sessão de 04/08/2026. O trabalho de código está **fechado e
> publicado**; o que falta é **subir para produção comercial**, que é a parte
> arriscada e por isso ficou para uma sessão nova, com espaço para ser feita
> inteira e sem pressa.

---

## O pedido, para colar na sessão nova

> Fazer o deploy do Orkiestri People 1.8.0 em produção comercial
> (54.159.107.250, `ssh orkestri-prod`). Produção está em 1.5.0, commit
> `59125f8`. **Backup do banco antes de qualquer coisa.** Três migrations
> novas. `main` está publicado e homologação (localhost) está em 1.8.0
> validada. Ler `docs/people/CONTINUAR-DEPLOY-1.8.0.md` primeiro.

---

## Onde as coisas estão

| | |
|---|---|
| `main` publicado em | `18c5845` |
| Homologação (localhost) | **1.8.0**, no ar e validada na tela |
| Produção (54.159.107.250) | **1.5.0**, commit `59125f8`, intocada |
| Testes | **373 unitários + 157 de integração** |
| Disco em produção | 47 GB livres (19% usado) |

---

## O passo a passo do deploy

### 1. Backup do banco — antes de tudo

Não é formalidade. Uma das migrations é justamente a que impede **dobrar o
passivo de férias de todos os colaboradores**; se algo sair errado no meio, o
backup é a diferença entre voltar atrás e não voltar.

Usar o módulo de Backup do próprio sistema, ou `pg_dump` com **streaming via
`spawn`** — nunca `execSync`, que trava o event loop num dump de ~7 GB (foi a
causa-raiz dos "erros de conexão" em 07/2026).

### 2. Atualizar o código

`/opt/orkestri` pertence ao root: preparar em `/home/ubuntu/deploy-in` e usar
`sudo`. Se for copiar arquivos, **usar tarball com caminhos preservados** —
diretório plano sobrescreve arquivos de mesmo nome-base (`salary.service.ts` e
`page.tsx` existem no backend E no frontend).

**Não copiar o `docker-compose.yml` do repo por cima do de produção.** O
overlay `prod.yml` é que traz o 443 e o `nginx-ssl.conf`; sobrescrever derruba
o TLS em silêncio.

### 3. Migrations (três, todas aditivas)

```
20260803120000_reconciliar_schema_migrations   (já aplicada? conferir)
20260803210000_anonimizacao_lgpd               collaborators.anonimizado_em
20260803230000_avaliacao_360                   tabela performance_review_inputs
```

Nenhuma altera coluna existente. A base de produção tem linhas com FK quebrada
apesar das constraints — por isso as FKs novas vão como `NOT VALID`.

### 4. Subir e conferir

- `GET /api/health` deve responder `"version":"1.8.0"`
- A tela **Sobre** compara a versão do frontend com a da API: divergência ali
  significa deploy pela metade
- A permissão `people.privacidade:gerenciar` é semeada sozinha na subida
- Na subida, a sincronização de férias **reconcilia e poda** períodos obsoletos
  — conferir depois que o total não dobrou:

```sql
SELECT count(*) total,
  count(*) FILTER (WHERE NOT (EXTRACT(MONTH FROM p.inicio)=EXTRACT(MONTH FROM c.data_admissao)
                          AND EXTRACT(DAY FROM p.inicio)=EXTRACT(DAY FROM c.data_admissao))) obsoletos
FROM collaborator_vacation_periods p JOIN collaborators c ON c.id=p.collaborator_id;
```

`obsoletos` tem que ser **0**. Se não for, a poda não rodou.

### 5. Limpar depois

`docker builder prune -af` ao fim — seis builds ocuparam 35 GB numa sessão
anterior. **Nunca** `system prune --volumes`: leva os documentos do People.

---

## O que 1.8.0 leva

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

**Correções que valem citar no deploy:**

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

## Decisões pendentes suas (não bloqueiam o deploy)

1. **`administrator@orkiestri.com` está vinculado à colaboradora Helena Braga**
   em homologação, para testar o Meu RH. Reverter?
   ```sql
   UPDATE collaborators SET user_id = NULL
   WHERE id = '8c1b63e2-edf4-4fac-b8bc-8bc5d16b2082';
   ```
2. **`guilumagaro@hotmail.com` está vinculado ao Rafael Nogueira** (gestor com 7
   liderados), pelo mesmo motivo.
3. **Ciclo 2026.2 da Helena** tem um 360 preenchido (autoavaliação 5, gestor
   3.5, dois pares). Massa de teste — manter ou apagar?
4. Senha do `administrator` em homologação foi redefinida nesta sessão.

---

## O que ainda NÃO está provado

Sendo direto, porque isso muda como você lê o resto:

- **Não existe um único teste de frontend.** Os 530 testes são de backend. Toda
  regressão de tela depende de alguém abrir a página.
- Em ~21 telas abertas nesta sessão, **5 defeitos** apareceram — três anteriores,
  dois introduzidos aqui. Nenhum foi pego por teste.
- Homologação tem **18 pessoas e nenhuma com login** (dois vínculos feitos à
  mão). Nunca rodou com volume, com vários usuários simultâneos, nem com o cron
  das 07:00 disparando de verdade.
- **Fora do escopo, por decisão:** folha de pagamento, ponto, eSocial e
  recrutamento.

## Próximo passo depois do deploy

O que mais reduziria risco daqui em diante é **teste de frontend** — nem que
seja um smoke test que abre cada tela do People e falha se aparecer
"Application error". Dos cinco defeitos desta sessão, dois seriam pegos por
isso sozinho.
