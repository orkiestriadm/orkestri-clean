# Integração de calendário externo — Arquitetura

Integração do **Microsoft 365 / Outlook** com a agenda do Orkiestri via
**Microsoft Graph API** e **OAuth 2.0 (Authorization Code)**. Desenhada
provider-agnóstica para receber Google Calendar no futuro sem reescrever a
lógica de agenda.

```
OUTLOOK  ⇅  MICROSOFT GRAPH  ⇅  INTEGRATION SERVICE  ⇅  AGENDA UNIFICADA (Event)  ⇅  REGRAS DE NEGÓCIO
```

## 1. Princípio central: a agenda unificada é a tabela `Event`

O Orkiestri já tinha `Event` + `/api/agenda` + `/api/agenda/disponibilidade`,
e vários módulos (projetos, capacity, stats) já liam `Event`. Em vez de criar
uma segunda estrutura, **os eventos do Outlook são materializados como linhas em
`Event`** com colunas de proveniência. Consequência: **toda** funcionalidade que
já consultava a agenda passou a enxergar o Outlook sem alteração.

Um evento nativo tem `provider = "internal"`. Um evento espelhado do Outlook tem
`provider = "microsoft"` + `connectionId`, `externalId`, `externalEtag`,
`syncHash`, `syncedAt`. O resto do sistema trabalha com o conceito
**"compromisso"**, nunca com "evento Outlook".

## 2. Modelo de dados

- **`CalendarConnection`** — vínculo de 1 usuário com 1 conta de provedor.
  Guarda identidade (`providerAccountId`, `providerEmail`, `providerTenantId`),
  o calendário conectado, `status`, os **tokens cifrados**
  (`accessTokenEnc`/`refreshTokenEnc` via `common/vault.ts`), o cursor
  incremental (`deltaLink`) e as políticas (`pushEnabled`, `syncEnabled`).
  `@@unique([userId, provider])` garante **isolamento por usuário**.
- **`CalendarSubscription`** — assinatura de webhook do Graph, com `clientState`
  (segredo), `expiresAt` e ciclo de vida próprio.
- **`Event` (+colunas)** — `@@unique([connectionId, externalId])` dá a
  **referência estável** e impede duplicidade.

## 3. Camadas (module `integracoes`)

```
graph/      microsoft.config · microsoft-oauth.service · microsoft-graph.client   ← específico do provedor
calendar/   calendar-connection · outlook-mapper · calendar-sync · calendar-writeback  ← agenda unificada
webhooks/   graph-webhook.controller · subscription.service · subscription.scheduler
integracoes.controller (API autenticada) · oauth-callback.controller (público)
```

Para adicionar **Google** no futuro: implementar um novo `graph/` equivalente
(OAuth + client) e um mapper; `calendar-sync`/`writeback` e a tabela `Event`
permanecem. `CalendarProvider` já tem `google` no enum.

## 4. Fluxo OAuth

1. Usuário clica **Conectar** → `GET /api/integracoes/microsoft/connect`
   (autenticado) devolve a `authorizeUrl` com um **`state` assinado** (HMAC-SHA256
   com `JWT_SECRET`) que carrega `userId`+`organizationId`+expiração de 10 min.
2. Navegador vai ao login Microsoft → usuário autoriza.
3. Microsoft redireciona para `GET /api/integracoes/microsoft/callback` (público;
   identidade vem do `state`, não de sessão nem de id no corpo).
4. Troca `code`→tokens, descobre `/me` + calendário principal, grava a conexão
   com tokens cifrados, dispara **sync inicial** + **assinatura** em segundo
   plano e redireciona para a tela de Integrações com `?ms=connected`.

**Renovação:** `getValidAccessToken` renova o access token quando falta < 2 min;
`invalid_grant` no refresh → status `reauth_required` (o usuário vê "Reconectar").

## 5. Sincronização (3 mecanismos combinados)

- **Webhook (tempo real):** Graph chama `/webhook` em mudanças → `deltaSync`.
- **Delta sync (incremental):** `calendarView/delta` com `deltaLink` persistido;
  barato, retoma de onde parou.
- **Reconciliação periódica (rede de segurança):** `@Cron` de 4/4h re-sincroniza
  tudo e **rola a janela** de datas (−30d … +180d).

Janela sincronizada e timezone: pedimos `Prefer: outlook.timezone="UTC"`, então
não há adivinhação de fuso — o Graph normaliza para UTC e nós convertemos.

**Recorrência:** usamos `calendarView`, que **entrega as ocorrências já
expandidas** na janela (cada ocorrência é um bloco concreto). Isso preserva a
recorrência para efeito de disponibilidade sem modelar RRULE. O `seriesMaster`
puro (sem data) é ignorado.

## 6. Anti-duplicidade e anti-loop

- **Duplicidade:** `@@unique([connectionId, externalId])`. Webhook e
  reconciliação convergem para a mesma linha (`upsert` por essa chave).
- **Loop de eco:** ao materializar, guardamos o `externalEtag`. Se o etag que
  chega do Graph é igual ao guardado → **skip**. No writeback (Orkiestri→Graph)
  guardamos o etag retornado pelo Graph e o `syncHash`; quando o delta trouxer o
  mesmo evento de volta, o etag bate e nada é reescrito.

## 7. Direção de escrita (writeback) e política de conflito

- **Outlook → Orkiestri:** fonte de verdade para eventos `provider=microsoft`.
  Alterado/cancelado no Outlook reflete aqui (update / remoção do espelho).
- **Orkiestri → Outlook:** `CalendarWritebackService` empurra criação/edição/
  exclusão de eventos **nativos** do usuário quando `pushEnabled`. É
  **best-effort e não-fatal**: falha no Graph nunca quebra a operação de agenda;
  a reconciliação e a próxima edição reconvergem.
- **Conflito:** o `syncHash` evita reescritas desnecessárias; uma remoção no
  Outlook remove o espelho (não apaga evento nativo). Não há sobrescrita
  silenciosa de dado nativo por dado externo — são registros distintos ligados
  por `externalId`.

**Limitação conhecida (v1):** o writeback não tem *outbox* transacional; se o
Graph estiver fora no exato momento da criação, o evento nasce só no Orkiestri
até a próxima edição. A reconciliação cobre o sentido Outlook→Orkiestri, não o
inverso. Roadmap: fila de saída persistente.

## 8. Disponibilidade

`/api/agenda/disponibilidade` e o novo `/api/agenda/horarios-livres` leem `Event`
com escopo de organização e `externalCancelled = false` — logo consideram
nativos **e** Outlook. `horarios-livres` calcula os vãos livres numa janela de
trabalho respeitando a duração mínima. Títulos de eventos Outlook de **outras**
pessoas são mascarados como "Ocupado" na visão de equipe (privacidade).

## 9. Segurança

- Tokens **sempre cifrados** (AES-256-GCM, `APP_VAULT_KEY`); nunca em log.
- OAuth `state` assinado (anti-CSRF no callback público); identidade nunca vem
  do corpo/query — sempre de `req.user` (ações) ou do `state` (callback).
- Webhook público valida `clientState` por assinatura; responde 202 rápido.
- Escopo de organização nas consultas de agenda (evita IDOR entre tenants).
- Permissão `integracoes:conectar` (em `BASE_PERMISSIONS`): cada um conecta só a
  **própria** conta.
- Menor privilégio no Graph (`Calendars.ReadWrite` + `offline_access` + login).

## 10. Observabilidade

Logs em conexão, sync (+importados/atualizados/cancelados), webhook, refresh,
reauth, criação/renovação de assinatura, writeback. Nunca logam token, secret,
nem corpo de evento. Status legível exposto ao usuário via `toStatusDto`
(`CONNECTED/SYNCING/SYNCED/ERROR/DISCONNECTED/REAUTH_REQUIRED`).

## 11. Desconexão

`POST /disconnect`: cancela assinaturas no Graph, apaga tokens/deltaLink, marca
`disconnected` e remove os eventos importados **futuros** (não poluir a
disponibilidade com dado obsoleto), mantendo o histórico passado. `purgeAll:true`
remove todos. Eventos **nativos** nunca são tocados.

## 12. Jobs

`SubscriptionScheduler` (@nestjs/schedule, padrão do projeto):
- `0 */6 * * *` — renova/recria assinaturas.
- `0 */4 * * *` — reconciliação completa.

Ambos são no-op enquanto a integração não estiver configurada, e têm trava
anti-sobreposição.

## Endpoints

| Método | Rota | Auth | Descrição |
|-------|------|------|-----------|
| GET | `/api/integracoes/microsoft/status` | sessão | Estado da integração do usuário |
| GET | `/api/integracoes/microsoft/connect` | sessão | Devolve a `authorizeUrl` |
| GET | `/api/integracoes/microsoft/callback` | state assinado | Retorno do OAuth |
| POST | `/api/integracoes/microsoft/sync-now` | sessão | Dispara sync imediata |
| PATCH | `/api/integracoes/microsoft/push` | sessão | Liga/desliga writeback |
| POST | `/api/integracoes/microsoft/disconnect` | sessão | Desconecta |
| GET/POST | `/api/integracoes/microsoft/webhook` | clientState | Change Notifications do Graph |
| GET | `/api/agenda/horarios-livres` | sessão | Horários livres (agenda unificada) |

Setup no Entra: ver [MICROSOFT_365_SETUP.md](./MICROSOFT_365_SETUP.md).
