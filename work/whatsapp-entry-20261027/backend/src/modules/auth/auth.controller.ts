import {
  Controller, Post, Get, Patch, Body, Param, Req, Res,
  UseGuards, HttpCode, HttpException, HttpStatus,
} from "@nestjs/common";
import { AuthGuard } from "@nestjs/passport";
import { IsArray, IsBoolean, IsEmail, IsNumber, IsOptional, IsString, MinLength } from "class-validator";
import { Response } from "express";
import { AuthService } from "./auth.service";
import { CacheService } from "../cache/cache.service";
import { LoginDto } from "./auth.dto";
import { SkipFirstAccessGuard } from "./first-access.decorator";

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
  // ── Workforce: provisionamento estrutural do colaborador ──
  // `setorId` saiu em 20/10/2026 com a tabela `setores` — ver approveUserRequest.
  @IsOptional() @IsString() gestorId?: string;
  @IsOptional() @IsString() perfilRoleId?: string;
  @IsOptional() @IsString() squad?: string;
  @IsOptional() @IsString() matricula?: string;
  @IsOptional() @IsString() senioridade?: string;
  @IsOptional() @IsString() tipoVinculo?: string;
  @IsOptional() @IsNumber() jornadaHorasDia?: number;
  // Aprovação rápida (pela notificação): usa a senha padrão 123@mudar em vez de
  // uma senha aleatória. O usuário é obrigado a trocá-la no primeiro acesso.
  @IsOptional() @IsBoolean() senhaPadrao?: boolean;
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
  // Slugs dos produtos do Orkiestri One escolhidos na landing page.
  @IsOptional() @IsArray() @IsString({ each: true }) produtos?: string[];
}

class RedefinirSenhaDto {
  @IsString() resetToken: string;
  @IsString() @MinLength(8) novaSenha: string;
}

class IniciarTrialDto {
  @IsEmail() email: string;
  @IsString() whatsapp: string;
  // Slug do produto Orkiestri One escolhido no modal (ex.: "one-fleet").
  @IsString() produto: string;
  // Código de indicação (opcional) — quem indicou este novo usuário.
  @IsOptional() @IsString() codigoIndicacao?: string;
}

class ConfirmarTrialDto {
  @IsString() whatsapp: string;
  @IsString() codigo: string;
}

class AjudaDto {
  @IsString() mensagem: string;
}

class PrimeiroAcessoDto {
  @IsString() @MinLength(8) novaSenha: string;
}

/**
 * Primeiro acesso SEM sessão: a pessoa prova quem é com a senha provisória
 * (que chegou pelo WhatsApp) mais o código de 6 dígitos (que chegou no
 * e-mail). Dois canais, nenhum token.
 */
class ConfirmarPrimeiroAcessoDto {
  @IsEmail() email: string;
  @IsString() senhaProvisoria: string;
  @IsString() codigo: string;
  @IsString() @MinLength(8) novaSenha: string;
}

class ReenviarCodigoDto {
  @IsEmail() email: string;
  @IsString() senhaProvisoria: string;
}

// ─── Controller ───────────────────────────────────────────────────────────────

// ── DTOs gerados: sem classe, o ValidationPipe global nao tem metadata e a
//    rota aceita qualquer JSON. Campos derivados do tipo inline anterior.
class EsqueciSenhaAuthDto {
  @IsString() email: string;
}

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
      const probe = await this.cache.rateLimitIncr(`ratelimit:login-probe:${ip}`, 1);
      const saValid = probe <= 1 && await this.auth.canBypassLoginCooldown(dto.email, dto.senha);
      if (!saValid) {
        const remaining = await this.cache.ttl(rlKey);
        const mins = Math.max(1, Math.ceil(remaining / 60));
        throw new HttpException(`Muitas tentativas. Aguarde ${mins} minuto(s).`, HttpStatus.TOO_MANY_REQUESTS);
      }
    }
    const result = await this.auth.login(dto.email, dto.senha);
    await this.cache.del(rlKey);

    // Primeiro acesso: a senha está certa, mas `login` não abre sessão — ele
    // manda um código para o e-mail e devolve só o pedido de troca. Não há
    // `user` nem cookie a emitir, e o resto deste método depende dos dois.
    if ((result as any).precisaTrocarSenha) return result;

    // Alerta de novo IP — detecta login de IP desconhecido
    const ipKey = `known:ip:${result.user.id}:${ip}`;
    const knownIp = await this.cache.get(ipKey);
    if (!knownIp) {
      await this.cache.set(ipKey, "1", 30 * 24 * 60 * 60); // Lembra IP por 30 dias
      this.auth.alertNewIpLogin(result.user.id, result.user.email, ip).catch(() => {});
    }

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
  @SkipFirstAccessGuard()
  async me(@Req() req: any) {
    const base = await this.auth.me(req.user.id);
    if (req.user.impersonating) {
      // Durante impersonação o SA global atua DENTRO de um tenant.
      // isSuperAdmin = false neste contexto (o módulo Gestão Global
      // não deve estar acessível, e o frontend não deve disparar
      // chamadas para /superadmin/* enquanto impersonando).
      return {
        ...base,
        organizationId: req.user.organizationId,
        isMaster: true,
        isSuperAdmin: false,
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
  @SkipFirstAccessGuard()
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

  // ── Acesso de teste (trial) pela landing page ─────────────────────────────
  @Post("trial/iniciar")
  @HttpCode(200)
  async trialIniciar(@Body() dto: IniciarTrialDto, @Req() req: any) {
    await this.enforceRate(req, "trial-iniciar", 5, 3600);
    return this.auth.iniciarTrial(dto);
  }

  @Post("trial/confirmar")
  @HttpCode(200)
  async trialConfirmar(@Body() dto: ConfirmarTrialDto, @Req() req: any) {
    await this.enforceRate(req, "trial-confirmar", 10, 3600);
    return this.auth.confirmarTrial(dto);
  }

  @Get("solicitacoes")
  @UseGuards(AuthGuard("jwt"))
  listarSolicitacoes(@Req() req: any) {
    return this.auth.listUserRequests(req.user);
  }

  @Get("trials")
  @UseGuards(AuthGuard("jwt"))
  listarTrials(@Req() req: any) {
    return this.auth.listTrials(req.user);
  }

  // "Fale Conosco": qualquer usuário logado (inclusive em primeiro acesso) pode
  // pedir ajuda ao admin.
  @Post("ajuda")
  @UseGuards(AuthGuard("jwt"))
  @SkipFirstAccessGuard()
  @HttpCode(200)
  async ajuda(@Body() dto: AjudaDto, @Req() req: any) {
    await this.enforceRate(req, "ajuda", 10, 3600);
    return this.auth.enviarAjuda(req.user, dto.mensagem);
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
  async esqueciSenha(@Body() dto: EsqueciSenhaAuthDto, @Req() req: any) {
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

  // ── Primeiro acesso: troca a senha ANTES de existir sessão ────────────────
  //
  // Rotas PÚBLICAS de propósito: no primeiro acesso ainda não há token, porque
  // `login` deixou de emitir um enquanto a senha provisória não for trocada.
  // Quem protege não é o JWT, é a combinação senha provisória + código do
  // e-mail, e os tetos de tentativa abaixo.

  @Post("primeiro-acesso/confirmar")
  @HttpCode(200)
  async confirmarPrimeiroAcesso(
    @Body() dto: ConfirmarPrimeiroAcessoDto,
    @Req() req: any,
    @Res({ passthrough: true }) res: Response,
  ) {
    await this.enforceRate(req, "primeiro-acesso-confirmar", 10, 900);
    const result = await this.auth.confirmarPrimeiroAcesso(dto.email, dto.senhaProvisoria, dto.codigo, dto.novaSenha);

    // É aqui que a sessão nasce, então é aqui que o cookie sai — o `login` não
    // emitiu nenhum. Sem isto a pessoa trocaria a senha e continuaria de fora,
    // porque o middleware procura a sessão no cookie, não no corpo.
    res.cookie("orkestri_token", result.accessToken, {
      httpOnly: true,
      sameSite: "strict",
      secure: req.headers["x-forwarded-proto"] === "https",
      maxAge: 8 * 60 * 60 * 1000,
      path: "/",
    });
    return result;
  }

  @Post("primeiro-acesso/reenviar")
  @HttpCode(200)
  async reenviarCodigoPrimeiroAcesso(@Body() dto: ReenviarCodigoDto, @Req() req: any) {
    // Teto mais apertado: cada chamada manda um e-mail de verdade.
    await this.enforceRate(req, "primeiro-acesso-reenviar", 3, 900);
    return this.auth.reenviarCodigoPrimeiroAcesso(dto.email, dto.senhaProvisoria);
  }

  @Patch("primeiro-acesso")
  @UseGuards(AuthGuard("jwt"))
  @SkipFirstAccessGuard()
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
