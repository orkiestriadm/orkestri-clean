const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
async function main() {
  const vs = await prisma.veiculo.findMany({ where: { deletedAt: null } });
  const byOrg = {};
  for(let v of vs) {
    byOrg[v.organizationId] = (byOrg[v.organizationId] || 0) + 1;
  }
  console.log('Org DB:', byOrg);
}
main().then(() => prisma.$disconnect());
