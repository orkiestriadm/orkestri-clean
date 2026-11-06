/**
 * O INSERT da conta nova leva o prazo do teste.
 *
 * `porta-unica.spec.ts` prova a regra (conta com prazo entra no ciclo). Este
 * aqui prova a fiação: que o cadastro pela Aurélia de fato grava `isTrial` e
 * `trialExpiraEm` na conta. Sem este teste, apagar o trecho do `create` não
 * quebraria nada — e a falha é silenciosa: ninguém recebe erro, as pessoas só
 * param de ser cobradas.
 */
jest.mock("nodemailer", () => ({}), { virtual: true });
jest.mock("../auth/auth.service", () => ({
  semearPermissoes: jest.fn(async () => ({})),
  semearPapeisDaOrganizacao: jest.fn(async () => ({ id: "papel-master", isMaster: true })),
}));
import "reflect-metadata";
import { CadastroWhatsappService } from "./cadastro-whatsapp.module";
import * as atomico from "./cadastro-atomico";
import { DIAS_DE_TESTE, PRODUTO_PADRAO } from "../auth/trial-renovacao";

const D = 24 * 60 * 60 * 1000;

/** Roda o `concluir` de verdade e devolve o que foi mandado para `user.create`. */
async function contaCriada(respostas: any = { email: "pessoa@exemplo.com", empresa: "" }) {
  let criada: any = null;

  const tx: any = {
    organization: { findUnique: jest.fn(async () => null), create: jest.fn(async ({ data }: any) => ({ id: "org-1", ...data })) },
    user: { create: jest.fn(async ({ data }: any) => { criada = data; return { id: data.id, ...data }; }) },
    role: { findFirst: jest.fn(async () => null) },
    userRole: { create: jest.fn(async () => ({})) },
    userProfile: { create: jest.fn(async () => ({})) },
    prospectLead: { updateMany: jest.fn(async () => ({})) },
    cadastroWhatsapp: { update: jest.fn(async () => ({})) },
  };

  const cadastro = { id: "cad-1", nome: "Fernando Bambui", cpf: "12345678901", whatsapp: "5514999990000" };

  jest.spyOn(atomico, "concluirCadastroAtomico").mockImplementation(async (_p: any, _id: any, provisionar: any) => {
    const conta = await provisionar(tx, cadastro, respostas);
    return { status: "criado", cadastro, conta } as any;
  });

  const svc: any = Object.create(CadastroWhatsappService.prototype);
  Object.assign(svc, {
    prisma: {},
    wa: { sendMessage: jest.fn(async () => true) },
    inicio: {
      enfileirar: jest.fn(async () => {}),
      enviarAcesso: jest.fn(async () => true),
      entregar: jest.fn(async () => {}),
    },
    logger: { log: jest.fn(), warn: jest.fn(), error: jest.fn() },
    responder: jest.fn(async () => true),
  });

  await svc.concluir(cadastro, respostas, "orkestri-default");
  return criada;
}

describe("a conta criada pela Aurélia", () => {
  afterEach(() => jest.restoreAllMocks());

  it("nasce com o teste correndo, e não de graça para sempre", async () => {
    const antes = Date.now();
    const conta = await contaCriada();
    const depois = Date.now();

    expect(conta).not.toBeNull();
    expect(conta.isTrial).toBe(true);
    expect(conta.trialModulo).toBe(PRODUTO_PADRAO);

    const fim = new Date(conta.trialExpiraEm).getTime();
    expect(fim).toBeGreaterThanOrEqual(antes + DIAS_DE_TESTE * D);
    expect(fim).toBeLessThanOrEqual(depois + DIAS_DE_TESTE * D);
  });

  it("continua entrando ativa e sem senha provisória para trocar", async () => {
    const conta = await contaCriada();
    expect(conta.ativo).toBe(true);
    expect(conta.primeiroAcesso).toBe(false);
  });
});
