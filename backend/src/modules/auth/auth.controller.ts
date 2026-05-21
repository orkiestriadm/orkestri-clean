import {
  Controller, Post, Get, Patch, Body, Param, Req, Res,
  UseGuards, HttpCode, HttpException, HttpStatus,
} from "@nestjs/common";
import { AuthGuard } from "@nestjs/passport";
import { IsString, IsEmail, IsOptional, MinLength } from "class-validator";
import { Response } from "express";
import { AuthService } from "./auth.service";
import { CacheService } from "../cache/cache.service";
import { LoginDto } from "./auth.dto";

// 5 failed attempts per 15-minute window → 429 for the rest of the window
const RATE_LIMIT_MAX = 5;
const RATE_LIMIT_WINDOW = 15 * 60; // seconds

// ─── DTOs ─────────────────────────────────────────────────────────────────────

class SolicitarAcessoDto {
  @IsString() nome: string;
  @IsEmail() email: string;
  @IsOptional() @IsString() whatsapp?: string;
  @IsOptional() @IsString() cargo?: string;
  @IsOptional() @IsString() departamento?: string;
  @IsOptional() @IsString() empresa?: string;
  @IsOptional() @IsString() motivacao?: string;
}

class AprovarDto {
  @IsOptional() @IsString() nome?: string;
  @IsOptional() @IsEmail() email?: string;
  @IsOptional() @IsString() whatsapp?: string;
  @IsOptional() @IsString() cargo?: string;
  @IsOptional() @IsString() departamento?: string;
  @IsOptional() @IsString() empresa?: string;
}

class RejeitarDto {
  @IsOptional() @IsString() motivo?: string;
}

class EnviarOtpDto {
  @IsString() whatsapp: string;
}

class VerificarOtpDto {
  @IsString() whatsapp: string;
  @IsString() codigo: string;
}

class SolicitarAcessoDtoFull {
  @IsString() nome: string;
  @IsEmail() email: string;
  @IsOptional() @IsString() whatsapp?: string;
  @IsOptional() @IsString() cargo?: string;
  @IsOptional() @IsString() departamento?: string;
  @IsOptional() @IsString() empresa?: string;
  @IsOptional() @IsString() motivacao?: string;
  @IsOptional() @IsString() organizationId?: string;
}

class RedefinirSenhaDto {
  @IsString() resetToken: string;
  @IsString() @MinLength(8) novaSenha: string;
}

class PrimeiroAcessoDto {
  @IsString() @MinLength(8) novaSenha: string;
}

// ─── Controller ───────────────────────────────────────────────────────────────

@Controller("auth")
export class AuthController {
  constructor(private auth: AuthService, private cache: CacheService) {}

  /** Rate-limit por IP para endpoints públicos (anti-spam / anti-brute-force). */
  private async enforceRate(req: any, scope: string, max: number, windowSec: number) {
    const ip: string =
      (req.headers["x-forwarded-for"] as string)?.split(",")[0]?.trim() || req.ip || "unknown";
    const key = `ratelimit:${scope}:${ip}`;
    const count = await this.cache.rateLimitIncr(key, windowSec);
    if (count > max) {
      const remaining = await this.cache.ttl(key);
      const mins = Math.max(1, Math.ceil(remaining / 60));
      throw new HttpException(
        `Muitas requisições. Aguarde ${mins} minuto(s).`,
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }
  }

  @Get("tenant-info")
  tenantInfo() { return this.auth.getTenantInfo(); }

  @Get("organizations")
  getOrganizations() { return this.auth.getPublicOrganizations(); }

  @Post("login")
  @HttpCode(200)
  async login(@Body() dto: LoginDto, @Req() req: any, @Res({ passthrough: true }) res: Response) {
    const ip: string = (req.headers["x-forwarded-for"] as string)?.split(",")[0]?.trim() || req.ip || "unknown";
    const rlKey = `ratelimit:login:${ip}`;
    const count = await this.cache.rateLimitIncr(rlKey, RATE_LIMIT_WINDOW);
    if (count > RATE_LIMIT_MAX) {
      const remaining = await this.cache.ttl(rlKey);
      const mins = Math.max(1, Math.ceil(remaining / 60));
      throw new HttpException(`Muitas tentativas. Aguarde ${mins} minuto(s).`, HttpStatus.TOO_MANY_REQUESTS);
    }
    const result = await this.auth.login(dto.email, dto.senha);
    await this.cache.del(rlKey);
    // Set HttpOnly cookie — JS cannot read this token
    const isSecure = req.headers["x-forwarded-proto"] === "https";
    res.cookie("orkestri_token", result.accessToken, {
      httpOnly: true,
      sameSite: "strict",
      secure: isSecure,
      maxAge: 8 * 60 * 60 * 1000, // 8h in ms
      path: "/",
    });
    return result;
  }

  @Get("me")
  @UseGuards(AuthGuard("jwt"))
  async me(@Req() req: any) {
    const base = await this.auth.me(req.user.id);
    if (req.user.impersonating) {
      return {
        ...base,
        organizationId: req.user.organizationId,
        isMaster: true,
        permissions: ["*"],
        impersonating: true,
        impersonatingOrgName: req.user.impersonatingOrgName,
      };
    }
    return base;
  }

  @Post("logout")
  @UseGuards(AuthGuard("jwt"))
  @HttpCode(200)
  async logout(@Req() req: any, @Res({ passthrough: true }) res: Response) {
    res.clearCookie("orkestri_token", { path: "/" });
    return this.auth.logout(req.user.id, req.user._iat, req.user._exp);
  }

  // Clears the session cookie without requiring a valid token (handles expired/invalid tokens)
  @Post("clear")
  @HttpCode(200)
  clearSession(@Res({ passthrough: true }) res: Response) {
    res.clearCookie("orkestri_token", { path: "/" });
    return { ok: true };
  }

  // ── Solicitações de acesso ────────────────────────────────────────────────

  @Post("solicitar-acesso")
  @HttpCode(200)
  async solicitarAcesso(@Body() dto: SolicitarAcessoDtoFull, @Req() req: any) {
    await this.enforceRate(req, "solicitar-acesso", 5, 3600);
    return this.auth.createUserRequest(dto);
  }

  @Get("solicitacoes")
  @UseGuards(AuthGuard("jwt"))
  listarSolicitacoes(@Req() req: any) {
    return this.auth.listUserRequests(req.user);
  }

  @Patch("solicitacoes/:id/aprovar")
  @UseGuards(AuthGuard("jwt"))
  aprovarSolicitacao(@Param("id") id: string, @Body() dto: AprovarDto, @Req() req: any) {
    return this.auth.approveUserRequest(id, dto, req.user);
  }

  @Patch("solicitacoes/:id/rejeitar")
  @UseGuards(AuthGuard("jwt"))
  rejeitarSolicitacao(@Param("id") id: string, @Body() dto: RejeitarDto, @Req() req: any) {
    return this.auth.rejectUserRequest(id, dto.motivo, req.user);
  }

  // ── Recuperação via Email ─────────────────────────────────────────────────

  @Post("esqueci-senha")
  @HttpCode(200)
  async esqueciSenha(@Body() dto: { email: string }, @Req() req: any) {
    await this.enforceRate(req, "esqueci-senha", 5, 900);
    return this.auth.sendPasswordResetEmail(dto.email);
  }

  // ── Recuperação via OTP WhatsApp ──────────────────────────────────────────

  @Post("enviar-otp")
  @HttpCode(200)
  async enviarOtp(@Body() dto: EnviarOtpDto, @Req() req: any) {
    await this.enforceRate(req, "enviar-otp", 5, 900);
    return this.auth.sendPasswordOtp(dto.whatsapp);
  }

  @Post("verificar-otp")
  @HttpCode(200)
  async verificarOtp(@Body() dto: VerificarOtpDto, @Req() req: any) {
    await this.enforceRate(req, "verificar-otp", 10, 900);
    return this.auth.verifyPasswordOtp(dto.whatsapp, dto.codigo);
  }

  @Post("redefinir-senha")
  @HttpCode(200)
  redefinirSenha(@Body() dto: RedefinirSenhaDto) {
    return this.auth.resetPasswordWithToken(dto.resetToken, dto.novaSenha);
  }

  // ── Primeiro acesso ───────────────────────────────────────────────────────

  @Patch("primeiro-acesso")
  @UseGuards(AuthGuard("jwt"))
  primeiroAcesso(@Body() dto: PrimeiroAcessoDto, @Req() req: any) {
    return this.auth.changeFirstPassword(req.user.id, dto.novaSenha);
  }

  // ── Desbloquear usuário ───────────────────────────────────────────────────

  @Patch("desbloquear/:id")
  @UseGuards(AuthGuard("jwt"))
  desbloquear(@Param("id") id: string, @Req() req: any) {
    return this.auth.unblockUser(id, req.user);
  }
}
