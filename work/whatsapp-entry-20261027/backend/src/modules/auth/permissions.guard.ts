import { Injectable, CanActivate, ExecutionContext } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { PERMISSIONS_KEY } from "./permissions.decorator";

@Injectable()
export class PermissionsGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(ctx: ExecutionContext): boolean {
    const required = this.reflector.getAllAndOverride<string[]>(PERMISSIONS_KEY, [
      ctx.getHandler(),
      ctx.getClass(),
    ]);
    if (!required || required.length === 0) return true;

    const { user } = ctx.switchToHttp().getRequest();
    if (!user) return false;

    // isMaster ou wildcard têm acesso total
    if (user.isMaster) return true;
    if (Array.isArray(user.permissions) && user.permissions.includes("*")) return true;

    // Comparação por string exata, no formato `recurso:acao`.
    //
    // Havia aqui uma tradução de permissão legada (`colaboradores:*` ->
    // `people.*`), necessária porque papéis customizados de cada cliente não
    // recebem a semente de `ROLE_DEFAULTS`. Ela existia só para o módulo
    // People; com ele fora, todo o catálogo voltou a ser `recurso:acao`.
    const userPerms = new Set<string>(user.permissions || []);
    return required.every(p => userPerms.has(p));
  }
}
