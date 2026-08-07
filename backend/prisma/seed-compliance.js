/**
 * Carga inicial do módulo Compliance a partir da planilha do cliente (sgi.xlsx).
 *
 * Execução:
 *   node prisma/seed-compliance.js [organizationId]
 *
 * Sem argumento, usa a primeira organização do banco.
 *
 * IDEMPOTENTE: reexecutar não duplica nada. A chave de reconhecimento é
 * (categoria + nome), porque o código sequencial (OBR-0001) é gerado aqui e
 * mudaria a cada execução.
 *
 * ── O que veio da planilha e o que foi DERIVADO ───────────────────────────
 *
 * DA PLANILHA, sem alteração:
 *   tipo/descrição, número do documento, validade em anos, data de emissão,
 *   data de validade, prazo mínimo do órgão, e-mails e telefones dos
 *   responsáveis, e a marcação de "Renovação Automática" das três licenças
 *   ambientais vencidas.
 *
 * DERIVADO pelo sistema (a planilha calculava com fórmula ou não tinha):
 *   - prazo interno e prazo fatal: recalculados por `calcularPrazos`, com a
 *     mesma conta da planilha (validade − prazo do órgão − folga de 60).
 *   - `sigla`, `numeroDocumento`, `unidade` e `ativoIdentificador`: extraídos
 *     da coluna "Tipo de Licença", que misturava as quatro coisas num texto só.
 *   - `validadeMeses`: os "anos" da planilha × 12.
 *
 * NÃO INVENTADO — deixado em branco de propósito:
 *   órgão emissor (exceto onde o próprio nome do documento o declara: "Auto de
 *   Vistoria do CORPO DE BOMBEIROS"), custos, centro de custo e criticidade
 *   individual. A planilha não tem essas colunas, e preenchê-las por dedução
 *   entregaria dado plausível que ninguém conferiu.
 *
 * DEFEITOS DE ORIGEM preservados, com aviso no console:
 *   - BSO 5 e BSO 6 têm o mesmo número de CCB (264433/3529005/2023).
 *   - "Fábrica d ePlaca" (erro de digitação) foi corrigido para "Fábrica de Placa".
 *   - Vários itens têm "Validade (Anos)" que não bate com a diferença entre
 *     emissão e validade. A validade DIGITADA prevalece; a periodicidade fica
 *     como está, para a renovação sugerir a data e o usuário conferir.
 */

const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

/* ── Responsáveis (coluna K/L da planilha) ────────────────────────────────── */

const EQUIPE_AMBIENTAL = [
  { nome: "Wilson Santos",    email: "wilson.santos@triunfotransbrasiliana.com.br",    telefone: "(14) 99787-1403" },
  { nome: "Carlos Santos",    email: "carlos.santos@triunfotransbrasiliana.com.br",    telefone: "(14) 98979-8419" },
  { nome: "Rafael Ogeda",     email: "rafael.ogeda@triunfotransbrasiliana.com.br",     telefone: "(14) 99741-1545" },
  { nome: "Flavio Valdevino", email: "flavio.valdevino@triunfotransbrasiliana.com.br", telefone: "(14) 98148-4374" },
  { nome: "Nayra Dias",       email: "nayra.dias@triunfotransbrasiliana.com.br",       telefone: "(14) 99630-5628" },
];

const EQUIPE_SST = [
  { nome: "Wilson Santos", email: "wilson.santos@triunfotransbrasiliana.com.br", telefone: "(14) 99787-1403" },
  { nome: "Carlos Santos", email: "carlos.santos@triunfotransbrasiliana.com.br", telefone: "(14) 98979-8419" },
  { nome: "Lauro Santos",  email: "lauro.santos@triunfotransbrasiliana.com.br",  telefone: "(14) 99678-6898" },
  { nome: "Cesar Quini",   email: "cesar.quini@triunfotransbrasiliana.com.br",   telefone: "(14) 99878-1343" },
];

/* ── Categorias (as duas abas) ────────────────────────────────────────────── */

const CATEGORIAS = [
  {
    nome: "Meio Ambiente",
    descricao: "Licenças e autorizações ambientais",
    icone: "leaf",
    cor: "#16a34a",
    folgaInternaDias: 60,
    ordem: 1,
    // Campos que a especificação cita como exemplo desta categoria. Ficam
    // vazios: a planilha não os tinha, e preenchê-los seria inventar.
    campos: [
      { rotulo: "Número do Processo", tipo: "texto" },
      { rotulo: "Condicionantes",     tipo: "texto_longo", ajuda: "Condicionantes da licença e seus prazos" },
      { rotulo: "Lote / Obra",        tipo: "texto" },
    ],
  },
  {
    nome: "Segurança do Trabalho",
    descricao: "Laudos, programas e licenças de segurança e saúde ocupacional",
    icone: "hard-hat",
    cor: "#ea580c",
    folgaInternaDias: 60,
    ordem: 2,
    campos: [
      { rotulo: "Responsável Técnico", tipo: "texto" },
      { rotulo: "CREA",                tipo: "texto" },
      { rotulo: "ART",                 tipo: "texto" },
    ],
  },
];

/* ── Órgãos ───────────────────────────────────────────────────────────────── */

const ORGAOS = [
  { nome: "Corpo de Bombeiros", sigla: "CB" },
];

/* ── Obrigações ───────────────────────────────────────────────────────────── */

const d = (iso) => new Date(`${iso}T00:00:00.000Z`);

const OBRIGACOES = [
  /* ══ Meio Ambiente ══ */
  {
    categoria: "Meio Ambiente", sigla: "LO", nome: "Licença de Operação",
    numeroDocumento: "709/2008", anos: 4,
    emissao: "2008-07-31", validade: "2012-07-31", prazoMinimoDias: 120,
    renovacaoAutomatica: true, criticidade: "critica",
    observacoes: "Planilha de origem: Status \"Válida - Renovação Automática\", "
      + "Observação \"Pendente de Análise - Renovação Automática\". "
      + "Registre o número e a data do protocolo para o sistema reconhecer a prorrogação.",
  },
  {
    categoria: "Meio Ambiente", sigla: "ASV", nome: "Autorização de Supressão Vegetal",
    numeroDocumento: "970/2014", anos: 2,
    emissao: "2018-03-29", validade: "2020-03-29", prazoMinimoDias: 120,
    renovacaoAutomatica: true, criticidade: "critica",
    observacoes: "Planilha de origem: \"Válida - Renovação Automática\". "
      + "Registre o protocolo para o sistema reconhecer a prorrogação.",
  },
  {
    categoria: "Meio Ambiente", sigla: "LI", nome: "Licença de Instalação",
    numeroDocumento: "1212/2018", anos: 4,
    emissao: "2018-04-25", validade: "2022-04-25", prazoMinimoDias: 120,
    renovacaoAutomatica: true, criticidade: "critica",
    observacoes: "Planilha de origem: \"Válida - Renovação Automática\". "
      + "Registre o protocolo para o sistema reconhecer a prorrogação.",
  },
  {
    categoria: "Meio Ambiente", sigla: "ABIO",
    nome: "Autorização de Captura, Coleta e Transporte de Material Biológico",
    numeroDocumento: "960/2018 (Retificada)", anos: 4,
    emissao: "2022-08-29", validade: "2026-08-29", prazoMinimoDias: 60,
    criticidade: "critica",
    observacoes: "Planilha de origem: \"Pendente de Análise - Sem Renovação Automática "
      + "(Fora do Prazo)\" — o prazo fatal para protocolar já havia passado.",
  },
  {
    categoria: "Meio Ambiente", sigla: "LI", nome: "Licença de Instalação",
    numeroDocumento: "1514/2025", anos: 4,
    emissao: "2025-04-25", validade: "2029-04-24", prazoMinimoDias: 120,
    lote: "Lote 1", criticidade: "alta",
  },
  {
    categoria: "Meio Ambiente", sigla: "ASV", nome: "Autorização de Supressão Vegetal",
    numeroDocumento: "1035.8.2025.63314", anos: 4,
    emissao: "2025-06-23", validade: "2029-06-23", prazoMinimoDias: 120,
    lote: "Lote 1", criticidade: "alta",
  },
  {
    categoria: "Meio Ambiente", sigla: "LI", nome: "Licença de Instalação",
    numeroDocumento: "1510/2025", anos: 4,
    emissao: "2025-03-12", validade: "2029-03-11", prazoMinimoDias: 120,
    lote: "Lote 3", criticidade: "alta",
  },
  {
    categoria: "Meio Ambiente", sigla: "ASV", nome: "Autorização de Supressão Vegetal",
    numeroDocumento: "1035.8.2025.64468", anos: 4,
    emissao: "2025-06-23", validade: "2029-06-23", prazoMinimoDias: 120,
    lote: "Lote 3", criticidade: "alta",
  },
  {
    categoria: "Meio Ambiente", sigla: "CADRI",
    nome: "Certificado de Movimentação de Resíduos de Interesse Ambiental",
    anos: 5, emissao: "2021-12-22", validade: "2026-12-22", prazoMinimoDias: 0,
    criticidade: "alta",
  },

  // Licenças de porte e uso — uma por EQUIPAMENTO. Na planilha o número de
  // série estava dentro do nome; aqui vira `ativoIdentificador`.
  ...[
    ["Motosserra", "368956544", "2025-01-06", "2027-01-06"],
    ["Motosserra", "369008008", "2025-01-06", "2027-01-06"],
    ["Motosserra", "368246274", "2025-01-06", "2027-01-06"],
    ["Motopoda",   "505387919", "2025-01-06", "2027-01-06"],
    ["Motopoda",   "504782876", "2025-01-06", "2027-01-06"],
    ["Motopoda",   "504208934", "2025-01-06", "2027-01-06"],
    ["Motopoda",   "542840049", "2024-12-02", "2026-12-02"],
    ["Motopoda",   "542840064", "2024-12-02", "2026-12-02"],
    ["Motopoda",   "542841730", "2024-12-02", "2026-12-02"],
  ].map(([equipamento, serie, emissao, validade]) => ({
    categoria: "Meio Ambiente", sigla: "LPU",
    nome: `Licença de Porte e Uso de ${equipamento}`,
    equipamento: `Nº Série ${serie}`,
    anos: 2, emissao, validade, prazoMinimoDias: 0,
    criticidade: "media",
  })),

  /* ══ Segurança do Trabalho ══ */
  {
    categoria: "Segurança do Trabalho", sigla: "PGR",
    nome: "Programa de Gerenciamento de Riscos",
    anos: 3, emissao: "2025-09-30", validade: "2028-09-30", prazoMinimoDias: 0,
    criticidade: "alta",
  },
  {
    categoria: "Segurança do Trabalho", sigla: "LTCAT",
    nome: "Laudo Técnico das Condições Ambientais do Trabalho",
    anos: 3, emissao: "2025-08-24", validade: "2028-08-24", prazoMinimoDias: 0,
    criticidade: "alta",
  },
  {
    // Atenção: "LI" aqui é Laudo de Insalubridade, e em Meio Ambiente é Licença
    // de Instalação. A mesma sigla com dois significados foi um dos motivos de
    // a sigla não ser um cadastro global.
    categoria: "Segurança do Trabalho", sigla: "LI", nome: "Laudo de Insalubridade",
    anos: 3, emissao: "2025-08-24", validade: "2028-08-24", prazoMinimoDias: 0,
    criticidade: "alta",
  },
  {
    categoria: "Segurança do Trabalho", sigla: "LP", nome: "Laudo de Periculosidade",
    anos: 3, emissao: "2025-08-24", validade: "2028-08-24", prazoMinimoDias: 0,
    criticidade: "alta",
  },
  {
    categoria: "Segurança do Trabalho", sigla: "AET", nome: "Análise Ergonômica do Trabalho",
    anos: 3, emissao: "2024-04-30", validade: "2027-04-30", prazoMinimoDias: 0,
    criticidade: "media",
  },

  // AVCB / CCB — um por instalação. A planilha guardava a instalação entre
  // parênteses no nome; aqui vira `unidade`, que é o que permite responder
  // "quais licenças são desta base".
  ...[
    ["AVCB", "Auto de Vistoria do Corpo de Bombeiros", "Sede Administrativa",  "102322/3527108/2023", "2023-08-17", "2026-08-17"],
    ["CCB",  "Certificado de Licenciamento do Corpo de Bombeiros", "P1",       "217068/3534005/2023", "2023-10-30", "2026-10-30"],
    ["CCB",  "Certificado de Licenciamento do Corpo de Bombeiros", "P2",       "228509/3525706/2023", "2023-11-09", "2026-11-09"],
    ["AVCB", "Auto de Vistoria do Corpo de Bombeiros", "P3",                   "004664/3527108/2014", "2023-12-26", "2026-12-23"],
    ["CCB",  "Certificado de Licenciamento do Corpo de Bombeiros", "P4",       "228515/3556602/2023", "2023-11-17", "2026-11-16"],
    ["CCB",  "Certificado de Licenciamento do Corpo de Bombeiros", "BSO 1",    "264430/3533007/2023", "2023-12-22", "2027-01-06"],
    ["CCB",  "Certificado de Licenciamento do Corpo de Bombeiros", "BSO 2",    "303601/3549805/2025", "2025-02-24", "2028-02-24"],
    ["CCB",  "Certificado de Licenciamento do Corpo de Bombeiros", "BSO 3",    "264432/3555356/2023", "2023-12-22", "2026-12-22"],
    ["CCB",  "Certificado de Licenciamento do Corpo de Bombeiros", "BSO 4",    "212208/3517208/2023", "2023-10-19", "2026-10-19"],
    ["CCB",  "Certificado de Licenciamento do Corpo de Bombeiros", "BSO 5",    "264433/3529005/2023", "2023-12-22", "2026-12-22"],
    ["CCB",  "Certificado de Licenciamento do Corpo de Bombeiros", "BSO 6",    "264433/3529005/2023", "2023-12-22", "2026-12-22"],
    ["CCB",  "Certificado de Licenciamento do Corpo de Bombeiros", "BSO 7",    "264435/3543204/2023", "2023-12-22", "2026-12-22"],
    ["CCB",  "Certificado de Licenciamento do Corpo de Bombeiros", "Fábrica de Placa", "177600/3517208/2023", "2023-09-05", "2026-09-05"],
  ].map(([sigla, nome, unidade, numero, emissao, validade]) => ({
    categoria: "Segurança do Trabalho", sigla, nome, unidade,
    numeroDocumento: numero, orgao: "Corpo de Bombeiros",
    anos: 3, emissao, validade, prazoMinimoDias: 0,
    criticidade: "alta",
  })),
];

/* ── Régua de alertas padrão ──────────────────────────────────────────────── */

const TEMPLATE_PADRAO = {
  nome: "Aviso de vencimento",
  canal: "email",
  assunto: "[{{Codigo}}] {{NomeObrigacao}} — {{Situacao}}",
  corpo:
    "Olá {{Responsavel}},\n\n" +
    "A obrigação {{NomeObrigacao}} ({{Sigla}} {{Numero}}) vence em {{Dias}} dias.\n\n" +
    "Validade: {{DataValidade}}\n" +
    "Prazo interno para iniciar a renovação: {{PrazoInterno}}\n" +
    "Prazo fatal para protocolar: {{PrazoFatal}}\n" +
    "Unidade: {{Unidade}}\n\n" +
    "Abrir no Orkiestri: {{Link}}",
};

/**
 * Régua da organização.
 *
 * Base = prazo INTERNO, não a validade. Foi o erro que a planilha induzia:
 * avisar quando a licença vence é avisar depois de já ter perdido a janela de
 * 120 dias que o órgão exige para protocolar a renovação.
 */
const REGRA_PADRAO = {
  nome: "Régua padrão da organização",
  baseData: "prazo_interno",
  diasAntes: [90, 60, 30, 15, 7, 3, 1, 0],
  diasDepois: [1, 3, 7, 15, 30],
  canais: ["interno", "email"],
  destinatarios: ["responsavel", "gestor"],
};

/** Escalonamento do exemplo da especificação: 3 → 7 → 15 dias. */
const ESCALONAMENTOS = [
  { aposDias: 3,  alvo: "gestor",        ordem: 0 },
  { aposDias: 7,  alvo: "administrador", ordem: 1 },
  { aposDias: 15, alvo: "administrador", ordem: 2 },
];

/* ── Cálculo (mesma regra do domínio, em JS) ──────────────────────────────── */

const FOLGA_PADRAO = 60;

function subtrairDias(base, dias) {
  const r = new Date(base.getTime());
  r.setUTCDate(r.getUTCDate() - dias);
  return r;
}

function calcularPrazos(validade, prazoMinimoDias, folgaDias) {
  if (!validade) return { prazoFatalEm: null, prazoInternoEm: null };
  const fatal = subtrairDias(validade, Math.max(0, prazoMinimoDias || 0));
  const interno = subtrairDias(fatal, folgaDias ?? FOLGA_PADRAO);
  return { prazoFatalEm: fatal, prazoInternoEm: interno };
}

const codigoDe = (n) => `OBR-${String(n).padStart(4, "0")}`;

/* ── Execução ─────────────────────────────────────────────────────────────── */

async function main() {
  const orgArg = process.argv[2];

  const org = orgArg
    ? await prisma.organization.findUnique({ where: { id: orgArg } })
    : await prisma.organization.findFirst({ orderBy: { criadoEm: "asc" } });

  if (!org) {
    console.error("Nenhuma organização encontrada. Passe o id: node prisma/seed-compliance.js <organizationId>");
    process.exit(1);
  }
  console.log(`Organização: ${org.nome ?? org.id} (${org.id})\n`);

  /* Categorias e campos personalizados */
  const categoriaPorNome = new Map();
  for (const c of CATEGORIAS) {
    let categoria = await prisma.complianceCategoria.findFirst({
      where: { organizationId: org.id, nome: c.nome },
    });

    if (!categoria) {
      categoria = await prisma.complianceCategoria.create({
        data: {
          organizationId: org.id,
          nome: c.nome, descricao: c.descricao, icone: c.icone, cor: c.cor,
          folgaInternaDias: c.folgaInternaDias, ordem: c.ordem,
        },
      });
      console.log(`  categoria criada: ${c.nome}`);
    } else {
      console.log(`  categoria já existia: ${c.nome}`);
    }
    categoriaPorNome.set(c.nome, categoria);

    for (const [i, campo] of c.campos.entries()) {
      const chave = campo.rotulo
        .normalize("NFD").replace(/[̀-ͯ]/g, "")
        .toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "");
      const existe = await prisma.complianceCampoDefinicao.findFirst({
        where: { categoriaId: categoria.id, chave },
      });
      if (existe) continue;
      await prisma.complianceCampoDefinicao.create({
        data: {
          organizationId: org.id, categoriaId: categoria.id,
          chave, rotulo: campo.rotulo, tipo: campo.tipo,
          ajuda: campo.ajuda ?? null, ordem: i,
        },
      });
      console.log(`    campo: ${campo.rotulo}`);
    }
  }

  /* Órgãos */
  const orgaoPorNome = new Map();
  for (const o of ORGAOS) {
    let orgao = await prisma.complianceOrgao.findFirst({
      where: { organizationId: org.id, nome: o.nome },
    });
    if (!orgao) {
      orgao = await prisma.complianceOrgao.create({
        data: { organizationId: org.id, nome: o.nome, sigla: o.sigla },
      });
      console.log(`  órgão criado: ${o.nome}`);
    }
    orgaoPorNome.set(o.nome, orgao);
  }

  /* Template, régua e escalonamento */
  let template = await prisma.complianceTemplate.findFirst({
    where: { organizationId: org.id, nome: TEMPLATE_PADRAO.nome },
  });
  if (!template) {
    template = await prisma.complianceTemplate.create({
      data: { organizationId: org.id, ...TEMPLATE_PADRAO },
    });
    console.log(`  template criado: ${TEMPLATE_PADRAO.nome}`);
  }

  const regraExistente = await prisma.complianceAlertaRegra.findFirst({
    where: { organizationId: org.id, categoriaId: null, obrigacaoId: null },
  });
  if (!regraExistente) {
    await prisma.complianceAlertaRegra.create({
      data: { organizationId: org.id, ...REGRA_PADRAO, templateId: template.id },
    });
    console.log(`  régua de alertas criada (base: prazo interno)`);
  }

  for (const e of ESCALONAMENTOS) {
    const existe = await prisma.complianceEscalonamento.findFirst({
      where: { organizationId: org.id, categoriaId: null, aposDias: e.aposDias },
    });
    if (existe) continue;
    await prisma.complianceEscalonamento.create({
      data: { organizationId: org.id, categoriaId: null, ...e },
    });
    console.log(`  escalonamento: após ${e.aposDias} dias → ${e.alvo}`);
  }

  /* Usuários existentes, para amarrar o responsável ao login quando houver */
  const emails = [...new Set([...EQUIPE_AMBIENTAL, ...EQUIPE_SST].map(p => p.email))];
  const usuarios = await prisma.user.findMany({
    where: { organizationId: org.id, email: { in: emails } },
    select: { id: true, email: true },
  });
  const userPorEmail = new Map(usuarios.map(u => [u.email.toLowerCase(), u.id]));
  console.log(`\n  ${usuarios.length} de ${emails.length} responsáveis têm login no sistema. ` +
    `Os demais recebem aviso por e-mail/WhatsApp.\n`);

  /* Obrigações */
  const jaExistem = await prisma.complianceObrigacao.count({ where: { organizationId: org.id } });
  let sequencial = jaExistem;
  let criadas = 0;
  let puladas = 0;

  for (const item of OBRIGACOES) {
    const categoria = categoriaPorNome.get(item.categoria);

    // Reconhecimento por (categoria + nome + número + equipamento + unidade):
    // o nome sozinho repete (nove LPU de motopoda), e o número repete de fato
    // entre BSO 5 e BSO 6 — defeito da planilha que preservamos.
    const existente = await prisma.complianceObrigacao.findFirst({
      where: {
        organizationId: org.id,
        categoriaId: categoria.id,
        nome: item.nome,
        numeroDocumento: item.numeroDocumento ?? null,
        ativoIdentificador: item.equipamento ?? null,
        unidade: item.unidade ?? null,
      },
      select: { id: true, codigo: true },
    });
    if (existente) {
      puladas++;
      continue;
    }

    const validade = d(item.validade);
    const { prazoFatalEm, prazoInternoEm } = calcularPrazos(
      validade, item.prazoMinimoDias, categoria.folgaInternaDias,
    );

    sequencial++;
    const equipe = item.categoria === "Meio Ambiente" ? EQUIPE_AMBIENTAL : EQUIPE_SST;

    const criada = await prisma.complianceObrigacao.create({
      data: {
        organizationId: org.id,
        codigo: codigoDe(sequencial),
        categoriaId: categoria.id,
        nome: item.nome,
        sigla: item.sigla ?? null,
        numeroDocumento: item.numeroDocumento ?? null,
        orgaoId: item.orgao ? orgaoPorNome.get(item.orgao)?.id ?? null : null,
        unidade: item.unidade ?? null,
        ativoIdentificador: item.equipamento ?? null,
        criticidade: item.criticidade ?? "media",
        status: "ativa",
        dataEmissao: d(item.emissao),
        dataValidade: validade,
        validadeMeses: item.anos ? item.anos * 12 : null,
        prazoMinimoDias: item.prazoMinimoDias ?? 0,
        prazoFatalEm,
        prazoInternoEm,
        renovacaoAutomatica: !!item.renovacaoAutomatica,
        // A planilha marcava "Renovação Automática" mas NÃO registrava o
        // protocolo. Sem protocolo não há prorrogação — e é isso que faz essas
        // três licenças aparecerem como vencidas no painel, que é a verdade.
        prorrogacaoVigente: false,
        observacoes: item.observacoes ?? null,
        versaoAtual: 1,
        responsaveis: {
          create: equipe.map((p, i) => ({
            organizationId: org.id,
            papel: i === 0 ? "principal" : "equipe",
            userId: userPorEmail.get(p.email.toLowerCase()) ?? null,
            nome: p.nome,
            email: p.email,
            telefone: p.telefone,
            notificar: true,
          })),
        },
      },
    });

    // Lote/obra vai para o campo personalizado da categoria ambiental.
    if (item.lote) {
      const campo = await prisma.complianceCampoDefinicao.findFirst({
        where: { categoriaId: categoria.id, chave: "lote_obra" },
      });
      if (campo) {
        await prisma.complianceCampoValor.create({
          data: {
            organizationId: org.id, obrigacaoId: criada.id,
            campoId: campo.id, valorTexto: item.lote,
          },
        });
      }
    }

    await prisma.complianceVersao.create({
      data: {
        organizationId: org.id, obrigacaoId: criada.id, versao: 1,
        numeroDocumento: criada.numeroDocumento,
        dataEmissao: criada.dataEmissao,
        dataValidade: criada.dataValidade,
        prazoMinimoDias: criada.prazoMinimoDias,
        prazoFatalEm, prazoInternoEm,
        observacao: "Versão inicial — carga da planilha sgi.xlsx.",
        snapshot: {},
      },
    });

    await prisma.complianceHistorico.create({
      data: {
        organizationId: org.id, obrigacaoId: criada.id,
        acao: "criou", origem: "sistema",
        descricao: `Importada da planilha sgi.xlsx (aba "${item.categoria}").`,
      },
    });

    criadas++;
  }

  console.log(`\n  ${criadas} obrigações criadas, ${puladas} já existiam.\n`);

  /* Relatório do que precisa de conferência humana */
  console.log("── Pontos que exigem conferência ──────────────────────────────");
  console.log("  1. BSO 5 e BSO 6 foram importados com o MESMO número de CCB");
  console.log("     (264433/3529005/2023). O defeito é da planilha e foi preservado.");
  console.log("  2. Três licenças ambientais (LO 709/2008, ASV 970/2014, LI 1212/2018)");
  console.log("     estão marcadas como de renovação automática mas SEM protocolo —");
  console.log("     e por isso aparecem como VENCIDAS. Registre o número e a data do");
  console.log("     protocolo em cada uma para que o sistema reconheça a prorrogação.");
  console.log("  3. Órgão emissor só foi preenchido onde o nome do documento o declara");
  console.log("     (Corpo de Bombeiros). Os demais estão em branco de propósito.");
  console.log("  4. Custo, centro de custo e fornecedor não existem na planilha —");
  console.log("     ficaram vazios.");
  console.log("  5. \"Fábrica d ePlaca\" foi corrigido para \"Fábrica de Placa\".");
  console.log("  6. Vários itens têm \"Validade (Anos)\" que não bate com a diferença");
  console.log("     entre emissão e validade (ex.: BSO 1, 3 anos + 15 dias). A data");
  console.log("     DIGITADA prevaleceu; a periodicidade ficou como estava.");
  console.log("───────────────────────────────────────────────────────────────");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
