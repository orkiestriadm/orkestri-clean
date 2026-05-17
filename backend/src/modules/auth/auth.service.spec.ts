import { Test, TestingModule } from "@nestjs/testing";
import { JwtService } from "@nestjs/jwt";
import { ConfigService } from "@nestjs/config";
import { UnauthorizedException } from "@nestjs/common";
import { AuthService } from "./auth.service";
import { PrismaService } from "../../prisma/prisma.service";
import * as bcrypt from "bcryptjs";

// ── Mocks ──────────────────────────────────────

const mockPrisma = {
  role: {
    findUnique: jest.fn(),
    create: jest.fn(),
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
  notification: {
    create: jest.fn(),
    findMany: jest.fn(),
    update: jest.fn(),
  },
};

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
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
  });

  // ── seedMaster ────────────────────────────────

  describe("seedMaster (onModuleInit)", () => {
    it("should create master role and user if they dont exist", async () => {
      mockPrisma.role.findUnique.mockResolvedValue(null);
      mockPrisma.role.create.mockResolvedValue({ id: "role-1", nome: "master", isMaster: true });
      mockPrisma.user.findUnique.mockResolvedValue(null);
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
      mockPrisma.user.findUnique.mockResolvedValue(existingUser);
      mockPrisma.userRole.findUnique.mockResolvedValue({ userId: "user-1", roleId: "role-1" });

      await service.onModuleInit();

      // Should NOT call user.update (old behavior was to overwrite password)
      expect(mockPrisma.user.update).not.toHaveBeenCalled();
    });

    it("should add master role if user exists but lacks it", async () => {
      const existingRole = { id: "role-1", nome: "master", isMaster: true };
      const existingUser = { id: "user-1", email: "sa@test.local" };

      mockPrisma.role.findUnique.mockResolvedValue(existingRole);
      mockPrisma.user.findUnique.mockResolvedValue(existingUser);
      mockPrisma.userRole.findUnique.mockResolvedValue(null); // no role assigned

      await service.onModuleInit();

      expect(mockPrisma.userRole.create).toHaveBeenCalledWith({
        data: { userId: "user-1", roleId: "role-1" },
      });
    });
  });

  // ── login ────────────────────────────────────

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
      mockPrisma.user.findUnique.mockResolvedValue(mockUser);
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
      mockPrisma.user.findUnique.mockResolvedValue(mockUser);
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
      mockPrisma.user.findUnique.mockResolvedValue(mockUser);

      await expect(service.login("test@test.com", "wrong-password")).rejects.toThrow(
        UnauthorizedException
      );
    });

    it("should throw UnauthorizedException for non-existent user", async () => {
      mockPrisma.user.findUnique.mockResolvedValue(null);

      await expect(service.login("nobody@test.com", "password123")).rejects.toThrow(
        UnauthorizedException
      );
    });

    it("should throw UnauthorizedException for inactive user", async () => {
      mockPrisma.user.findUnique.mockResolvedValue({ ...mockUser, ativo: false });

      await expect(service.login("test@test.com", "password123")).rejects.toThrow(
        UnauthorizedException
      );
    });

    it("should update ultimoLogin on successful login", async () => {
      mockPrisma.user.findUnique.mockResolvedValue(mockUser);
      mockPrisma.user.update.mockResolvedValue(mockUser);

      await service.login("test@test.com", "password123");

      expect(mockPrisma.user.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: "user-1" },
          data: { ultimoLogin: expect.any(Date) },
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

      expect(result).toEqual({
        id: "user-1",
        nome: "Test",
        email: "test@test.com",
        avatar: null,
        roles: ["master"],
        isMaster: true,
      });
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
      mockPrisma.user.findUnique.mockResolvedValue(null);

      const result = await service.forgotPassword("nobody@test.com");

      expect(result.message).toBeDefined();
      expect(mockPrisma.notification.create).not.toHaveBeenCalled();
    });
  });
});
