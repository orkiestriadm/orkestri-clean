/**
 * Seed do módulo de Monitoramento (Orkiestri Observe).
 * Cria unidades, ativos monitorados e histórico de eventos de status.
 *
 * Idempotente. Execução: node /app/prisma/seed-monitoramento.js
 */

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const minsAgo = (n) => new Date(Date.now() - n * 60_000);

async function main() {
  console.log('🌱 Seed — Monitoramento (Observe)\n');

  const org = await prisma.organization.findFirst({
    where: { OR: [{ slug: 'default' }, { nome: { contains: 'default', mode: 'insensitive' } }] },
    include: { users: { where: { ativo: true }, take: 5 } },
  });
  if (!org) throw new Error('Organização Default não encontrada');
  const orgId = org.id;
  const u = (i) => org.users[i % org.users.length]?.id ?? null;

  // ── Unidades ──────────────────────────────────────────────────────────────
  const unidadesDef = [
    { nome: 'Matriz — São Paulo', tipo: 'sede', latitude: -23.5613, longitude: -46.6565 },
    { nome: 'Data Center — Barueri', tipo: 'datacenter', latitude: -23.5106, longitude: -46.8761 },
    { nome: 'Filial — Campinas', tipo: 'filial', latitude: -22.9099, longitude: -47.0626 },
    { nome: 'Filial — Ribeirão Preto', tipo: 'filial', latitude: -21.1775, longitude: -47.8103 },
  ];
  const unidades = [];
  for (const un of unidadesDef) {
    let x = await prisma.monUnidade.findFirst({ where: { organizationId: orgId, nome: un.nome } });
    if (!x) x = await prisma.monUnidade.create({ data: { organizationId: orgId, ...un } });
    unidades.push(x);
  }
  console.log(`📍 Unidades: ${unidades.length}`);

  // ── Ativos monitorados ────────────────────────────────────────────────────
  // Mix realista: a maioria ONLINE, alguns INSTAVEL, poucos OFFLINE.
  const ativosDef = [
    { nome: 'Firewall Principal',        categoria: 'INFRAESTRUTURA', tipo: 'Firewall',   ip: '10.0.0.1',    proto: 'ICMP', un: 0, st: 'ONLINE',   lat: 2,   up: 99.98 },
    { nome: 'Switch Core — Matriz',      categoria: 'INFRAESTRUTURA', tipo: 'Switch',     ip: '10.0.0.2',    proto: 'ICMP', un: 0, st: 'ONLINE',   lat: 1,   up: 99.99 },
    { nome: 'Servidor de Aplicação 01',  categoria: 'SERVIDORES',     tipo: 'Linux',      ip: '10.0.10.11',  proto: 'TCP',  un: 1, st: 'ONLINE',   lat: 4,   up: 99.95, porta: 443 },
    { nome: 'Servidor de Aplicação 02',  categoria: 'SERVIDORES',     tipo: 'Linux',      ip: '10.0.10.12',  proto: 'TCP',  un: 1, st: 'ONLINE',   lat: 5,   up: 99.91, porta: 443 },
    { nome: 'Banco de Dados — Primário', categoria: 'SERVIDORES',     tipo: 'PostgreSQL', ip: '10.0.10.20',  proto: 'TCP',  un: 1, st: 'ONLINE',   lat: 3,   up: 99.99, porta: 5432 },
    { nome: 'Banco de Dados — Réplica',  categoria: 'SERVIDORES',     tipo: 'PostgreSQL', ip: '10.0.10.21',  proto: 'TCP',  un: 1, st: 'INSTAVEL', lat: 48,  up: 97.42, porta: 5432 },
    { nome: 'Portal Corporativo',        categoria: 'ITS',            tipo: 'Aplicação',  ip: '10.0.20.10',  proto: 'HTTP', un: 1, st: 'ONLINE',   lat: 121, up: 99.87, porta: 443 },
    { nome: 'API Gateway',               categoria: 'ITS',            tipo: 'Aplicação',  ip: '10.0.20.11',  proto: 'HTTP', un: 1, st: 'ONLINE',   lat: 89,  up: 99.93, porta: 443 },
    { nome: 'Servidor de Arquivos',      categoria: 'SERVIDORES',     tipo: 'Windows',    ip: '10.0.10.30',  proto: 'ICMP', un: 0, st: 'ONLINE',   lat: 2,   up: 99.88 },
    { nome: 'Link Dedicado — Operadora', categoria: 'INFRAESTRUTURA', tipo: 'WAN',        ip: '200.10.5.1',  proto: 'ICMP', un: 0, st: 'ONLINE',   lat: 12,  up: 99.72 },
    { nome: 'Nobreak — Sala Técnica',    categoria: 'INFRAESTRUTURA', tipo: 'UPS',        ip: '10.0.0.50',   proto: 'ICMP', un: 1, st: 'ONLINE',   lat: 3,   up: 99.96 },
    { nome: 'Switch — Campinas',         categoria: 'INFRAESTRUTURA', tipo: 'Switch',     ip: '10.1.0.2',    proto: 'ICMP', un: 2, st: 'ONLINE',   lat: 8,   up: 99.81 },
    { nome: 'Câmera — Recepção',         categoria: 'PRACAS',         tipo: 'CFTV',       ip: '10.1.30.15',  proto: 'ICMP', un: 2, st: 'OFFLINE',  lat: null, up: 84.20 },
    { nome: 'Estação — Financeiro 04',   categoria: 'COMPUTADORES',   tipo: 'Desktop',    ip: '10.0.40.104', proto: 'ICMP', un: 0, st: 'ONLINE',   lat: 1,   up: 98.64 },
    { nome: 'Switch — Ribeirão Preto',   categoria: 'INFRAESTRUTURA', tipo: 'Switch',     ip: '10.2.0.2',    proto: 'ICMP', un: 3, st: 'ONLINE',   lat: 14,  up: 99.66 },
    { nome: 'Controlador Wi-Fi',         categoria: 'INFRAESTRUTURA', tipo: 'WLC',        ip: '10.0.0.60',   proto: 'ICMP', un: 0, st: 'ONLINE',   lat: 4,   up: 99.90 },
  ];

  const ativos = [];
  for (let i = 0; i < ativosDef.length; i++) {
    const a = ativosDef[i];
    let x = await prisma.monAsset.findFirst({ where: { organizationId: orgId, ip: a.ip } });
    if (!x) {
      x = await prisma.monAsset.create({
        data: {
          organizationId: orgId,
          nome: a.nome,
          categoria: a.categoria,
          tipo: a.tipo,
          ip: a.ip,
          porta: a.porta ?? null,
          protocolo: a.proto,
          unidadeId: unidades[a.un].id,
          responsavelId: u(i),
          localizacao: unidades[a.un].nome,
          ativo: true,
          ultimoStatus: a.st,
          ultimoCheckEm: minsAgo(1 + (i % 3)),
          ultimaLatenciaMs: a.lat,
          perdaPctUltimaHora: a.st === 'ONLINE' ? 0 : a.st === 'INSTAVEL' ? 6.4 : 100,
          uptime24h: a.up,
          intervaloSeg: 60,
        },
      });
    }
    ativos.push(x);
  }
  console.log(`🖥️  Ativos monitorados: ${ativos.length}`);

  // ── Histórico de eventos ──────────────────────────────────────────────────
  const jaTemEvento = await prisma.monStatusEvent.count({ where: { organizationId: orgId } });
  let eventos = 0;
  if (jaTemEvento === 0) {
    const def = [
      // em aberto (o que aparece como incidente ativo)
      { a: 12, de: 'ONLINE',   para: 'OFFLINE',  sev: 'CRITICO', ini: 214, fim: null, msg: 'Sem resposta ao ping — verificar alimentação PoE' },
      { a: 5,  de: 'ONLINE',   para: 'INSTAVEL', sev: 'ATENCAO', ini: 96,  fim: null, msg: 'Latência acima do limiar (48ms) e perda de 6,4%' },
      // já resolvidos (histórico)
      { a: 9,  de: 'ONLINE',   para: 'OFFLINE',  sev: 'CRITICO', ini: 1450, fim: 1408, msg: 'Queda do link da operadora' },
      { a: 6,  de: 'ONLINE',   para: 'INSTAVEL', sev: 'ATENCAO', ini: 1120, fim: 1094, msg: 'Tempo de resposta elevado no portal' },
      { a: 3,  de: 'INSTAVEL', para: 'ONLINE',   sev: 'INFO',    ini: 900,  fim: 900,  msg: 'Serviço normalizado após reinício' },
      { a: 13, de: 'ONLINE',   para: 'INSTAVEL', sev: 'ATENCAO', ini: 640,  fim: 618,  msg: 'Perda intermitente de pacotes' },
      { a: 2,  de: 'OFFLINE',  para: 'ONLINE',   sev: 'INFO',    ini: 480,  fim: 480,  msg: 'Ativo restabelecido' },
      { a: 11, de: 'ONLINE',   para: 'INSTAVEL', sev: 'ATENCAO', ini: 300,  fim: 288,  msg: 'Oscilação no switch de acesso' },
    ];
    for (const e of def) {
      await prisma.monStatusEvent.create({
        data: {
          organizationId: orgId,
          assetId: ativos[e.a].id,
          statusAnterior: e.de,
          statusNovo: e.para,
          severidade: e.sev,
          iniciadoEm: minsAgo(e.ini),
          finalizadoEm: e.fim ? minsAgo(e.fim) : null,
          duracaoSeg: e.fim ? (e.ini - e.fim) * 60 : null,
          mensagem: e.msg,
        },
      });
      eventos++;
    }
  }
  console.log(`🔔 Eventos de status: ${eventos || jaTemEvento} (${jaTemEvento ? 'já existiam' : 'criados'})`);

  console.log('\n🎉 Seed de monitoramento concluído!\n');
}

main()
  .catch((e) => { console.error('❌ Erro:', e.message); process.exit(1); })
  .finally(async () => { await prisma.$disconnect(); });
