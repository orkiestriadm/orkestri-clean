require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const user = await prisma.user.findFirst({
    where: { nome: { contains: 'Leticia', mode: 'insensitive' } }
  });
  
  if (!user) {
    console.log("Usuario Leticia nao encontrado");
    return;
  }
  
  console.log("Leticia encontrada:", user.id);
  
  const perms = ["frota:criar", "frota:editar", "frota:excluir", "frota:ver"];
  
  for (const slug of perms) {
    let perm = await prisma.permission.findUnique({ where: { slug } });
    if (!perm) {
      console.log(`Permissao ${slug} nao existe no banco, ignorando...`);
      continue;
    }
    
    // Check if override exists
    const existing = await prisma.permissionOverride.findFirst({
      where: { userId: user.id, permissionId: perm.id }
    });
    
    if (existing) {
      if (!existing.conceder) {
        await prisma.permissionOverride.update({
          where: { id: existing.id },
          data: { conceder: true }
        });
        console.log(`Override atualizado para ${slug}`);
      }
    } else {
      await prisma.permissionOverride.create({
        data: {
          id: require("crypto").randomUUID(),
          userId: user.id,
          permissionId: perm.id,
          conceder: true
        }
      });
      console.log(`Override criado para ${slug}`);
    }
  }
  
  // Also clear the cache key so her permissions reload immediately
  const Redis = require('ioredis');
  const redis = new Redis(process.env.REDIS_URL || 'redis://localhost:6379');
  await redis.del(`cache:permissions:${user.id}`);
  redis.disconnect();
  
  console.log("Permissoes da Leticia atualizadas com sucesso.");
}

main().catch(console.error).finally(() => prisma.$disconnect());
