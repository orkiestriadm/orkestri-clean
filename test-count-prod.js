const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
prisma.manutencaoAnexo.count().then(x => console.log('Count manutencaoAnexo:', x))
  .catch(e => console.error(e))
  .finally(() => process.exit(0));
