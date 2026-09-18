import { Injectable, CanActivate, ExecutionContext } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { PERMISSIONS_KEY } from "./permissions.decorator";
import { temPermissao } from "../../common/permission-aliases";

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

    // A tradução entre o formato antigo (`colaboradores:*`) e o do People vale
    // nos DOIS sentidos: quem tem a antiga passa nas rotas novas, e quem tem as
    // novas equivalentes passa nas rotas ainda guardadas pela antiga. Ver
    // temPermissao em common/permission-aliases.ts.
    const userPerms: string[] = user.permissions || [];
    return required.every(p => temPermissao(userPerms, p));
  }
}
