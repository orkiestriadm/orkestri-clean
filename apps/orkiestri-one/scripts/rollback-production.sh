#!/usr/bin/env bash
set -euo pipefail
cd /opt/orkestri
backup=/opt/orkestri/.backups/one-20261025
test -s "$backup/source-before.tgz"
test -s "$backup/docker-compose.prod.yml"
test -s "$backup/database-before.dump"
mkdir -p "$backup/restore"
tar -xzf "$backup/source-before.tgz" -C "$backup/restore"
sudo -n install -m 644 "$backup/docker-compose.prod.yml" /opt/orkestri/docker-compose.prod.yml
for source in backend/src backend/assets frontend/src frontend/public; do
  test -d "$backup/restore/$source"
  sudo -n rsync -a --delete --chown=root:root --chmod=D755,F644 "$backup/restore/$source/" "/opt/orkestri/$source/"
done
# Migrations aditivas e arquivos privados ficam preservados. Não restaurar o
# dump automaticamente: isso apagaria registros legítimos feitos após o deploy.
for file in backend/prisma/schema.prisma backend/package.json backend/package-lock.json backend/tsconfig.json backend/nest-cli.json backend/Dockerfile backend/.dockerignore frontend/package.json frontend/package-lock.json frontend/tsconfig.json frontend/next-env.d.ts frontend/next.config.js frontend/tailwind.config.js frontend/postcss.config.js frontend/Dockerfile frontend/.dockerignore; do
  sudo -n install -m 644 "$backup/restore/$file" "/opt/orkestri/$file"
done
docker image tag orkestri/api:before-one-20261025 orkestri/api:latest
docker image tag orkestri/frontend:before-one-20261025 orkestri/frontend:latest
if docker inspect orkestri_media_worker >/dev/null 2>&1; then docker stop orkestri_media_worker >/dev/null; fi
docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d --no-deps --no-build api frontend
for attempt in $(seq 1 40); do
  if [ "$(docker inspect orkestri_api --format '{{.State.Health.Status}}')" = healthy ]; then break; fi
  sleep 3
done
test "$(docker inspect orkestri_api --format '{{.State.Health.Status}}')" = healthy
docker exec orkestri_nginx nginx -t
docker exec orkestri_nginx nginx -s reload
curl -fsS https://orkiestri.com/api/health >/dev/null
printf '%s\n' ROLLBACK_ONE_HEALTHY
