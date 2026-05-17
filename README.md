# Orkestri — Guia de Instalação

Sistema de organização de demandas com agenda, planner de projetos e keep de anotações.

---

## Pré-requisitos da VM

| Recurso | Mínimo | Recomendado |
|---|---|---|
| SO | Ubuntu 22.04 | Ubuntu 22.04 / 24.04 |
| CPU | 2 vCPUs | 4 vCPUs |
| RAM | 4 GB | 8 GB |
| Disco | 20 GB | 50 GB |
| Porta 80 | Aberta | Aberta |

---

## Instalação em 1 comando

Copie a pasta do projeto para a VM e execute:

```bash
sudo bash scripts/install.sh
```

O instalador faz **tudo automaticamente**:
- Instala Docker e Docker Compose se não existirem
- Gera as chaves de segurança (JWT) aleatórias
- Configura o banco de dados PostgreSQL
- Faz o build de todos os containers
- Cria e ativa o serviço systemd para **auto-start no boot**
- Exibe o IP de acesso e as credenciais ao final

---

## O que acontece quando a VM liga

```
VM liga
  └─ systemd inicia
       └─ orkestri.service inicia automaticamente
            ├─ PostgreSQL sobe
            ├─ Redis sobe
            ├─ API NestJS sobe + executa migrations
            └─ Frontend Next.js sobe
                 └─ Nginx roteia tudo na porta 80
```

Nenhuma intervenção manual necessária. O sistema estará disponível em:

```
http://IP_DA_VM
```

---

## Credenciais iniciais

| Campo | Valor padrão |
|---|---|
| E-mail | admin@orkestri.local |
| Senha | Admin@123 |

> **Troque a senha imediatamente após o primeiro login.**

---

## Comandos de gestão

Após a instalação, use o comando global `orkestri`:

```bash
orkestri status    # Status de todos os containers
orkestri start     # Inicia o sistema
orkestri stop      # Para o sistema
orkestri restart   # Reinicia
orkestri logs      # Logs em tempo real
orkestri logs api  # Logs de um serviço específico
orkestri ip        # Mostra o endereço de acesso
```

Ou via systemd:

```bash
sudo systemctl status orkestri
sudo systemctl start orkestri
sudo systemctl stop orkestri
sudo systemctl restart orkestri
```

---

## Verificar se está funcionando

```bash
# Status dos containers
orkestri status

# Deve mostrar algo como:
# NAME                STATUS          PORTS
# orkestri_postgres   healthy
# orkestri_redis      healthy
# orkestri_api        healthy
# orkestri_frontend   running
# orkestri_nginx      running         0.0.0.0:80->80/tcp
```

Se algum container não subiu:

```bash
orkestri logs api       # Ver erros da API
orkestri logs postgres  # Ver erros do banco
```

---

## Estrutura de arquivos

```
orkestri/
├── docker-compose.yml        # Orquestra os serviços
├── .env                      # Variáveis de ambiente (gerado no install)
├── nginx/
│   └── nginx.conf            # Proxy reverso + WebSocket
├── backend/
│   ├── Dockerfile
│   ├── prisma/
│   │   └── schema.prisma     # Schema completo do banco de dados
│   └── src/
│       ├── main.ts
│       ├── app.module.ts
│       └── modules/
│           ├── auth/          # Login, JWT, sessões
│           ├── users/         # Gestão de usuários
│           └── health/        # Health check endpoint
├── frontend/
│   ├── Dockerfile
│   └── src/
│       ├── app/
│       │   ├── login/         # Tela de login
│       │   └── dashboard/     # Dashboard (em construção)
│       ├── lib/
│       │   ├── api.ts         # Cliente Axios
│       │   └── store.ts       # Estado global Zustand
│       └── styles/
│           └── globals.css    # Design system Orkestri
└── scripts/
    ├── install.sh             # Instalador completo
    └── init.sql               # Extensões do PostgreSQL
```

---

## Atualização do sistema

```bash
cd ~/orkestri

# Puxa novas versões e reconstrói
docker compose pull
docker compose up -d --build --remove-orphans

# Migrations são executadas automaticamente no start da API
```

---

## Acesso ao banco de dados (opcional)

Para acessar o PostgreSQL diretamente (ex: via DBeaver):

```bash
# Descomente a linha ports no docker-compose.yml:
# postgres:
#   ports:
#     - "5432:5432"

# Reinicie o postgres
docker compose restart postgres
```

Credenciais do banco estão no arquivo `.env`.

---

## Backup

```bash
# Backup do banco
source ~/orkestri/.env
docker exec orkestri_postgres pg_dump -U $POSTGRES_USER $POSTGRES_DB \
  | gzip > ~/orkestri-backup-$(date +%Y%m%d).sql.gz

# Restaurar
gunzip -c backup.sql.gz \
  | docker exec -i orkestri_postgres psql -U $POSTGRES_USER $POSTGRES_DB
```

---

## Firewall (UFW)

Se a VM tiver UFW ativo:

```bash
sudo ufw allow 80/tcp
sudo ufw allow 22/tcp
sudo ufw enable
```

---

## Progresso do desenvolvimento

- [x] Banco de dados (schema completo com todas as tabelas)
- [x] Auth API (login, JWT, sessões, usuário master automático)
- [x] Tela de login (design futurístico)
- [ ] Dashboard principal
- [ ] Módulo de Agenda
- [ ] Módulo de Projetos (Planner)
- [ ] Módulo Keep (notas + tasks diárias)
- [ ] Gestão de usuários (painel master)
