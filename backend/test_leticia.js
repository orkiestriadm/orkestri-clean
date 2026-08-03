const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const users = await prisma.user.findMany({
    where: {
      nome: { contains: 'Leticia', mode: 'insensitive' }
    },
    include: {
      userRoles: {
        include: {
          role: true
        }
      },
      permissionOverrides: {
        include: {
          permission: true
        }
      }
    }
  });
  console.log(JSON.stringify(users, null, 2));

  // Also let's print all roles available that might have frota permissions
  const roles = await prisma.role.findMany({
    include: {
      rolePermissions: {
        include: {
          permission: true
        }
      }
    }
  });
  console.log("ROLES AND PERMISSIONS:");
  console.log(JSON.stringify(roles.map(r => ({
    name: r.nome,
    permissions: r.rolePermissions.map(rp => rp.permission?.slug)
  })), null, 2));
}

main().catch(console.error).finally(() => prisma.$disconnect());
