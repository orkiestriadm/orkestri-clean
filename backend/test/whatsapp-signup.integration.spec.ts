import "reflect-metadata";
import { PrismaClient } from "@prisma/client";
import { randomInt, randomUUID } from "crypto";
import { Logger } from "@nestjs/common";
import { CadastroWhatsappService } from "../src/modules/cadastro-whatsapp/cadastro-whatsapp.module";
import { WhatsappInicioService } from "../src/modules/cadastro-whatsapp/whatsapp-inicio.service";
import { WhatsappInboundService } from "../src/modules/agenda/whatsapp-inbound.module";

// This suite requires a NEW disposable local database. It never uses DATABASE_URL.
const url = process.env.SIGNUP_TEST_DATABASE_URL || "";
const parsed = url ? new URL(url) : null;
if (!parsed || parsed.hostname !== "127.0.0.1" || parsed.pathname !== "/codex_signup_audit" || !parsed.port) {
  throw new Error("SIGNUP_TEST_DATABASE_URL must point to the disposable loopback database codex_signup_audit");
}
const prisma = new PrismaClient({ datasources: { db: { url } } });
const runSeed = randomInt(1000000, 8000000), runId = randomUUID().slice(0, 8);
let sequence = 0;
function cpfTeste(seed: number) {
  let digits = String(seed).padStart(9, "0").split("").map(Number);
  for (const weight of [10, 11]) {
    const remainder = digits.reduce((n, digit, i) => n + digit * (weight - i), 0) % 11;
    digits.push(remainder < 2 ? 0 : 11 - remainder);
  }
  return digits.join("");
}
function conversa(lid = false) {
  const index = ++sequence;
  const phone = String(5511900000000 + runSeed + index), nome = `Pessoa de Teste ${runId} ${index}`;
  const email = `cadastro-${randomUUID()}@example.invalid`, cpf = cpfTeste(runSeed + index);
  const jid = lid ? `${800000000000000 + index}@lid` : `${phone}@s.whatsapp.net`;
  const messages: { texto: string; instancia: string }[] = [];
  let failWelcome = false;
  const wa: any = {
    sendMessage: jest.fn(async (_: string, texto: string, instancia: string) => {
      messages.push({ texto, instancia });
      return !(failWelcome && /Sua (conta|agenda) está pronta/.test(texto));
    }),
    sendToJid: jest.fn(async (_: string, texto: string, instancia: string) => {
      messages.push({ texto, instancia }); return true;
    }),
  };
  const inicio = new WhatsappInicioService(prisma as any, wa);
  const cadastro = new CadastroWhatsappService(prisma as any, wa, inicio);
  const inbound = new WhatsappInboundService(prisma as any, wa,
    { resolvePermissions: jest.fn(async () => ["*"]) } as any, {} as any, cadastro, inicio,
    {} as any, { obter: jest.fn(async () => "PESSOAL") } as any, {} as any,
    { tratar: jest.fn(async () => ({})) } as any, { tratar: jest.fn(async () => ({})) } as any);
  const send = (texto: string, id = randomUUID()) => inbound.processar({ instance: "fixture-isolada", data: {
    key: { id, remoteJid: jid, fromMe: false, ...(lid ? { remoteJidAlt: `${phone}@s.whatsapp.net` } : {}) },
    message: { conversation: texto },
  } });
  const row = () => prisma.cadastroWhatsapp.findFirst({ where: { whatsapp: phone }, orderBy: { criadoEm: "desc" } });
  const user = () => prisma.user.findFirst({ where: { email }, include: { organization: true, profile: true, userRoles: { include: { role: true } } } });
  const ateOrganizacao = async () => { await send("cadastro"); await send(nome); await send(cpf); await send(email); };
  const dados = async (organizacao = nome) => { await ateOrganizacao(); await send(organizacao); };
  const legado = async (etapa = "CONFIRMACAO", respostas: any = { email, empresa: "", usoPessoal: true }) =>
    prisma.cadastroWhatsapp.create({ data: { whatsapp: phone, nome, cpf, status: "EM_CONVERSA", etapa,
      respostas: JSON.stringify(respostas), expiraEm: new Date(Date.now() + 600000) } });
  return { phone, nome, email, cpf, jid, messages, wa, inicio, cadastro, send, row, user, dados, ateOrganizacao, legado,
    ultima: () => messages[messages.length - 1]?.texto || "", falharBoasVindas: (value: boolean) => { failWelcome = value; } };
}

beforeAll(async () => {
  Logger.overrideLogger(false);
  const db: any[] = await prisma.$queryRaw`SELECT current_database() AS name`;
  if (db[0].name !== "codex_signup_audit") throw new Error("Wrong database");
  process.env.APP_VAULT_KEY = "isolated-signup-integration-fixture-key";
});
afterAll(async () => { await prisma.$disconnect(); });

describe("Cadastro único pelo webhook e PostgreSQL reais, mensagens simuladas", () => {
  it("pede organização obrigatória, sem escolher versões do sistema nem pedir telefone", async () => {
    const h = conversa(); await h.ateOrganizacao();
    expect((await h.row())?.etapa).toBe("EMPRESA");
    expect(h.ultima()).toContain("nome completo");
    await h.send(h.nome);
    expect((await h.row())?.etapa).toBe("CONFIRMACAO");
    expect(h.ultima()).toContain("Confere");
    expect(h.messages.map(m => m.texto).join("\n")).not.toMatch(/só para mim|para uma empresa|qual.*telefone|informe.*celular/i);
  });
  it("cria uma única conta com o nome da pessoa, permissões e boas-vindas", async () => {
    const h = conversa(); await h.dados(); await h.send("1");
    expect((await h.row())?.status).toBe("CONCLUIDO");
    const user: any = await h.user();
    expect(user.organization.nome).toBe(h.nome);
    expect(user.profile.whatsapp).toBe(h.phone);
    expect(user.userRoles.some((r: any) => r.role.isMaster)).toBe(true);
    expect(user.trialExpiraEm).toBeInstanceOf(Date);
    expect(h.messages.some(m => /Sua (conta|agenda) está pronta/.test(m.texto))).toBe(true);
    expect(h.messages.some(m => m.texto.includes("não consegui concluir"))).toBe(false);
    const queue: any[] = await prisma.$queryRaw`SELECT estado FROM whatsapp_boas_vindas WHERE user_id=${user.id}`;
    expect(queue[0].estado).toBe("ACEITA");
  });
  it("aceita o convite inicial e segue o mesmo cadastro único", async () => {
    const h = conversa(); await h.send("Oi"); expect((await h.row())?.etapa).toBe("INICIO");
    await h.send("1"); await h.send(h.nome); await h.send(h.cpf); await h.send(h.email); await h.send(h.nome); await h.send("sim");
    expect((await h.row())?.status).toBe("CONCLUIDO");
  });
  it.each([true, false])("retoma confirmação antiga com empresa vazia (flag pessoal=%s)", async flag => {
    const h = conversa(); await h.legado("CONFIRMACAO", { email: h.email, empresa: "", ...(flag ? { usoPessoal: true } : {}) });
    await h.send("1");
    if (!flag) { expect((await h.row())?.etapa).toBe("EMPRESA"); await h.send(h.nome); await h.send("1"); }
    expect((await h.row())?.status).toBe("CONCLUIDO");
    expect((await h.user())?.organization.nome).toBe(h.nome);
  });
  it("preserva a organização já informada em uma confirmação antiga", async () => {
    const h = conversa(); await h.legado("CONFIRMACAO", { email: h.email, empresa: "Organizacao Fixture" });
    await h.send("1"); expect((await h.user())?.organization.nome).toBe("Organizacao Fixture");
  });
  it.each(["EMPRESA", "EMPRESA_NOME"])("conversa antiga na etapa %s exige nome da organização sem uma nova escolha", async etapa => {
    const h = conversa(); await h.legado(etapa, { email: h.email }); await h.send("1");
    expect(["EMPRESA", "EMPRESA_NOME"]).toContain((await h.row())?.etapa);
    expect(await h.user()).toBeNull();
    expect(h.ultima()).not.toMatch(/só para mim|para uma empresa|nome da empresa/i);
    await h.send(h.nome); await h.send("1"); expect((await h.user())?.organization.nome).toBe(h.nome);
  });
  it("corrige e-mail e retorna à confirmação sem pedir empresa", async () => {
    const h = conversa(); await h.dados(); await h.send("2");
    expect((await h.row())?.etapa).toBe("CORRIGIR_DADO");
    expect(h.ultima()).toContain("Nome da organização");
    await h.send("3"); await h.send(`novo-${h.email}`);
    expect((await h.row())?.etapa).toBe("CONFIRMACAO");
    expect(JSON.parse((await h.row())!.respostas).email).toBe(`novo-${h.email}`);
  });
  it("voltar e manter preservam os dados e não reintroduzem a escolha removida", async () => {
    const h = conversa(); await h.dados(); await h.send("voltar");
    expect((await h.row())?.etapa).toBe("EMPRESA");
    await h.send("manter"); expect((await h.row())?.etapa).toBe("CONFIRMACAO");
    await h.send("1"); expect((await h.row())?.status).toBe("CONCLUIDO");
  });
  it("CPF e e-mail inválidos não avançam nem criam conta parcial", async () => {
    const h = conversa(); await h.send("cadastro"); await h.send(h.nome); await h.send("11111111111");
    expect((await h.row())?.etapa).toBe("CPF"); await h.send(h.cpf); await h.send("email-invalido");
    expect((await h.row())?.etapa).toBe("EMAIL"); expect(await h.user()).toBeNull();
    await h.send(h.email); expect((await h.row())?.etapa).toBe("EMPRESA");
  });
  it("cancelamento não cria usuário ou organização", async () => {
    const h = conversa(); await h.dados(); await h.send("cancelar");
    expect((await h.row())?.status).toBe("CANCELADO"); expect(await h.user()).toBeNull();
    expect(await prisma.organization.count({ where: { nome: h.nome } })).toBe(0);
  });
  it("um webhook repetido não duplica a conversa", async () => {
    const h = conversa(), id = randomUUID(); await h.send("cadastro", id); await h.send("cadastro", id);
    expect(await prisma.cadastroWhatsapp.count({ where: { whatsapp: h.phone } })).toBe(1);
    expect(h.messages).toHaveLength(1);
  });
  it("confirmações concorrentes criam apenas uma conta e uma fila", async () => {
    const h = conversa(); const row = await h.legado();
    await Promise.all([h.cadastro.tratarResposta(row, "1", "fixture-isolada"), h.cadastro.tratarResposta(row, "1", "fixture-isolada")]);
    expect(await prisma.user.count({ where: { email: h.email } })).toBe(1);
    const user = await h.user();
    const queue: any[] = await prisma.$queryRaw`SELECT user_id FROM whatsapp_boas_vindas WHERE user_id=${user!.id}`;
    expect(queue).toHaveLength(1);
  });
  it("falha dentro da transação reverte tudo e permite tentar novamente", async () => {
    const h = conversa(); await h.legado();
    const fail = jest.spyOn(h.inicio, "enfileirar").mockImplementationOnce(async (tx: any) => {
      await tx.$executeRawUnsafe('INSERT INTO fixture_table_that_does_not_exist VALUES (1)');
    });
    await h.send("1"); expect((await h.row())?.etapa).toBe("CONFIRMACAO");
    expect(await h.user()).toBeNull(); expect(await prisma.organization.count({ where: { nome: h.nome } })).toBe(0);
    expect(h.ultima()).toContain("Seus dados foram preservados"); fail.mockRestore();
    await h.send("1"); expect((await h.row())?.status).toBe("CONCLUIDO");
    expect(await prisma.user.count({ where: { email: h.email } })).toBe(1);
  });
  it("falha ao enviar boas-vindas mantém a conta pronta e permite reentregar", async () => {
    const h = conversa(); await h.legado(); h.falharBoasVindas(true); await h.send("1");
    expect((await h.row())?.status).toBe("CONCLUIDO"); const user = await h.user();
    const before: any[] = await prisma.$queryRaw`SELECT estado FROM whatsapp_boas_vindas WHERE user_id=${user!.id}`;
    expect(before[0].estado).toBe("PENDENTE"); h.falharBoasVindas(false);
    await prisma.$executeRaw`UPDATE whatsapp_boas_vindas SET proxima_tentativa=CURRENT_TIMESTAMP WHERE user_id=${user!.id}`;
    await h.inicio.entregar(user!.id);
    const after: any[] = await prisma.$queryRaw`SELECT estado FROM whatsapp_boas_vindas WHERE user_id=${user!.id}`;
    expect(after[0].estado).toBe("ACEITA");
  });
  it("conclui também quando o WhatsApp usa LID com telefone alternativo", async () => {
    const h = conversa(true); await h.dados(); await h.send("1");
    expect((await h.row())?.status).toBe("CONCLUIDO");
    expect((await h.user())?.profile?.whatsappLid).toBe(h.jid.split("@")[0]);
  });
  it.each([['1', 'Nome Corrigido Fixture'], ['2', cpfTeste(runSeed + 100)]])('corrige o campo %s e conserva o restante do cadastro', async (opcao, valor) => {
    const h = conversa(); await h.dados(); await h.send('2'); await h.send(opcao); await h.send(valor);
    const row = await h.row(); expect(row?.etapa).toBe('CONFIRMACAO');
    expect(JSON.parse(row!.respostas).email).toBe(h.email);
    expect(opcao === '1' ? row?.nome : row?.cpf).toBe(valor);
  });
  it('uma conversa expirada não confirma a conta e pode ser reiniciada', async () => {
    const h = conversa(), row = await h.legado();
    await prisma.cadastroWhatsapp.update({ where: { id: row.id }, data: { expiraEm: new Date(Date.now() - 60000) } });
    await h.send('1'); expect((await h.row())?.status).toBe('EXPIRADO'); expect(await h.user()).toBeNull();
    await h.send('cadastro'); expect((await h.row())?.etapa).toBe('NOME');
  });
  it.each(['nome', 'cpf', 'email'])('não cria conta com dado obrigatório ausente: %s', async campo => {
    const h = conversa(), row = await h.legado();
    await prisma.cadastroWhatsapp.update({ where: { id: row.id }, data: campo === 'email' ? { respostas: '{}' } : { [campo]: null } });
    await h.send('1'); expect((await h.row())?.status).toBe('EM_CONVERSA'); expect(await h.user()).toBeNull();
    expect(await prisma.organization.count({ where: { nome: h.nome } })).toBe(0);
  });

  it('grava o nome da empresa na organização, sem mudar o tipo de sistema', async () => {
    const h = conversa(); await h.dados('Empresa Fixture Completa'); await h.send('1');
    const user: any = await h.user(); expect(user.organization.nome).toBe('Empresa Fixture Completa');
    expect(user.userRoles.some((r: any) => r.role.isMaster)).toBe(true);
  });
  it('nome de organização vazio ou uma opção numérica não avança', async () => {
    const h = conversa(); await h.ateOrganizacao();
    for (const texto of [' ', '1', '2']) { await h.send(texto); expect((await h.row())?.etapa).toBe('EMPRESA'); }
    expect(await h.user()).toBeNull(); await h.send(h.nome); await h.send('1');
    expect((await h.user())?.organization.nome).toBe(h.nome);
  });
  it('corrige o nome da organização e apresenta o resumo antes de criar', async () => {
    const h = conversa(); await h.dados(); await h.send('2'); await h.send('4'); await h.send('Organizacao Corrigida Fixture');
    expect((await h.row())?.etapa).toBe('CONFIRMACAO'); expect(await h.user()).toBeNull();
    expect(h.ultima()).toContain('Organizacao Corrigida Fixture'); await h.send('1');
    expect((await h.user())?.organization.nome).toBe('Organizacao Corrigida Fixture');
  });

});
