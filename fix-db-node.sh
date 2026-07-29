#!/bin/bash
ssh -o StrictHostKeyChecking=no planner@10.192.4.123 "cat << 'EOF' > /tmp/fix.js
const { PrismaClient } = require(\"@prisma/client\");
const prisma = new PrismaClient();
async function main() {
  await prisma.\$executeRawUnsafe(\"DELETE FROM project_members WHERE project_id NOT IN (SELECT id FROM projects);\");
  console.log(\"Deleted orphaned project members\");
}
main().catch(console.error).finally(() => prisma.\$disconnect());
EOF
docker cp /tmp/fix.js \$(docker compose -f /home/planner/orkestri/docker-compose.yml ps -q api):/app/fix.js
docker compose -f /home/planner/orkestri/docker-compose.yml exec -T api node /app/fix.js
"
