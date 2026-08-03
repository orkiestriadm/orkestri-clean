const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const express = require('express');

async function test() {
  const org = await prisma.organization.findFirst();
  const total = await prisma.veiculo.count({
    where: { organizationId: org.id, deletedAt: null }
  });
  console.log('Total via prisma for org', org.id, 'is', total);
}
test().then(() => prisma.$disconnect());
