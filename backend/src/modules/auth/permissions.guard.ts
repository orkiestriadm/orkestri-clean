import { Injectable, CanActivate, ExecutionContext } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { PERMISSIONS_KEY } from "./permissions.decorator";
import { expandLegacyPermissions } from "../../common/permission-aliases";

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

    // Expande as permissões legadas (`recurso:acao`) para o formato novo
    // (`module.entity.action`) antes de comparar. Sem isso, quem tem
    // `colaboradores:ver` perderia acesso às rotas do People, que declaram
    // `people.employee.view`. Ver common/permission-aliases.ts.
    const userPerms = expandLegacyPermissions(user.permissions || []);
    return required.every(p => userPerms.has(p));
  }
}
