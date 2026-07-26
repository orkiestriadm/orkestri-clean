# Deploy Runbook — Novo site institucional (MESMO domínio)

Objetivo:
- `orkiestri.com` + `www.orkiestri.com` **continuam iguais** (mesmo domínio, mesmo cert).
- As **rotas públicas** (`/`, `/products`, `/services`, `/company`, `/technology`,
  `/cases`, `/blog`, `/contact`, `/demo`, `/privacy`, `/terms`) passam a servir o
  **novo site** (container `orkestri_website`).
- O **SISTEMA/plataforma** continua no mesmo domínio, nas rotas dele
  (`/login`, `/dashboard`, `/signup`, `/portal`, `/kb`, `/reservas`,
  `/primeiro-acesso`, `/recuperar-senha`, `/solicitar-acesso`, `/suspended`,
  `/entenda-orkiestri`, `/api/*`, `/_next/*`) → containers `orkestri_frontend` + `orkestri_api`.

SEM mudança de DNS. SEM novo certificado. Usuários logados **não** precisam relogar.

Servidor: AWS Lightsail `54.159.107.250` · `/opt/orkestri` · `ssh orkestri-prod`.
Princípio: sistema nunca sai do ar; cada passo validado; rollback em segundos.

---

## PASSO 1 — Código no servidor

```bash
cd /opt/orkestri
git fetch origin
git checkout claude/orkiestri-site-redesign-8e4b21    # ou o merge em main
git pull
ls website/                                             # confirmar
```

O serviço `website` já faz parte de `docker-compose.prod.yml` — entra nos deploys
padrão da plataforma (comando de 2 arquivos). Não há mais override separado.

## PASSO 2 — Build da imagem do site (não afeta produção)

```bash
cd /opt/orkestri
docker compose -f docker-compose.yml -f docker-compose.prod.yml build website
```

## PASSO 3 — Subir o container do site

```bash
docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d website
docker ps | grep orkestri_website
# validar internamente (rede docker), antes de tocar no nginx:
docker exec orkestri_nginx wget -qO- http://orkestri_website:3000/ | grep -o "organizes businesses"
```

## PASSO 4 — Cutover do nginx (o único passo que afeta o tráfego)

A config canônica do nginx (`nginx/nginx-ssl.conf`) já contém as rotas do site +
sistema. Num deploy via git, ela vem junto. Para aplicar/recarregar:

```bash
cd /opt/orkestri
docker exec orkestri_nginx nginx -t                            # testar sintaxe
docker exec orkestri_nginx nginx -s reload                    # aplicar (zero downtime)
```

Rollback rápido usa o backup salvo no cutover (`nginx/nginx-ssl.conf.bak.<ts>`).

## PASSO 5 — Validação

```bash
# SITE novo nas rotas públicas:
curl -s  https://www.orkiestri.com/ | grep -o "organizes businesses"
curl -sI https://www.orkiestri.com/products | head -1        # 200
curl -sI https://www.orkiestri.com/_site/_next/static/ | head -1
# SISTEMA intacto no mesmo domínio:
curl -sI https://www.orkiestri.com/login | head -1           # 200 (plataforma)
curl -sI https://www.orkiestri.com/dashboard | head -1       # 200/302 (plataforma)
```

Checklist:
- [ ] `/` mostra o novo site
- [ ] `/products`, `/services`, `/contact` OK
- [ ] CSS/JS do site carregam (via /_site/_next/…)
- [ ] `/login` abre a plataforma e o login funciona
- [ ] `/dashboard` acessível para usuário logado (sessão preservada)
- [ ] Formulário de contato/demo envia (POST /api/contact → 200)
- [ ] `/api/*` do sistema continua funcionando

## ROLLBACK (segundos)

```bash
cd /opt/orkestri
cp nginx/nginx-ssl.conf.bak.<timestamp> nginx/nginx-ssl.conf
docker exec orkestri_nginx nginx -t && docker exec orkestri_nginx nginx -s reload
# tudo volta ao estado anterior (sistema servindo tudo na raiz)
```

---

## Observações

- **Assets:** os dois são Next.js; a plataforma é dona de `/_next/`, o site usa
  `assetPrefix=/_site` → nginx roteia `/_site/` para o site. Sem colisão.
- **Memória:** `orkestri_website` limitado a 256MB. O build (`next build`) usa até
  ~1GB de heap; em host de 2GB, rodar em janela de baixo tráfego. Monitorar `docker stats`.
- **Botão "Entrar"** no site aponta para `/login` (mesmo domínio) → leva à plataforma.
