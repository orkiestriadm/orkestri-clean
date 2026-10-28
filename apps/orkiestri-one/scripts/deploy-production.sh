#!/usr/bin/env bash
set -euo pipefail
cd /opt/orkestri
release=/opt/orkestri/releases/one-20261025
backup=/opt/orkestri/.backups/one-20261025
test "$(docker inspect orkestri_api --format '{{.Image}}')" = sha256:0f5f6ff4e1e0e04a920845298095ba731d2af02f5c6ec03b06db3a034ddbc10a
test "$(docker inspect orkestri_frontend --format '{{.Image}}')" = sha256:9597abbb16ab021e613fe9336a22ee08b4c89e16d686788de736f90aa9e4e0e7
docker exec orkestri_api node -e 'if(!["orkiestri.com","app.orkiestri.com"].includes(new URL(process.env.APP_URL).hostname))process.exit(1)'
test "$(docker inspect orkiestri-one-test-api --format '{{.Image}}')" = "$(docker image inspect orkestri/api:one-final-20261025 --format '{{.Id}}')"
test "$(docker inspect orkiestri-one-test-frontend --format '{{.Image}}')" = "$(docker image inspect orkestri/frontend:one-final-20261025 --format '{{.Id}}')"
grep -q 'PASS HTTP real: full signup' "$release/http-tests.log"
grep -q 'PASS HTTP real: guided conversation' "$release/http-tests.log"
for suite in inicio rotina cadastro recibos; do grep -q 'RESULTADO:' "$release/regression-$suite.log"; done
test -f "$release/browser-tests-passed"
test ! -e "$backup"
test ! -e /opt/orkestri/.secrets/whatsapp-media.env
! grep -q 'media-worker:' docker-compose.prod.yml
umask 077
mkdir -p "$backup/baseline"
tar -xzf /tmp/orkiestri-one-source-20261024.tgz -C "$backup/baseline"
for source in backend/src backend/prisma frontend/src frontend/public; do
  diff -qr "$backup/baseline/$source" "/opt/orkestri/$source"
done
tar -czf "$backup/source-before.tgz" backend/src backend/prisma backend/assets backend/package.json backend/package-lock.json backend/tsconfig.json backend/nest-cli.json backend/Dockerfile backend/.dockerignore frontend/src frontend/public frontend/package.json frontend/package-lock.json frontend/tsconfig.json frontend/next-env.d.ts frontend/next.config.js frontend/tailwind.config.js frontend/postcss.config.js frontend/Dockerfile frontend/.dockerignore docker-compose.prod.yml
cp docker-compose.prod.yml "$backup/docker-compose.prod.yml"
docker exec orkestri_postgres sh -c 'pg_dump -U "$POSTGRES_USER" -Fc "$POSTGRES_DB"' > "$backup/database-before.dump"
test -s "$backup/database-before.dump"
docker image tag sha256:0f5f6ff4e1e0e04a920845298095ba731d2af02f5c6ec03b06db3a034ddbc10a orkestri/api:before-one-20261025
docker image tag sha256:9597abbb16ab021e613fe9336a22ee08b4c89e16d686788de736f90aa9e4e0e7 orkestri/frontend:before-one-20261025
mkdir -p /opt/orkestri/.secrets
chmod 700 /opt/orkestri/.secrets
docker exec orkestri_api node -e 'const c=require("crypto");if(!process.env.JWT_SECRET)process.exit(1);process.stdout.write("MEDIA_WORKER_TOKEN="+c.createHmac("sha256",process.env.JWT_SECRET).update("orkiestri/media-worker/v1").digest("hex")+"\n")' > /opt/orkestri/.secrets/whatsapp-media.env
changed=0
trap 'code=$?; if [ "$changed" = 1 ]; then echo "DEPLOY_FAILED_ROLLING_BACK"; bash "$release/scripts/rollback-production.sh"; fi; exit "$code"' ERR
changed=1
sudo -n tee -a docker-compose.prod.yml < "$release/production-whatsapp.fragment.yml" >/dev/null
docker compose -f docker-compose.yml -f docker-compose.prod.yml config --quiet
for source in backend/src backend/prisma backend/assets frontend/src frontend/public; do
  sudo -n rsync -a --chown=root:root --chmod=D755,F644 "$release/$source/" "/opt/orkestri/$source/"
done
for file in backend/package.json backend/package-lock.json backend/tsconfig.json backend/nest-cli.json backend/Dockerfile backend/.dockerignore frontend/package.json frontend/package-lock.json frontend/tsconfig.json frontend/next-env.d.ts frontend/next.config.js frontend/tailwind.config.js frontend/postcss.config.js frontend/Dockerfile frontend/.dockerignore; do
  sudo -n install -m 644 "$release/$file" "/opt/orkestri/$file"
done
docker image tag orkestri/api:one-final-20261025 orkestri/api:latest
docker image tag orkestri/frontend:one-final-20261025 orkestri/frontend:latest
docker compose -f docker-compose.yml -f docker-compose.prod.yml run --rm --no-deps --interactive=false -T api npx prisma migrate deploy
docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d --no-deps --no-build api frontend media-worker
for attempt in $(seq 1 40); do
  if [ "$(docker inspect orkestri_api --format '{{.State.Health.Status}}')" = healthy ]; then break; fi
  sleep 3
done
test "$(docker inspect orkestri_api --format '{{.State.Health.Status}}')" = healthy
docker exec orkestri_nginx nginx -t
docker exec orkestri_nginx nginx -s reload
curl -fsS https://orkiestri.com/api/health > "$release/production-health.json"
for route in /dashboard/whatsapp-operacao /dashboard/whatsapp-anexos; do
  status=$(curl -sS -D "$release/auth-redirect.headers" -o /dev/null -w '%{http_code}' "https://orkiestri.com$route")
  test "$status" = 307
  grep -i '^location:' "$release/auth-redirect.headers" | grep -q '/login'
done
test "$(curl -sS -o /dev/null -w '%{http_code}' https://orkiestri.com/recuperar-senha)" = 200
docker inspect orkestri_api orkestri_frontend orkestri_media_worker --format '{{.Name}} {{.Image}} {{.State.Status}}' > "$release/production-images.txt"
date -u +'%Y-%m-%dT%H:%M:%SZ' > "$release/deployed-at.txt"
changed=0
trap - ERR
printf '%s\n' DEPLOY_ONE_HEALTHY
