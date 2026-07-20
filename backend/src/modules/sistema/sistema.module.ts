import { Module, Controller, Get, Post, Body, UseGuards, Req, Logger, OnModuleInit, Injectable } from "@nestjs/common";
import { AuthGuard } from "@nestjs/passport";
import { IsString, IsIn, IsOptional, IsBoolean } from "class-validator";
import { PrismaService } from "../../prisma/prisma.service";
import { ConfigService } from "@nestjs/config";
import * as fs from "fs";
import * as path from "path";
import { spawn } from "child_process";

// Tabelas de telemetria do Monitoramento (time-series regeneravel, ~7GB). Sao
// EXCLUIDAS do dump de dados para o backup ser rapido e nao derrubar a API.
// A estrutura (CREATE TABLE) continua no backup; apenas os dados sao pulados.
const BACKUP_EXCLUDE_DATA = [
  "mon_probe_result", "mon_metric_sample", "mon_rollup_minute",
  "mon_rollup_hour", "mon_status_event",
];

// Executa pg_dump em streaming direto para arquivo, SEM bloquear o event loop e
// SEM bufferizar a saida em memoria (o execSync antigo travava a API inteira e
// estourava memoria em bancos grandes). Resolve com Promise.
function runPgDump(args: string[], outFile: string, pass: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const out = fs.createWriteStream(outFile);
    const child = spawn("pg_dump", args, { env: { ...process.env, PGPASSWORD: pass } });
    let stderr = "";
    child.stdout.pipe(out);
    child.stderr.on("data", d => { stderr += d.toString(); });
    child.on("error", reject);
    out.on("error", reject);
    child.on("close", code => {
      out.close();
      if (code === 0) resolve();
      else reject(new Error(`pg_dump saiu com codigo ${code}: ${stderr.slice(0, 500)}`));
    });
  });
}

class UpdateSistemaConfigDto {
  @IsOptional() @IsString() logsPath?: string;
  @IsOptional() @IsIn(["24","48","120"]) logsRetencaoHoras?: string;
  @IsOptional() @IsString() backupPath?: string;
  @IsOptional() @IsString() backupFullCron?: string;
  @IsOptional() @IsString() backupIncrementalCron?: string;
  @IsOptional() @IsBoolean() backupFullAtivo?: boolean;
  @IsOptional() @IsBoolean() backupIncrementalAtivo?: boolean;
}

@Injectable()
export class SistemaService implements OnModuleInit {
  private readonly logger = new Logger(SistemaService.name);
  private fullInterval: NodeJS.Timeout | null = null;
  private incrementalInterval: NodeJS.Timeout | null = null;
  private logsInterval: NodeJS.Timeout | null = null;
  private config: any = {};

  constructor(private prisma: PrismaService, private configService: ConfigService) {}

  async onModuleInit() {
    await this.loadConfig();
    this.startSchedulers();
    this.logger.log("SistemaService inicializado");
  }

  private readonly DEFAULT_ORG = "00000000-0000-0000-0000-000000000001";

  async loadConfig() {
    try {
      const configs = await this.prisma.sistemaConfig.findMany({ where: { organizationId: this.DEFAULT_ORG } as any });
      this.config = Object.fromEntries(configs.map((c: any) => [c.chave, c.valor]));
    } catch {
      this.config = {};
    }
  }

  getConfig() {
    return {
      logsPath:             this.config.logsPath             || "/app/logs",
      logsRetencaoHoras:    this.config.logsRetencaoHoras    || "24",
      backupPath:           this.config.backupPath           || "/app/backup",
      backupFullCron:       this.config.backupFullCron       || "daily",
      backupIncrementalCron:this.config.backupIncrementalCron|| "hourly",
      backupFullAtivo:      this.config.backupFullAtivo      !== "false",
      backupIncrementalAtivo: this.config.backupIncrementalAtivo !== "false",
      ultimoBackupFull:     this.config.ultimoBackupFull     || null,
      ultimoBackupIncremental: this.config.ultimoBackupIncremental || null,
      ultimaLimpezaLogs:    this.config.ultimaLimpezaLogs    || null,
    };
  }

  async saveConfig(key: string, value: string) {
    await (this.prisma.sistemaConfig as any).upsert({
      where: { organizationId_chave: { organizationId: this.DEFAULT_ORG, chave: key } },
      update: { valor: value },
      create: { organizationId: this.DEFAULT_ORG, chave: key, valor: value },
    });
    this.config[key] = value;
  }

  private startSchedulers() {
    if (this.fullInterval)          clearInterval(this.fullInterval);
    if (this.incrementalInterval)   clearInterval(this.incrementalInterval);
    if (this.logsInterval)          clearInterval(this.logsInterval);

    const cfg = this.getConfig();

    // Backup full: diario (24h) ou semanal (168h)
    const fullMs = cfg.backupFullCron === "weekly" ? 7*24*60*60*1000 : 24*60*60*1000;
    if (cfg.backupFullAtivo) {
      this.fullInterval = setInterval(() => this.runBackupFull(), fullMs);
      this.logger.log(`Backup full agendado a cada ${fullMs/3600000}h`);
    }

    // Backup incremental: por hora ou a cada 6h
    const incMs = cfg.backupIncrementalCron === "6h" ? 6*60*60*1000 : 60*60*1000;
    if (cfg.backupIncrementalAtivo) {
      this.incrementalInterval = setInterval(() => this.runBackupIncremental(), incMs);
      this.logger.log(`Backup incremental agendado a cada ${incMs/3600000}h`);
    }

    // Limpeza de logs
    const retHoras = Number(cfg.logsRetencaoHoras) || 24;
    this.logsInterval = setInterval(() => this.cleanLogs(retHoras), 60*60*1000);
    this.logger.log(`Limpeza de logs agendada (retencao: ${retHoras}h)`);
  }

  async runBackupFull(): Promise<{ sucesso: boolean; arquivo?: string; erro?: string }> {
    const cfg = this.getConfig();
    const now = new Date();
    const ts  = now.toISOString().replace(/[:.]/g, "-").slice(0, 19);
    const dir = path.join(cfg.backupPath, "full");
    const arquivo = path.join(dir, `backup-full-${ts}.sql`);

    try {
      const dbUrl = this.configService.get("DATABASE_URL", "");
      const match = dbUrl.match(/postgresql:\/\/([^:]+):([^@]+)@([^:]+):(\d+)\/(.+)/);
      if (!match) throw new Error("DATABASE_URL invalida");
      const [, user, pass, host, port, db] = match;

      fs.mkdirSync(dir, { recursive: true });
      // -Fc = formato custom (comprimido). Exclui os DADOS das tabelas de telemetria
      // (mantém a estrutura). Streaming direto p/ arquivo, sem travar a API.
      const args = [
        "-h", host, "-p", port, "-U", user, "-Fc",
        ...BACKUP_EXCLUDE_DATA.flatMap(t => ["--exclude-table-data", t]),
        db,
      ];
      await runPgDump(args, arquivo, pass);
      await this.saveConfig("ultimoBackupFull", now.toISOString());

      this.logger.log(`Backup full concluido: ${arquivo}`);
      await this.logEvent("backup_full", `Backup full gerado: ${path.basename(arquivo)}`);
      return { sucesso: true, arquivo: path.basename(arquivo) };
    } catch (e: any) {
      this.logger.error("Erro no backup full: " + e.message);
      return { sucesso: false, erro: e.message };
    }
  }

  async runBackupIncremental(): Promise<{ sucesso: boolean; arquivo?: string; erro?: string }> {
    const cfg = this.getConfig();
    const now = new Date();
    const ts  = now.toISOString().replace(/[:.]/g, "-").slice(0, 19);
    const dir = path.join(cfg.backupPath, "incremental");
    const arquivo = path.join(dir, `backup-inc-${ts}.sql`);

    try {
      const dbUrl = this.configService.get("DATABASE_URL", "");
      const match = dbUrl.match(/postgresql:\/\/([^:]+):([^@]+)@([^:]+):(\d+)\/(.+)/);
      if (!match) throw new Error("DATABASE_URL invalida");
      const [, user, pass, host, port, db] = match;

      // Backup incremental: apenas as tabelas de negocio (leves). Streaming p/ arquivo,
      // sem travar a API. As tabelas de telemetria (mon_*) NAO entram aqui.
      const tables = ["events", "tasks", "notes", "daily_tasks", "notifications", "audit_log"];
      fs.mkdirSync(dir, { recursive: true });
      const args = [
        "-h", host, "-p", port, "-U", user, "--data-only",
        ...tables.flatMap(t => ["--table", t]),
        db,
      ];
      await runPgDump(args, arquivo, pass);
      await this.saveConfig("ultimoBackupIncremental", now.toISOString());

      this.logger.log(`Backup incremental concluido: ${arquivo}`);
      await this.logEvent("backup_incremental", `Backup incremental gerado: ${path.basename(arquivo)}`);
      return { sucesso: true, arquivo: path.basename(arquivo) };
    } catch (e: any) {
      this.logger.error("Erro no backup incremental: " + e.message);
      return { sucesso: false, erro: e.message };
    }
  }

  async cleanLogs(retencaoHoras: number): Promise<{ removidos: number }> {
    const cfg = this.getConfig();
    const logsDir = cfg.logsPath;
    const corte = new Date(Date.now() - retencaoHoras * 60 * 60 * 1000);
    let removidos = 0;

    try {
      // Limpa logs do banco de dados (notifications antigas lidas)
      const result = await this.prisma.notification.deleteMany({
        where: { lida: true, criadoEm: { lt: corte } },
      });
      removidos = result.count;

      // Limpa audit logs antigos
      await this.prisma.auditLog.deleteMany({
        where: { criadoEm: { lt: corte } },
      });

      // Limpa arquivos de log no disco se existirem
      if (fs.existsSync(logsDir)) {
        const files = fs.readdirSync(logsDir);
        for (const file of files) {
          if (file.endsWith(".log") || file.endsWith(".txt")) {
            const filePath = path.join(logsDir, file);
            const stat = fs.statSync(filePath);
            if (stat.mtime < corte) {
              fs.unlinkSync(filePath);
              removidos++;
            }
          }
        }
      }

      await this.saveConfig("ultimaLimpezaLogs", new Date().toISOString());
      this.logger.log(`Limpeza de logs: ${removidos} registros removidos`);
    } catch (e: any) {
      this.logger.error("Erro na limpeza de logs: " + e.message);
    }

    return { removidos };
  }

  async listBackups(): Promise<{ full: string[]; incremental: string[] }> {
    const cfg = this.getConfig();
    const fullDir = path.join(cfg.backupPath, "full");
    const incDir  = path.join(cfg.backupPath, "incremental");
    const readDir = (d: string) => {
      try { return fs.readdirSync(d).filter(f => f.endsWith(".sql")).reverse().slice(0, 20); }
      catch { return []; }
    };
    return { full: readDir(fullDir), incremental: readDir(incDir) };
  }

  async logEvent(tipo: string, mensagem: string) {
    try {
      await (this.prisma.auditLog.create as any)({
        data: { tabela: "sistema", registroId: tipo, acao: mensagem, organizationId: this.DEFAULT_ORG },
      });
    } catch {}
  }
}

@Controller("sistema")
class SistemaController {
  constructor(private sistemaService: SistemaService) {}

  @Get("config")
  @UseGuards(AuthGuard("jwt"))
  async getConfig(@Req() req: any) {
    if (!req.user.isMaster) throw new Error("Acesso negado");
    return this.sistemaService.getConfig();
  }

  @Post("config")
  @UseGuards(AuthGuard("jwt"))
  async updateConfig(@Body() dto: UpdateSistemaConfigDto, @Req() req: any) {
    if (!req.user.isMaster) throw new Error("Acesso negado");
    const updates: Record<string, string> = {};
    if (dto.logsPath)              updates.logsPath              = dto.logsPath;
    if (dto.logsRetencaoHoras)     updates.logsRetencaoHoras     = dto.logsRetencaoHoras;
    if (dto.backupPath)            updates.backupPath            = dto.backupPath;
    if (dto.backupFullCron)        updates.backupFullCron        = dto.backupFullCron;
    if (dto.backupIncrementalCron) updates.backupIncrementalCron = dto.backupIncrementalCron;
    if (dto.backupFullAtivo !== undefined)        updates.backupFullAtivo        = String(dto.backupFullAtivo);
    if (dto.backupIncrementalAtivo !== undefined) updates.backupIncrementalAtivo = String(dto.backupIncrementalAtivo);
    for (const [k, v] of Object.entries(updates)) {
      await this.sistemaService.saveConfig(k, v);
    }
    return this.sistemaService.getConfig();
  }

  @Post("backup/full")
  @UseGuards(AuthGuard("jwt"))
  async backupFull(@Req() req: any) {
    if (!req.user.isMaster) throw new Error("Acesso negado");
    return this.sistemaService.runBackupFull();
  }

  @Post("backup/incremental")
  @UseGuards(AuthGuard("jwt"))
  async backupIncremental(@Req() req: any) {
    if (!req.user.isMaster) throw new Error("Acesso negado");
    return this.sistemaService.runBackupIncremental();
  }

  @Get("backup/list")
  @UseGuards(AuthGuard("jwt"))
  async listBackups(@Req() req: any) {
    if (!req.user.isMaster) throw new Error("Acesso negado");
    return this.sistemaService.listBackups();
  }

  @Post("logs/limpar")
  @UseGuards(AuthGuard("jwt"))
  async limparLogs(@Req() req: any) {
    if (!req.user.isMaster) throw new Error("Acesso negado");
    const cfg = this.sistemaService.getConfig();
    return this.sistemaService.cleanLogs(Number(cfg.logsRetencaoHoras) || 24);
  }
}

@Module({ controllers: [SistemaController], providers: [SistemaService], exports: [SistemaService] })
export class SistemaModule {}