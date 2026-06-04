import { Injectable, CanActivate, ExecutionContext, ForbiddenException } from "@nestjs/common";
import { Reflector } from "@nestjs/core";

export const SKIP_FIRST_ACCESS_KEY = "skipFirstAccess";

/**
 * Bloqueia qualquer endpoint protegido por JWT quando o usuário ainda não
 * trocou a senha temporária (primeiroAcesso=true).
 * Endpoints que precisam ser acessíveis nesse estado devem usar @SkipFirstAccessGuard().
 */
@Injectable()
export class FirstAccessGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(ctx: ExecutionContext): boolean {
    const skip = this.reflector.getAllAndOverride<boolean>(SKIP_FIRST_ACCESS_KEY, [
      ctx.getHandler(),
      ctx.getClass(),
    ]);
    if (skip) return true;

    const { user } = ctx.switchToHttp().getRequest();
    if (!user) return true; // deixa o AuthGuard lidar

    if (user.primeiroAcesso) {
      throw new ForbiddenException({
        code: "PRIMEIRO_ACESSO",
        message: "Você precisa definir uma nova senha antes de continuar.",
      });
    }
    return true;
  }
}
