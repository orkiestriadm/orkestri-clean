import {
  Controller, Post, Get, Patch, Body, Param, Req,
  UseGuards, HttpCode, HttpException, HttpStatus,
} from "@nestjs/common";
import { AuthGuard } from "@nestjs/passport";
import { IsString, IsEmail, IsOptional, MinLength } from "class-validator";
import { AuthService } from "./auth.service";
import { LoginDto } from "./auth.dto";

// ─── Rate limit para login ────────────────────────────────────────────────────
const loginAttempts = new Map<string, { count: number; blockedUntil: number }>();
const MAX_ATTEMPTS = 999;
const BLOCK_MINUTES = 1;

function checkRateLimit(ip: string) {
  const now = Date.now();
  const entry = loginAttempts.get(ip);
  if (entry) {
    if (entry.blockedUntil > now) {
      const remaining = Math.ceil((entry.blockedUntil - now) / 60000);
      throw new HttpException(`Muitas tentativas. Aguarde ${remaining} minuto(s).`, HttpStatus.TOO_MANY_REQUESTS);
    }
    if (entry.count >= MAX_ATTEMPTS) {
      entry.blockedUntil = now + BLOCK_MINUTES * 60 * 1000;
      entry.count = 0;
      throw new HttpException(`Muitas tentativas. Aguarde ${BLOCK_MINUTES} minutos.`, HttpStatus.TOO_MANY_REQUESTS);
    }
  }
}

function registerAttempt(ip: string, success: boolean) {
  if (success) { loginAttempts.delete(ip); return; }
  const entry = loginAttempts.get(ip) || { count: 0, blockedUntil: 0 };
  entry.count++;
  loginAttempts.set(ip, entry);
}

setInterval(() => {
  const now = Date.now();
  for (const [ip, entry] of loginAttempts.entries()) {
    if (entry.blockedUntil > 0 && entry.blockedUntil < now) loginAttempts.delete(ip);
  }
}, 30 * 60 * 1000);

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
  constructor(private auth: AuthService) {}

  @Get("tenant-info")
  tenantInfo() { return this.auth.getTenantInfo(); }

  @Post("login")
  @HttpCode(200)
  async login(@Body() dto: LoginDto, @Req() req: any) {
    const ip = req.ip || req.headers["x-forwarded-for"] || "unknown";
    checkRateLimit(ip);
    try {
      const result = await this.auth.login(dto.email, dto.senha);
      registerAttempt(ip, true);
      return result;
    } catch (e) {
      registerAttempt(ip, false);
      throw e;
    }
  }

  @Get("me")
  @UseGuards(AuthGuard("jwt"))
  me(@Req() req: any) { return this.auth.me(req.user.id); }

  @Post("logout")
  @UseGuards(AuthGuard("jwt"))
  @HttpCode(200)
  logout(@Req() req: any) { return this.auth.logout(req.user.id); }

  // ── Solicitações de acesso ────────────────────────────────────────────────

  @Post("solicitar-acesso")
  @HttpCode(200)
  solicitarAcesso(@Body() dto: SolicitarAcessoDto) {
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

  // ── Recuperação via OTP WhatsApp ──────────────────────────────────────────

  @Post("enviar-otp")
  @HttpCode(200)
  enviarOtp(@Body() dto: EnviarOtpDto) {
    return this.auth.sendPasswordOtp(dto.whatsapp);
  }

  @Post("verificar-otp")
  @HttpCode(200)
  verificarOtp(@Body() dto: VerificarOtpDto) {
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
