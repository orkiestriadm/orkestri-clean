import { Test, TestingModule } from "@nestjs/testing";
import { JwtService } from "@nestjs/jwt";
import { ConfigService } from "@nestjs/config";
import { UnauthorizedException } from "@nestjs/common";
import { AuthService } from "./auth.service";
import { PrismaService } from "../../prisma/prisma.service";
import { CacheService } from "../cache/cache.service";
import { WhatsAppService } from "../notifications/whatsapp.service";
import { EmailService } from "../notifications/email.service";
import { AutomacaoService } from "../automacoes/automacoes.module";
import * as bcrypt from "bcryptjs";

// ── Mocks ──────────────────────────────────────

const mockPrisma = {
  role: {
    findUnique: jest.fn(),
    findFirst: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
  },
  user: {
    findUnique: jest.fn(),
    findFirst: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
  },
  userRole: {
    findUnique: jest.fn(),
    create: jest.fn(),
  },
  // O seed do master cria permissões e papéis padrão ANTES de tocar no usuário.
  // Sem estes mocks ele lançava, o onModuleInit engolia a exceção num warn e o
  // teste via "0 chamadas" — falha que não aponta para a causa.
  permission: {
    upsert: jest.fn().mockImplementation(({ where }: any) =>
      Promise.resolve({ id: `perm-${where.recurso_acao.recurso}-${where.recurso_acao.acao}` }),
    ),
  },
  rolePermission: {
    findMany: jest.fn().mockResolvedValue([]),
    create: jest.fn(),
  },
  notification: {
    create: jest.fn(),
    findMany: jest.fn(),
    update: jest.fn(),
  },
};

/** Papéis padrão já existem; só o `master` é decidido caso a caso no teste. */
function papelPadraoExiste(nome: string) {
  return { id: `role-${nome}`, nome, isMaster: false, nivel: 10 };
}

const mockJwt = {
  sign: jest.fn().mockReturnValue("mock-token"),
};

const mockConfig = {
  get: jest.fn((key: string, defaultVal?: string) => {
    const map: Record<string, string> = {
      MASTER_EMAIL: "sa@test.local",
      MASTER_PASSWORD: "Test@123",
      MASTER_NOME: "SA",
      JWT_SECRET: "test-jwt-secret",
      JWT_REFRESH_SECRET: "test-refresh-secret",
    };
    return map[key] || defaultVal;
  }),
};

/**
 * Colaboradores do AuthService que não participam do que é testado aqui.
 *
 * Estas suítes ficaram MESES sem rodar por falta destes providers: a
 * dependência entrou no construtor com a blacklist de JWT e o teste nunca foi
 * atualizado, então quebrava na instanciação. Entre os testes mortos estava
 * justamente "should NOT overwrite existing master password" — a regressão que
 * ele existe para pegar aconteceu em produção sem ninguém ver.
 */
const mockCache = {
  get: jest.fn(),
  set: jest.fn(),
  del: jest.fn(),
  delPattern: jest.fn(),
  isBlacklisted: jest.fn().mockResolvedValue(false),
  blacklistToken: jest.fn(),
};

/**
 * Envio: sempre resolve.
 *
 * Cada método devolve uma Promise porque o serviço encadeia `.catch(...)` nas
 * chamadas de aviso — um mock que devolve `undefined` estoura em "cannot read
 * catch of undefined" e o teste acusa erro de envio onde não existe nenhum.
 */
const mockWhatsApp = {
  resolveInstance: jest.fn().mockResolvedValue("orkestri-default"),
  sendPasswordResetLink: jest.fn().mockResolvedValue(true),
  sendOtpForOrg: jest.fn().mockResolvedValue(true),
  sendAccountApproved: jest.fn().mockResolvedValue(true),
  sendAccountRejected: jest.fn().mockResolvedValue(true),
  send: jest.fn().mockResolvedValue(true),
};

const mockEmail = {
  sendPasswordResetRequest: jest.fn().mockResolvedValue(true),
  sendPasswordResetLink: jest.fn().mockResolvedValue(true),
  sendAccountApproved: jest.fn().mockResolvedValue(true),
  sendAccountRejected: jest.fn().mockResolvedValue(true),
  send: jest.fn().mockResolvedValue(true),
};

const mockAutomacao = {
  disparar: jest.fn().mockResolvedValue(undefined),
  executar: jest.fn().mockResolvedValue(undefined),
};

describe("AuthService", () => {
  let service: AuthService;

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: JwtService, useValue: mockJwt },
        { provide: ConfigService, useValue: mockConfig },
        { provide: CacheService, useValue: mockCache },
        { provide: WhatsAppService, useValue: mockWhatsApp },
        { provide: EmailService, useValue: mockEmail },
        { provide: AutomacaoService, useValue: mockAutomacao },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
  });

  // ── seedMaster ────────────────────────────────

  describe("seedMaster (onModuleInit)", () => {
    it("should create master role and user if they dont exist", async () => {
      mockPrisma.role.findUnique.mockResolvedValue(null);
      mockPrisma.role.create.mockResolvedValue({ id: "role-1", nome: "master", isMaster: true });
      // `findFirst`, não `findUnique`: e-mail sozinho não é único (é único por
      // organização), então o seed procura assim. O mock antigo apontava para o
      // método errado e o master parecia sempre inexistente.
      mockPrisma.user.findFirst.mockResolvedValue(null);
      mockPrisma.user.create.mockResolvedValue({ id: "user-1" });

      await service.onModuleInit();

      expect(mockPrisma.role.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ nome: "master", isMaster: true }),
        })
      );
      expect(mockPrisma.user.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            nome: "SA",
            email: "sa@test.local",
          }),
        })
      );
    });

    it("should NOT overwrite existing master password", async () => {
      const existingRole = { id: "role-1", nome: "master", isMaster: true };
      const existingUser = { id: "user-1", email: "sa@test.local" };

      mockPrisma.role.findUnique.mockResolvedValue(existingRole);
      mockPrisma.user.findFirst.mockResolvedValue(existingUser);
      mockPrisma.userRole.findUnique.mockResolvedValue({ userId: "user-1", roleId: "role-1" });

      await service.onModuleInit();

      // O invariante é a SENHA, não a ausência de update: a subida ainda
      // desbloqueia e reativa o master (isso é intencional). Proibir qualquer
      // update tornaria o teste falso-vermelho e ele seria desligado — foi por
      // aí que a regressão passou. Então: pode gravar, não pode gravar senha.
      for (const chamada of mockPrisma.user.update.mock.calls) {
        expect(chamada[0]?.data ?? {}).not.toHaveProperty("senhaHash");
        expect(chamada[0]?.data ?? {}).not.toHaveProperty("senha");
      }
    });

    it("should add master role if user exists but lacks it", async () => {
      const existingRole = { id: "role-1", nome: "master", isMaster: true };
      const existingUser = { id: "user-1", email: "sa@test.local" };

      mockPrisma.role.findUnique.mockResolvedValue(existingRole);
      mockPrisma.user.findFirst.mockResolvedValue(existingUser);
      mockPrisma.userRole.findUnique.mockResolvedValue(null); // no role assigned

      await service.onModuleInit();

      expect(mockPrisma.userRole.create).toHaveBeenCalledWith({
        data: { userId: "user-1", roleId: "role-1" },
      });
    });
  });

  // ── login ────────────────────────────────────

  /**
   * `login` busca com `findFirst`, não `findUnique`.
   *
   * Os mocks apontavam para o método errado, então o usuário vinha `undefined`
   * e os testes de exceção passavam pelo motivo errado — "senha errada" passava
   * sem sequer chegar ao bcrypt. Um teste que passa por acidente é pior que um
   * teste ausente: ele afirma cobertura que não existe.
   */
  describe("login", () => {
    const mockUser = {
      id: "user-1",
      nome: "Test User",
      email: "test@test.com",
      senhaHash: "",
      ativo: true,
      avatar: null,
      userRoles: [{ role: { nome: "membro", isMaster: false } }],
    };

    beforeEach(async () => {
      mockUser.senhaHash = await bcrypt.hash("password123", 4);
    });

    it("should return tokens and user data on valid login", async () => {
      mockPrisma.user.findFirst.mockResolvedValue(mockUser);
      mockPrisma.user.update.mockResolvedValue(mockUser);

      const result = await service.login("test@test.com", "password123");

      expect(result).toHaveProperty("accessToken");
      expect(result).toHaveProperty("refreshToken");
      expect(result.user).toEqual(
        expect.objectContaining({
          id: "user-1",
          email: "test@test.com",
          nome: "Test User",
          roles: ["membro"],
          isMaster: false,
        })
      );
    });

    it("should use JWT_REFRESH_SECRET for refresh token", async () => {
      mockPrisma.user.findFirst.mockResolvedValue(mockUser);
      mockPrisma.user.update.mockResolvedValue(mockUser);

      await service.login("test@test.com", "password123");

      // Access token uses JWT_SECRET
      expect(mockJwt.sign).toHaveBeenCalledWith(
        expect.objectContaining({ sub: "user-1" }),
        expect.objectContaining({ secret: "test-jwt-secret" })
      );

      // Refresh token uses JWT_REFRESH_SECRET
      expect(mockJwt.sign).toHaveBeenCalledWith(
        { sub: "user-1" },
        expect.objectContaining({ secret: "test-refresh-secret" })
      );
    });

    it("should throw UnauthorizedException for wrong password", async () => {
      mockPrisma.user.findFirst.mockResolvedValue(mockUser);

      await expect(service.login("test@test.com", "wrong-password")).rejects.toThrow(
        UnauthorizedException
      );
    });

    it("should throw UnauthorizedException for non-existent user", async () => {
      mockPrisma.user.findFirst.mockResolvedValue(null);

      await expect(service.login("nobody@test.com", "password123")).rejects.toThrow(
        UnauthorizedException
      );
    });

    it("should throw UnauthorizedException for inactive user", async () => {
      mockPrisma.user.findFirst.mockResolvedValue({ ...mockUser, ativo: false });

      await expect(service.login("test@test.com", "password123")).rejects.toThrow(
        UnauthorizedException
      );
    });

    it("should update ultimoLogin on successful login", async () => {
      mockPrisma.user.findFirst.mockResolvedValue(mockUser);
      mockPrisma.user.update.mockResolvedValue(mockUser);

      await service.login("test@test.com", "password123");

      // `data` com objectContaining: o login também zera as tentativas falhas,
      // e igualdade exata do objeto proibiria isso sem motivo.
      expect(mockPrisma.user.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: "user-1" },
          data: expect.objectContaining({ ultimoLogin: expect.any(Date) }),
        })
      );
    });
  });

  // ── me ───────────────────────────────────────

  describe("me", () => {
    it("should return user profile data", async () => {
      mockPrisma.user.findUnique.mockResolvedValue({
        id: "user-1",
        nome: "Test",
        email: "test@test.com",
        avatar: null,
        userRoles: [{ role: { nome: "master", isMaster: true } }],
      });

      const result = await service.me("user-1");

      expect(result).toEqual(
        expect.objectContaining({
          id: "user-1",
          nome: "Test",
          email: "test@test.com",
          avatar: null,
          roles: ["master"],
          isMaster: true,
        }),
      );
    });

    it("should throw UnauthorizedException if user not found", async () => {
      mockPrisma.user.findUnique.mockResolvedValue(null);

      await expect(service.me("invalid-id")).rejects.toThrow(UnauthorizedException);
    });
  });

  // ── forgotPassword ───────────────────────────

  describe("forgotPassword", () => {
    it("should create notification for master when user exists", async () => {
      mockPrisma.user.findUnique.mockResolvedValue({ id: "user-2", nome: "User", email: "user@test.com" });
      mockPrisma.user.findFirst.mockResolvedValue({ id: "master-1" });
      mockPrisma.notification.create.mockResolvedValue({});

      const result = await service.forgotPassword("user@test.com");

      expect(result.message).toContain("administrador");
      expect(mockPrisma.notification.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            userId: "master-1",
            tipo: "reset_senha",
          }),
        })
      );
    });

    it("should return safe message even if user does not exist", async () => {
      // `clearAllMocks` limpa as CHAMADAS, não as implementações: sem zerar
      // aqui, o `findFirst` continuava devolvendo o master do teste anterior e
      // o "usuário inexistente" era encontrado. O teste passava porque
      // verificava só que havia mensagem.
      mockPrisma.user.findFirst.mockReset().mockResolvedValue(null);

      const result = await service.forgotPassword("nobody@test.com");

      expect(result.message).toBeDefined();
      expect(mockPrisma.notification.create).not.toHaveBeenCalled();
    });
  });
});
