#!/usr/bin/env python3
"""
Seed — Manual de Instalação do Agente de Monitoramento de Ativos
Insere 1 artigo completo + detalhado na categoria Automacoes & Webhooks
"""
import json, subprocess, sys, os

BASE  = os.environ.get("ORKESTRI_BASE",  "http://localhost/api")
EMAIL = os.environ.get("ORKESTRI_EMAIL", "administrator@orkiestri.com")
SENHA = os.environ.get("ORKESTRI_SENHA", "")

CSRF_VAL = ""

def req(method, path, body=None, token=None):
    h = ["-H","Content-Type: application/json"]
    if CSRF_VAL:
        h += ["-H", f"x-csrf-token: {CSRF_VAL}", "-b", f"csrf_token={CSRF_VAL}"]
    if token:
        h += ["-H", f"Authorization: Bearer {token}"]
    cmd = ["curl","-s","-X",method, BASE+path] + h
    if body: cmd += ["-d", json.dumps(body)]
    r = subprocess.run(cmd, capture_output=True, text=True, timeout=30)
    try: return json.loads(r.stdout)
    except: return {"_raw": r.stdout[:300]}

def req_csrf(method, path, body=None, token=None):
    global CSRF_VAL
    # Get CSRF
    cr = subprocess.run(["curl","-sc","/tmp/csrf.txt","-s", BASE+"/auth/csrf"], capture_output=True, text=True)
    try:
        CSRF_VAL = json.loads(cr.stdout).get("csrfToken","")
    except: pass
    return req(method, path, body, token)

# Login
print("Autenticando...")
login = req_csrf("POST", "/auth/login", {"email": EMAIL, "senha": SENHA})
TOKEN = login.get("accessToken","")
if not TOKEN:
    print("Falhou:", login); sys.exit(1)
print(f"  OK: {TOKEN[:20]}...")

# Encontra categoria Automacoes
print("Buscando categoria...")
cats = req("GET", "/conhecimento/categorias", token=TOKEN)
CAT_ID = ""
if isinstance(cats, list):
    for c in cats:
        if "Automa" in c.get("nome",""):
            CAT_ID = c["id"]
            print(f"  Categoria: {c['nome']} ({CAT_ID})")
            break

if not CAT_ID:
    # Cria se nao existir
    r = req("POST", "/conhecimento/categorias", {
        "nome":"Automações & Webhooks","descricao":"Aprenda a automatizar o Orkiestri sem escrever código",
        "icone":"⚡","cor":"#7c3aed","ordem":20
    }, TOKEN)
    CAT_ID = r.get("id","")
    print(f"  Categoria criada: {CAT_ID}")

CONTEUDO = """# Manual de Instalação e Configuração do Agente de Monitoramento

O **Agente de Monitoramento** é um pequeno programa que você instala em qualquer computador da sua rede interna. Ele faz o ping dos seus ativos (servidores, impressoras, switches, câmeras, etc.) e envia os resultados para o Orkiestri em tempo real — sem precisar abrir nenhuma porta no firewall.

---

## Como funciona

```
[Agente na sua rede]  →  ping nos ativos  →  envia resultados  →  [Orkiestri na nuvem]
```

O agente só precisa de acesso à internet de **saída** (porta 443/HTTPS). Não é necessário abrir portas de entrada no seu firewall ou roteador.

---

## Requisitos

| Item | Requisito |
|---|---|
| **Sistema operacional** | Linux, macOS ou Windows |
| **Node.js** | Versão 18 ou superior |
| **Rede** | Acesso à internet de saída (HTTPS) |
| **Posição na rede** | Deve conseguir fazer ping nos ativos que quer monitorar |

> Qualquer computador que já esteja ligado e na rede serve: um PC de escritório, um servidor, um Raspberry Pi ou até uma máquina virtual.

---

## Passo 1 — Instalar o Node.js

### Linux (Ubuntu/Debian)
```bash
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs
node --version  # deve mostrar v20.x.x
```

### Linux (CentOS/RHEL/Fedora)
```bash
curl -fsSL https://rpm.nodesource.com/setup_20.x | sudo bash -
sudo yum install -y nodejs
```

### macOS
```bash
# Com Homebrew:
brew install node

# Ou baixe o instalador em: https://nodejs.org
```

### Windows
Baixe o instalador LTS em **nodejs.org** e execute. Após instalar, abra o **Prompt de Comando** e verifique:
```
node --version
```

---

## Passo 2 — Gerar a chave de autenticação

1. Acesse o Orkiestri e vá em **Ativos** no menu lateral
2. Clique no botão **🖥 Monitoramento** (canto superior direito)
3. Clique em **⚙ Configurar agente**
4. Clique em **Gerar nova chave**
5. **Copie a chave** — ela começa com `mkey_` e aparece apenas uma vez

> ⚠️ Guarde a chave em local seguro. Se gerar uma nova chave, a anterior para de funcionar e o agente precisa ser reconfigurado.

---

## Passo 3 — Baixar o agente

### Linux / macOS

Abra o terminal e execute:

```bash
curl -fsSL https://orkiestri.com/api/agent/orkestri-agent.js -o orkestri-agent.js
```

Ou baixe manualmente pelo navegador em:
```
https://orkiestri.com/scripts/orkestri-agent.js
```

### Windows

Abra o PowerShell e execute:
```powershell
Invoke-WebRequest -Uri "https://orkiestri.com/scripts/orkestri-agent.js" -OutFile "orkestri-agent.js"
```

---

## Passo 4 — Executar o agente

### Linux / macOS

```bash
ORKESTRI_URL="https://orkiestri.com/api" \
MONITORING_KEY="mkey_SUA_CHAVE_AQUI" \
node orkestri-agent.js
```

### Windows (Prompt de Comando)

```cmd
set ORKESTRI_URL=https://orkiestri.com/api
set MONITORING_KEY=mkey_SUA_CHAVE_AQUI
node orkestri-agent.js
```

### Windows (PowerShell)

```powershell
$env:ORKESTRI_URL = "https://orkiestri.com/api"
$env:MONITORING_KEY = "mkey_SUA_CHAVE_AQUI"
node orkestri-agent.js
```

Se tudo estiver correto, você verá no terminal:

```
╔══════════════════════════════════════════════╗
║   Orkiestri — Agente de Monitoramento        ║
╚══════════════════════════════════════════════╝
  API:       https://orkiestri.com/api
  Intervalo: 60s
  Timeout:   3000ms
  Paralelo:  10 pings simultâneos

[14:32:01] INFO  Buscando ativos para monitorar...
[14:32:02] OK    Ping concluído: 8 online, 2 offline
[14:32:02] INFO  Resultados enviados: 10/10 processados
```

---

## Passo 5 — Cadastrar os IPs nos ativos

Para cada ativo que deseja monitorar:

1. Vá em **Ativos** → clique no ativo → **Editar**
2. No campo **Endereço IP**, digite o IP do equipamento (ex: `192.168.1.10`)
3. Marque a caixa **Monitorar este ativo**
4. Clique em **Salvar**

O agente detectará o novo ativo automaticamente no próximo ciclo (a cada 60 segundos por padrão).

---

## Opções de configuração

O agente aceita configurações via variáveis de ambiente:

| Variável | Padrão | Descrição |
|---|---|---|
| `ORKESTRI_URL` | — | URL da API do Orkiestri **(obrigatório)** |
| `MONITORING_KEY` | — | Chave gerada no sistema **(obrigatório)** |
| `INTERVAL` | `60` | Intervalo entre ciclos de ping em segundos |
| `TIMEOUT` | `3000` | Timeout do ping em milissegundos |
| `CONCURRENCY` | `10` | Número de pings simultâneos |
| `LOG_LEVEL` | `normal` | Nível de log: `quiet`, `normal` ou `verbose` |

**Exemplo com configurações personalizadas:**
```bash
ORKESTRI_URL="https://orkiestri.com/api" \
MONITORING_KEY="mkey_..." \
INTERVAL=30 \
CONCURRENCY=20 \
LOG_LEVEL=verbose \
node orkestri-agent.js
```

---

## Manter o agente rodando em segundo plano

Para que o agente não pare quando você fechar o terminal, use uma das opções abaixo:

### Opção A — PM2 (recomendado para Linux/macOS)

PM2 é um gerenciador de processos Node.js que reinicia o agente automaticamente se ele cair.

```bash
# Instalar PM2
npm install -g pm2

# Iniciar o agente
ORKESTRI_URL="https://orkiestri.com/api" \
MONITORING_KEY="mkey_..." \
pm2 start orkestri-agent.js --name orkestri-agent

# Ver status
pm2 status

# Ver logs
pm2 logs orkestri-agent

# Configurar para iniciar com o sistema
pm2 startup
pm2 save
```

### Opção B — systemd (Linux com systemd)

Crie o arquivo `/etc/systemd/system/orkestri-agent.service`:

```ini
[Unit]
Description=Orkiestri Monitoring Agent
After=network.target

[Service]
Type=simple
User=ubuntu
WorkingDirectory=/home/ubuntu
Environment=ORKESTRI_URL=https://orkiestri.com/api
Environment=MONITORING_KEY=mkey_SUA_CHAVE_AQUI
Environment=INTERVAL=60
ExecStart=/usr/bin/node /home/ubuntu/orkestri-agent.js
Restart=always
RestartSec=10

[Install]
WantedBy=multi-user.target
```

Ative o serviço:
```bash
sudo systemctl daemon-reload
sudo systemctl enable orkestri-agent
sudo systemctl start orkestri-agent
sudo systemctl status orkestri-agent
```

### Opção C — Tarefa agendada (Windows)

No PowerShell como **Administrador**:

```powershell
$action = New-ScheduledTaskAction `
  -Execute "node" `
  -Argument "C:\\orkestri\\orkestri-agent.js" `
  -WorkingDirectory "C:\\orkestri"

$trigger = New-ScheduledTaskTrigger -AtStartup

$settings = New-ScheduledTaskSettingsSet -RestartCount 3 -RestartInterval (New-TimeSpan -Minutes 1)

$env_vars = @(
  New-ScheduledTaskPrincipal -UserId "SYSTEM" -LogonType ServiceAccount
)

Register-ScheduledTask `
  -TaskName "OrkiestriAgent" `
  -Action $action `
  -Trigger $trigger `
  -Settings $settings `
  -Description "Agente de monitoramento de ativos Orkiestri"

# Definir variáveis de ambiente para o serviço
[System.Environment]::SetEnvironmentVariable("ORKESTRI_URL", "https://orkiestri.com/api", "Machine")
[System.Environment]::SetEnvironmentVariable("MONITORING_KEY", "mkey_SUA_CHAVE_AQUI", "Machine")
```

---

## Dashboard de monitoramento

Após o agente estar rodando e os IPs cadastrados, acesse o dashboard em:

**Ativos → 🖥 Monitoramento**

O dashboard mostra:

| Indicador | Descrição |
|---|---|
| 🟢 **Online** | Respondeu ao último ping |
| 🔴 **Offline** | Não respondeu ao último ping |
| ⚪ **Sem IP** | Ativo cadastrado sem IP configurado |
| **Latência (ms)** | Tempo de resposta do último ping |
| **Uptime 24h** | Percentual de disponibilidade nas últimas 24 horas |
| **Histórico** | Gráfico de pings com barras coloridas (verde = online, vermelho = offline) |

O dashboard atualiza automaticamente a cada **30 segundos**.

---

## Solução de problemas

### O agente diz "Chave de monitoramento inválida"
- Verifique se a variável `MONITORING_KEY` está correta
- Gere uma nova chave em Ativos → Monitoramento → Configurar agente

### O ativo aparece como offline mas está funcionando
- Verifique se o IP cadastrado está correto
- Certifique-se que o computador onde o agente roda consegue fazer ping para esse IP
- Teste manualmente: `ping 192.168.1.10`
- Alguns equipamentos bloqueiam ping por padrão (verifique o firewall local)

### O agente não conecta na API
- Verifique a conexão com a internet do computador onde o agente está
- Teste: `curl https://orkiestri.com/api/auth/csrf`
- Verifique se a URL em `ORKESTRI_URL` está correta (sem barra no final)

### Ping bloqueado por firewall corporativo
- O agente usa o comando `ping` nativo do sistema operacional (ICMP)
- Se o ICMP estiver bloqueado, o ativo sempre aparecerá offline
- Solução: liberar ICMP no firewall interno, ou posicionar o agente em uma máquina que tenha acesso direto aos equipamentos

### Ver logs detalhados
```bash
LOG_LEVEL=verbose node orkestri-agent.js
```

---

## Segurança

- A comunicação entre o agente e o Orkiestri usa **HTTPS (TLS)**
- A chave `mkey_...` autentica o agente — mantenha-a em segredo
- Se a chave for comprometida, gere uma nova no dashboard imediatamente
- O agente NÃO precisa de acesso SSH nem admin nos equipamentos monitorados
- O agente só FAZ requisições de saída — nenhuma porta de entrada é necessária
"""

print("Criando artigo...")
r = req("POST", "/conhecimento", {
    "titulo": "Manual completo: Instalação e configuração do Agente de Monitoramento",
    "resumo": "Guia passo a passo para instalar o agente de monitoramento de ativos no Linux, macOS e Windows, incluindo configuração em segundo plano com PM2, systemd e Windows Task Scheduler.",
    "conteudo": CONTEUDO,
    "categoriaId": CAT_ID,
    "tags": ["monitoramento","agente","instalação","ping","infraestrutura","ativos","Linux","Windows"],
    "status": "rascunho"
}, TOKEN)

ART_ID = r.get("id","")
if not ART_ID:
    print("Erro ao criar:", r); sys.exit(1)

print(f"  Artigo criado: {ART_ID[:8]}...")

# Publicar
pub = req("PATCH", f"/conhecimento/{ART_ID}/publicar", {"publicar": True}, TOKEN)
print(f"  Status: {pub.get('status','?')}")
print("\n✅ Manual publicado com sucesso na base de conhecimento!")
print(f"   Categoria: Automações & Webhooks")
print(f"   Título: Manual completo: Instalação e configuração do Agente de Monitoramento")
