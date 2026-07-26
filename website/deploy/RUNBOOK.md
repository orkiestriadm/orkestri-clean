# Deploy Runbook — Novo site institucional + migração da plataforma

Objetivo final:
- `orkiestri.com` + `www.orkiestri.com` → **novo site institucional** (container `orkestri_website`)
- `app.orkiestri.com` → **plataforma SaaS** (containers `orkestri_frontend` + `orkestri_api`, hoje na raiz)

Servidor: AWS Lightsail `54.159.107.250` · deploy dir `/opt/orkestri` · acesso `ssh orkestri-prod`.

Princípio: a plataforma **nunca** fica fora do ar. Cada passo é validado antes do próximo.

---

## PRÉ-REQUISITO (ação do cliente) — bloqueia todo o resto

Criar no provedor de DNS um registro A:

```
app.orkiestri.com   A   54.159.107.250   (TTL baixo, ex. 300)
```

Verificar propagação:
```bash
getent hosts app.orkiestri.com    # deve retornar 54.159.107.250
```

Enquanto `app.orkiestri.com` não resolver, o cutover NÃO pode ocorrer (sem cert TLS).

---

## PASSO 1 — Enviar o código do site para o servidor

```bash
# no servidor: garantir que o branch com website/ está presente em /opt/orkestri
cd /opt/orkestri
git fetch origin
git checkout claude/orkiestri-site-redesign-8e4b21   # ou o commit de merge em main
git pull
ls website/                                            # confirmar que existe
```

## PASSO 2 — Build da imagem do site (não afeta produção ainda)

```bash
cd /opt/orkestri
docker compose -f docker-compose.yml -f docker-compose.prod.yml \
  -f website/deploy/docker-compose.website.yml build website
```

## PASSO 3 — Emitir certificado TLS para app.orkiestri.com

O bloco :80 default já serve o desafio ACME via webroot `/var/www/certbot`.

```bash
docker compose run --rm --entrypoint "" certbot \
  certbot certonly --webroot -w /var/www/certbot \
  -d app.orkiestri.com --email <email> --agree-tos --no-eff-email
# confirmar:
sudo ls /opt/orkestri/ssl/letsencrypt/live/app.orkiestri.com/
```

## PASSO 4 — Subir o container do site

```bash
docker compose -f docker-compose.yml -f docker-compose.prod.yml \
  -f website/deploy/docker-compose.website.yml up -d website
docker ps | grep orkestri_website
# validar internamente (via rede docker), sem depender do nginx ainda:
docker exec orkestri_nginx wget -qO- http://orkestri_website:3000/ | head -c 200
```

## PASSO 5 — Trocar a config do nginx (o cutover)

```bash
cd /opt/orkestri
cp nginx/nginx-ssl.conf nginx/nginx-ssl.conf.bak.$(date +%s)     # backup
cp website/deploy/nginx-ssl.conf nginx/nginx-ssl.conf            # nova config
docker exec orkestri_nginx nginx -t                             # testar sintaxe
docker exec orkestri_nginx nginx -s reload                     # aplicar (zero downtime)
```

## PASSO 6 — Validação

```bash
curl -sI https://app.orkiestri.com/login   | head -1   # 200 → plataforma OK no subdomínio
curl -s  https://www.orkiestri.com/ | grep -o "organizes businesses"   # site novo no ar
curl -sI https://www.orkiestri.com/products | head -1  # 200
curl -sI https://orkiestri.com/login | head -1         # 301 → redireciona p/ app
```

Checklist:
- [ ] `app.orkiestri.com` abre a plataforma e o login funciona
- [ ] `www.orkiestri.com` mostra o novo site
- [ ] `www.orkiestri.com/products`, `/services`, `/contact` OK
- [ ] Formulário de contato/demo envia (POST /api/contact → 200)
- [ ] `orkiestri.com/login` redireciona para `app.orkiestri.com/login`

## ROLLBACK (se algo falhar)

```bash
cd /opt/orkestri
cp nginx/nginx-ssl.conf.bak.<timestamp> nginx/nginx-ssl.conf
docker exec orkestri_nginx nginx -t && docker exec orkestri_nginx nginx -s reload
# a plataforma volta a responder na raiz orkiestri.com imediatamente
```

---

## Observações

- A plataforma usa API same-origin (`/api`), então funciona igual em qualquer domínio.
  Cookies host-only: usuários logados hoje em `orkiestri.com` precisarão logar de novo
  em `app.orkiestri.com` (esperado numa migração de domínio).
- Recomenda-se comunicar aos usuários o novo endereço da plataforma (`app.orkiestri.com`).
- Memória: `orkestri_website` limitado a 256MB (heap 192MB). Monitorar `docker stats`.
