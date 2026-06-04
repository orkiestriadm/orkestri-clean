import { NestFactory } from "@nestjs/core";
import { ValidationPipe, Logger } from "@nestjs/common";
import { AppModule } from "./app.module";
import helmet from "helmet";
import * as cookieParser from "cookie-parser";
import { NestExpressApplication } from "@nestjs/platform-express";
import * as path from "path";
import * as fs from "fs";

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
  app.use(helmet());

  // CORS — origins controladas via env
  const origins = process.env.CORS_ORIGINS
    ? process.env.CORS_ORIGINS.split(",").map(o => o.trim())
    : ["http://localhost"];
  app.enableCors({
    origin: origins,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Authorization", "Content-Type"],
    credentials: true,
  });

  // Validação global de DTOs
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true, forbidNonWhitelisted: true }));

  const port = process.env.PORT || 3000;
  await app.listen(port, "0.0.0.0");
  logger.log(`Orkestri API running on port ${port}`);
  logger.log(`CORS origins: ${origins.join(", ")}`);
}
bootstrap();