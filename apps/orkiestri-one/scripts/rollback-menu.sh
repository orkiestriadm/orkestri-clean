#!/usr/bin/env bash
set -euo pipefail
cd /opt/orkestri
test -s /opt/orkestri/.backups/menu-20261025/before-inbound.ts
sudo -n install -m 644 /opt/orkestri/.backups/menu-20261025/before-inbound.ts backend/src/modules/agenda/whatsapp-inbound.module.ts
docker image tag orkestri/api:before-menu-20261025 orkestri/api:latest
docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d --no-deps --no-build api
for attempt in $(seq 1 40); do
  if [ "$(docker inspect orkestri_api --format '{{.State.Health.Status}}')" = healthy ]; then break; fi
  sleep 3
done
test "$(docker inspect orkestri_api --format '{{.State.Health.Status}}')" = healthy
docker exec orkestri_nginx nginx -t
docker exec orkestri_nginx nginx -s reload
curl -fsS https://orkiestri.com/api/health >/dev/null
