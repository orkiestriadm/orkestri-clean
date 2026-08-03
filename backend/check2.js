const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
async function main() {
  const vs = await prisma.veiculo.findMany({ where: { deletedAt: null } });
  const byStatus = {};
  for(let v of vs) {
    byStatus[v.status] = (byStatus[v.status] || 0) + 1;
  }
  console.log('Status DB:', byStatus);
}
main().then(() => prisma.$disconnect());
