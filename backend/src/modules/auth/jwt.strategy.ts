import { Injectable, UnauthorizedException } from "@nestjs/common";
import { PassportStrategy } from "@nestjs/passport";
import { ExtractJwt, Strategy } from "passport-jwt";
import { ConfigService } from "@nestjs/config";
import { Request } from "express";
import { PrismaService } from "../../prisma/prisma.service";
import { AuthService } from "./auth.service";

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(config: ConfigService, private prisma: PrismaService, private authService: AuthService) {
    super({
      jwtFromRequest: ExtractJwt.fromExtractors([
        // Primary: HttpOnly cookie (not readable by JS)
        (req: Request) => req?.cookies?.orkestri_token || null,
        // Fallback: Authorization Bearer header (API clients / SA panel)
        ExtractJwt.fromAuthHeaderAsBearerToken(),
      ]),
      ignoreExpiration: false,
      secretOrKey: config.get("JWT_SECRET"),
      passReqToCallback: false,
    });
  }
  async validate(payload: any) {
    // Check JWT blacklist (tokens invalidated on logout)
    if (payload.iat && await this.authService.isTokenBlacklisted(payload.sub, payload.iat)) {
      throw new UnauthorizedException("Token invalidado");
    }
    const user = await this.prisma.user.findUnique({ where: { id: payload.sub } });
    if (!user || !user.ativo) throw new UnauthorizedException();

    // Impersonation: super-admin operating within another org's context.
    // Dentro da impersonação ele atua como master DAQUELE tenant —
    // isSuperAdmin = false para não expor o módulo global no contexto do tenant.
    if (payload.impersonating && payload.targetOrgId) {
      return {
        id: payload.sub, email: payload.email,
        organizationId: payload.targetOrgId,
        roles: ["master"],
        isMaster: true,
        isSuperAdmin: false,
        permissions: ["*"],
        impersonating: true,
        impersonatingOrgName: payload.targetOrgName,
        _iat: payload.iat,
        _exp: payload.exp,
      };
    }

    const permissions = await this.authService.resolvePermissions(payload.sub);
    // isSuperAdmin é resolvido server-side (não confia só no payload assinado)
    const isSuperAdmin = await this.authService.checkGlobalSuperAdmin(payload.sub, payload.email || (user as any).email);
    return {
      id: payload.sub, email: payload.email,
      organizationId: (user as any).organizationId,
      roles: payload.roles,
      isMaster: permissions.includes("*"),
      isSuperAdmin,
      permissions,
      _iat: payload.iat,
      _exp: payload.exp,
    };
  }
}