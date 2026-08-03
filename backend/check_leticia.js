const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const users = await prisma.user.findMany({
    where: { 
      OR: [
        { email: { contains: 'leticia', mode: 'insensitive' } },
        { nome: { contains: 'leticia', mode: 'insensitive' } }
      ]
    },
    include: {
      userRoles: {
        include: { role: true }
      },
      permissionOverrides: true
    }
  });
  console.log(JSON.stringify(users, null, 2));
}

main()
  .catch(console.error)
  .finally(async () => {
    await prisma.$disconnect();
  });
