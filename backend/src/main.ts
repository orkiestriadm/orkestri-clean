import { NestFactory, Reflector } from "@nestjs/core";
import { ValidationPipe, Logger } from "@nestjs/common";
import { AppModule } from "./app.module";
import helmet from "helmet";
import * as cookieParser from "cookie-parser";
import { NestExpressApplication } from "@nestjs/platform-express";
import * as path from "path";
import * as fs from "fs";
import { randomBytes } from "crypto";
import { Request, Response, NextFunction } from "express";
import { FirstAccessGuard } from "./modules/auth/first-access.guard";

async function bootstrap() {
  const logger = new Logger("Bootstrap");
  const app = await NestFactory.create<NestExpressApplication>(AppModule);

  // Servir uploads de arquivos (anexos de chamados)
  const uploadsDir = process.env.UPLOAD_DIR || "/app/uploads";
  if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });
  app.useStaticAssets(uploadsDir, { prefix: "/uploads" });

  // Cookie parsing (required for HttpOnly JWT cookies)
  app.use(cookieParser());
  
  // Set global prefix so it expects /api
  app.setGlobalPrefix('api');

  // Security headers
  app.use(helmet({
    crossOriginResourcePolicy: { policy: "same-site" },
    contentSecurityPolicy: false, // gerenciado pelo Nginx
  }));

  // CSRF — Double Submit Cookie pattern
  // O frontend lê o cookie csrf_token (não-HttpOnly) e envia como header X-CSRF-Token
  const CSRF_SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);
  const CSRF_EXEMPT_PATHS = ["/api/auth/login", "/api/auth/solicitar-acesso", "/api/auth/esqueci-senha",
    "/api/auth/enviar-otp", "/api/auth/verificar-otp", "/api/auth/redefinir-senha",
    "/api/auth/tenant-info", "/api/auth/organizations", "/api/billing/webhook/mp",
    "/api/billing/public/signup", "/health"];

  app.use((req: Request, res: Response, next: NextFunction) => {
    // Emite cookie CSRF a cada request (token rotativo por sessão)
    if (!req.cookies?.csrf_token) {
      const token = randomBytes(32).toString("hex");
      res.cookie("csrf_token", token, { httpOnly: false, sameSite: "strict", secure: req.headers["x-forwarded-proto"] === "https", path: "/" });
    }
    if (CSRF_SAFE_METHODS.has(req.method) || CSRF_EXEMPT_PATHS.includes(req.path)) return next();
    const headerToken = req.headers["x-csrf-token"] as string;
    const cookieToken = req.cookies?.csrf_token;
    if (!headerToken || !cookieToken || headerToken !== cookieToken) {
      res.status(403).json({ message: "CSRF token inválido." });
      return;
    }
    next();
  });

  // CORS — origins controladas via env
  const origins = process.env.CORS_ORIGINS
    ? process.env.CORS_ORIGINS.split(",").map(o => o.trim())
    : ["http://localhost"];
  app.enableCors({
    origin: origins,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Authorization", "Content-Type", "X-CSRF-Token"],
    credentials: true,
  });

  // Validação global de DTOs
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true, forbidNonWhitelisted: true }));

  // Guard global: bloqueia endpoints quando usuário ainda não trocou senha temporária
  app.useGlobalGuards(new FirstAccessGuard(app.get(Reflector)));

  const port = process.env.PORT || 3000;
  await app.listen(port, "0.0.0.0");
  logger.log(`Orkestri API running on port ${port}`);
  logger.log(`CORS origins: ${origins.join(", ")}`);
}
bootstrap();