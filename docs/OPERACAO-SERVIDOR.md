# O que vive no servidor e não vem do git

Há configuração de produção que o `scripts/deploy.sh` **não publica**. Quem
olhar só o repositório não a encontra, e quem reinstalar um servidor do zero
não a terá. Este arquivo existe para essa configuração não se perder.

O `deploy.sh` leva **apenas `backend/` e `frontend/`**. Tudo o mais abaixo é
mantido à mão, direto no servidor.

---

## 1. `.env` — variáveis que o repositório não tem

Em `/opt/orkestri/.env`. O arquivo não está no git (e não deve estar).

### `EVOLUTION_INSTANCE`

```
EVOLUTION_INSTANCE=orkestri-default
```

Nome da instância do Evolution usada quando a organização não tem a sua
própria (`resolveInstance`). **Precisa ser diferente em cada ambiente.**

Até 20/10/2026 esse nome estava escrito no código, como a constante
`"orkestri"`. Enquanto foi fixo, homologação e produção caíam no mesmo nome
por omissão, e um podia falar pelo número do outro — é essa, e não outra, a
origem da regra "em produção o WhatsApp é só leitura". A constante virou
variável de ambiente e a API passou a avisar no log, na partida, quando ela
não está definida.

Em produção o valor é `orkestri-default`, que é a instância conectada ao
número da empresa.

### `WHATSAPP_INBOUND_SECRET`

Segredo do webhook de entrada do WhatsApp. **Viaja no cabeçalho
`x-webhook-secret`, nunca na query string.**

Em 20/10/2026 o valor anterior foi encontrado em texto puro no log de acesso
do nginx, porque ia na URL:

```
POST /api/whatsapp/inbound?secret=<valor>  200
```

Com esse valor, qualquer um que lesse o log poderia forjar mensagem de
qualquer número — que é exatamente o que o segredo existe para impedir. O
valor foi **rotacionado** (mover sem trocar seria conserto cosmético, porque o
antigo já estava escrito) e saiu do `docker-compose.yml`, onde também estava
cravado em texto puro.

Sem segredo configurado, o inbound fica **desligado de propósito**: o
controller responde e ignora. Isso é silencioso — se o WhatsApp parar de
responder, confira esta variável primeiro.

---

## 2. `docker-compose.yml` — editado à mão no servidor

O compose do servidor **diverge do repositório** e precisa continuar
divergindo: ele carrega a configuração de TLS. Copiar o do repo por cima
derruba o HTTPS em silêncio.

As duas variáveis acima precisam ser **passadas ao container** da API, além de
existirem no `.env`. Sem isso o `.env` não chega a lugar nenhum:

```yaml
  api:
    environment:
      EVOLUTION_INSTANCE: ${EVOLUTION_INSTANCE:-}
      WHATSAPP_INBOUND_SECRET: ${WHATSAPP_INBOUND_SECRET}
```

Ao mexer, edite **a linha**, não o arquivo: `sed -i` numa linha específica, com
backup antes, e `docker compose config --quiet` para validar o YAML antes de
subir. Depois confira o certificado — `curl -s -o /dev/null -w "%{ssl_verify_result}"`
deve devolver `0`.

---

## 3. Webhook do Evolution — configuração que vive na API do Evolution

Não está em arquivo nenhum: mora dentro do Evolution, por instância.

```
POST {EVOLUTION_API_URL}/webhook/set/{instancia}
{
  "webhook": {
    "enabled": true,
    "url": "https://orkiestri.com/api/whatsapp/inbound",
    "headers": { "x-webhook-secret": "<WHATSAPP_INBOUND_SECRET>" },
    "byEvents": false, "base64": false,
    "events": ["MESSAGES_UPSERT"]
  }
}
```

> **O webhook NÃO sobrevive à recriação da instância.** Rodar
> `POST /instance/create` apaga a configuração, e o sistema passa a **enviar
> normalmente e não receber nada** — falha silenciosa, sem erro em log de
> envio. Depois de recriar qualquer instância, reconfigure o webhook e
> confirme com `GET /webhook/find/{instancia}`.

---

## 4. Publicar o site institucional (`website/`)

O `deploy.sh` **não cobre** o `website/`. E `docker compose build website`
falha com `no such service: website`, porque o site tem compose próprio, que
só resolve combinando os três arquivos:

```bash
cd /opt/orkestri
sudo git fetch origin main
sudo git checkout origin/main -- website/
sudo docker compose \
  -f docker-compose.yml \
  -f docker-compose.prod.yml \
  -f website/deploy/docker-compose.website.yml \
  build website
sudo docker compose \
  -f docker-compose.yml \
  -f docker-compose.prod.yml \
  -f website/deploy/docker-compose.website.yml \
  up -d website
```

Antes do `checkout`, confira o que seria sobrescrito:

```bash
sudo git status --porcelain --untracked-files=all -- website/
sudo git diff --stat HEAD origin/main -- website/
```

O primeiro comando precisa sair vazio. O segundo mostra **tudo** o que vai ao
ar — pode haver mudança de outra pessoa parada na `main` há meses, e ela sobe
junto.

---

## 5. Como conferir se o deploy pegou

`rc=0` no terminal não prova nada. A prova é a versão respondida:

```bash
curl -s https://orkiestri.com/api/health
```

E, para saber se um deploy chegou a **começar**, olhe a **data** do log no
servidor, não o conteúdo:

```bash
ssh orkestri-prod ls -la /tmp/orkestri-deploy-producao.log
```

Um `tail -f` logo após disparar o deploy imprime o **fim do log anterior** —
inclusive o `__DEPLOY_FIM__ rc=0` da vez passada — e parece sucesso.

No Windows, `bash scripts/deploy.sh` no PowerShell cai no **WSL** e morre com
`execvpe(/bin/bash) failed`. Chame o Git Bash pelo caminho completo:

```powershell
& "C:\Program Files\Git\bin\bash.exe" scripts/deploy.sh producao
```
