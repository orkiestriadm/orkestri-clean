# Orkiestri

Sistema SaaS multi-tenant de orquestramento de demandas — chamados, projetos, agenda, contratos, ativos e base de conhecimento.

---

## Stack

| Camada | Tecnologia |
|---|---|
| Backend | NestJS + Prisma + PostgreSQL + Redis |
| Frontend | Next.js 14 (App Router) |
| Infra | Docker Compose + Nginx + Let's Encrypt |
| Auth | JWT em cookie HttpOnly |
| E-mail | Resend |
| WhatsApp | Evolution API |

---

## Desenvolvimento local (Windows)

**Pré-requisitos:** Docker Desktop, Git

```bash
# 1. Clone
git clone https://github.com/orkiestriadm/orkestri-clean.git
cd orkestri-clean

# 2. Crie o .env (peça ao time o arquivo com os valores)
cp .env.example .env   # edite os valores

# 3. Suba a stack (docker-compose.override.yml é carregado automaticamente)
docker compose up -d

# 4. Acesse
# Frontend: http://localhost
# API:      http://localhost/api
# SA Panel: http://localhost:8080
```

> Evolution API é desligada automaticamente no override local (economiza ~1.5 GB de RAM).

---

## Deploy em produção (AWS Lightsail)

### Pré-requisitos

- Instância Ubuntu 24.04 com portas 80 e 443 abertas
- Domínio apontando para o IP da instância (registros A `@` e `www`)
- Arquivo `.env.production` preenchido (nunca commitar)

### Passo 1 — Enviar código para o servidor

No Windows (Git Bash ou WSL):

```bash
bash deploy.sh <IP_DO_SERVIDOR>
```

O script envia o código via rsync e copia `.env.production` como `.env` no servidor.

### Passo 2 — Configurar o servidor (primeira vez)

```bash
ssh ubuntu@<IP_DO_SERVIDOR>
bash /opt/orkestri/scripts/setup-server.sh
```

Instala Docker, constrói as imagens e sobe todos os serviços.

### Passo 3 — Obter certificado SSL

Após o DNS propagar (teste com `curl http://<domínio>/health`):

```bash
cd /opt/orkestri && bash scripts/init-ssl.sh
```

Gera certificado Let's Encrypt e recarrega nginx com HTTPS.

### Deploys subsequentes

```bash
# Do Windows:
bash deploy.sh <IP_DO_SERVIDOR>

# No servidor:
cd /opt/orkestri
git pull
sudo docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d --build
```

---

## Variáveis de ambiente obrigatórias

| Variável | Descrição |
|---|---|
| `POSTGRES_DB/USER/PASSWORD` | Banco de dados |
| `REDIS_PASSWORD` | Redis |
| `JWT_SECRET` / `JWT_REFRESH_SECRET` | Assinatura de tokens |
| `SA_TOKEN` | Autenticação do SA Panel |
| `CORS_ORIGINS` | Origens permitidas |
| `APP_URL` | URL pública do sistema |
| `MASTER_EMAIL/PASSWORD/NOME` | Usuário administrador inicial |
| `RESEND_API_KEY` | Envio de e-mails |
| `EVOLUTION_API_KEY` | Integração WhatsApp |

---

## Gestão dos containers

```bash
# Status
sudo docker compose -f docker-compose.yml -f docker-compose.prod.yml ps

# Logs
sudo docker logs orkestri_api --tail 50
sudo docker logs orkestri_nginx --tail 50

# Restart de um serviço
sudo docker compose -f docker-compose.yml -f docker-compose.prod.yml restart api

# Rebuild completo
sudo docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d --build
```

---

## Estrutura do projeto

```
orkestri-clean/
├── backend/          # API NestJS
│   ├── prisma/       # Schema e migrations
│   └── src/
├── frontend/         # Next.js
│   └── src/
├── saas/
│   └── sa-panel/     # Super Admin Panel (Express)
├── nginx/
│   ├── nginx.conf         # Config local
│   └── nginx-ssl.conf     # Config produção (HTTPS)
├── scripts/
│   ├── init-ssl.sh        # Obtém certificado Let's Encrypt
│   └── setup-server.sh    # Bootstrap do servidor
├── docker-compose.yml          # Base
├── docker-compose.override.yml # Dev local (Windows)
├── docker-compose.prod.yml     # Produção
└── deploy.sh                   # Envia código para o servidor
```
