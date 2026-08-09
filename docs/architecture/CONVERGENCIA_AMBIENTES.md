# Convergência dos três ambientes

Levantamento feito em **07/08/2026**, por inspeção direta (somente leitura) de
`localhost`, `homologação (10.192.4.123)` e `produção (54.159.107.250)`.

Objetivo: deixar os três na mesma versão sistêmica.

**Conclusão em uma frase:** os três divergiram em direções DIFERENTES, e
homologação tem trabalho real que não está no git — resgatar isso é o primeiro
passo, e nenhum deploy pode acontecer antes.

---

## Números

| | branch/local | homologação | produção |
|---|---|---|---|
| migrations aplicadas | 72 | 72 | 71 |
| models no schema | 165 | 146 | 145 |
| módulos de backend | 45 | 44 | 44 |
| telas em `/dashboard` | 39 | 37 | 38 |

Números parecidos escondem divergência grande: as migrations coincidem em
quantidade e diferem em **26 nomes**.

---

## O que existe em cada lugar

### People — na branch e em produção, NÃO em homologação

22 models, 12 migrations, o módulo `backend/src/modules/people` e as telas
`people` + `meu-rh`.

Homologação nunca recebeu. É por isso que o deploy do Compliance precisou ser
cirúrgico: `app.module.ts` e `auth.service.ts` do git importam `people.permissions`,
e o build lá quebra com `Cannot find module`.

### Compliance — na branch e em homologação, NÃO em produção

20 models, 1 migration, o módulo e 8 telas. Subiu em homologação em 07/08/2026.

### Só em homologação — e NÃO ESTÁ NO GIT

Esta é a parte que exige ação antes de qualquer convergência.

**13 arquivos que não existem no repositório:**

| Arquivo | O que é |
|---|---|
| `notifications/notificacao-dispatcher.service.ts` | notificações por módulo |
| `notifications/notificacao-modulos.ts` | idem |
| `notifications/notificacao-prefs.controller.ts` | idem |
| `notifications/notificacao-worker.service.ts` | idem |
| `notifications/resolver-instancia.ts` | idem |
| `notifications/whatsapp-monitor.service.ts` | melhoria do WhatsApp |
| `notifications/*.spec.ts` (2) | testes do acima |
| `frota/frota-status.ts` + `app/dashboard/frota/status/page.tsx` | status operacional da frota |
| `common/marca.ts` + `lib/marca.ts` | marca vinda do ambiente |
| `components/notificacoes/PermissoesMensagemModal.tsx` | gestão de acessos a mensagens |

**3 models:** `NotificacaoEnvio`, `NotificacaoPreferencia`, `OrgNotificacaoConfig`.

**3 migrations:** `frota_status_operacional`, `notificacoes_por_modulo`,
`notification_modulo`.

**49 arquivos com conteúdo divergente** (descontadas as diferenças de CRLF, que
sozinhas faziam 219 arquivos parecerem diferentes).

---

## As 49 divergências não são todas do mesmo tipo

Duas amostras mostram que é preciso olhar caso a caso:

**`notifications/whatsapp.service.ts` — homologação está À FRENTE.**
320 linhas contra 270 do git. Tem o token por instância exigido pela Evolution
v1.8.2 e a marca vinda do ambiente. É melhoria real, e um deploy do git por cima
a destruiria.

**`ativos/ativos.module.ts` — divergência SEMÂNTICA, não de versão.**

| | homologação | branch |
|---|---|---|
| excluir ativo | `ativos:excluir` | `ativos:deletar` |
| mover ativo | `ativos:mover` | `ativos:transferir` |

São nomes de permissão diferentes para a mesma ação. Promover qualquer um dos
lados sem decidir qual é o correto **quebra o controle de acesso** — quem tinha
a permissão para de ter, silenciosamente, porque a string deixa de casar.

---

## Migrations: 11 são divergência de histórico, não de schema

`add_cliente_portal_token`, `add_monitoramento`, `add_mon_asset_link`,
`chamados_v2`, `mon_auto_chamado`, `mon_event_ack`, `mon_sla_meta`,
`mon_inteligencia`, `mon_coleta_profunda`, `osa_monitor`, `osa_zabbix`.

Estão registradas só em homologação. Local e produção têm as MESMAS tabelas,
recebidas pela migration consolidada `20260726220000_monitoramento_tabelas`.
Mesmo estado final, caminhos diferentes.

Não é problema de dado, mas atrapalha o `migrate deploy`, que compara nomes.
Resolve-se com `prisma migrate resolve --applied`, sem tocar em tabela.

---

## Plano de convergência

A ordem importa. Inverter qualquer par destrói trabalho.

### Fase 1 — Resgatar o que só existe em homologação

Trazer para o git os 13 arquivos novos, os 3 models, as 3 migrations e as
melhorias reais dentre os 49 divergentes.

**Exige revisão humana**: dos 49, alguns são melhoria de homologação e outros
são versão antiga. O caso do `ativos.module.ts` mostra que há decisão de negócio
envolvida — qual nome de permissão é o certo.

Sem esta fase, qualquer deploy do git para homologação apaga o trabalho.

### Fase 2 — Reconciliar o histórico de migrations

`migrate resolve --applied` para as 11 duplicadas em homologação. Sem escrita em
tabela.

### Fase 3 — Definir a versão alvo

`main` = People + Compliance + notificações por módulo + status da frota +
melhorias resgatadas. Subir o número de versão (ver `reference_versionamento`).

### Fase 4 — Promover na ordem

`localhost → homologação → produção`, conferindo `/dashboard/sobre` em cada uma
(a tela compara a versão da interface com a da API e denuncia deploy pela metade).

Antes de produção, conferir:
- volume `compliance_docs_data` no compose de lá;
- que o overlay usado é o mesmo que já está no ar (produção sobe com
  `yml + override.yml`, não com `prod.yml`);
- backup do banco.

---

---

## Estado da Fase 1 — atualizado em 09/08/2026

Resgatado e commitado na branch (`d25dd0e`, `8008981`, `f3633ba`):

- 13 arquivos que não existiam no repositório
- 3 models de notificação + 4 migrations (3 resgatadas, 1 escrita)
- grupos 1 a 5 dos divergentes, mais o grupo 2

### Duas correções ao levantamento original

**1. A comparação por nome de model era insuficiente.** São **16 models
compartilhados com campos divergentes**. Foi assim que a integração
chamado↔frota passou despercebida.

**2. As 11 migrations "só de histórico" NÃO eram equivalentes.** Produção não
tem `chamados.veiculo_id`, `chamados.atribuido_por_id` nem
`manutencoes_veiculo.chamado_id`.

### Descoberta: homologação tem drift de schema

As colunas da integração chamado↔frota **existem no banco de homologação e
nenhuma migration as cria** — foram aplicadas por `db push` ou à mão. Um
ambiente novo, montado pelas migrations, não as teria.

A migration `20260807000000_chamado_frota_integracao` foi **escrita agora** para
tapar esse buraco, e é idempotente porque em homologação as colunas já estão lá.

**Vale procurar outros casos de drift antes de promover para produção.**

### A suspeita das guardas empilhadas era infundada

O padrão de homologação (`@UseGuards` duas vezes no mesmo handler) é **seguro**.
`guards-empilhados.spec.ts` prova: o NestJS acumula em vez de sobrescrever, e a
ordem final é `[AuthGuard, PermissionsGuard]` — autentica e só então autoriza.

### O que falta da Fase 1

Um cluster, o de **orçamento por centro de custo**, onde homologação está à
frente e que exige campos de schema (`CentroCusto.compartilhamentos`,
`OrcamentoCompartilhamento.centroCustoId` e `papel`) mais a migration:

| Arquivo | homolog+ | branch+ |
|---|---|---|
| `orcamento/orcamento.module.ts` | 159 | 39 |
| `app/dashboard/orcamento/page.tsx` | 143 | 45 |
| `app/dashboard/page.tsx` | 59 | 15 |
| `workforce/workforce.module.ts` | 14 | 7 |

Nos outros 9 arquivos do grupo 6 a branch está à frente — ficam como estão.

---

## Riscos conhecidos

| Risco | Mitigação |
|---|---|
| Deploy do git em homologação apaga trabalho não versionado | Fase 1 antes de tudo |
| Nome de permissão divergente quebra acesso em silêncio | Decidir caso a caso na Fase 1; conferir a matriz de permissões depois |
| `migrate deploy` recusa por histórico divergente | Fase 2 |
| Migration do People em produção já derrubou a API por 20 min | Produção já tem o People; não se repete |
| Copiar `schema.prisma` por cima apaga models locais do ambiente | Mesclar, nunca sobrescrever — como foi feito no Compliance |
