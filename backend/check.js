const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
async function main() {
  const org = await prisma.organization.findFirst();
  const vs = await prisma.veiculo.findMany({ where: { organizationId: org.id, deletedAt: null } });
  console.log('Total DB:', vs.length);
  const byType = {};
  for(let v of vs) {
    byType[v.tipo] = (byType[v.tipo] || 0) + 1;
  }
  console.log('Types DB:', byType);
}
main().then(() => prisma.$disconnect());
