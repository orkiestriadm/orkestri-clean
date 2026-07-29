import { UnauthorizedException } from "@nestjs/common";
import { Test, TestingModule } from "@nestjs/testing";
import { ConfigService } from "@nestjs/config";
import { JwtStrategy } from "./jwt.strategy";
import { PrismaService } from "../../prisma/prisma.service";
import { AuthService } from "./auth.service";

const mockPrisma = {
  user: {
    findUnique: jest.fn(),
  },
  orgBilling: {
    findUnique: jest.fn().mockResolvedValue(null),
  },
};

/**
 * A estratégia passou a consultar a blacklist e a resolver permissões pelo
 * AuthService; o teste não foi atualizado e quebrava na instanciação, deixando
 * a validação de token sem cobertura nenhuma.
 *
 * Os padrões são os do caminho felizes — token válido, sem permissão especial —
 * para que cada teste só configure o que de fato exercita.
 */
const mockAuthService = {
  isTokenBlacklisted: jest.fn().mockResolvedValue(false),
  resolvePermissions: jest.fn().mockResolvedValue([]),
  checkGlobalSuperAdmin: jest.fn().mockResolvedValue(false),
};

const mockConfig = {
  get: jest.fn((key: string) => {
    if (key === "JWT_SECRET") return "test-secret";
    return undefined;
  }),
};

describe("JwtStrategy", () => {
  let strategy: JwtStrategy;

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        JwtStrategy,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: ConfigService, useValue: mockConfig },
        { provide: AuthService, useValue: mockAuthService },
      ],
    }).compile();

    strategy = module.get<JwtStrategy>(JwtStrategy);
  });

  describe("validate", () => {
    it("should return user payload for valid active user", async () => {
      mockPrisma.user.findUnique.mockResolvedValue({
        id: "user-1",
        email: "test@test.com",
        ativo: true,
      });

      const payload = { sub: "user-1", email: "test@test.com", roles: ["membro"], isMaster: false };
      const result = await strategy.validate(payload);

      // `objectContaining`: o contexto ganhou campos (permissions, isSuperAdmin,
      // organizationId) e vai ganhar outros. Igualdade exata transformava cada
      // campo novo em teste vermelho, o que foi o começo do abandono desta
      // suíte. O que importa é a identidade não mudar em trânsito.
      expect(result).toEqual(
        expect.objectContaining({
          id: "user-1",
          email: "test@test.com",
          roles: ["membro"],
          isMaster: false,
        }),
      );
    });

    it("should reject a blacklisted token", async () => {
      mockPrisma.user.findUnique.mockResolvedValue({
        id: "user-1", email: "test@test.com", ativo: true,
      });
      mockAuthService.isTokenBlacklisted.mockResolvedValueOnce(true);

      // `iat` é obrigatório: a blacklist compara o instante de emissão, então
      // token sem `iat` nunca é conferido.
      const payload = { sub: "user-1", email: "test@test.com", roles: [], isMaster: false, iat: 1 };

      await expect(strategy.validate(payload)).rejects.toThrow(UnauthorizedException);
    });

    it("should reject a blocked user", async () => {
      mockPrisma.user.findUnique.mockResolvedValue({
        id: "user-1", email: "test@test.com", ativo: true, bloqueado: true,
      });

      const payload = { sub: "user-1", email: "test@test.com", roles: [], isMaster: false };

      await expect(strategy.validate(payload)).rejects.toThrow(UnauthorizedException);
    });

    it("should resolve permissions server-side, not from the token", async () => {
      mockPrisma.user.findUnique.mockResolvedValue({
        id: "user-1", email: "test@test.com", ativo: true,
      });
      mockAuthService.resolvePermissions.mockResolvedValueOnce(["people.colaborador:ver"]);

      // O payload MENTE: diz ter tudo. Quem decide é o banco.
      const payload = {
        sub: "user-1", email: "test@test.com", roles: [], isMaster: false,
        permissions: ["*"],
      };
      const result: any = await strategy.validate(payload);

      expect(result.permissions).toEqual(["people.colaborador:ver"]);
    });

    it("should throw UnauthorizedException for non-existent user", async () => {
      mockPrisma.user.findUnique.mockResolvedValue(null);

      const payload = { sub: "invalid-id", email: "nobody@test.com", roles: [], isMaster: false };

      await expect(strategy.validate(payload)).rejects.toThrow(UnauthorizedException);
    });

    it("should throw UnauthorizedException for inactive user", async () => {
      mockPrisma.user.findUnique.mockResolvedValue({
        id: "user-1",
        email: "test@test.com",
        ativo: false,
      });

      const payload = { sub: "user-1", email: "test@test.com", roles: ["membro"], isMaster: false };

      await expect(strategy.validate(payload)).rejects.toThrow(UnauthorizedException);
    });

    it("should query user by payload.sub", async () => {
      mockPrisma.user.findUnique.mockResolvedValue({
        id: "user-42",
        email: "user@test.com",
        ativo: true,
      });

      const payload = { sub: "user-42", email: "user@test.com", roles: ["master"], isMaster: true };
      await strategy.validate(payload);

      expect(mockPrisma.user.findUnique).toHaveBeenCalledWith({
        where: { id: "user-42" },
      });
    });
  });
});
