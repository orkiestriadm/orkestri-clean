# Deploy API `5.2.0` + Frontend `5.2.0` — Integração Space com Google Agenda — 05/11/2026

## Resumo das alterações publicadas

### 1. Módulo Space e Configurações (`/dashboard/agenda` e `/dashboard/configuracoes/integracoes`) — Frontend `5.2.0`
- **Botão no topo da Space (`frontend/src/app/dashboard/agenda/page.tsx`):**
  - Adicionado botão **Google Agenda** com ícone oficial do Google Calendar e indicador luminoso de conexão (verde quando ativo).
  - Captura automática do parâmetro de retorno `?google=connected` após o OAuth para recarregar os compromissos da agenda.
- **Modal sob demanda (`frontend/src/components/agenda/GoogleCalendarModal.tsx`):**
  - Fluxo 100% opcional acionado pelo usuário.
  - Preferências de sincronização configuráveis antes e depois de conectar:
    - Enviar novos compromissos criados na Space ou pela Aurélia no WhatsApp para o Google Agenda (`pushEnabled`).
    - Importar eventos do Google Agenda para a Space (`syncEnabled`).
  - Conexão em 1 clique via OAuth 2.0 oficial da Google, botão **Sincronizar agora** e **Desconectar** (com opção de expurgar ou manter eventos externos importados).
  - Suporte a credenciais próprias (*BYO Client ID / Secret*) do Google Cloud Console para organizações.
- **Central de Integrações (`frontend/src/components/ui/IntegracoesConfig.tsx`):**
  - Cartão dedicado do **Google Agenda** ao lado do **Microsoft Outlook / 365**, exibindo conta conectada, status de sincronização, horário da última sincronização e controles rápidos.

### 2. Motor de Sincronização Bidirecional Google Calendar — API `5.2.0`
- **OAuth 2.0, Resolver e Cliente REST (`backend/src/modules/integracoes/google/*`):**
  - `google.config.ts`, `google-config.resolver.ts`, `google-oauth.service.ts` (com assinatura HMAC-SHA256 no `state`, `access_type=offline` e `prompt=consent`) e `google-calendar.client.ts` (Calendar API v3).
  - Credenciais e tokens armazenados criptografados com AES-256-GCM via `Vault`.
- **Mapeador Bidirecional e Anti-Loop (`backend/src/modules/integracoes/calendar/google-mapper.ts`):**
  - Conversão entre `GoogleCalendarEvent` e eventos da Space (eventos com horário específico, eventos de dia inteiro `diaTodo`, cancelamentos e `computeSyncHash` MD5 anti-loop).
- **Sync Incremental e Writeback (`calendar-sync.service.ts`, `calendar-writeback.service.ts`, `calendar-connection.service.ts`):**
  - Sincronização incremental via `syncToken` com fallback automático para janela completa quando o token expira (`410 Gone`).
  - Writeback automático em tempo real quando compromissos são criados, editados ou excluídos na Space ou via WhatsApp da Aurélia.
- **Webhook Push (`backend/src/modules/integracoes/webhooks/google-webhook.controller.ts`):**
  - Endpoint `POST /api/integracoes/google/webhook` para notificações push (`X-Goog-Channel-ID`, `X-Goog-Resource-State`).

## Validação
- **Testes automatizados (Backend):** 6 suítes / 38 testes em `src/modules/integracoes` passando (`google-mapper.spec.ts`, `calendar-sync.spec.ts`, `calendar-connection.spec.ts`, `outlook-mapper.spec.ts`, `microsoft-oauth.spec.ts`, `microsoft-config.resolver.spec.ts`).
- **Build Next.js (Frontend):** 40/40 rotas compiladas e tipadas sem erros.

## Ambientes sincronizados
- **Produção (`https://www.orkiestri.com` / `orkestri-prod`):**
  - `orkestri_api` (`5.2.0`)
  - `orkestri_frontend` (`5.2.0`)
  - `orkestri_website` (`3.17.0`)
- **Localhost (`http://localhost`):**
  - `orkestri_api` (`5.2.0`) e `orkestri_frontend` (`5.2.0`) atualizados.
