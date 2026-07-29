#!/bin/bash
ssh -o StrictHostKeyChecking=no planner@10.192.4.123 "cat << 'EOF' > /tmp/fix3.js
const { PrismaClient } = require(\"@prisma/client\");
const prisma = new PrismaClient();
async function main() {
  try { await prisma.\$executeRawUnsafe(\"ALTER TABLE \\\"reservas_veiculo\\\" DROP CONSTRAINT IF EXISTS \\\"reservas_veiculo_centro_custo_id_fkey\\\";\"); } catch (e) { console.log(e); }
  try { await prisma.\$executeRawUnsafe(\"ALTER TABLE \\\"reservas_veiculo\\\" RENAME COLUMN \\\"centro_custo_id\\\" TO \\\"centro_custo\\\";\"); } catch (e) { console.log(e); }
  
  console.log(\"Renamed centro_custo_id in reservas_veiculo!\");
}
main().catch(console.error).finally(() => prisma.\$disconnect());
EOF
docker cp /tmp/fix3.js \$(docker compose -f /home/planner/orkestri/docker-compose.yml ps -q api):/app/fix3.js
docker compose -f /home/planner/orkestri/docker-compose.yml exec -T api node /app/fix3.js
"
