/**
 * Seed demo v3 — Orkiestri
 * Preenche os módulos ainda vazios: Frota, Clientes, Contratos e Faturas.
 * Dados realistas — este conteúdo aparece em capturas de tela institucionais.
 *
 * Idempotente: identifica registros já criados pelo seed e não duplica.
 * Execução: node /app/prisma/seed-demo3.js
 */

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const daysAgo = (n) => new Date(Date.now() - n * 86400_000);
const daysAhead = (n) => new Date(Date.now() + n * 86400_000);
const money = (v) => Math.round(v * 100) / 100;
const pick = (arr, i) => arr[i % arr.length];

async function main() {
  console.log('🌱 Seed v3 — Frota, Clientes, Contratos e Faturas\n');

  const org = await prisma.organization.findFirst({
    where: { OR: [{ slug: 'default' }, { nome: { contains: 'default', mode: 'insensitive' } }] },
    include: { users: { where: { ativo: true }, take: 10 } },
  });
  if (!org) throw new Error('Organização Default não encontrada');
  const orgId = org.id;
  const users = org.users;
  if (!users.length) throw new Error('Nenhum usuário ativo na org Default');
  const u = (i) => users[i % users.length];

  console.log(`✅ Org: ${org.nome}\n`);

  // ── 1. CATEGORIAS DE VEÍCULO ──────────────────────────────────────────────
  const categoriasDef = [
    { nome: 'Frota Leve', descricao: 'Veículos de passeio e representação', icone: 'car', cor: '#f97316' },
    { nome: 'Utilitários', descricao: 'Vans e furgões de apoio operacional', icone: 'truck', cor: '#0284c7' },
    { nome: 'Pesados', descricao: 'Caminhões e equipamentos de carga', icone: 'truck', cor: '#059669' },
    { nome: 'Operacional', descricao: 'Veículos de campo e manutenção', icone: 'wrench', cor: '#7c3aed' },
  ];
  const categorias = [];
  for (const c of categoriasDef) {
    let cat = await prisma.categoriaVeiculo.findFirst({ where: { organizationId: orgId, nome: c.nome } });
    if (!cat) cat = await prisma.categoriaVeiculo.create({ data: { organizationId: orgId, ...c } });
    categorias.push(cat);
  }
  console.log(`🏷️  Categorias de veículo: ${categorias.length}`);

  // ── 2. MOTORISTAS ─────────────────────────────────────────────────────────
  const motoristasDef = [
    { nome: 'Carlos Eduardo Ramos', cpf: '312.445.789-10', matricula: 'MOT-001', departamento: 'Logística', cargo: 'Motorista Sênior', cnh: '04512378900', categoriaCnh: 'D', validadeCnh: daysAhead(410), telefone: '(11) 98812-4477' },
    { nome: 'Marcos Vinícius Alves', cpf: '445.221.907-33', matricula: 'MOT-002', departamento: 'Operações', cargo: 'Motorista', cnh: '03398712045', categoriaCnh: 'B', validadeCnh: daysAhead(48), telefone: '(11) 99123-7788' },
    { nome: 'Roberto Nascimento', cpf: '221.887.334-56', matricula: 'MOT-003', departamento: 'Logística', cargo: 'Motorista Carreteiro', cnh: '05128834471', categoriaCnh: 'E', validadeCnh: daysAhead(220), telefone: '(11) 97744-2210' },
    { nome: 'Fernanda Lopes Cardoso', cpf: '556.112.443-90', matricula: 'MOT-004', departamento: 'Comercial', cargo: 'Consultora Externa', cnh: '06611239087', categoriaCnh: 'B', validadeCnh: daysAhead(640), telefone: '(11) 98455-1122' },
    { nome: 'José Antônio Ferreira', cpf: '778.334.556-21', matricula: 'MOT-005', departamento: 'Manutenção', cargo: 'Técnico de Campo', cnh: '02277451193', categoriaCnh: 'C', validadeCnh: daysAhead(-12), telefone: '(11) 96633-8890' },
    { nome: 'Patrícia Gomes Silveira', cpf: '990.556.221-77', matricula: 'MOT-006', departamento: 'Administrativo', cargo: 'Analista', cnh: '07733991124', categoriaCnh: 'B', validadeCnh: daysAhead(305), telefone: '(11) 95522-3344' },
  ];
  const motoristas = [];
  for (const m of motoristasDef) {
    let mot = await prisma.motorista.findFirst({ where: { organizationId: orgId, matricula: m.matricula } });
    if (!mot) {
      mot = await prisma.motorista.create({
        data: { organizationId: orgId, ...m, cnhEmissao: daysAgo(1500), orgaoEmissor: 'DETRAN-SP', status: 'ativo', criadoPorId: u(0).id },
      });
    }
    motoristas.push(mot);
  }
  console.log(`🧑‍✈️ Motoristas: ${motoristas.length}`);

  // ── 3. VEÍCULOS ───────────────────────────────────────────────────────────
  const veiculosDef = [
    { codigo: 'VE-001', placa: 'RJT4A21', marca: 'Toyota',    modelo: 'Corolla XEi',      tipo: 'carro',      combustivel: 'flex',    cor: 'Prata',  anoFabricacao: 2023, anoModelo: 2024, kmAtual: 38420, cat: 0, valorAquisicao: 158000 },
    { codigo: 'VE-002', placa: 'RJT7B45', marca: 'Chevrolet', modelo: 'Onix Plus',        tipo: 'carro',      combustivel: 'flex',    cor: 'Branco', anoFabricacao: 2022, anoModelo: 2023, kmAtual: 61230, cat: 0, valorAquisicao: 92000 },
    { codigo: 'VE-003', placa: 'RJT9C88', marca: 'Fiat',      modelo: 'Strada Freedom',   tipo: 'utilitario', combustivel: 'flex',    cor: 'Branco', anoFabricacao: 2023, anoModelo: 2023, kmAtual: 44870, cat: 3, valorAquisicao: 112000 },
    { codigo: 'VE-004', placa: 'RJU1D12', marca: 'Renault',   modelo: 'Master Furgão',    tipo: 'van',        combustivel: 'diesel',  cor: 'Branco', anoFabricacao: 2021, anoModelo: 2022, kmAtual: 128940, cat: 1, valorAquisicao: 215000 },
    { codigo: 'VE-005', placa: 'RJU3E56', marca: 'Mercedes',  modelo: 'Sprinter 416',     tipo: 'van',        combustivel: 'diesel',  cor: 'Branco', anoFabricacao: 2022, anoModelo: 2022, kmAtual: 97350, cat: 1, valorAquisicao: 328000 },
    { codigo: 'VE-006', placa: 'RJU5F90', marca: 'Volkswagen',modelo: 'Delivery 11.180',  tipo: 'caminhao',   combustivel: 'diesel',  cor: 'Branco', anoFabricacao: 2020, anoModelo: 2021, kmAtual: 204100, cat: 2, valorAquisicao: 385000 },
    { codigo: 'VE-007', placa: 'RJU7G34', marca: 'Volvo',     modelo: 'FH 460',           tipo: 'caminhao',   combustivel: 'diesel',  cor: 'Azul',   anoFabricacao: 2021, anoModelo: 2021, kmAtual: 312880, cat: 2, valorAquisicao: 720000 },
    { codigo: 'VE-008', placa: 'RJU9H78', marca: 'Hyundai',   modelo: 'HR Baú',           tipo: 'utilitario', combustivel: 'diesel',  cor: 'Branco', anoFabricacao: 2022, anoModelo: 2023, kmAtual: 71460, cat: 1, valorAquisicao: 168000 },
    { codigo: 'VE-009', placa: 'RJV2J01', marca: 'Jeep',      modelo: 'Renegade',         tipo: 'carro',      combustivel: 'flex',    cor: 'Cinza',  anoFabricacao: 2023, anoModelo: 2024, kmAtual: 22140, cat: 0, valorAquisicao: 145000 },
    { codigo: 'VE-010', placa: 'RJV4K23', marca: 'Ford',      modelo: 'Ranger XLS',       tipo: 'utilitario', combustivel: 'diesel',  cor: 'Preto',  anoFabricacao: 2023, anoModelo: 2023, kmAtual: 35990, cat: 3, valorAquisicao: 245000 },
    { codigo: 'VE-011', placa: 'RJV6L67', marca: 'Honda',     modelo: 'City EXL',         tipo: 'carro',      combustivel: 'flex',    cor: 'Prata',  anoFabricacao: 2022, anoModelo: 2022, kmAtual: 58720, cat: 0, valorAquisicao: 118000 },
    { codigo: 'VE-012', placa: 'RJV8M09', marca: 'Iveco',     modelo: 'Daily 35-150',     tipo: 'van',        combustivel: 'diesel',  cor: 'Branco', anoFabricacao: 2021, anoModelo: 2022, kmAtual: 141530, cat: 1, valorAquisicao: 232000 },
  ];
  const statusPool = ['ativo', 'ativo', 'ativo', 'ativo', 'ativo', 'ativo', 'ativo', 'ativo', 'manutencao', 'ativo', 'ativo', 'inativo'];
  const veiculos = [];
  for (let i = 0; i < veiculosDef.length; i++) {
    const v = veiculosDef[i];
    let veic = await prisma.veiculo.findFirst({ where: { organizationId: orgId, placa: v.placa } });
    if (!veic) {
      veic = await prisma.veiculo.create({
        data: {
          organizationId: orgId,
          codigo: v.codigo, placa: v.placa, marca: v.marca, modelo: v.modelo,
          tipo: v.tipo, combustivel: v.combustivel, cor: v.cor,
          anoFabricacao: v.anoFabricacao, anoModelo: v.anoModelo, kmAtual: v.kmAtual,
          categoriaId: categorias[v.cat].id,
          motoristaId: motoristas[i % motoristas.length].id,
          responsavelId: u(i).id,
          status: statusPool[i],
          capacidadeTanque: v.combustivel === 'diesel' ? 90 : 50,
          centroCusto: pick(['CC-LOG-100', 'CC-OPE-200', 'CC-ADM-300'], i),
          unidade: pick(['Matriz — São Paulo', 'Filial — Campinas', 'Filial — Ribeirão Preto'], i),
          dataAquisicao: daysAgo(400 + i * 45),
          valorAquisicao: v.valorAquisicao,
          renavam: String(10234567890 + i * 137),
          criadoPorId: u(0).id,
        },
      });
    }
    veiculos.push(veic);
  }
  console.log(`🚗 Veículos: ${veiculos.length}`);

  // ── 4. ABASTECIMENTOS (últimos 90 dias — alimenta gráficos de consumo) ────
  const jaTemAbast = await prisma.abastecimento.count({ where: { organizationId: orgId } });
  let abastCriados = 0;
  if (jaTemAbast === 0) {
    const postos = ['Posto Ipiranga — Marginal', 'Shell Select — Av. Paulista', 'Petrobras BR — Rod. Anhanguera', 'Ale Combustíveis — Centro'];
    for (let i = 0; i < veiculos.length; i++) {
      const veic = veiculos[i];
      const diesel = veiculosDef[i].combustivel === 'diesel';
      const precoBase = diesel ? 6.19 : 5.89;
      const kmPorLitro = diesel ? 7.2 : 11.4;
      let km = veic.kmAtual - 4200;
      for (let j = 0; j < 5; j++) {
        const litros = money(diesel ? 62 + (j * 3.7) % 18 : 38 + (j * 2.9) % 11);
        const valorLitro = money(precoBase + ((i + j) % 5) * 0.07);
        km += Math.round(litros * kmPorLitro);
        await prisma.abastecimento.create({
          data: {
            organizationId: orgId,
            veiculoId: veic.id,
            motoristaId: motoristas[(i + j) % motoristas.length].id,
            data: daysAgo(88 - j * 17 - (i % 5)),
            kmAtual: km,
            litros,
            valorLitro,
            valorTotal: money(litros * valorLitro),
            tipoCombustivel: diesel ? 'diesel' : 'gasolina',
            posto: pick(postos, i + j),
            tanqueCheio: true,
            consumoKmL: money(kmPorLitro + ((j % 3) - 1) * 0.4),
            custoKm: money(valorLitro / kmPorLitro),
            criadoPorId: u(j).id,
          },
        });
        abastCriados++;
      }
    }
  }
  console.log(`⛽ Abastecimentos: ${abastCriados || jaTemAbast} (${jaTemAbast ? 'já existiam' : 'criados'})`);

  // ── 5. MANUTENÇÕES ────────────────────────────────────────────────────────
  const jaTemManut = await prisma.manutencaoVeiculo.count({ where: { organizationId: orgId } });
  let manutCriadas = 0;
  if (jaTemManut === 0) {
    const manutencoes = [
      { v: 0, tipo: 'preventiva', descricao: 'Revisão programada de 40.000 km', oficina: 'Toyota Nakata — Zona Sul', status: 'concluida', pecas: 890, servicos: 620, dias: 22 },
      { v: 3, tipo: 'corretiva',  descricao: 'Substituição do sistema de embreagem', oficina: 'Diesel Master Renault', status: 'concluida', pecas: 3450, servicos: 1800, dias: 40 },
      { v: 6, tipo: 'preventiva', descricao: 'Troca de óleo, filtros e checagem de freios', oficina: 'Volvo Truck Center', status: 'concluida', pecas: 2780, servicos: 1450, dias: 15 },
      { v: 8, tipo: 'corretiva',  descricao: 'Reparo no sistema de ar-condicionado', oficina: 'AutoCenter Jeep', status: 'em_andamento', pecas: 1240, servicos: 780, dias: 3 },
      { v: 5, tipo: 'preventiva', descricao: 'Alinhamento, balanceamento e rodízio de pneus', oficina: 'Pneus & Cia — Anhanguera', status: 'aberta', pecas: 0, servicos: 480, dias: 0 },
      { v: 11, tipo: 'corretiva', descricao: 'Troca da bomba injetora', oficina: 'Iveco Service SP', status: 'em_andamento', pecas: 5200, servicos: 2100, dias: 5 },
      { v: 1, tipo: 'preventiva', descricao: 'Revisão de 60.000 km', oficina: 'Chevrolet Caoa', status: 'concluida', pecas: 1120, servicos: 740, dias: 55 },
      { v: 9, tipo: 'corretiva',  descricao: 'Reparo na suspensão dianteira', oficina: 'Ford Diesel Center', status: 'concluida', pecas: 2340, servicos: 1350, dias: 30 },
    ];
    for (let i = 0; i < manutencoes.length; i++) {
      const m = manutencoes[i];
      const concluida = m.status === 'concluida';
      await prisma.manutencaoVeiculo.create({
        data: {
          organizationId: orgId,
          veiculoId: veiculos[m.v].id,
          numeroOs: `OS-2026-${String(1040 + i)}`,
          tipo: m.tipo,
          descricao: m.descricao,
          solicitanteId: u(i).id,
          dataAbertura: daysAgo(m.dias + 4),
          data: daysAgo(m.dias),
          dataFechamento: concluida ? daysAgo(m.dias - 2) : null,
          km: veiculos[m.v].kmAtual - 500,
          custoPecas: m.pecas,
          custoServicos: m.servicos,
          custo: m.pecas + m.servicos,
          oficina: m.oficina,
          fornecedor: m.oficina,
          status: m.status,
          criadoPorId: u(0).id,
        },
      });
      manutCriadas++;
    }
  }
  console.log(`🔧 Manutenções: ${manutCriadas || jaTemManut} (${jaTemManut ? 'já existiam' : 'criadas'})`);

  // ── 6. RESERVAS DE VEÍCULO ────────────────────────────────────────────────
  const jaTemReserva = await prisma.reservaVeiculo.count({ where: { organizationId: orgId } });
  let reservasCriadas = 0;
  if (jaTemReserva === 0) {
    const reservas = [
      { v: 0, destino: 'Campinas — SP', motivo: 'Visita técnica ao cliente', ini: -2, fim: -1, status: 'FINALIZADA' },
      { v: 1, destino: 'Santos — SP', motivo: 'Reunião comercial', ini: 1, fim: 1, status: 'CONFIRMADA' },
      { v: 8, destino: 'Ribeirão Preto — SP', motivo: 'Auditoria em filial', ini: 3, fim: 4, status: 'CONFIRMADA' },
      { v: 2, destino: 'São José dos Campos — SP', motivo: 'Entrega de equipamentos', ini: 0, fim: 0, status: 'EM_ANDAMENTO' },
      { v: 10, destino: 'Sorocaba — SP', motivo: 'Treinamento de equipe', ini: 6, fim: 7, status: 'SOLICITADA' },
      { v: 9, destino: 'Curitiba — PR', motivo: 'Implantação em cliente', ini: 10, fim: 13, status: 'SOLICITADA' },
    ];
    for (const r of reservas) {
      await prisma.reservaVeiculo.create({
        data: {
          organizationId: orgId,
          veiculoId: veiculos[r.v].id,
          solicitanteId: u(r.v).id,
          dataInicio: daysAhead(r.ini),
          dataFim: daysAhead(r.fim),
          destino: r.destino,
          motivo: r.motivo,
          status: r.status,
          centroCusto: pick(['CC-LOG-100', 'CC-OPE-200'], r.v),
          kmInicial: r.status === 'FINALIZADA' ? veiculos[r.v].kmAtual - 180 : null,
          kmFinal: r.status === 'FINALIZADA' ? veiculos[r.v].kmAtual : null,
        },
      });
      reservasCriadas++;
    }
  }
  console.log(`📆 Reservas: ${reservasCriadas || jaTemReserva} (${jaTemReserva ? 'já existiam' : 'criadas'})`);

  // ── 7. CLIENTES ───────────────────────────────────────────────────────────
  const clientesDef = [
    { nome: 'Ana Beatriz Moraes', empresa: 'Transportadora Rota Sul', cargo: 'Diretora de Operações', segmento: 'Logística', cidade: 'Curitiba', estado: 'PR', cnpj: '12.345.678/0001-90', valorEstimado: 180000, probabilidade: 90, saudeScore: 94, statusLead: 'ativo' },
    { nome: 'Ricardo Menezes', empresa: 'Concessionária ViaNorte', cargo: 'CIO', segmento: 'Concessionárias', cidade: 'São Paulo', estado: 'SP', cnpj: '98.765.432/0001-10', valorEstimado: 320000, probabilidade: 75, saudeScore: 88, statusLead: 'ativo' },
    { nome: 'Juliana Prado', empresa: 'Indústria Metalpar', cargo: 'Gerente de TI', segmento: 'Indústria', cidade: 'Joinville', estado: 'SC', cnpj: '45.678.901/0001-23', valorEstimado: 240000, probabilidade: 60, saudeScore: 79, statusLead: 'ativo' },
    { nome: 'Eduardo Tavares', empresa: 'AgroVale Cooperativa', cargo: 'Diretor Administrativo', segmento: 'Agronegócio', cidade: 'Uberlândia', estado: 'MG', cnpj: '23.456.789/0001-45', valorEstimado: 150000, probabilidade: 45, saudeScore: 72, statusLead: 'ativo' },
    { nome: 'Camila Ribeiro', empresa: 'Hospital Santa Clara', cargo: 'Superintendente', segmento: 'Saúde', cidade: 'Belo Horizonte', estado: 'MG', cnpj: '34.567.890/0001-56', valorEstimado: 410000, probabilidade: 80, saudeScore: 91, statusLead: 'ativo' },
    { nome: 'Fernando Aguiar', empresa: 'Construtora Horizonte', cargo: 'CEO', segmento: 'Construção', cidade: 'Goiânia', estado: 'GO', cnpj: '56.789.012/0001-67', valorEstimado: 195000, probabilidade: 35, saudeScore: 64, statusLead: 'ativo' },
    { nome: 'Larissa Fontes', empresa: 'Grupo Educacional Saber', cargo: 'Diretora de Tecnologia', segmento: 'Educação', cidade: 'Recife', estado: 'PE', cnpj: '67.890.123/0001-78', valorEstimado: 130000, probabilidade: 55, saudeScore: 83, statusLead: 'ativo' },
    { nome: 'Paulo Henrique Costa', empresa: 'Energia Verde S.A.', cargo: 'CTO', segmento: 'Energia', cidade: 'Fortaleza', estado: 'CE', cnpj: '78.901.234/0001-89', valorEstimado: 520000, probabilidade: 25, saudeScore: 58, statusLead: 'inativo' },
  ];
  const clientes = [];
  for (let i = 0; i < clientesDef.length; i++) {
    const c = clientesDef[i];
    let cli = await prisma.cliente.findFirst({ where: { organizationId: orgId, empresa: c.empresa } });
    if (!cli) {
      cli = await prisma.cliente.create({
        data: {
          organizationId: orgId,
          ...c,
          email: `${c.nome.split(' ')[0].toLowerCase()}@${c.empresa.toLowerCase().replace(/[^a-z]/g, '').slice(0, 12)}.com.br`,
          telefone: `(${11 + i}) 3${300 + i}0-${1000 + i * 7}`,
          origem: pick(['Indicação', 'Site', 'LinkedIn', 'Evento'], i),
          responsavelId: u(i).id,
          dataFechamento: daysAhead(20 + i * 12),
          notas: 'Conta acompanhada pelo time de Customer Success.',
        },
      });
    }
    clientes.push(cli);
  }
  console.log(`🤝 Clientes: ${clientes.length}`);

  // ── 8. CONTRATOS ──────────────────────────────────────────────────────────
  const contratosDef = [
    { c: 0, titulo: 'Orkiestri One — Plataforma Completa', tipo: 'saas', plano: 'Enterprise', valor: 18500, sla: 4, status: 'vigente', ini: -320, fim: 410 },
    { c: 1, titulo: 'Orkiestri Fleet + Desk', tipo: 'saas', plano: 'Business', valor: 12400, sla: 8, status: 'vigente', ini: -180, fim: 550 },
    { c: 2, titulo: 'Software Factory — Portal do Fornecedor', tipo: 'projeto', plano: null, valor: 245000, sla: null, status: 'vigente', ini: -95, fim: 180 },
    { c: 4, titulo: 'Orkiestri One + Sustentação', tipo: 'saas', plano: 'Enterprise', valor: 26800, sla: 2, status: 'vigente', ini: -410, fim: 320 },
    { c: 6, titulo: 'Orkiestri Desk — Service Management', tipo: 'saas', plano: 'Professional', valor: 7900, sla: 8, status: 'vigente', ini: -60, fim: 670 },
    { c: 3, titulo: 'Consultoria — Arquitetura e Integrações', tipo: 'servico', plano: null, valor: 88000, sla: null, status: 'encerrado', ini: -520, fim: -40 },
  ];
  const contratos = [];
  for (let i = 0; i < contratosDef.length; i++) {
    const ct = contratosDef[i];
    let con = await prisma.contrato.findFirst({ where: { organizationId: orgId, titulo: ct.titulo } });
    if (!con) {
      con = await prisma.contrato.create({
        data: {
          organizationId: orgId,
          clienteId: clientes[ct.c].id,
          titulo: ct.titulo,
          tipo: ct.tipo,
          plano: ct.plano,
          status: ct.status,
          slaHoras: ct.sla,
          valor: ct.valor,
          vigenciaInicio: daysAgo(-ct.ini),
          vigenciaFim: daysAhead(ct.fim),
          responsavelId: u(i).id,
          observacoes: 'Renovação automática mediante aceite formal.',
        },
      });
    }
    contratos.push(con);
  }
  console.log(`📄 Contratos: ${contratos.length}`);

  // ── 9. FATURAS ────────────────────────────────────────────────────────────
  const jaTemFatura = await prisma.fatura.count({ where: { organizationId: orgId } });
  let faturasCriadas = 0;
  if (jaTemFatura === 0) {
    // 4 meses de faturamento recorrente + algumas avulsas
    for (let mes = 3; mes >= 0; mes--) {
      for (let i = 0; i < contratos.length; i++) {
        const ct = contratos[i];
        if (ct.status !== 'vigente' || ct.tipo === 'projeto') continue;
        const venc = daysAgo(mes * 30 - 5);
        const vencido = venc < new Date();
        const pago = mes > 0;
        await prisma.fatura.create({
          data: {
            organizationId: orgId,
            contratoId: ct.id,
            clienteId: ct.clienteId,
            descricao: `${ct.titulo} — competência ${new Date(venc).toLocaleDateString('pt-BR', { month: '2-digit', year: 'numeric' })}`,
            valor: ct.valor,
            dataEmissao: daysAgo(mes * 30 + 10),
            dataVencimento: venc,
            dataPagamento: pago ? daysAgo(mes * 30 - 3) : null,
            status: pago ? 'paga' : vencido ? 'vencida' : 'pendente',
            criadoPorId: u(0).id,
          },
        });
        faturasCriadas++;
      }
    }
    // Marcos de projeto
    const proj = contratos.find((c) => c.tipo === 'projeto');
    if (proj) {
      const marcos = [
        { d: 'Marco 1 — Discovery e Arquitetura', v: 73500, dias: 80, status: 'paga' },
        { d: 'Marco 2 — Desenvolvimento (Sprint 1-4)', v: 98000, dias: 25, status: 'paga' },
        { d: 'Marco 3 — Homologação e Go-live', v: 73500, dias: -20, status: 'pendente' },
      ];
      for (const m of marcos) {
        await prisma.fatura.create({
          data: {
            organizationId: orgId,
            contratoId: proj.id,
            clienteId: proj.clienteId,
            descricao: m.d,
            valor: m.v,
            dataEmissao: daysAgo(m.dias + 12),
            dataVencimento: daysAgo(m.dias),
            dataPagamento: m.status === 'paga' ? daysAgo(m.dias - 4) : null,
            status: m.status,
            criadoPorId: u(0).id,
          },
        });
        faturasCriadas++;
      }
    }
  }
  console.log(`🧾 Faturas: ${faturasCriadas || jaTemFatura} (${jaTemFatura ? 'já existiam' : 'criadas'})`);

  console.log('\n════════════════════════════════════════');
  console.log('🎉 Seed v3 concluído!');
  console.log('════════════════════════════════════════\n');
}

main()
  .catch((e) => {
    console.error('❌ Erro no seed v3:', e.message);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
