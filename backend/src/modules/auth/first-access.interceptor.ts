import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  ForbiddenException,
} from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { Observable } from "rxjs";

export const SKIP_FIRST_ACCESS_KEY = "skipFirstAccess";

/**
 * Bloqueia qualquer endpoint protegido por JWT quando o usuário ainda não
 * trocou a senha temporária (primeiroAcesso=true).
 * Endpoints que precisam ser acessíveis nesse estado devem usar @SkipFirstAccessGuard().
 *
 * ── Por que INTERCEPTOR e não guard ──────────────────────────────────────────
 *
 * Isto já existiu como `FirstAccessGuard` global (`app.useGlobalGuards`) e
 * nunca bloqueou nada. No Nest a ordem é:
 *
 *     guards globais → guards de controller/rota → interceptors → handler
 *
 * Quem popula `request.user` é o `AuthGuard("jwt")`, que é de rota
 * (`@UseGuards(AuthGuard("jwt"))` em 79 arquivos). Então o guard global rodava
 * ANTES da autenticação, lia `user === undefined`, caía no `if (!user) return
 * true` e liberava TODA requisição. Na prática quem recebia senha temporária
 * usava a API inteira sem nunca trocar a senha — confirmado em produção, um
 * usuário com `primeiro_acesso = true` desde 06/09/2026 criou 25 eventos pelo
 * endpoint autenticado `POST /agenda/eventos`.
 *
 * A ordem está provada em execução real, não lida na documentação: ver
 * `primeiro-acesso-bloqueia.spec.ts`, que sobe um app de verdade e mostra o
 * guard global vendo `user=undefined` e o interceptor global vendo o usuário.
 *
 * As alternativas e por que foram descartadas:
 *
 *  - registrar como `APP_GUARD`: guards globais rodam antes dos de rota de
 *    qualquer forma, por provider ou por `useGlobalGuards`. Não resolve.
 *  - mover a checagem para dentro de um `JwtAuthGuard extends AuthGuard("jwt")`:
 *    funciona, mas exige trocar 166 ocorrências de `AuthGuard("jwt")` em 79
 *    arquivos. Diff largo demais para uma mudança que mexe no login de todos.
 *  - checar dentro de `JwtStrategy.validate()`: não tem acesso ao Reflector nem
 *    ao handler, logo não conseguiria honrar `@SkipFirstAccessGuard()`.
 *
 * Interceptor global resolve com uma linha no `main.ts`, roda depois de
 * qualquer guard de autenticação e mantém a leitura da metadata do handler.
 */
@Injectable()
export class FirstAccessInterceptor implements NestInterceptor {
  constructor(private reflector: Reflector) {}

  intercept(ctx: ExecutionContext, next: CallHandler): Observable<any> {
    // Gateways de websocket e handlers de fila não têm `request.user` de HTTP.
    if (ctx.getType() !== "http") return next.handle();

    const skip = this.reflector.getAllAndOverride<boolean>(SKIP_FIRST_ACCESS_KEY, [
      ctx.getHandler(),
      ctx.getClass(),
    ]);
    if (skip) return next.handle();

    const { user } = ctx.switchToHttp().getRequest();
    if (!user) return next.handle(); // rota pública — o AuthGuard já decidiu

    if (user.primeiroAcesso) {
      throw new ForbiddenException({
        code: "PRIMEIRO_ACESSO",
        message: "Você precisa definir uma nova senha antes de continuar.",
      });
    }
    return next.handle();
  }
}
