# Microsoft 365 / Outlook — Setup no Microsoft Entra

Este documento reúne **tudo que precisa ser feito manualmente** para habilitar a
integração de calendário. O código já está pronto; ele apenas fica inativo
enquanto as variáveis abaixo não existirem no ambiente.

> Sem `MS_CLIENT_ID`/`MS_CLIENT_SECRET`, o endpoint de status responde
> `configured: false` e a tela de Integrações mostra "ainda não configurada pelo
> administrador". Nada mais no sistema é afetado.

---

## 1. Criar o App Registration

Portal: <https://entra.microsoft.com> → **Identity → Applications → App registrations → New registration**

| Campo | Valor |
|-------|-------|
| **Name** | `Orkiestri Calendar` |
| **Supported account types** | *Single tenant* (só sua organização). Escolha *Multitenant* apenas se usuários de outros tenants Microsoft forem conectar. |
| **Redirect URI** | Plataforma **Web** → `https://SEU_DOMINIO/api/integracoes/microsoft/callback` |

Para testes locais, adicione **também** `http://localhost/api/integracoes/microsoft/callback`
como segunda Redirect URI (Web).

Ao salvar, anote:
- **Application (client) ID** → `MS_CLIENT_ID`
- **Directory (tenant) ID** → `MS_TENANT_ID` (ou use `common` para multitenant)

## 2. Criar o Client Secret

**Certificates & secrets → Client secrets → New client secret**
- Descrição: `orkiestri`
- Expira: 24 meses (anote a data — precisará renovar)
- Copie o **Value** imediatamente (só aparece uma vez) → `MS_CLIENT_SECRET`

## 3. Permissões (Microsoft Graph, Delegated — menor privilégio)

**API permissions → Add a permission → Microsoft Graph → Delegated permissions**:

| Permissão | Para quê |
|-----------|----------|
| `Calendars.ReadWrite` | Ler os eventos do usuário e criar/editar/excluir os que ele cria no Orkiestri |
| `offline_access` | Obter *refresh token* (renovação sem novo login) |
| `User.Read` | Descobrir a identidade da conta conectada |
| `openid`, `email`, `profile` | Login OpenID Connect |

Depois clique em **Grant admin consent for <tenant>** (exige um administrador do
Entra). Sem o consentimento administrativo, cada usuário veria a tela de
consentimento individual — e permissões de calendário costumam exigir admin.

> **Não** adicione `Mail.*`, `Files.*`, `Calendars.Read.Shared` etc. A integração
> foi desenhada para o mínimo. Se um dia precisar de calendários compartilhados,
> a permissão extra será `Calendars.Read.Shared` (ver ROADMAP em ARCHITECTURE.md).

## 4. Webhook (Change Notifications) — requisito de rede

O tempo real depende de a Microsoft **conseguir chamar** o Orkiestri em:

```
https://SEU_DOMINIO/api/integracoes/microsoft/webhook
```

Requisitos:
- **HTTPS público** com certificado válido (a Microsoft recusa `http://` e `localhost`).
- O endpoint responde ao *handshake* de validação automaticamente (devolve o
  `validationToken` em texto puro).

Se o ambiente **não** tiver URL pública (ex.: homologação atrás de VPN), a
integração continua funcionando por **delta sync + reconciliação periódica** —
só não é instantânea. Isso é detectado sozinho (`webhookViable: false`).

## 5. Onde colocar as credenciais — tela OU ambiente

Há duas formas (a tela tem prioridade sobre o ambiente):

**(a) Pela tela (recomendado para multi-tenant).** Um administrador vai em
**Configurações → Integrações → Configurar credenciais** e preenche Client ID,
Tenant ID e Client Secret. Fica guardado cifrado no banco. Um **super-admin**
pode definir um **padrão da plataforma** (herdado por todas as organizações) ou
cada organização traz o seu próprio app. Ordem de resolução em runtime:
config da organização → padrão da plataforma → variáveis de ambiente.

> Requer `APP_VAULT_KEY` definida no servidor (para cifrar o secret) — a própria
> tela avisa se estiver faltando.

**(b) Pelas variáveis de ambiente** (abaixo) — servem como padrão da instalação
quando não há nada preenchido na tela. Útil para um ambiente de uma organização só.

## 6. Variáveis de ambiente (opcional se usar a tela)

No `.env` do ambiente (ver `.env.example`):

```dotenv
# Cofre — cifra os tokens no banco. 64 hex OU frase longa. (Já exigido pelo OSA.)
APP_VAULT_KEY=<64_hex_ou_frase_longa>

MS_CLIENT_ID=<Application (client) ID>
MS_CLIENT_SECRET=<Client secret Value>
MS_TENANT_ID=<Directory (tenant) ID | common>

# URL pública HTTPS (redirect do OAuth + webhook). Cai para APP_URL se vazio.
MS_APP_URL=https://SEU_DOMINIO

# Opcionais (sobrescrevem os padrões derivados de MS_APP_URL):
# MS_REDIRECT_URI=https://SEU_DOMINIO/api/integracoes/microsoft/callback
# MS_WEBHOOK_URL=https://SEU_DOMINIO/api/integracoes/microsoft/webhook
```

O `docker-compose.yml` já repassa todas essas variáveis ao container `api`.

## 6. Validar

1. Suba a API com as variáveis. Rode a migration (`prisma migrate deploy` roda no
   boot do container).
2. Faça login no Orkiestri e vá em **Configurações → Integrações** (ou
   `/dashboard/configuracoes/integracoes`).
3. O cartão deve mostrar **Microsoft Outlook / Não conectado** com o botão
   **Conectar Microsoft 365**.
4. Clique, autorize na tela da Microsoft, e você será redirecionado de volta com
   o status **Sincronizado**. Os eventos do Outlook aparecem na Agenda em azul.

## Checklist de valores que você precisa me fornecer

- [ ] `MS_CLIENT_ID`
- [ ] `MS_TENANT_ID` (ou `common`)
- [ ] `MS_CLIENT_SECRET`
- [ ] Domínio público HTTPS (para redirect + webhook), confirmando a Redirect URI
- [ ] `APP_VAULT_KEY` definido no ambiente (se ainda não estiver)

Depois de me passar isso (ou colocar no `.env`), a integração fica operacional —
nenhuma outra alteração de código é necessária.

## Troubleshooting rápido

| Sintoma | Causa provável | Ação |
|--------|----------------|------|
| Tela diz "não configurada" | Faltam `MS_CLIENT_ID`/`MS_CLIENT_SECRET` | Preencher o `.env` e reiniciar a API |
| `AADSTS50011` (redirect mismatch) | Redirect URI não bate exatamente | Conferir `MS_REDIRECT_URI` × Entra (protocolo, barra final) |
| Status **Reconexão necessária** | Refresh token revogado/expirado | Usuário clica em **Reconectar** |
| Status **Erro** com "Permissão insuficiente" | Falta admin consent de `Calendars.ReadWrite` | Conceder consentimento no Entra |
| Eventos não chegam em tempo real | Webhook inviável (sem HTTPS público) | Normal fora de produção; delta+reconciliação cobrem |
