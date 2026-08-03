const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
async function main() {
  const veiculos = await prisma.veiculo.findMany({
    where: { placa: 'GHV5A93' }
  });
  console.log(veiculos);
}
main().finally(() => prisma.$disconnect());
