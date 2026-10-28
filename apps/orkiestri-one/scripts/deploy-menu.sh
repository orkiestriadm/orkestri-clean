#!/usr/bin/env bash
set -euo pipefail
cd /opt/orkestri
release=/opt/orkestri/releases/one-20261025
backup=/opt/orkestri/.backups/menu-20261025
test "$(docker inspect orkestri_api --format '{{.Image}}')" = sha256:56d3190568ba7c42fdefa037bf077f1e01c594dd43bed447d0399d6cfa5f3a45
test "$(docker inspect orkiestri-one-test-api --format '{{.Image}}')" = "$(docker image inspect orkestri/api:one-menu-20261025 --format '{{.Id}}')"
grep -q 'PASS screenshot sequence' "$release/menu-tests.log"
grep -q 'PASS finance-only permissions' "$release/menu-tests.log"
grep -q 'RESULTADO:' "$release/menu-regression-inicio.log"
test ! -e "$backup"
umask 077
mkdir -p "$backup"
cp backend/src/modules/agenda/whatsapp-inbound.module.ts "$backup/before-inbound.ts"
docker image tag orkestri/api:latest orkestri/api:before-menu-20261025
trap 'code=$?; bash "$release/scripts/rollback-menu.sh"; exit "$code"' ERR
sudo -n install -m 644 "$release/backend/src/modules/agenda/whatsapp-inbound.module.ts" backend/src/modules/agenda/whatsapp-inbound.module.ts
docker image tag orkestri/api:one-menu-20261025 orkestri/api:latest
docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d --no-deps --no-build api
for attempt in $(seq 1 40); do
  if [ "$(docker inspect orkestri_api --format '{{.State.Health.Status}}')" = healthy ]; then break; fi
  sleep 3
done
test "$(docker inspect orkestri_api --format '{{.State.Health.Status}}')" = healthy
docker exec orkestri_nginx nginx -t
docker exec orkestri_nginx nginx -s reload
curl -fsS https://orkiestri.com/api/health > "$release/menu-production-health.json"
docker inspect orkestri_api --format '{{.Image}}' > "$release/menu-production-image.txt"
trap - ERR
printf '%s\n' MENU_DEPLOY_HEALTHY
