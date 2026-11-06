jest.mock("nodemailer", () => ({}), { virtual: true });
import "reflect-metadata";
import { UnauthorizedException } from "@nestjs/common";
import { AuthService } from "./auth.service";

/**
 * Recuperação de senha pelo WhatsApp: ACHAR a conta.
 *
 * A tela pede "DDD + número" e manda 11 dígitos. O cadastro feito pela Aurélia
 * grava com o DDI, e as telas de perfil gravaram por anos o que a pessoa
 * digitou, máscara inclusive. Enquanto a busca era `where: { whatsapp }`, nada
 * disso batia: toda conta nascida no WhatsApp recebia "não encontramos este
 * número cadastrado" com o número corretamente gravado no perfil.
 *
 * Estes testes olham o que o usuário vive — digitou o número do próprio celular
 * e recebeu (ou não) o código — e não o formato em que ele está no banco.
 */
const TEL_DIGITADO = "14991661688"; // como sai da tela: sem o 55
const USER = {
  id: "conta-1",
  ativo: true,
  bloqueado: false,
  organizationId: "org-1",
};

function montar(perfis: any[], user: any = USER) {
  const prisma: any = {
    userProfile: { findMany: jest.fn(async () => perfis) },
    user: { findUnique: jest.fn(async () => user) },
    passwordResetOtp: {
      updateMany: jest.fn(async () => ({})),
      create: jest.fn(async ({ data }: any) => data),
      findFirst: jest.fn(async () => ({
        id: "otp-1",
        otpCode: "123456",
        otpExpiresAt: new Date(Date.now() + 60_000),
        otpAttempts: 0,
        used: false,
      })),
      update: jest.fn(async () => ({})),
    },
  };
  const wa: any = { sendOtpForOrg: jest.fn(async () => true) };
  const jwt: any = { sign: jest.fn(() => "token-de-reset") };
  const config: any = { get: jest.fn(() => "segredo") };
  const service = new AuthService(
    prisma,
    jwt,
    config,
    {} as any,
    wa,
    {} as any,
  );
  return { service, prisma, wa };
}

const perfil = (whatsapp: string | null, userId = USER.id) => ({ userId, whatsapp });

describe("Recuperação por WhatsApp acha a conta em qualquer formato gravado", () => {
  // Os três formatos que convivem na coluna hoje, para o MESMO telefone.
  for (const guardado of ["5514991661688", "14991661688", "(14) 99166-1688"]) {
    it(`encontra a conta com o número guardado como ${guardado}`, async () => {
      const { service, wa } = montar([perfil(guardado)]);
      const r: any = await service.sendPasswordOtp(TEL_DIGITADO);
      expect(r.semCadastro).toBe(false);
      // Entrega sempre no formato que o Evolution aceita, não no que veio da tela.
      expect(wa.sendOtpForOrg).toHaveBeenCalledWith(
        "org-1",
        "5514991661688",
        expect.stringMatching(/^\d{6}$/),
      );
    });
  }

  it("aceita o nono dígito que o cadastro antigo não tinha", async () => {
    const { service } = montar([perfil("551491661688")]);
    const r: any = await service.sendPasswordOtp(TEL_DIGITADO);
    expect(r.semCadastro).toBe(false);
  });

  it("segue dizendo que não há conta para um número de outra pessoa", async () => {
    const { service, wa } = montar([perfil("5514991661688")]);
    const r: any = await service.sendPasswordOtp("11988887777");
    expect(r.semCadastro).toBe(true);
    expect(wa.sendOtpForOrg).not.toHaveBeenCalled();
  });

  it("não manda código para quem digitou algo que não é telefone", async () => {
    const { service, wa } = montar([perfil("5514991661688")]);
    expect((await service.sendPasswordOtp("1234")).semCadastro).toBe(true);
    expect(wa.sendOtpForOrg).not.toHaveBeenCalled();
  });

  /**
   * Dois perfis com o mesmo número é dado sujo. Escolher um no acaso mandaria o
   * código de recuperação para a conta errada — quem recebe o código entra.
   */
  it("não escolhe entre duas contas com o mesmo número", async () => {
    const { service, wa } = montar([
      perfil("5514991661688"),
      perfil("14991661688", "conta-2"),
    ]);
    await expect(service.sendPasswordOtp(TEL_DIGITADO)).rejects.toThrow(
      UnauthorizedException,
    );
    expect(wa.sendOtpForOrg).not.toHaveBeenCalled();
  });

  it("confere o código com a mesma régua do envio", async () => {
    const { service } = montar([perfil("5514991661688")]);
    const r: any = await service.verifyPasswordOtp(TEL_DIGITADO, "123456");
    expect(r.resetToken).toBe("token-de-reset");
  });

  it("recusa o código quando o número não leva a conta nenhuma", async () => {
    const { service } = montar([perfil("5514991661688")]);
    await expect(
      service.verifyPasswordOtp("11988887777", "123456"),
    ).rejects.toThrow(UnauthorizedException);
  });

  it("não deixa conta inativa receber código", async () => {
    const { service, wa } = montar([perfil("5514991661688")], {
      ...USER,
      ativo: false,
    });
    expect((await service.sendPasswordOtp(TEL_DIGITADO)).semCadastro).toBe(true);
    expect(wa.sendOtpForOrg).not.toHaveBeenCalled();
  });
});
