#!/bin/bash
ssh -o StrictHostKeyChecking=no planner@10.192.4.123 "cat << 'EOF' > /tmp/fix2.js
const { PrismaClient } = require(\"@prisma/client\");
const prisma = new PrismaClient();
async function main() {
  try { await prisma.\$executeRawUnsafe(\"ALTER TABLE \\\"veiculos\\\" DROP CONSTRAINT IF EXISTS \\\"veiculos_centro_custo_id_fkey\\\";\"); } catch (e) { console.log(e); }
  try { await prisma.\$executeRawUnsafe(\"ALTER TABLE \\\"veiculos\\\" RENAME COLUMN \\\"centro_custo_id\\\" TO \\\"centro_custo\\\";\"); } catch (e) { console.log(e); }
  
  try { await prisma.\$executeRawUnsafe(\"ALTER TABLE \\\"reserva_veiculos\\\" DROP CONSTRAINT IF EXISTS \\\"reserva_veiculos_centro_custo_id_fkey\\\";\"); } catch (e) { console.log(e); }
  try { await prisma.\$executeRawUnsafe(\"ALTER TABLE \\\"reserva_veiculos\\\" RENAME COLUMN \\\"centro_custo_id\\\" TO \\\"centro_custo\\\";\"); } catch (e) { console.log(e); }
  
  console.log(\"Renamed centro_custo_id columns!\");
}
main().catch(console.error).finally(() => prisma.\$disconnect());
EOF
docker cp /tmp/fix2.js \$(docker compose -f /home/planner/orkestri/docker-compose.yml ps -q api):/app/fix2.js
docker compose -f /home/planner/orkestri/docker-compose.yml exec -T api node /app/fix2.js
"
