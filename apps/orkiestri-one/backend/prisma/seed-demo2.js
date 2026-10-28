/**
 * Seed COMPLETO v2 — Orkiestri
 * Cria dados para TODOS os usuários da org Default
 * Agenda: eventos para cada usuário + como participante
 * Execução: node /app/prisma/seed-demo2.js
 */

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

function daysFromNow(days, hour = 9, minute = 0) {
  const d = new Date();
  d.setDate(d.getDate() + days);
  d.setHours(hour, minute, 0, 0);
  return d;
}

function randomDate(daysBack = 30, daysAhead = 0) {
  const d = new Date();
  const spread = daysBack + daysAhead;
  d.setDate(d.getDate() - daysBack + Math.floor(Math.random() * spread));
  return d;
}

async function main() {
  console.log('🌱 Seed v2 — carga completa de dados demo...\n');

  const org = await prisma.organization.findFirst({
    where: { OR: [{ slug: 'default' }, { nome: { contains: 'default', mode: 'insensitive' } }] },
    include: { users: { where: { ativo: true } } },
  });

  if (!org) { console.error('❌ Org não encontrada'); process.exit(1); }

  const users = org.users;
  const orgId = org.id;

  console.log(`✅ Org: ${org.nome}`);
  console.log(`👤 Usuários: ${users.map(u => u.nome).join(', ')}\n`);

  // Pegar IDs de usuários para espalhar dados
  const u = (i) => users[i % users.length];

  // ── AGENDA — eventos para CADA usuário ──────────────────────────────────
  console.log('📅 Criando eventos para todos os usuários...');

  // Eventos de equipe (criados para cada usuário como dono)
  const eventosEquipe = [
    // Reuniões recorrentes (toda semana)
    { titulo: 'Daily Standup — Time TI', tipo: 'REUNIAO', desc: 'Reunião diária de 15 minutos para alinhamento de atividades, impedimentos e prioridades do dia.', dur: 0.25, cor: '#7c3aed', local: 'Google Meet', dias: [-14,-13,-12,-11,-10,-7,-6,-5,-4,-3,0,1,2,3,4,7,8,9,10,11,14], hora: 9 },
    { titulo: 'Reunião Semanal de TI', tipo: 'REUNIAO', desc: 'Alinhamento semanal da equipe: pendências, blockers e prioridades da semana.', dur: 1, cor: '#7c3aed', local: 'Sala A', dias: [-14,-7,0,7,14,21], hora: 14 },
    { titulo: 'Sprint Planning', tipo: 'PROJETO', desc: 'Planejamento do sprint. Estimativas e atribuição de tasks para os próximos 15 dias.', dur: 2, cor: '#a855f7', local: 'Sala Ágil', dias: [-14,0,14], hora: 10 },
    { titulo: 'Sprint Review & Retrospectiva', tipo: 'PROJETO', desc: 'Revisão do sprint encerrado e retrospectiva de melhoria de processos.', dur: 1.5, cor: '#a855f7', local: 'Sala Ágil', dias: [-1,13], hora: 15 },
    // Eventos únicos importantes
    { titulo: 'Kickoff — Migração Cloud AWS', tipo: 'PROJETO', desc: 'Início oficial do projeto de migração para AWS. Presença obrigatória de toda a equipe técnica e gestores.', dur: 2, cor: '#0ea5e9', local: 'Sala de Conferências', dias: [3], hora: 14 },
    { titulo: 'Apresentação de Resultados Q2', tipo: 'REUNIAO', desc: 'Apresentação dos KPIs do segundo trimestre para a diretoria. Incluindo métricas de SLA, CSAT e indicadores financeiros.', dur: 2, cor: '#f59e0b', local: 'Auditório', dias: [7], hora: 15 },
    { titulo: 'Treinamento AWS Solutions Architect', tipo: 'COMPROMISSO', desc: 'Treinamento preparatório para certificação AWS. Módulo 3: VPC, segurança e IAM.', dur: 8, cor: '#0ea5e9', local: 'Online', dias: [5], hora: 9 },
    { titulo: 'Workshop: Segurança da Informação', tipo: 'COMPROMISSO', desc: 'Workshop obrigatório de conscientização sobre LGPD, phishing e boas práticas de segurança.', dur: 4, cor: '#ef4444', local: 'Sala de Treinamentos', dias: [10], hora: 9 },
    { titulo: 'Demo — Portal do Cliente v3', tipo: 'EXTERNO', desc: 'Demonstração das novas funcionalidades do portal para o cliente Acme Corp.', dur: 1, cor: '#06b6d4', local: 'Google Meet', dias: [6], hora: 11 },
    { titulo: 'Almoço de Integração — Time TI', tipo: 'PESSOAL', desc: 'Confraternização mensal do time. Restaurante Cantina do Zé — reserva confirmada para 12 pessoas.', dur: 2, cor: '#f59e0b', local: 'Cantina do Zé', dias: [14], hora: 12 },
    { titulo: 'One-on-One — Review Semestral', tipo: 'PESSOAL', desc: 'Review de desempenho semestral com feedback estruturado e alinhamento de metas individuais.', dur: 1, cor: '#10b981', local: 'Sala Gerência', dias: [2], hora: 10 },
    { titulo: 'Manutenção Preventiva — Servidores', tipo: 'COMPROMISSO', desc: 'Janela de manutenção dos servidores de produção. Sistema em modo manutenção das 00h às 04h.', dur: 4, cor: '#ef4444', local: 'CPD', dias: [10], hora: 0 },
    // Eventos passados
    { titulo: 'Reunião de Alinhamento Comercial', tipo: 'REUNIAO', desc: 'Alinhamento entre TI e Comercial sobre integrações com CRM e automações de pipeline.', dur: 1.5, cor: '#f59e0b', local: 'Sala B', dias: [-3], hora: 14 },
    { titulo: 'Entrega: Módulo de Relatórios', tipo: 'PROJETO', desc: 'Entrega oficial do módulo de relatórios gerenciais ao cliente. Homologação e aceite.', dur: 1, cor: '#10b981', local: 'Online', dias: [-5], hora: 16 },
    { titulo: 'Treinamento: Uso do Orkiestri', tipo: 'COMPROMISSO', desc: 'Treinamento de onboarding dos novos colaboradores no sistema Orkiestri.', dur: 3, cor: '#7c3aed', local: 'Sala de Treinamentos', dias: [-8], hora: 9 },
    { titulo: 'Reunião com Fornecedor — AWS', tipo: 'EXTERNO', desc: 'Reunião técnica com equipe da AWS para definição de arquitetura e precificação do projeto de migração.', dur: 2, cor: '#0ea5e9', local: 'Escritório AWS SP', dias: [-10], hora: 10 },
    // Lembretes
    { titulo: '⚠️ Renovar certificado SSL', tipo: 'LEMBRETE', desc: 'O certificado SSL vence em 30 dias. Iniciar processo de renovação com Certisign.', dur: 0.5, cor: '#ef4444', local: null, dias: [-1], hora: 9 },
    { titulo: '⚠️ Backup mensal — verificar logs', tipo: 'LEMBRETE', desc: 'Verificar integridade dos backups mensais e validar restauração no ambiente de staging.', dur: 0.5, cor: '#ef4444', local: null, dias: [1], hora: 8 },
    { titulo: 'Renovação contrato Microsoft 365', tipo: 'COMPROMISSO', desc: 'Prazo final para renovação anual das licenças Microsoft 365. Contato: representante.ms@microsoft.com', dur: 0.5, cor: '#0ea5e9', local: null, dias: [20], hora: 10 },
    // Próximas semanas
    { titulo: 'Go-live: Portal Cliente v3', tipo: 'PROJETO', desc: 'Deploy em produção da nova versão do portal de autoatendimento. Monitoramento intensivo por 48h.', dur: 4, cor: '#10b981', local: 'Remoto', dias: [30], hora: 8 },
    { titulo: 'Revisão de Contratos Anuais', tipo: 'REUNIAO', desc: 'Revisão dos contratos de fornecedores com vencimento no segundo semestre.', dur: 2, cor: '#f59e0b', local: 'Sala Jurídico', dias: [21], hora: 14 },
    { titulo: 'Hackathon Interno — Inovação Q3', tipo: 'PROJETO', desc: '24h de hackathon interno para desenvolvimento de novas features. Premiação para os 3 melhores projetos.', dur: 24, cor: '#a855f7', local: 'Escritório', dias: [18], hora: 8 },
  ];

  let totalEventos = 0;

  // Para cada evento de equipe, criar para TODOS os usuários (ou distribuir)
  for (const ev of eventosEquipe) {
    for (const dia of ev.dias) {
      const inicio = daysFromNow(dia, ev.hora);
      const fim = new Date(inicio.getTime() + ev.dur * 3600000);

      // Criar para todos os usuários ativos
      for (let ui = 0; ui < users.length; ui++) {
        const owner = users[ui];
        try {
          const evento = await prisma.event.create({
            data: {
              organizationId: orgId,
              userId: owner.id,
              criadoPorId: owner.id,
              titulo: ev.titulo,
              tipo: ev.tipo,
              descricao: ev.desc,
              inicio,
              fim,
              cor: ev.cor,
              local: ev.local,
              confirmado: true,
            },
          });
          totalEventos++;

          // Adicionar outros usuários como participantes nos eventos de equipe
          if (['REUNIAO', 'PROJETO'].includes(ev.tipo)) {
            for (let uj = 0; uj < Math.min(users.length, 4); uj++) {
              if (users[uj].id !== owner.id) {
                await prisma.eventParticipant.create({
                  data: {
                    eventId: evento.id,
                    userId: users[uj].id,
                    status: Math.random() > 0.3 ? 'confirmado' : 'pendente',
                  },
                }).catch(() => {});
              }
            }
          }
        } catch (e) {
          // Ignorar duplicatas
        }
      }
    }
  }

  // Eventos pessoais únicos por usuário
  const eventosPessoais = [
    { titulo: 'Consulta médica', tipo: 'PESSOAL', desc: 'Consulta de rotina agendada.', dur: 1.5, cor: '#10b981', local: 'Clínica São Lucas', hora: 14 },
    { titulo: 'Reunião com gestor', tipo: 'PESSOAL', desc: 'Check-in mensal com gestor direto.', dur: 1, cor: '#7c3aed', local: 'Sala Gerência', hora: 15 },
    { titulo: 'Curso: Docker e Kubernetes', tipo: 'COMPROMISSO', desc: 'Módulo 5 do curso de containers na Udemy.', dur: 2, cor: '#0ea5e9', local: 'Online', hora: 19 },
    { titulo: 'Entrega de relatório mensal', tipo: 'LEMBRETE', desc: 'Prazo final para entrega do relatório de atividades mensais.', dur: 0.5, cor: '#ef4444', local: null, hora: 17 },
    { titulo: 'Call com cliente Nexus Corp', tipo: 'EXTERNO', desc: 'Alinhamento sobre cronograma de entrega do módulo financeiro.', dur: 1, cor: '#06b6d4', local: 'Zoom', hora: 10 },
  ];

  for (let ui = 0; ui < users.length; ui++) {
    const owner = users[ui];
    const diasPessoais = [-12, -5, 2, 8, 15, 22];
    for (let pi = 0; pi < eventosPessoais.length && pi < diasPessoais.length; pi++) {
      const ev = eventosPessoais[pi % eventosPessoais.length];
      const dia = diasPessoais[pi];
      const inicio = daysFromNow(dia, ev.hora);
      const fim = new Date(inicio.getTime() + ev.dur * 3600000);
      try {
        await prisma.event.create({
          data: {
            organizationId: orgId,
            userId: owner.id,
            criadoPorId: owner.id,
            titulo: ev.titulo,
            tipo: ev.tipo,
            descricao: ev.desc,
            inicio, fim,
            cor: ev.cor,
            local: ev.local,
            confirmado: true,
          },
        });
        totalEventos++;
      } catch (e) {}
    }
  }

  console.log(`   ✓ ${totalEventos} eventos criados para ${users.length} usuários`);

  // ── CHAMADOS — carga massiva ─────────────────────────────────────────────
  console.log('\n📋 Adicionando mais chamados...');

  const maisChamados = [
    { titulo: 'Tela de login retornando erro 500 intermitente', desc: 'Alguns usuários relatam que ao tentar logar no sistema às 08h recebem "Internal Server Error". O problema é intermitente e parece piorar em horários de pico.', status: 'aberto', prio: 'urgente', cat: 'Sistema' },
    { titulo: 'Planilha de controle de estoque corrompida', desc: 'O arquivo Excel compartilhado na pasta de rede apresentou erro ao abrir: "Arquivo corrompido ou ilegível". Arquivo contém dados de inventário do último trimestre.', status: 'aberto', prio: 'alta', cat: 'Dados' },
    { titulo: 'Solicitação de acesso ao sistema de BI', desc: 'Novo analista, Sr. Rafael Torres, precisa de acesso ao Power BI e ao data warehouse para geração de relatórios gerenciais. Aprovação do gestor em anexo.', status: 'em_atendimento', prio: 'media', cat: 'Acessos' },
    { titulo: 'Webcam não reconhecida no notebook corporativo', desc: 'A webcam integrada do notebook Dell Latitude (patrimônio NB-003) não está sendo reconhecida pelo Windows. Já tentamos reinstalar drivers sem sucesso. Impacta reuniões por vídeo.', status: 'em_atendimento', prio: 'media', cat: 'Hardware' },
    { titulo: 'E-mails do domínio corporativo caindo no spam', desc: 'Clientes relatam que os e-mails enviados pelo domínio @empresa.com.br estão sendo classificados como spam. Verificamos e o SPF/DKIM parece correto, mas o problema persiste.', status: 'aberto', prio: 'alta', cat: 'Comunicação' },
    { titulo: 'Upgrade de RAM — 3 estações de trabalho', desc: 'Solicitação de upgrade de memória RAM de 8GB para 16GB em 3 estações do time de desenvolvimento. Patrimônios: NB-001, NB-002 e EST-007.', status: 'resolvido', prio: 'baixa', cat: 'Hardware' },
    { titulo: 'Configurar assinatura de e-mail padrão', desc: 'Precisamos padronizar a assinatura de e-mail de todos os colaboradores conforme o novo template aprovado pelo marketing. São 45 usuários no total.', status: 'em_atendimento', prio: 'baixa', cat: 'Comunicação' },
    { titulo: 'Sistema de ponto eletrônico offline', desc: 'O relógio de ponto biométrico da entrada principal está offline desde as 07:30. Colaboradores estão registrando ponto manualmente. Necessário correção urgente para fechamento de folha.', status: 'resolvido', prio: 'urgente', cat: 'Hardware' },
    { titulo: 'Migrar dados do servidor antigo para NAS', desc: 'O servidor de arquivos legado (WIN-FS-01) precisa ser descomissionado. Aproximadamente 2TB de dados precisam ser migrados para o novo NAS Synology.', status: 'em_atendimento', prio: 'alta', cat: 'Infraestrutura' },
    { titulo: 'Dashboard de KPIs não atualizando em tempo real', desc: 'O painel de KPIs executivos parou de atualizar automaticamente. Os dados estão congelados desde ontem às 15h. Necessário investigar conexão com banco de dados.', status: 'aberto', prio: 'alta', cat: 'Sistema' },
    { titulo: 'Licença do software CAD expirada', desc: 'A licença do AutoCAD LT 2023 expirou e a equipe de engenharia não consegue abrir os projetos. Necessário renovação ou migração para alternativa.', status: 'aberto', prio: 'media', cat: 'Software' },
    { titulo: 'Solicitação de notebook para trabalho remoto', desc: 'Colaboradora Juliana Martins foi autorizada pelo RH a trabalhar 3 dias em home office e necessita de notebook corporativo para uso externo.', status: 'aberto', prio: 'media', cat: 'Hardware' },
  ];

  let chamadosCriados = 0;
  for (const c of maisChamados) {
    const solicitante = u(chamadosCriados);
    const atendente = u(chamadosCriados + 1);
    const chamado = await prisma.chamado.create({
      data: {
        organizationId: orgId,
        solicitanteId: solicitante.id,
        atendenteId: c.status !== 'aberto' ? atendente.id : null,
        titulo: c.titulo,
        descricao: c.desc,
        status: c.status,
        prioridade: c.prio,
        categoria: c.cat,
        slaHoras: c.prio === 'urgente' ? 2 : c.prio === 'alta' ? 8 : 24,
        resolvidoEm: c.status === 'resolvido' ? daysFromNow(-2) : null,
        criadoEm: randomDate(20),
      },
    });

    // Comentários realistas
    await prisma.chamadoComentario.create({
      data: {
        chamadoId: chamado.id,
        userId: atendente.id,
        texto: 'Chamado recebido e registrado. Iniciando análise. Retornaremos dentro do prazo de SLA.',
        interno: false,
        criadoEm: new Date(chamado.criadoEm.getTime() + 900000),
      },
    });

    if (c.status === 'em_atendimento') {
      await prisma.chamadoComentario.create({
        data: {
          chamadoId: chamado.id,
          userId: atendente.id,
          texto: 'Problema identificado. Estamos aplicando a correção. Previsão de resolução: 2 horas.',
          interno: false,
          criadoEm: new Date(chamado.criadoEm.getTime() + 3600000),
        },
      });
      await prisma.chamadoComentario.create({
        data: {
          chamadoId: chamado.id,
          userId: atendente.id,
          texto: '[INTERNO] Causa raiz identificada. Verificando rollback da última atualização.',
          interno: true,
          criadoEm: new Date(chamado.criadoEm.getTime() + 5400000),
        },
      });
    }

    if (c.status === 'resolvido') {
      await prisma.chamadoComentario.create({
        data: {
          chamadoId: chamado.id,
          userId: atendente.id,
          texto: 'Problema resolvido com sucesso. Causa raiz identificada e corrigida. Monitoramento ativo por 24h. Por favor confirme se está tudo funcionando.',
          interno: false,
          criadoEm: new Date(chamado.criadoEm.getTime() + 7200000),
        },
      });
    }

    chamadosCriados++;
  }
  console.log(`   ✓ ${chamadosCriados} chamados adicionais criados`);

  // ── PROJETOS — mais tasks e mais detalhes ────────────────────────────────
  console.log('\n📁 Adicionando tasks extras nos projetos existentes...');

  const projetos = await prisma.project.findMany({
    where: { organizationId: orgId },
    include: { milestones: true },
  });

  let tasksAdicionadas = 0;
  for (const proj of projetos) {
    const taskExtras = [
      { titulo: 'Documentar decisões de arquitetura (ADR)', status: 'A_FAZER', prio: 'MEDIA' },
      { titulo: 'Configurar pipeline de CI/CD', status: 'EM_ANDAMENTO', prio: 'ALTA' },
      { titulo: 'Code review do módulo principal', status: 'EM_REVISAO', prio: 'ALTA' },
      { titulo: 'Atualizar README e documentação técnica', status: 'A_FAZER', prio: 'BAIXA' },
    ];

    for (const t of taskExtras) {
      await prisma.task.create({
        data: {
          projectId: proj.id,
          milestoneId: proj.milestones[0]?.id || null,
          criadoPorId: u(0).id,
          assigneeId: u(tasksAdicionadas % users.length).id,
          titulo: t.titulo,
          status: t.status,
          prioridade: t.prio,
          horasEstimadas: [4, 8, 16][tasksAdicionadas % 3],
        },
      }).catch(() => {});
      tasksAdicionadas++;
    }
  }
  console.log(`   ✓ ${tasksAdicionadas} tasks extras adicionadas`);

  // ── ORÇAMENTO — mais itens e categorias ─────────────────────────────────
  console.log('\n💰 Adicionando itens de orçamento...');

  const ciclo = await prisma.orcamentoCiclo.findFirst({ where: { organizationId: orgId, ano: 2026 } });
  const cc = await prisma.centroCusto.findFirst({ where: { organizationId: orgId } });
  const cat = await prisma.categoriaOrcamento.findFirst({ where: { organizationId: orgId } });
  const forn = await prisma.fornecedorOrcamento.findFirst({ where: { organizationId: orgId } });

  if (ciclo && cc && cat) {
    const novosItens = [
      { nome: 'Google Workspace Business Plus', tipo: 'despesa', meses: [420,420,420,420,420,420,420,420,420,420,420,420] },
      { nome: 'Datadog — Monitoramento e APM', tipo: 'despesa', meses: [890,890,890,1200,1200,1200,1200,1200,1500,1500,1500,1500] },
      { nome: 'GitHub Enterprise', tipo: 'despesa', meses: [350,350,350,350,350,350,350,350,350,350,350,350] },
      { nome: 'Receita Projeto Beta — Fase 2', tipo: 'receita', meses: [0,0,0,25000,25000,25000,30000,30000,30000,35000,35000,35000] },
      { nome: 'Receita SaaS — Licenças Recorrentes', tipo: 'receita', meses: [8000,8500,9000,9500,10000,10500,11000,11500,12000,12500,13000,13500] },
      { nome: 'Seguro de TI e Cyber Security', tipo: 'despesa', meses: [600,600,600,600,600,600,600,600,600,600,600,600] },
    ];

    for (const item of novosItens) {
      try {
        const itemOrc = await prisma.itemOrcamento.create({
          data: {
            cicloId: ciclo.id,
            centroCustoId: cc.id,
            categoriaId: cat.id,
            fornecedorId: item.tipo === 'despesa' ? forn?.id : null,
            tipo: item.tipo,
            nome: item.nome,
            recorrente: true,
            periodicidade: 'mensal',
            status: 'ativo',
            criadoPorId: u(0).id,
          },
        });

        await prisma.itemOrcamentoMes.createMany({
          data: item.meses.map((v, i) => ({
            itemId: itemOrc.id,
            mes: i + 1,
            valorPrevisto: v,
            valorRealizado: i < 4 ? v * (0.9 + Math.random() * 0.2) : null,
            status: i < 4 ? 'realizado' : 'pendente',
            lancadoPorId: i < 4 ? u(0).id : null,
            lancadoEm: i < 4 ? daysFromNow(-120 + i * 30) : null,
          })),
          skipDuplicates: true,
        });
      } catch (e) { /* Ignora se já existe */ }
    }
    console.log(`   ✓ 6 itens adicionais com lançamentos mensais`);
  }

  // ── INVENTÁRIO — mais ativos ─────────────────────────────────────────────
  console.log('\n🖥️  Adicionando mais ativos...');

  const catHW = await prisma.categoriaAtivo.findFirst({ where: { organizationId: orgId, nome: 'Hardware' } });
  const catRede = await prisma.categoriaAtivo.findFirst({ where: { organizationId: orgId, nome: 'Rede e Telecom' } });
  const setor = await prisma.setor.findFirst({ where: { organizationId: orgId } });

  let catMob = await prisma.categoriaAtivo.findFirst({ where: { organizationId: orgId, nome: 'Dispositivos Móveis' } });
  let catSW = await prisma.categoriaAtivo.findFirst({ where: { organizationId: orgId, nome: 'Software e Licenças' } });
  if (!catSW) {
    catSW = await prisma.categoriaAtivo.create({
      data: { organizationId: orgId, nome: 'Software e Licenças', icone: 'code', cor: '#f59e0b' },
    });
  }
  let catMov = await prisma.categoriaAtivo.findFirst({ where: { organizationId: orgId, nome: 'Mobiliário' } });
  if (!catMov) {
    catMov = await prisma.categoriaAtivo.create({
      data: { organizationId: orgId, nome: 'Mobiliário e Instalações', icone: 'layout', cor: '#6b7280' },
    });
  }

  const maisAtivos = [
    { codigo: 'NB-004', nome: 'Notebook MacBook Pro 14" M3', cat: catHW, marca: 'Apple', modelo: 'MacBook Pro M3', serie: 'APL-MBP-004', local: 'Sala Desenvolvimento', status: 'ativo', valor: 15800 },
    { codigo: 'NB-005', nome: 'Notebook Dell XPS 15', cat: catHW, marca: 'Dell', modelo: 'XPS 15 9530', serie: 'DL-XPS-005', local: 'Home Office', status: 'ativo', valor: 9200 },
    { codigo: 'SV-001', nome: 'Servidor Dell PowerEdge R750', cat: catHW, marca: 'Dell', modelo: 'PowerEdge R750', serie: 'DL-PE-001', local: 'CPD', status: 'ativo', valor: 42000 },
    { codigo: 'SV-002', nome: 'NAS Synology DS920+', cat: catHW, marca: 'Synology', modelo: 'DS920+', serie: 'SY-920-001', local: 'CPD', status: 'ativo', valor: 5600 },
    { codigo: 'MN-003', nome: 'Monitor Samsung 32" 4K', cat: catHW, marca: 'Samsung', modelo: 'U32J590', serie: 'SM-32-003', local: 'Sala Diretoria', status: 'ativo', valor: 3200 },
    { codigo: 'MN-004', nome: 'Monitor Ultrawide LG 49"', cat: catHW, marca: 'LG', modelo: '49WQ95C-W', serie: 'LG-49-004', local: 'Sala Dev', status: 'ativo', valor: 6800 },
    { codigo: 'RO-002', nome: 'Firewall Fortinet FortiGate 60F', cat: catRede, marca: 'Fortinet', modelo: 'FortiGate 60F', serie: 'FN-FG60F-001', local: 'CPD', status: 'ativo', valor: 8500 },
    { codigo: 'AP-001', nome: 'Access Point Ubiquiti UniFi U6 Pro', cat: catRede, marca: 'Ubiquiti', modelo: 'UniFi U6 Pro', serie: 'UB-U6P-001', local: 'Escritório Andar 1', status: 'ativo', valor: 1800 },
    { codigo: 'AP-002', nome: 'Access Point Ubiquiti UniFi U6 Lite', cat: catRede, marca: 'Ubiquiti', modelo: 'UniFi U6 Lite', serie: 'UB-U6L-002', local: 'Sala de Reuniões', status: 'ativo', valor: 1200 },
    { codigo: 'IP-003', nome: 'iPhone 14 — Gerente Comercial', cat: catMob, marca: 'Apple', modelo: 'iPhone 14', serie: 'APL-IP14-003', local: 'Diretoria Comercial', status: 'ativo', valor: 5200 },
    { codigo: 'TB-001', nome: 'Tablet Samsung Galaxy Tab S8', cat: catMob, marca: 'Samsung', modelo: 'Galaxy Tab S8', serie: 'SM-TAB-001', local: 'Recepção', status: 'ativo', valor: 3800 },
    { codigo: 'LIC-001', nome: 'Licença Adobe Creative Cloud — Design', cat: catSW, marca: 'Adobe', modelo: 'Creative Cloud All Apps', serie: 'ADO-CC-001', local: 'Digital', status: 'ativo', valor: 4200 },
    { codigo: 'LIC-002', nome: 'Microsoft Office 365 — Suite Corporativa', cat: catSW, marca: 'Microsoft', modelo: 'M365 Business Premium', serie: 'MS-365-001', local: 'Digital', status: 'ativo', valor: 12600 },
    { codigo: 'PR-002', nome: 'Impressora HP Color LaserJet Pro M479', cat: catHW, marca: 'HP', modelo: 'LaserJet M479fdw', serie: 'HP-CL-002', local: 'Sala Administrativa', status: 'ativo', valor: 2800 },
    { codigo: 'CAM-001', nome: 'Câmera de Segurança Intelbras IP', cat: catRede, marca: 'Intelbras', modelo: 'VIP 1130', serie: 'ITB-CAM-001', local: 'Entrada Principal', status: 'ativo', valor: 650 },
  ];

  let ativosAdd = 0;
  for (const a of maisAtivos) {
    if (!a.cat) continue;
    const existente = await prisma.ativo.findFirst({ where: { organizationId: orgId, codigo: a.codigo } });
    if (!existente) {
      await prisma.ativo.create({
        data: {
          organizationId: orgId,
          codigo: a.codigo,
          nome: a.nome,
          categoriaId: a.cat.id,
          marca: a.marca,
          modelo: a.modelo,
          numeroSerie: a.serie,
          localizacao: a.local,
          status: a.status,
          responsavelId: u(ativosAdd).id,
          setorId: setor?.id || null,
          dataAquisicao: daysFromNow(-Math.floor(Math.random() * 365)),
          valorAquisicao: a.valor,
          dataGarantiaFim: daysFromNow(Math.floor(Math.random() * 730)),
        },
      });
      ativosAdd++;
    }
  }
  console.log(`   ✓ ${ativosAdd} ativos adicionados`);

  // ── APROVAÇÕES — mais workflow requests ──────────────────────────────────
  console.log('\n✅ Adicionando mais aprovações...');

  const maisAprovacoes = [
    { tipo: 'despesa', titulo: 'Aquisição de licença Figma Professional — 5 designers', desc: 'Renovação e expansão do plano Figma para acomodar o novo time de UX. Valor: R$ 4.200/ano.', valor: 4200, status: 'PENDENTE', ui: 1 },
    { tipo: 'despesa', titulo: 'Contratação de consultoria de segurança — Pentest', desc: 'Contratação de empresa especializada para realização de teste de penetração anual conforme política de segurança. Orçamento aprovado: R$ 18.000.', valor: 18000, status: 'APROVADA', ui: 2, aprovUi: 0 },
    { tipo: 'horas_extra', titulo: 'Hora extra — Migração banco de dados produção', desc: 'Solicitação de aprovação de 12h extras para janela de migração do banco de dados em produção realizada no final de semana de 24-25/05.', valor: 1440, status: 'APROVADA', ui: 1, aprovUi: 0 },
    { tipo: 'folga_compensatoria', titulo: 'Folga compensatória — Plantão de emergência', desc: 'Prestei suporte remoto emergencial no feriado de 01/05 por 8h. Solicitando 1 dia de folga compensatória.', status: 'PENDENTE', ui: 3 },
    { tipo: 'alteracao_cadastral', titulo: 'Mudança de setor — Transferência para equipe de Cloud', desc: 'Solicitando transferência formal do colaborador Bruno Mendes do setor de Infraestrutura para a equipe de Cloud & DevOps, conforme decisão da gerência.', status: 'APROVADA', ui: 0, aprovUi: 0 },
    { tipo: 'despesa', titulo: 'Upgrade de servidor — Expansão de memória RAM', desc: 'O servidor de produção atingiu 92% de uso de RAM consistentemente. Solicitando aprovação para upgrade de 64GB → 128GB. Custo: R$ 3.800.', valor: 3800, status: 'REJEITADA', ui: 2, aprovUi: 0, motivo: 'Aguardar conclusão da migração para cloud antes de investir em hardware on-premise.' },
    { tipo: 'despesa', titulo: 'Notebook para novo Dev Senior — Onboarding Junho', desc: 'Novo desenvolvedor sênior contratado inicia em 02/06. Necessário notebook MacBook Pro M3 para início das atividades. Valor: R$ 15.800.', valor: 15800, status: 'PENDENTE', ui: 0 },
    { tipo: 'horas_extra', titulo: 'Sprint de entrega acelerado — Go-live Portal', desc: 'Time trabalhou 3 finais de semana consecutivos para antecipar o go-live do portal do cliente. Total: 48h extras distribuídas entre 4 colaboradores.', valor: 9600, status: 'APROVADA', ui: 1, aprovUi: 0 },
  ];

  let aprovAdd = 0;
  for (const ap of maisAprovacoes) {
    await prisma.workflowRequest.create({
      data: {
        organizationId: orgId,
        solicitanteId: u(ap.ui).id,
        tipo: ap.tipo,
        titulo: ap.titulo,
        descricao: ap.desc,
        valor: ap.valor || null,
        status: ap.status,
        aprovadorAtualId: ap.status === 'PENDENTE' ? u(0).id : null,
        aprovadoPorId: ap.aprovUi !== undefined && ap.status === 'APROVADA' ? u(ap.aprovUi).id : null,
        aprovadoEm: ap.status === 'APROVADA' ? daysFromNow(-Math.floor(Math.random() * 10)) : null,
        rejeitadoPorId: ap.status === 'REJEITADA' ? u(0).id : null,
        rejeitadoEm: ap.status === 'REJEITADA' ? daysFromNow(-3) : null,
        motivoRejeicao: ap.motivo || null,
      },
    });
    aprovAdd++;
  }
  console.log(`   ✓ ${aprovAdd} aprovações adicionais`);

  // ── Resumo final ─────────────────────────────────────────────────────────
  const totals = {
    chamados: await prisma.chamado.count({ where: { organizationId: orgId } }),
    eventos: await prisma.event.count({ where: { organizationId: orgId } }),
    projetos: await prisma.project.count({ where: { organizationId: orgId } }),
    tasks: await prisma.task.count({ where: { project: { organizationId: orgId } } }),
    ativos: await prisma.ativo.count({ where: { organizationId: orgId } }),
    aprovacoes: await prisma.workflowRequest.count({ where: { organizationId: orgId } }),
    itensOrc: await prisma.itemOrcamento.count({ where: { ciclo: { organizationId: orgId } } }),
  };

  console.log('\n════════════════════════════════════════');
  console.log('🎉 Seed v2 concluído!\n');
  console.log(`📋 Chamados:      ${totals.chamados} total`);
  console.log(`📅 Eventos:       ${totals.eventos} total (para todos os usuários)`);
  console.log(`📁 Projetos:      ${totals.projetos} total / ${totals.tasks} tasks`);
  console.log(`💰 Itens Orc.:    ${totals.itensOrc} total (ciclo 2026)`);
  console.log(`✅ Aprovações:    ${totals.aprovacoes} workflow requests`);
  console.log(`🖥️  Ativos:        ${totals.ativos} total`);
  console.log('════════════════════════════════════════\n');
}

main()
  .catch(e => { console.error('❌ Erro:', e.message); process.exit(1); })
  .finally(() => prisma.$disconnect());
