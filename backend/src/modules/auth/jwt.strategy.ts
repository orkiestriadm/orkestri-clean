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
    const permissions = await this.authService.resolvePermissions(payload.sub);
    return {
      id: payload.sub, email: payload.email,
      organizationId: (user as any).organizationId,
      roles: payload.roles,
      isMaster: permissions.includes("*"),
      permissions,
      _iat: payload.iat,
      _exp: payload.exp,
    };
  }
}