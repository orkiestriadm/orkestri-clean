import { UnauthorizedException } from "@nestjs/common";
import { Test, TestingModule } from "@nestjs/testing";
import { ConfigService } from "@nestjs/config";
import { JwtStrategy } from "./jwt.strategy";
import { PrismaService } from "../../prisma/prisma.service";

const mockPrisma = {
  user: {
    findUnique: jest.fn(),
  },
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

      expect(result).toEqual({
        id: "user-1",
        email: "test@test.com",
        roles: ["membro"],
        isMaster: false,
      });
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
