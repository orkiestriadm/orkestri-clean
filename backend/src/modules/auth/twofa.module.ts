import { Module, Controller, Post, Get, Body, UseGuards, Req, UnauthorizedException, BadRequestException } from "@nestjs/common";
import { AuthGuard } from "@nestjs/passport";
import { IsString } from "class-validator";
import { PrismaService } from "../../prisma/prisma.service";
import * as OTPAuth from "otpauth";
import * as QRCode from "qrcode";
import { randomBytes } from "crypto";
import * as bcryptjs from "bcryptjs";

class VerifyTotpDto { @IsString() token: string; }
class DisableTotpDto { @IsString() senha: string; }

@Controller("auth/2fa")
class TwoFAController {
  constructor(private prisma: PrismaService) {}

  // Gera secret e QR code para configurar o 2FA
  @Post("setup")
  @UseGuards(AuthGuard("jwt"))
  async setup(@Req() req: any) {
    const user = await this.prisma.user.findUnique({
      where: { id: req.user.id },
      include: { profile: true },
    });
    if (!user) throw new UnauthorizedException();

    // Gera novo secret TOTP
    const totp = new OTPAuth.TOTP({
      issuer: "Orkestri",
      label: user.email,
      algorithm: "SHA1",
      digits: 6,
      period: 30,
    });

    const secret = totp.secret.base32;
    const otpAuthUrl = totp.toString();

    // Salva secret temporariamente (nao ativa ainda)
    await this.prisma.userProfile.upsert({
      where: { userId: req.user.id },
      update: { twoFactorSecret: secret },
      create: { userId: req.user.id, twoFactorSecret: secret },
    });

    // Gera QR Code como data URL
    const qrCode = await QRCode.toDataURL(otpAuthUrl);

    return { secret, qrCode, otpAuthUrl };
  }

  // Verifica token e ativa o 2FA
  @Post("verify")
  @UseGuards(AuthGuard("jwt"))
  async verify(@Body() dto: VerifyTotpDto, @Req() req: any) {
    const profile = await this.prisma.userProfile.findUnique({ where: { userId: req.user.id } });
    if (!profile?.twoFactorSecret) throw new BadRequestException("Configure o 2FA primeiro");

    const totp = new OTPAuth.TOTP({
      issuer: "Orkestri",
      label: req.user.email,
      algorithm: "SHA1",
      digits: 6,
      period: 30,
      secret: OTPAuth.Secret.fromBase32(profile.twoFactorSecret),
    });

    const delta = totp.validate({ token: dto.token, window: 0 });
    if (delta === null) throw new UnauthorizedException("Codigo invalido");

    // Gera backup codes criptograficamente seguros
    const backupCodes = Array.from({ length: 8 }, () =>
      randomBytes(4).toString("hex").toUpperCase()
    );

    // Armazena apenas os hashes dos backup codes
    const backupHashes = await Promise.all(backupCodes.map(c => bcryptjs.hash(c, 10)));

    await this.prisma.userProfile.update({
      where: { userId: req.user.id },
      data: { twoFactorAtivo: true, twoFactorBackup: JSON.stringify(backupHashes) },
    });

    // Retorna os códigos em plaintext apenas uma vez para o usuário salvar
    return { sucesso: true, backupCodes };
  }

  // Desativa o 2FA
  @Post("disable")
  @UseGuards(AuthGuard("jwt"))
  async disable(@Body() dto: DisableTotpDto, @Req() req: any) {
    const user = await this.prisma.user.findUnique({ where: { id: req.user.id } });
    if (!user) throw new UnauthorizedException();

    const valid = await bcryptjs.compare(dto.senha, user.senhaHash);
    if (!valid) throw new UnauthorizedException("Senha incorreta");

    await this.prisma.userProfile.update({
      where: { userId: req.user.id },
      data: { twoFactorAtivo: false, twoFactorSecret: null, twoFactorBackup: null },
    });

    return { sucesso: true };
  }

  // Status do 2FA
  @Get("status")
  @UseGuards(AuthGuard("jwt"))
  async status(@Req() req: any) {
    const profile = await this.prisma.userProfile.findUnique({ where: { userId: req.user.id } });
    return { ativo: profile?.twoFactorAtivo || false };
  }

  // Valida token 2FA no login
  @Post("validate")
  @UseGuards(AuthGuard("jwt"))
  async validate(@Body() dto: VerifyTotpDto, @Req() req: any) {
    const profile = await this.prisma.userProfile.findUnique({ where: { userId: req.user.id } });
    if (!profile?.twoFactorSecret || !profile?.twoFactorAtivo) {
      return { valido: true };
    }

    // Tenta codigo TOTP
    const totp = new OTPAuth.TOTP({
      issuer: "Orkestri",
      label: req.user.email,
      algorithm: "SHA1",
      digits: 6,
      period: 30,
      secret: OTPAuth.Secret.fromBase32(profile.twoFactorSecret),
    });

    const delta = totp.validate({ token: dto.token, window: 0 });
    if (delta !== null) return { valido: true };

    // Tenta codigo de backup — comparação com hash bcrypt
    if (profile.twoFactorBackup) {
      const backupHashes: string[] = JSON.parse(profile.twoFactorBackup);
      const tokenUpper = dto.token.toUpperCase();
      let matchIdx = -1;
      for (let i = 0; i < backupHashes.length; i++) {
        if (await bcryptjs.compare(tokenUpper, backupHashes[i])) {
          matchIdx = i;
          break;
        }
      }
      if (matchIdx >= 0) {
        backupHashes.splice(matchIdx, 1);
        await this.prisma.userProfile.update({
          where: { userId: req.user.id },
          data: { twoFactorBackup: JSON.stringify(backupHashes) },
        });
        return { valido: true, backupUsado: true };
      }
    }

    throw new UnauthorizedException("Codigo 2FA invalido");
  }
}

// â”€â”€ Politica de senhas endpoint â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
@Controller("auth/password-policy")
class PasswordPolicyController {
  constructor(private prisma: PrismaService) {}

  @Get()
  @UseGuards(AuthGuard("jwt"))
  async getPolicy() {
    try {
      const DEFAULT_ORG = "00000000-0000-0000-0000-000000000001";
      const configs = await this.prisma.sistemaConfig.findMany({
        where: { organizationId: DEFAULT_ORG, chave: { startsWith: "pwPolicy_" } } as any,
      });
      const policy = Object.fromEntries(configs.map((c: any) => [c.chave.replace("pwPolicy_", ""), c.valor]));
      return {
        minLength:       Number(policy.minLength)       || 6,
        requireUpper:    policy.requireUpper             !== "false",
        requireLower:    policy.requireLower             !== "false",
        requireNumber:   policy.requireNumber            !== "false",
        requireSpecial:  policy.requireSpecial           === "true",
        expiracaoDias:   Number(policy.expiracaoDias)   || 0,
        historicoSenhas: Number(policy.historicoSenhas) || 0,
      };
    } catch {
      return { minLength:6, requireUpper:true, requireLower:true, requireNumber:true, requireSpecial:false, expiracaoDias:0, historicoSenhas:0 };
    }
  }

  @Post()
  @UseGuards(AuthGuard("jwt"))
  async savePolicy(@Body() body: any, @Req() req: any) {
    if (!req.user.isMaster) throw new UnauthorizedException("Apenas masters");
    const DEFAULT_ORG = "00000000-0000-0000-0000-000000000001";
    const fields = ["minLength","requireUpper","requireLower","requireNumber","requireSpecial","expiracaoDias","historicoSenhas"];
    for (const f of fields) {
      if (body[f] !== undefined) {
        await (this.prisma.sistemaConfig as any).upsert({
          where: { organizationId_chave: { organizationId: DEFAULT_ORG, chave: `pwPolicy_${f}` } },
          update: { valor: String(body[f]) },
          create: { organizationId: DEFAULT_ORG, chave: `pwPolicy_${f}`, valor: String(body[f]) },
        });
      }
    }
    return { sucesso: true };
  }
}

@Module({ controllers: [TwoFAController, PasswordPolicyController] })
export class TwoFAModule {}