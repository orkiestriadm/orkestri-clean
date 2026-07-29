/**
 * Seed de veículos da frota — Orkiestri
 * Insere tratores e roçadeiras com setor e descrição (identificação).
 * Execução: node prisma/seed-frota-veiculos.js
 */

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const VEICULOS = [
  // ── Tratores ──
  { placa: "TRATOR 01", modelo: "Massey Ferguson",          descricao: "TR01", setor: "CONSERVAÇÃO" },
  { placa: "TRATOR 02", modelo: "Massey Ferguson",          descricao: "TR02", setor: "CONSERVAÇÃO" },
  { placa: "TRATOR 03", modelo: "Massey Ferguson",          descricao: "TR03", setor: "CONSERVAÇÃO" },
  { placa: "TRATOR 04", modelo: "Massey Ferguson",          descricao: "TR04", setor: "CONSERVAÇÃO" },
  { placa: "TRATOR 05", modelo: "Massey Ferguson",          descricao: "TR05", setor: "CONSERVAÇÃO" },
  { placa: "TRATOR 06", modelo: "Massey Ferguson",          descricao: "TR06", setor: "CONSERVAÇÃO" },
  { placa: "TRATOR 07", modelo: "JOHN DEERE",               descricao: "TR07", setor: "PLANTIO COMPENSATORIO" },
  { placa: "TRATOR 11", modelo: "Massey Ferguson / Locado", descricao: "TR11", setor: "CONSERVAÇÃO" },
  { placa: "TRATOR 12", modelo: "Massey Ferguson / Locado", descricao: "TR12", setor: "CONSERVAÇÃO" },
  { placa: "TRATOR 13", modelo: "Massey Ferguson / Locado", descricao: "TR13", setor: "CONSERVAÇÃO" },
  { placa: "TRATOR 14", modelo: "Massey Ferguson / Locado", descricao: "TR14", setor: "CONSERVAÇÃO" },
  { placa: "TRATOR 15", modelo: "Massey Ferguson / Locado", descricao: "TR15", setor: "CONSERVAÇÃO" },
  { placa: "TRATOR 16", modelo: "Massey Ferguson / Locado", descricao: "TR16", setor: "CONSERVAÇÃO" },
  { placa: "TRATOR 17", modelo: "Massey Ferguson / Locado", descricao: "TR17", setor: "CONSERVAÇÃO" },
  { placa: "TRATOR 18", modelo: "Massey Ferguson / Locado", descricao: "TR18", setor: "CONSERVAÇÃO" },

  // ── Roçadeiras ──
  { placa: "ROÇADEIRA A01", modelo: "A01 - Articulada remanescente", descricao: "A01", setor: "CONSERVAÇÃO" },
  { placa: "ROÇADEIRA S01", modelo: "S01 - Remanescente",            descricao: "S01", setor: "CONSERVAÇÃO" },
  { placa: "ROÇADEIRA S02", modelo: "S02 - Nova",                    descricao: "S02", setor: "CONSERVAÇÃO" },
  { placa: "ROÇADEIRA S03", modelo: "S03 - Nova",                    descricao: "S03", setor: "CONSERVAÇÃO" },
  { placa: "ROÇADEIRA T01", modelo: "T01 - Nova",                    descricao: "T01", setor: "CONSERVAÇÃO" },
  { placa: "ROÇADEIRA T02", modelo: "T02 - Nova",                    descricao: "T02", setor: "CONSERVAÇÃO" },
  { placa: "ROÇADEIRA T03", modelo: "T03 - Nova",                    descricao: "T03", setor: "CONSERVAÇÃO" },
  { placa: "ROÇADEIRA T04", modelo: "T04 - Nova",                    descricao: "T04", setor: "CONSERVAÇÃO" },
  { placa: "ROÇADEIRA T05", modelo: "T05 - Remanescente",            descricao: "T05", setor: "CONSERVAÇÃO" },
  { placa: "ROÇADEIRA T06", modelo: "T06 - Nova",                    descricao: "T06", setor: "CONSERVAÇÃO" },
  { placa: "ROÇADEIRA T07", modelo: "T07 - Nova",                    descricao: "T07", setor: "CONSERVAÇÃO" },
  { placa: "ROÇADEIRA T08", modelo: "T08 - Nova",                    descricao: "T08", setor: "CONSERVAÇÃO" },
  { placa: "ROÇADEIRA R03", modelo: "R03 - Tatu",                    descricao: "R03", setor: "CONSERVAÇÃO" },
  { placa: "ROÇADEIRA R04", modelo: "R04 - Tatu",                    descricao: "R04", setor: "CONSERVAÇÃO" },
  { placa: "ROÇADEIRA R05", modelo: "R05 - Tatu",                    descricao: "R05", setor: "CONSERVAÇÃO" },
  { placa: "ROÇADEIRA R07", modelo: "R07 - Tatu",                    descricao: "R07", setor: "CONSERVAÇÃO" },
  { placa: "ROÇADEIRA R08", modelo: "R08 - Plantio",                 descricao: "R08", setor: "CONSERVAÇÃO" },
  { placa: "ROÇADEIRA R09", modelo: "R09 - Tatu",                    descricao: "R01", setor: "CONSERVAÇÃO" },
  { placa: "ROÇADEIRA R10", modelo: "R10 - Tatu",                    descricao: "R10", setor: "CONSERVAÇÃO" },
];

async function main() {
  console.log('🚜 Seed de veículos da frota — Orkiestri\n');

  // ── 1. Localizar organização ──
  const org = await prisma.organization.findFirst({
    where: {
      OR: [{ slug: 'default' }, { nome: { contains: 'default', mode: 'insensitive' } }],
    },
  });
  if (!org) {
    console.error('❌ Organização Default não encontrada!');
    process.exit(1);
  }
  const orgId = org.id;
  console.log(`✅ Org: ${org.nome} (${orgId})\n`);

  // ── 2. Criar/localizar setores ──
  const setorNomes = [...new Set(VEICULOS.map(v => v.setor))];
  const setorMap = {};

  for (const nome of setorNomes) {
    let setor = await prisma.setor.findFirst({
      where: { organizationId: orgId, nome: { equals: nome, mode: 'insensitive' } },
    });
    if (!setor) {
      setor = await prisma.setor.create({
        data: {
          organizationId: orgId,
          nome,
          cor: nome === 'CONSERVAÇÃO' ? '#10b981' : '#f59e0b',
        },
      });
      console.log(`📂 Setor criado: ${nome}`);
    } else {
      console.log(`📂 Setor existente: ${nome} (${setor.id})`);
    }
    setorMap[nome] = setor.id;
  }

  // ── 3. Inserir veículos ──
  console.log('\n🚛 Inserindo veículos...');
  let criados = 0;
  let existentes = 0;

  for (let i = 0; i < VEICULOS.length; i++) {
    const v = VEICULOS[i];

    // Verifica se já existe (pela placa, que é unique por org)
    const existe = await prisma.veiculo.findFirst({
      where: { organizationId: orgId, placa: v.placa, deletedAt: null },
    });

    if (existe) {
      existentes++;
      console.log(`   ⏭️  ${v.placa} já existe — ignorando`);
      continue;
    }

    // Gera código sequencial
    const seq = String(i + 1).padStart(5, '0');
    const codigo = `FRT-${seq}`;

    // Checa se o código já existe e gera um novo se necessário
    let codigoFinal = codigo;
    let n = i + 1;
    while (await prisma.veiculo.findFirst({ where: { organizationId: orgId, codigo: codigoFinal } })) {
      n++;
      codigoFinal = `FRT-${String(n).padStart(5, '0')}`;
    }

    await prisma.veiculo.create({
      data: {
        organizationId: orgId,
        codigo: codigoFinal,
        placa: v.placa,
        modelo: v.modelo,
        descricao: v.descricao,
        setorId: setorMap[v.setor],
        tipo: 'caminhao', // Tratores/roçadeiras se enquadram melhor em "caminhao" dentre as opções disponíveis
        combustivel: 'diesel',
        status: 'ativo',
      },
    });

    criados++;
    console.log(`   ✅ ${v.placa} — ${v.descricao} (${codigoFinal})`);
  }

  // ── Resumo ──
  console.log('\n════════════════════════════════════════');
  console.log('🎉 Seed de frota concluído!\n');
  console.log(`🚛 Criados:    ${criados}`);
  console.log(`⏭️  Existentes: ${existentes}`);
  console.log(`📊 Total:      ${VEICULOS.length}`);
  console.log('════════════════════════════════════════\n');
}

main()
  .catch((e) => {
    console.error('❌ Erro:', e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
