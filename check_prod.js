const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
async function main() {
  const veiculos = await prisma.veiculo.findMany({
    orderBy: { atualizadoEm: 'desc' },
    take: 40
  });
  console.log("Últimos 40 veículos atualizados:");
  console.table(veiculos.map(v => ({ id: v.id, placa: v.placa, codigo: v.codigo, criadoEm: v.criadoEm, atualizadoEm: v.atualizadoEm })));
}
main().finally(() => prisma.$disconnect());
