/**
 * Seed de dados demo para testes — Orkiestri
 * Preenche: Orçamento, Chamados, Aprovações, Inventário, Projetos, Agenda
 * Execução: node /app/prisma/seed-demo.js
 */

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Iniciando seed de dados demo...\n');

  // ── 1. Localizar org Default e seus usuários ─────────────────────────────
  const org = await prisma.organization.findFirst({
    where: {
      OR: [{ slug: 'default' }, { nome: { contains: 'default', mode: 'insensitive' } }],
    },
    include: {
      users: { where: { ativo: true }, take: 10 },
    },
  });

  if (!org) {
    console.error('❌ Organização Default não encontrada!');
    process.exit(1);
  }

  const users = org.users;
  if (users.length === 0) {
    console.error('❌ Nenhum usuário ativo encontrado na org Default!');
    process.exit(1);
  }

  const u0 = users[0]; // usuário principal
  const u1 = users[1] || users[0];
  const u2 = users[2] || users[0];
  const orgId = org.id;

  console.log(`✅ Org: ${org.nome} (${orgId})`);
  console.log(`👤 Usuários disponíveis: ${users.map(u => u.nome).join(', ')}\n`);

  // ── 2. Setor base (necessário para alguns relacionamentos) ───────────────
  let setor = await prisma.setor.findFirst({ where: { organizationId: orgId } });
  if (!setor) {
    setor = await prisma.setor.create({
      data: { organizationId: orgId, nome: 'Tecnologia da Informação', cor: '#7c3aed' },
    });
    console.log('📂 Setor criado: Tecnologia da Informação');
  }

  // ── 3. CHAMADOS ──────────────────────────────────────────────────────────
  console.log('\n📋 Criando chamados...');

  const chamadosData = [
    {
      titulo: 'Lentidão no sistema de ERP após atualização',
      descricao: 'Após a atualização realizada na última sexta-feira, o sistema apresenta lentidão severa na abertura de telas de relatórios. O carregamento que levava 3 segundos agora demora mais de 40 segundos, impactando toda a equipe financeira.',
      status: 'aberto',
      prioridade: 'alta',
      categoria: 'Infraestrutura',
    },
    {
      titulo: 'Erro ao gerar NF-e — certificado expirado',
      descricao: 'O sistema está recusando a emissão de notas fiscais eletrônicas. Mensagem de erro: "Certificado digital vencido em 15/05/2026". Estamos impedidos de faturar desde ontem.',
      status: 'em_atendimento',
      prioridade: 'urgente',
      categoria: 'Faturamento',
    },
    {
      titulo: 'Acesso bloqueado para colaboradores do setor de RH',
      descricao: 'Após a migração de contas realizada na semana passada, 4 colaboradores do setor de RH não conseguem acessar o módulo de folha de pagamento. Aparece mensagem "Sem permissão para este recurso".',
      status: 'em_atendimento',
      prioridade: 'alta',
      categoria: 'Acessos',
    },
    {
      titulo: 'Solicitação de novo equipamento — Notebook para estagiário',
      descricao: 'Estamos com um novo estagiário iniciando em 01/06/2026 e precisamos de um notebook para ele. Perfil de uso: Office, navegador e sistema interno. Sem necessidade de alto desempenho.',
      status: 'aberto',
      prioridade: 'media',
      categoria: 'Infraestrutura',
    },
    {
      titulo: 'Impressora do setor comercial sem conectividade',
      descricao: 'A impressora HP LaserJet Pro M404n parou de ser reconhecida na rede. Tentamos reiniciar o equipamento e verificar os cabos, sem sucesso. O setor comercial está imprimindo em outra impressora temporariamente.',
      status: 'resolvido',
      prioridade: 'media',
      categoria: 'Infraestrutura',
    },
    {
      titulo: 'Configurar VPN para trabalho remoto — 3 colaboradores',
      descricao: 'Precisamos configurar acesso VPN para 3 colaboradores que passarão a trabalhar em regime híbrido a partir de junho. Usuários: Ana Lima, Carlos Mota, Pedro Souza.',
      status: 'resolvido',
      prioridade: 'baixa',
      categoria: 'Acessos',
    },
    {
      titulo: 'Backup automatizado não está executando desde segunda-feira',
      descricao: 'O job de backup agendado para as 02:00 não está executando há 3 dias. Verificamos no servidor e a tarefa aparece como "Failed" sem log de erro detalhado. Risco de perda de dados.',
      status: 'aberto',
      prioridade: 'urgente',
      categoria: 'Infraestrutura',
    },
    {
      titulo: 'Integração com API do banco retornando erro 503',
      descricao: 'O módulo de conciliação bancária apresenta falha na comunicação com a API do Itaú. Código de erro: 503 Service Unavailable. O problema ocorre desde às 09h de hoje. Transações em atraso.',
      status: 'em_atendimento',
      prioridade: 'alta',
      categoria: 'Integrações',
    },
  ];

  const chamadosCriados = [];
  for (const c of chamadosData) {
    const chamado = await prisma.chamado.create({
      data: {
        organizationId: orgId,
        solicitanteId: u0.id,
        atendenteId: c.status !== 'aberto' ? u1.id : null,
        titulo: c.titulo,
        descricao: c.descricao,
        status: c.status,
        prioridade: c.prioridade,
        categoria: c.categoria,
        slaHoras: c.prioridade === 'urgente' ? 2 : c.prioridade === 'alta' ? 8 : 24,
        resolvidoEm: c.status === 'resolvido' ? new Date() : null,
        criadoEm: randomDate(30),
      },
    });
    chamadosCriados.push(chamado);

    // Comentários em cada chamado
    await prisma.chamadoComentario.create({
      data: {
        chamadoId: chamado.id,
        userId: u1.id,
        texto: gerarComentarioInicial(c.status),
        interno: false,
        criadoEm: new Date(chamado.criadoEm.getTime() + 1800000),
      },
    });

    if (c.status === 'em_atendimento' || c.status === 'resolvido') {
      await prisma.chamadoComentario.create({
        data: {
          chamadoId: chamado.id,
          userId: u1.id,
          texto: 'Analisando o problema internamente. Em breve retorno com atualização.',
          interno: true,
          criadoEm: new Date(chamado.criadoEm.getTime() + 3600000),
        },
      });
    }
  }
  console.log(`   ✓ ${chamadosCriados.length} chamados criados`);

  // ── 4. PROJETOS ──────────────────────────────────────────────────────────
  console.log('\n📁 Criando projetos...');

  const projetosData = [
    {
      titulo: 'Implantação ERP Financeiro',
      descricao: 'Implantação do módulo financeiro completo com integração bancária, conciliação automática e emissão de NF-e. Projeto estratégico para digitalização do setor financeiro.',
      status: 'EM_ANDAMENTO',
      prioridade: 'ALTA',
      progressoPct: 45,
      valor: 85000,
      cor: '#7c3aed',
      diasInicio: -30,
      diasFim: 90,
    },
    {
      titulo: 'Migração para Cloud AWS',
      descricao: 'Migração completa da infraestrutura on-premise para AWS. Inclui configuração de RDS, EC2, S3, CloudFront e implementação de práticas de DevSecOps.',
      status: 'PLANEJAMENTO',
      prioridade: 'ALTA',
      progressoPct: 10,
      valor: 120000,
      cor: '#0ea5e9',
      diasInicio: 15,
      diasFim: 180,
    },
    {
      titulo: 'Redesign Portal do Cliente',
      descricao: 'Modernização completa do portal de autoatendimento dos clientes com nova identidade visual, UX responsiva e integração com API de notificações em tempo real.',
      status: 'EM_ANDAMENTO',
      prioridade: 'MEDIA',
      progressoPct: 72,
      valor: 45000,
      cor: '#06b6d4',
      diasInicio: -60,
      diasFim: 30,
    },
    {
      titulo: 'Automação de Processos RH',
      descricao: 'Automatização do onboarding de colaboradores, fluxo de aprovação de férias, ponto eletrônico e integração com sistema de folha de pagamento.',
      status: 'CONCLUIDO',
      prioridade: 'MEDIA',
      progressoPct: 100,
      valor: 32000,
      cor: '#10b981',
      diasInicio: -120,
      diasFim: -15,
    },
    {
      titulo: 'Plataforma de BI e Analytics',
      descricao: 'Construção de data warehouse e dashboards executivos com KPIs estratégicos de negócio, CSAT, SLA operacional e indicadores financeiros em tempo real.',
      status: 'PLANEJAMENTO',
      prioridade: 'ALTA',
      progressoPct: 5,
      valor: 78000,
      cor: '#f59e0b',
      diasInicio: 30,
      diasFim: 210,
    },
  ];

  for (const p of projetosData) {
    const projeto = await prisma.project.create({
      data: {
        organizationId: orgId,
        criadoPorId: u0.id,
        titulo: p.titulo,
        descricao: p.descricao,
        status: p.status,
        prioridade: p.prioridade,
        progressoPct: p.progressoPct,
        valor: p.valor,
        cor: p.cor,
        dataInicio: daysFromNow(p.diasInicio),
        dataFim: daysFromNow(p.diasFim),
      },
    });

    // Membros
    await prisma.projectMember.createMany({
      data: [
        { projectId: projeto.id, userId: u0.id, papel: 'gerente' },
        { projectId: projeto.id, userId: u1.id, papel: 'membro' },
        ...(u2.id !== u0.id ? [{ projectId: projeto.id, userId: u2.id, papel: 'membro' }] : []),
      ],
      skipDuplicates: true,
    });

    // Milestones
    if (p.status !== 'CONCLUIDO') {
      const ms1 = await prisma.milestone.create({
        data: {
          projectId: projeto.id,
          titulo: 'Levantamento e Planejamento',
          dataAlvo: daysFromNow(p.diasInicio + 20),
          concluido: p.progressoPct > 30,
        },
      });

      const ms2 = await prisma.milestone.create({
        data: {
          projectId: projeto.id,
          titulo: 'Desenvolvimento e Implementação',
          dataAlvo: daysFromNow(p.diasInicio + 60),
          concluido: p.progressoPct > 70,
        },
      });

      // Tasks
      const tasksMs1 = [
        { titulo: 'Reunião de kick-off com stakeholders', status: p.progressoPct > 30 ? 'CONCLUIDA' : 'A_FAZER', prioridade: 'ALTA' },
        { titulo: 'Documentar requisitos funcionais', status: p.progressoPct > 30 ? 'CONCLUIDA' : 'EM_ANDAMENTO', prioridade: 'ALTA' },
        { titulo: 'Validar arquitetura técnica', status: p.progressoPct > 30 ? 'CONCLUIDA' : 'A_FAZER', prioridade: 'MEDIA' },
      ];

      const tasksMs2 = [
        { titulo: 'Configurar ambiente de desenvolvimento', status: p.progressoPct > 50 ? 'CONCLUIDA' : 'EM_ANDAMENTO', prioridade: 'ALTA' },
        { titulo: 'Desenvolvimento módulo core', status: p.progressoPct > 60 ? 'CONCLUIDA' : 'EM_ANDAMENTO', prioridade: 'ALTA' },
        { titulo: 'Testes de integração e homologação', status: p.progressoPct > 75 ? 'CONCLUIDA' : 'A_FAZER', prioridade: 'MEDIA' },
        { titulo: 'Deploy em produção e monitoramento', status: p.progressoPct >= 100 ? 'CONCLUIDA' : 'A_FAZER', prioridade: 'ALTA' },
      ];

      for (const t of [...tasksMs1, ...tasksMs2]) {
        await prisma.task.create({
          data: {
            projectId: projeto.id,
            milestoneId: tasksMs1.includes(t) ? ms1.id : ms2.id,
            criadoPorId: u0.id,
            assigneeId: [u0.id, u1.id, u2.id][Math.floor(Math.random() * 3)],
            titulo: t.titulo,
            status: t.status,
            prioridade: t.prioridade,
            horasEstimadas: [4, 8, 16, 24][Math.floor(Math.random() * 4)],
          },
        });
      }
    }
  }
  console.log(`   ✓ ${projetosData.length} projetos criados com milestones e tarefas`);

  // ── 5. ORÇAMENTO ─────────────────────────────────────────────────────────
  console.log('\n💰 Criando orçamento...');

  // Centro de custo
  let cc1 = await prisma.centroCusto.findFirst({ where: { organizationId: orgId } });
  if (!cc1) {
    cc1 = await prisma.centroCusto.create({
      data: {
        organizationId: orgId,
        codigo: 'CC-001',
        nome: 'Tecnologia da Informação',
        descricao: 'Infraestrutura, software e serviços de TI',
        cor: '#7c3aed',
        responsavelId: u0.id,
      },
    });
  }

  let cc2 = await prisma.centroCusto.findFirst({ where: { organizationId: orgId, codigo: 'CC-002' } });
  if (!cc2) {
    cc2 = await prisma.centroCusto.create({
      data: {
        organizationId: orgId,
        codigo: 'CC-002',
        nome: 'Recursos Humanos',
        descricao: 'Treinamentos, benefícios e desenvolvimento de pessoas',
        cor: '#06b6d4',
        responsavelId: u1.id,
      },
    });
  }

  let cc3 = await prisma.centroCusto.findFirst({ where: { organizationId: orgId, codigo: 'CC-003' } });
  if (!cc3) {
    cc3 = await prisma.centroCusto.create({
      data: {
        organizationId: orgId,
        codigo: 'CC-003',
        nome: 'Comercial e Marketing',
        descricao: 'Campanhas, eventos e ferramentas comerciais',
        cor: '#f59e0b',
        responsavelId: u1.id,
      },
    });
  }

  // Categorias de orçamento
  let catDespesa = await prisma.categoriaOrcamento.findFirst({ where: { organizationId: orgId, tipo: 'despesa', codigo: 'SW' } });
  if (!catDespesa) {
    catDespesa = await prisma.categoriaOrcamento.create({
      data: {
        organizationId: orgId,
        tipo: 'despesa',
        codigo: 'SW',
        nome: 'Software e Licenças',
        cor: '#7c3aed',
      },
    });
  }

  let catInfra = await prisma.categoriaOrcamento.findFirst({ where: { organizationId: orgId, codigo: 'INFRA' } });
  if (!catInfra) {
    catInfra = await prisma.categoriaOrcamento.create({
      data: {
        organizationId: orgId,
        tipo: 'despesa',
        codigo: 'INFRA',
        nome: 'Infraestrutura e Cloud',
        cor: '#0ea5e9',
      },
    });
  }

  let catPessoas = await prisma.categoriaOrcamento.findFirst({ where: { organizationId: orgId, codigo: 'RH' } });
  if (!catPessoas) {
    catPessoas = await prisma.categoriaOrcamento.create({
      data: {
        organizationId: orgId,
        tipo: 'despesa',
        codigo: 'RH',
        nome: 'Pessoal e Treinamentos',
        cor: '#06b6d4',
      },
    });
  }

  let catReceita = await prisma.categoriaOrcamento.findFirst({ where: { organizationId: orgId, codigo: 'SRV' } });
  if (!catReceita) {
    catReceita = await prisma.categoriaOrcamento.create({
      data: {
        organizationId: orgId,
        tipo: 'receita',
        codigo: 'SRV',
        nome: 'Serviços Prestados',
        cor: '#10b981',
      },
    });
  }

  // Fornecedor
  let forn1 = await prisma.fornecedorOrcamento.findFirst({ where: { organizationId: orgId } });
  if (!forn1) {
    forn1 = await prisma.fornecedorOrcamento.create({
      data: {
        organizationId: orgId,
        nome: 'Microsoft do Brasil Ltda',
        cnpj: '60.316.817/0001-44',
        email: 'contratos@microsoft.com',
        segmento: 'Software',
      },
    });
  }

  let forn2 = await prisma.fornecedorOrcamento.findFirst({ where: { organizationId: orgId, nome: 'Amazon Web Services' } });
  if (!forn2) {
    forn2 = await prisma.fornecedorOrcamento.create({
      data: {
        organizationId: orgId,
        nome: 'Amazon Web Services',
        cnpj: '23.412.671/0001-89',
        email: 'billing@aws.amazon.com',
        segmento: 'Cloud',
      },
    });
  }

  // Ciclo orçamentário
  let ciclo = await prisma.orcamentoCiclo.findFirst({ where: { organizationId: orgId, ano: 2026 } });
  if (!ciclo) {
    ciclo = await prisma.orcamentoCiclo.create({
      data: {
        organizationId: orgId,
        ano: 2026,
        descricao: 'Orçamento Anual 2026 — Tecnologia & Operações',
        status: 'aprovado',
        aprovadoPorId: u0.id,
      },
    });
  }

  // Itens de orçamento com lançamentos mensais
  const itensOrcamento = [
    { nome: 'Microsoft 365 Business Premium', catId: catDespesa.id, ccId: cc1.id, fornId: forn1.id, recorrente: true, tipo: 'despesa', meses: [850, 850, 850, 850, 850, 850, 850, 850, 850, 850, 850, 850] },
    { nome: 'AWS — Infraestrutura Cloud', catId: catInfra.id, ccId: cc1.id, fornId: forn2.id, recorrente: true, tipo: 'despesa', meses: [3200, 3200, 3600, 3600, 3400, 3400, 3800, 3800, 4000, 4200, 4200, 4500] },
    { nome: 'Licença ERP — Suporte Anual', catId: catDespesa.id, ccId: cc1.id, fornId: forn1.id, recorrente: false, tipo: 'despesa', meses: [18000, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0] },
    { nome: 'Treinamentos e Certificações TI', catId: catPessoas.id, ccId: cc2.id, fornId: null, recorrente: true, tipo: 'despesa', meses: [1500, 1500, 2000, 1500, 1500, 3000, 1500, 1500, 2000, 1500, 1500, 2500] },
    { nome: 'Prestação de Serviços — Cliente A', catId: catReceita.id, ccId: cc3.id, fornId: null, recorrente: true, tipo: 'receita', meses: [15000, 15000, 15000, 18000, 18000, 18000, 20000, 20000, 20000, 22000, 22000, 22000] },
  ];

  for (const item of itensOrcamento) {
    const itemOrc = await prisma.itemOrcamento.create({
      data: {
        cicloId: ciclo.id,
        centroCustoId: item.ccId,
        categoriaId: item.catId,
        fornecedorId: item.fornId,
        tipo: item.tipo,
        nome: item.nome,
        recorrente: item.recorrente,
        periodicidade: item.recorrente ? 'mensal' : 'unico',
        status: 'ativo',
        criadoPorId: u0.id,
      },
    });

    // Lançamentos mensais
    const lancamentos = item.meses.map((v, i) => ({
      itemId: itemOrc.id,
      mes: i + 1,
      valorPrevisto: v,
      valorRealizado: i < 5 ? v * (0.9 + Math.random() * 0.2) : null,
      status: i < 5 ? 'realizado' : 'pendente',
      lancadoPorId: i < 5 ? u0.id : null,
      lancadoEm: i < 5 ? daysFromNow(-30 + i * 5) : null,
    }));

    await prisma.itemOrcamentoMes.createMany({ data: lancamentos, skipDuplicates: true });
  }
  console.log(`   ✓ Ciclo 2026 criado com ${itensOrcamento.length} itens e lançamentos mensais`);

  // ── 6. APROVAÇÕES ────────────────────────────────────────────────────────
  console.log('\n✅ Criando aprovações...');

  // AprovacaoOrcamento
  const itemParaAprov = await prisma.itemOrcamento.findFirst({ where: { cicloId: ciclo.id } });
  if (itemParaAprov) {
    await prisma.aprovacaoOrcamento.createMany({
      data: [
        {
          itemId: itemParaAprov.id,
          tipo: 'aumento_verba',
          status: 'pendente',
          solicitadoPorId: u1.id,
          observacoes: 'Solicitando aumento de R$5.000 na verba de cloud devido ao crescimento de uso em Q3.',
        },
        {
          itemId: itemParaAprov.id,
          tipo: 'novo_item',
          status: 'aprovado',
          solicitadoPorId: u1.id,
          aprovadoPorId: u0.id,
          observacoes: 'Aprovado. Segue dentro do budget aprovado para 2026.',
          resolvidoEm: daysFromNow(-5),
        },
        {
          itemId: itemParaAprov.id,
          tipo: 'cancelamento',
          status: 'rejeitado',
          solicitadoPorId: u2.id,
          aprovadoPorId: u0.id,
          observacoes: 'Rejeitado. Item essencial para operação do trimestre.',
          resolvidoEm: daysFromNow(-10),
        },
      ],
    });
  }

  // WorkflowRequest — aprovações gerais
  await prisma.workflowRequest.createMany({
    data: [
      {
        organizationId: orgId,
        solicitanteId: u1.id,
        tipo: 'despesa',
        titulo: 'Compra de equipamentos para laboratório',
        descricao: 'Aquisição de 5 monitores LG UltraWide 34" para o time de desenvolvimento. Valor total: R$ 12.500.',
        valor: 12500,
        status: 'PENDENTE',
        aprovadorAtualId: u0.id,
      },
      {
        organizationId: orgId,
        solicitanteId: u2.id,
        tipo: 'horas_extra',
        titulo: 'Horas extras — Sprint de entrega',
        descricao: 'Solicitação de aprovação de 20h extras referentes à sprint de entrega do projeto de migração cloud realizada entre 20-24/05.',
        valor: 2400,
        status: 'APROVADA',
        aprovadorAtualId: null,
        aprovadoPorId: u0.id,
        aprovadoEm: daysFromNow(-3),
      },
      {
        organizationId: orgId,
        solicitanteId: u1.id,
        tipo: 'folga_compensatoria',
        titulo: 'Folga compensatória — final de semana de plantão',
        descricao: 'Trabalhei no final de semana 17-18/05 para manutenção emergencial de servidor. Solicitando 2 dias de folga compensatória.',
        status: 'PENDENTE',
        aprovadorAtualId: u0.id,
      },
      {
        organizationId: orgId,
        solicitanteId: u0.id,
        tipo: 'alteracao_cadastral',
        titulo: 'Atualização de cargo — Promoção Carlos Mota',
        descricao: 'Solicitando atualização do cargo de "Analista de TI" para "Especialista de TI" referente à promoção aprovada em reunião de 15/05.',
        status: 'APROVADA',
        aprovadoPorId: u0.id,
        aprovadoEm: daysFromNow(-7),
      },
      {
        organizationId: orgId,
        solicitanteId: u2.id,
        tipo: 'despesa',
        titulo: 'Assinatura anual — Figma Professional',
        descricao: 'Renovação da licença anual do Figma Professional para o time de design. Valor: R$ 2.880 (R$ 240/mês × 12).',
        valor: 2880,
        status: 'REJEITADA',
        aprovadoPorId: u0.id,
        rejeitadoPorId: u0.id,
        rejeitadoEm: daysFromNow(-2),
        motivoRejeicao: 'Substituir por alternativa open-source aprovada pela diretoria. Retornar com nova proposta usando o Penpot.',
      },
    ],
  });
  console.log('   ✓ 3 aprovações de orçamento e 5 workflow requests criados');

  // ── 7. INVENTÁRIO (ATIVOS) ───────────────────────────────────────────────
  console.log('\n🖥️  Criando inventário...');

  // Categorias
  let catHW = await prisma.categoriaAtivo.findFirst({ where: { organizationId: orgId, nome: 'Hardware' } });
  if (!catHW) {
    catHW = await prisma.categoriaAtivo.create({
      data: { organizationId: orgId, nome: 'Hardware', icone: 'monitor', cor: '#7c3aed' },
    });
  }

  let catRede = await prisma.categoriaAtivo.findFirst({ where: { organizationId: orgId, nome: 'Rede e Telecom' } });
  if (!catRede) {
    catRede = await prisma.categoriaAtivo.create({
      data: { organizationId: orgId, nome: 'Rede e Telecom', icone: 'wifi', cor: '#0ea5e9' },
    });
  }

  let catMob = await prisma.categoriaAtivo.findFirst({ where: { organizationId: orgId, nome: 'Dispositivos Móveis' } });
  if (!catMob) {
    catMob = await prisma.categoriaAtivo.create({
      data: { organizationId: orgId, nome: 'Dispositivos Móveis', icone: 'smartphone', cor: '#10b981' },
    });
  }

  const ativos = [
    { codigo: 'NB-001', nome: 'Notebook Dell Latitude 5540', catId: catHW.id, marca: 'Dell', modelo: 'Latitude 5540', serie: 'DL2024-001', local: 'Sala TI', status: 'ativo', valor: 5800, garantia: daysFromNow(365) },
    { codigo: 'NB-002', nome: 'Notebook Lenovo ThinkPad X1', catId: catHW.id, marca: 'Lenovo', modelo: 'ThinkPad X1 Carbon', serie: 'LN2024-045', local: 'Sala Comercial', status: 'ativo', valor: 7200, garantia: daysFromNow(730) },
    { codigo: 'NB-003', nome: 'Notebook HP EliteBook 840', catId: catHW.id, marca: 'HP', modelo: 'EliteBook 840 G9', serie: 'HP2023-112', local: 'Sala RH', status: 'em_manutencao', valor: 4900, garantia: daysFromNow(90) },
    { codigo: 'MN-001', nome: 'Monitor LG UltraWide 34"', catId: catHW.id, marca: 'LG', modelo: '34WN780-B', serie: 'LG-34-001', local: 'Sala TI', status: 'ativo', valor: 2500, garantia: daysFromNow(400) },
    { codigo: 'MN-002', nome: 'Monitor Dell P2722H 27"', catId: catHW.id, marca: 'Dell', modelo: 'P2722H', serie: 'DM-P27-002', local: 'Sala Financeiro', status: 'ativo', valor: 1800, garantia: daysFromNow(500) },
    { codigo: 'SW-001', nome: 'Switch Cisco Catalyst 2960', catId: catRede.id, marca: 'Cisco', modelo: 'Catalyst 2960-24', serie: 'CSC-2960-01', local: 'CPD', status: 'ativo', valor: 3200, garantia: daysFromNow(-30) },
    { codigo: 'RO-001', nome: 'Roteador Mikrotik RB4011', catId: catRede.id, marca: 'Mikrotik', modelo: 'RB4011iGS+', serie: 'MK-4011-01', local: 'CPD', status: 'ativo', valor: 2100, garantia: daysFromNow(200) },
    { codigo: 'IP-001', nome: 'iPhone 14 Pro — Diretoria', catId: catMob.id, marca: 'Apple', modelo: 'iPhone 14 Pro', serie: 'APL-IP14-001', local: 'Diretoria', status: 'ativo', valor: 7500, garantia: daysFromNow(100) },
    { codigo: 'IP-002', nome: 'iPad Air 5ª Geração', catId: catMob.id, marca: 'Apple', modelo: 'iPad Air 5', serie: 'APL-IPAD-002', local: 'Sala Reunião', status: 'ativo', valor: 4800, garantia: daysFromNow(300) },
    { codigo: 'PR-001', nome: 'Impressora HP LaserJet Pro M404n', catId: catHW.id, marca: 'HP', modelo: 'LaserJet Pro M404n', serie: 'HP-LJ-001', local: 'Sala Comercial', status: 'inativo', valor: 1200, garantia: daysFromNow(-90) },
  ];

  for (const a of ativos) {
    const existente = await prisma.ativo.findFirst({ where: { organizationId: orgId, codigo: a.codigo } });
    if (!existente) {
      await prisma.ativo.create({
        data: {
          organizationId: orgId,
          codigo: a.codigo,
          nome: a.nome,
          categoriaId: a.catId,
          marca: a.marca,
          modelo: a.modelo,
          numeroSerie: a.serie,
          localizacao: a.local,
          status: a.status,
          responsavelId: u0.id,
          setorId: setor.id,
          dataAquisicao: daysFromNow(-180),
          valorAquisicao: a.valor,
          dataGarantiaFim: a.garantia,
        },
      });
    }
  }
  console.log(`   ✓ ${ativos.length} ativos cadastrados em 3 categorias`);

  // ── 8. AGENDA ────────────────────────────────────────────────────────────
  console.log('\n📅 Criando eventos na agenda...');

  const eventos = [
    {
      titulo: 'Reunião Semanal de TI',
      tipo: 'REUNIAO',
      descricao: 'Alinhamento semanal da equipe de TI: pendências, prioridades da semana e status dos projetos em andamento.',
      inicio: daysFromNow(1, 9),
      fim: daysFromNow(1, 10),
      cor: '#7c3aed',
      local: 'Sala de Reuniões A',
      recorrencia: 'SEMANAL',
    },
    {
      titulo: 'Kickoff — Projeto Migração Cloud',
      tipo: 'PROJETO',
      descricao: 'Reunião de início oficial do projeto de migração para AWS. Presença obrigatória de todos os membros do time técnico e gestores.',
      inicio: daysFromNow(3, 14),
      fim: daysFromNow(3, 16),
      cor: '#0ea5e9',
      local: 'Sala de Conferências',
    },
    {
      titulo: 'Apresentação de Resultados Q2',
      tipo: 'REUNIAO',
      descricao: 'Apresentação dos resultados do segundo trimestre para a diretoria. Incluir métricas de SLA, satisfação e KPIs operacionais.',
      inicio: daysFromNow(7, 15),
      fim: daysFromNow(7, 17),
      cor: '#f59e0b',
      local: 'Auditório Principal',
    },
    {
      titulo: 'Treinamento — AWS Solutions Architect',
      tipo: 'COMPROMISSO',
      descricao: 'Treinamento preparatório para certificação AWS Solutions Architect. Módulo 3: Design de redes VPC e segurança.',
      inicio: daysFromNow(5, 9),
      fim: daysFromNow(5, 18),
      cor: '#0ea5e9',
      local: 'Online — Plataforma AWS Training',
      diaTodo: false,
    },
    {
      titulo: 'Manutenção Preventiva — Servidores',
      tipo: 'COMPROMISSO',
      descricao: 'Janela de manutenção preventiva dos servidores de produção. Sistema ficará em modo de manutenção das 00h às 04h.',
      inicio: daysFromNow(10, 0),
      fim: daysFromNow(10, 4),
      cor: '#ef4444',
      local: 'CPD',
    },
    {
      titulo: 'One-on-One — Review de Desempenho',
      tipo: 'PESSOAL',
      descricao: 'Reunião individual de review de desempenho semestral com feedback estruturado e alinhamento de metas.',
      inicio: daysFromNow(2, 10),
      fim: daysFromNow(2, 11),
      cor: '#10b981',
      local: 'Sala Gerência',
    },
    {
      titulo: 'Demo — Nova Versão do Portal Cliente',
      tipo: 'EXTERNO',
      descricao: 'Demonstração das novas funcionalidades do portal de autoatendimento para o cliente Acme Corp. Foco em UX e integração via API.',
      inicio: daysFromNow(6, 11),
      fim: daysFromNow(6, 12),
      cor: '#06b6d4',
      local: 'Google Meet',
    },
    {
      titulo: 'Sprint Planning — Ciclo 14',
      tipo: 'PROJETO',
      descricao: 'Planejamento do sprint 14. Estimativas de story points, definição de prioridades e atribuição de tasks para os próximos 15 dias.',
      inicio: daysFromNow(0, 14),
      fim: daysFromNow(0, 16),
      cor: '#a855f7',
      local: 'Sala Ágil',
    },
    {
      titulo: 'Almoço de Integração — Time TI',
      tipo: 'PESSOAL',
      descricao: 'Confraternização mensal do time de TI. Restaurante Cantina do Zé — reserva confirmada para 12 pessoas.',
      inicio: daysFromNow(14, 12),
      fim: daysFromNow(14, 14),
      cor: '#f59e0b',
      local: 'Cantina do Zé — Rua das Flores, 142',
    },
    {
      titulo: 'Lembrete: Renovar certificado SSL',
      tipo: 'LEMBRETE',
      descricao: 'O certificado SSL do domínio orkiestri.com.br vence em 30 dias. Iniciar processo de renovação junto à Certisign.',
      inicio: daysFromNow(-1, 9),
      fim: daysFromNow(-1, 9, 30),
      cor: '#ef4444',
    },
  ];

  for (const e of eventos) {
    const evento = await prisma.event.create({
      data: {
        organizationId: orgId,
        userId: u0.id,
        criadoPorId: u0.id,
        titulo: e.titulo,
        tipo: e.tipo,
        descricao: e.descricao,
        inicio: e.inicio,
        fim: e.fim || null,
        cor: e.cor,
        local: e.local || null,
        diaTodo: e.diaTodo || false,
        recorrencia: e.recorrencia || null,
        confirmado: true,
      },
    });

    // Adicionar participantes
    if (u1.id !== u0.id) {
      await prisma.eventParticipant.create({
        data: { eventId: evento.id, userId: u1.id, status: 'confirmado' },
      });
    }
    if (u2.id !== u0.id && u2.id !== u1.id && ['REUNIAO', 'PROJETO'].includes(e.tipo)) {
      await prisma.eventParticipant.create({
        data: { eventId: evento.id, userId: u2.id, status: 'pendente' },
      }).catch(() => {});
    }
  }
  console.log(`   ✓ ${eventos.length} eventos criados na agenda`);

  // ── Resumo ───────────────────────────────────────────────────────────────
  console.log('\n════════════════════════════════════════');
  console.log('🎉 Seed concluído com sucesso!\n');
  console.log(`📋 Chamados:      ${chamadosCriados.length}`);
  console.log(`📁 Projetos:      ${projetosData.length} (com milestones e tasks)`);
  console.log(`💰 Orçamento:     Ciclo 2026, ${itensOrcamento.length} itens, 60 lançamentos mensais`);
  console.log(`✅ Aprovações:    3 orçamento + 5 workflow`);
  console.log(`🖥️  Inventário:    ${ativos.length} ativos em 3 categorias`);
  console.log(`📅 Agenda:        ${eventos.length} eventos`);
  console.log('════════════════════════════════════════\n');
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function randomDate(daysBack) {
  const d = new Date();
  d.setDate(d.getDate() - Math.floor(Math.random() * daysBack));
  return d;
}

function daysFromNow(days, hour = 8, minute = 0) {
  const d = new Date();
  d.setDate(d.getDate() + days);
  d.setHours(hour, minute, 0, 0);
  return d;
}

function gerarComentarioInicial(status) {
  const msgs = {
    aberto: 'Chamado registrado. Nossa equipe irá analisar e retornar em breve dentro do prazo de SLA estabelecido.',
    em_atendimento: 'Chamado recebido e em análise. Identificamos o problema e estamos trabalhando na solução. Manteremos atualização a cada 2 horas.',
    resolvido: 'Problema identificado e solucionado com sucesso. Realizamos os seguintes procedimentos: análise de logs, identificação da causa raiz e aplicação da correção. Por favor, confirme se o serviço está operando normalmente.',
  };
  return msgs[status] || msgs.aberto;
}

main()
  .catch(e => {
    console.error('❌ Erro durante o seed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
