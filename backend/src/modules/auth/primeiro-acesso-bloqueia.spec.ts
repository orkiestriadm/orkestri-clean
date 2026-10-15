import {
  Controller,
  Get,
  Patch,
  Post,
  UseGuards,
  Injectable,
  CanActivate,
  ExecutionContext,
  INestApplication,
} from "@nestjs/common";
import { Test } from "@nestjs/testing";
import { Reflector } from "@nestjs/core";
import { FirstAccessInterceptor, SKIP_FIRST_ACCESS_KEY } from "./first-access.interceptor";
import { SkipFirstAccessGuard } from "./first-access.decorator";

/**
 * A obrigatoriedade de trocar a senha temporária no primeiro acesso.
 *
 * Isto existia só no frontend. No backend havia um `FirstAccessGuard` global
 * que NUNCA bloqueou nada, e o último describe deste arquivo mostra por quê em
 * execução real: guard global roda antes do `AuthGuard("jwt")` (que é de rota),
 * lê `request.user === undefined` e libera tudo.
 *
 * Os endpoints de teste imitam os reais: `/agenda/eventos` é um endpoint comum
 * autenticado (foi por ele que um usuário com `primeiro_acesso = true` desde
 * 06/09/2026 criou 25 eventos em produção), e os de `/auth` que precisam
 * funcionar durante o primeiro acesso carregam `@SkipFirstAccessGuard()`.
 */

jest.setTimeout(30000);

/**
 * Faz o papel do `AuthGuard("jwt")`: guard DE ROTA que popula `request.user`.
 * O objeto é o mesmo que `JwtStrategy.validate()` devolve, incluindo
 * `primeiroAcesso` — o campo que a checagem lê.
 */
function guardDeRotaCom(primeiroAcesso: boolean) {
  @Injectable()
  class FakeJwtGuard implements CanActivate {
    canActivate(ctx: ExecutionContext) {
      ctx.switchToHttp().getRequest().user = {
        id: "fdc82c97-3a19-44f3-9c7f-f5ec10969d2f",
        email: "usuario@test.local",
        organizationId: "org-1",
        permissions: ["agenda:criar"],
        isMaster: false,
        primeiroAcesso,
      };
      return true;
    }
  }
  return FakeJwtGuard;
}

/** Controllers são criados por fábrica, um par para cada cenário da flag. */
function controllersPara(primeiroAcesso: boolean) {
  const JwtGuard = guardDeRotaCom(primeiroAcesso);

  // Endpoint comum, protegido por JWT. É o que tem de travar.
  @Controller("agenda")
  @UseGuards(JwtGuard)
  class AgendaFake {
    @Post("eventos")
    criar() {
      return { criado: true };
    }
  }

  @Controller("auth")
  @UseGuards(JwtGuard)
  class AuthFake {
    @Get("me")
    @SkipFirstAccessGuard()
    me() {
      return { ok: "me" };
    }

    @Post("logout")
    @SkipFirstAccessGuard()
    logout() {
      return { ok: "logout" };
    }

    @Post("ajuda")
    @SkipFirstAccessGuard()
    ajuda() {
      return { ok: "ajuda" };
    }

    @Patch("primeiro-acesso")
    @SkipFirstAccessGuard()
    primeiroAcessoEndpoint() {
      return { ok: "primeiro-acesso" };
    }
  }

  return [AgendaFake, AuthFake];
}

type Resp = { status: number; body: any };

async function sobeApp(
  primeiroAcesso: boolean,
  registra: (app: INestApplication, reflector: Reflector) => void,
) {
  const mod = await Test.createTestingModule({
    controllers: controllersPara(primeiroAcesso) as any,
  }).compile();
  const app = mod.createNestApplication();
  registra(app, app.get(Reflector));
  await app.listen(0);
  const porta = (app.getHttpServer().address() as any).port;

  const chama = async (metodo: string, rota: string): Promise<Resp> => {
    const res = await fetch(`http://127.0.0.1:${porta}${rota}`, { method: metodo });
    let body: any = null;
    try {
      body = await res.json();
    } catch {
      /* resposta sem corpo */
    }
    return { status: res.status, body };
  };

  return { app, chama };
}

const comoInterceptor = (app: INestApplication, reflector: Reflector) =>
  app.useGlobalInterceptors(new FirstAccessInterceptor(reflector));

describe("primeiro acesso — bloqueio no servidor", () => {
  describe("usuário com primeiroAcesso = true", () => {
    let app: INestApplication;
    let chama: (m: string, r: string) => Promise<Resp>;

    beforeAll(async () => {
      ({ app, chama } = await sobeApp(true, comoInterceptor));
    });
    afterAll(async () => {
      await app?.close();
    });

    it("endpoint comum autenticado responde 403 com code PRIMEIRO_ACESSO", async () => {
      const res = await chama("POST", "/agenda/eventos");
      expect(res.status).toBe(403);
      // Contrato que o frontend usa para redirecionar (frontend/src/lib/api.ts).
      expect(res.body.code).toBe("PRIMEIRO_ACESSO");
      expect(res.body.message).toContain("nova senha");
    });

    it.each([
      ["GET", "/auth/me"],
      ["POST", "/auth/logout"],
      ["POST", "/auth/ajuda"],
      ["PATCH", "/auth/primeiro-acesso"],
    ])("%s %s continua passando (@SkipFirstAccessGuard)", async (metodo, rota) => {
      const res = await chama(metodo, rota);
      expect(res.status).toBeLessThan(300);
    });
  });

  describe("usuário com primeiroAcesso = false", () => {
    let app: INestApplication;
    let chama: (m: string, r: string) => Promise<Resp>;

    beforeAll(async () => {
      ({ app, chama } = await sobeApp(false, comoInterceptor));
    });
    afterAll(async () => {
      await app?.close();
    });

    it("usa o endpoint comum normalmente", async () => {
      const res = await chama("POST", "/agenda/eventos");
      expect(res.status).toBe(201);
      expect(res.body).toEqual({ criado: true });
    });
  });

  /**
   * A regressão, provada: é por isto que a checagem NÃO pode voltar a ser um
   * guard global. Mesmo código, mesma metadata, mesmo usuário em primeiro
   * acesso — registrado com `useGlobalGuards` ele libera a requisição, porque
   * roda antes do `AuthGuard("jwt")` e não tem `request.user` para ler.
   *
   * O guard antigo é reproduzido aqui numa classe local: o arquivo
   * `first-access.guard.ts` foi removido justamente para ninguém reusar.
   */
  describe("por que não pode ser guard global", () => {
    let app: INestApplication;
    let chama: (m: string, r: string) => Promise<Resp>;

    @Injectable()
    class GuardAntigo implements CanActivate {
      constructor(private reflector: Reflector) {}
      canActivate(ctx: ExecutionContext): boolean {
        const skip = this.reflector.getAllAndOverride<boolean>(SKIP_FIRST_ACCESS_KEY, [
          ctx.getHandler(),
          ctx.getClass(),
        ]);
        if (skip) return true;
        const { user } = ctx.switchToHttp().getRequest();
        if (!user) return true; // <<< aqui o bloqueio inteiro se perdia
        if (user.primeiroAcesso) throw new Error("nunca chegava aqui");
        return true;
      }
    }

    beforeAll(async () => {
      ({ app, chama } = await sobeApp(true, (a, reflector) =>
        a.useGlobalGuards(new GuardAntigo(reflector)),
      ));
    });
    afterAll(async () => {
      await app?.close();
    });

    it("como guard global a checagem é código morto: 201 em vez de 403", async () => {
      const res = await chama("POST", "/agenda/eventos");
      expect(res.status).toBe(201);
    });
  });
});

/**
 * O registro no `main.ts`.
 *
 * Os testes acima provam que a checagem funciona como interceptor global e
 * falha como guard global. Falta travar o registro de verdade: o `main.ts` é
 * bootstrap, não entra em nenhuma suíte, e foi exatamente ali que o bloqueio
 * se perdeu por meses. Sem esta checagem, trocar de volta para
 * `useGlobalGuards` passaria por todos os testes verdes.
 */
describe("main.ts — registro do bloqueio", () => {
  const fs = require("fs");
  const path = require("path");
  const main: string = fs.readFileSync(path.join(__dirname, "../../main.ts"), "utf8");

  it("registra FirstAccessInterceptor como interceptor global", () => {
    expect(main).toMatch(/useGlobalInterceptors\(\s*new FirstAccessInterceptor\(/);
  });

  it("não registra o bloqueio como guard global (roda antes do AuthGuard)", () => {
    const comoGuard = /useGlobalGuards\([^)]*FirstAccess/;
    expect(main).not.toMatch(comoGuard);
  });
});

/**
 * Os 4 endpoints REAIS marcados em auth.controller.ts.
 *
 * Os testes acima usam controllers de mentira; este lê a metadata dos handlers
 * de verdade. Sem ele, apagar um `@SkipFirstAccessGuard()` do controller real
 * passaria batido — e o usuário em primeiro acesso ficaria sem conseguir nem
 * trocar a senha nem sair do sistema.
 */
describe("auth.controller.ts — endpoints isentos de verdade", () => {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const { AuthController } = require("./auth.controller");
  const marcado = (metodo: string) =>
    Reflect.getMetadata(SKIP_FIRST_ACCESS_KEY, AuthController.prototype[metodo]) === true;

  it.each(["me", "logout", "ajuda", "primeiroAcesso"])("%s é isento", (metodo) => {
    expect(AuthController.prototype[metodo]).toBeDefined();
    expect(marcado(metodo)).toBe(true);
  });

  it.each(["desbloquear", "aprovarSolicitacao", "listarSolicitacoes"])(
    "%s NÃO é isento",
    (metodo) => {
      expect(AuthController.prototype[metodo]).toBeDefined();
      expect(marcado(metodo)).toBe(false);
    },
  );
});
