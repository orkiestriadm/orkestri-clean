#!/bin/bash
set -e

SERVER="planner@10.192.4.123"

echo "==> Enviando nginx.conf para o servidor de produção..."
scp -o StrictHostKeyChecking=no nginx/nginx.conf "$SERVER:/home/planner/orkestri/nginx/nginx.conf"

echo "==> Reiniciando o nginx..."
ssh -o StrictHostKeyChecking=no "$SERVER" '
  cd /home/planner/orkestri
  docker compose restart nginx
'

echo "=== FEITO ==="
