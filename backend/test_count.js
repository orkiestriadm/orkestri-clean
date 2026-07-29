const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const result = await prisma.manutencaoVeiculo.findFirst({
    include: {
      veiculo: { select: { id: true, placa: true, codigo: true } },
      solicitante: { select: { id: true, nome: true, avatar: true } },
      _count: { select: { anexos: { where: { deletedAt: null } } } },
    }
  });
  console.log(result._count);
}

main().finally(() => prisma.$disconnect());
