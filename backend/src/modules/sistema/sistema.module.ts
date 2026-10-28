import { Module, Controller, Get, Post, Body, UseGuards, Req, Logger, OnModuleInit, Injectable } from "@nestjs/common";
import { AuthGuard } from "@nestjs/passport";
import { IsString, IsIn, IsOptional, IsBoolean } from "class-validator";
import { PrismaService } from "../../prisma/prisma.service";
import { ConfigService } from "@nestjs/config";
import * as fs from "fs";
import * as path from "path";
import { execFileSync } from "child_process";

class UpdateSistemaConfigDto {
  @IsOptional() @IsString() logsPath?: string;
  @IsOptional() @IsIn(["24","48","120"]) logsRetencaoHoras?: string;
  @IsOptional() @IsString() backupPath?: string;
  @IsOptional() @IsString() backupFullCron?: string;
  @IsOptional() @IsString() backupIncrementalCron?: string;
  @IsOptional() @IsBoolean() backupFullAtivo?: boolean;
  @IsOptional() @IsBoolean() backupIncrementalAtivo?: boolean;
  @IsOptional() @IsString() backupFullRetencao?: string;
  @IsOptional() @IsString() backupIncrementalRetencao?: string;
  @IsOptional() @IsString() backupCopiaPath?: string;
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
      backupFullRetencao:        this.config.backupFullRetencao        || "14",
      backupIncrementalRetencao: this.config.backupIncrementalRetencao || "24",
      backupCopiaPath:           this.config.backupCopiaPath           || "",
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

    // Catch-up: se esta atrasado, roda logo apos o boot (evita nunca disparar com restarts frequentes)
    const lastFull = cfg.ultimoBackupFull ? new Date(cfg.ultimoBackupFull).getTime() : 0;
    if (cfg.backupFullAtivo && Date.now() - lastFull >= fullMs) {
      setTimeout(() => this.runBackupFull().catch(() => {}), 2 * 60 * 1000);
    }
    const lastInc = cfg.ultimoBackupIncremental ? new Date(cfg.ultimoBackupIncremental).getTime() : 0;
    if (cfg.backupIncrementalAtivo && Date.now() - lastInc >= incMs) {
      setTimeout(() => this.runBackupIncremental().catch(() => {}), 3 * 60 * 1000);
    }
  }

  // Extrai host/porta/usuario/senha/db do DATABASE_URL, descartando a query-string.
  private parseDbUrl() {
    const dbUrl = this.configService.get("DATABASE_URL", "");
    try {
      const u = new URL(dbUrl);
      return {
        host: u.hostname,
        port: u.port || "5432",
        user: decodeURIComponent(u.username),
        pass: decodeURIComponent(u.password),
        db:   u.pathname.replace(/^\//, ""), // só o nome; URL já separa a query
      };
    } catch {
      const m = dbUrl.match(/postgresql:\/\/([^:]+):([^@]+)@([^:]+):(\d+)\/([^?]+)/);
      if (!m) throw new Error("DATABASE_URL invalida");
      return { user: m[1], pass: m[2], host: m[3], port: m[4], db: m[5] };
    }
  }

  // Executa pg_dump escrevendo DIRETO no arquivo (-f), sem buffer na RAM e sem shell.
  private dumpToFile(arquivo: string, extraArgs: string[]) {
    const { host, port, user, pass, db } = this.parseDbUrl();
    const args = ["-h", host, "-p", port, "-U", user, "-Fc", ...extraArgs, "-f", arquivo, db];
    execFileSync("pg_dump", args, {
      env: { ...process.env, PGPASSWORD: pass },
      maxBuffer: 1024 * 1024 * 64,
      stdio: ["ignore", "ignore", "pipe"], // stderr capturado p/ mensagem de erro
    });
  }

  // Mantem apenas os N backups mais recentes na pasta.
  private pruneOldBackups(dir: string, keep: number) {
    try {
      const arq = fs.readdirSync(dir)
        .filter(f => f.endsWith(".dump") || f.endsWith(".sql"))
        .map(f => ({ f, t: fs.statSync(path.join(dir, f)).mtimeMs }))
        .sort((a, b) => b.t - a.t);
      for (const { f } of arq.slice(Math.max(1, keep))) fs.unlinkSync(path.join(dir, f));
    } catch (e: any) {
      this.logger.warn("Falha ao limpar backups antigos: " + e.message);
    }
  }

  // Copia opcional para um segundo caminho (ex: share de rede montado).
  private copiaExterna(arquivo: string, cfg: any) {
    const destino = cfg.backupCopiaPath;
    if (!destino) return;
    try {
      fs.mkdirSync(destino, { recursive: true });
      fs.copyFileSync(arquivo, path.join(destino, path.basename(arquivo)));
      this.logger.log(`Copia externa do backup em: ${destino}`);
    } catch (e: any) {
      this.logger.warn("Falha na copia externa: " + e.message);
    }
  }

  // Reaplica config e reagenda os jobs (chamado quando a config muda na UI).
  public async reagendar() {
    await this.loadConfig();
    this.startSchedulers();
  }

  async runBackupFull(): Promise<{ sucesso: boolean; arquivo?: string; tamanhoMB?: number; erro?: string }> {
    const cfg = this.getConfig();
    const now = new Date();
    const ts  = now.toISOString().replace(/[:.]/g, "-").slice(0, 19);
    const dir = path.join(cfg.backupPath, "full");
    const arquivo = path.join(dir, `backup-full-${ts}.dump`);

    try {
      fs.mkdirSync(dir, { recursive: true });
      this.dumpToFile(arquivo, []);                       // dump completo (schema + dados), formato custom
      const tamanho = fs.statSync(arquivo).size;
      if (tamanho === 0) throw new Error("pg_dump gerou arquivo vazio");
      await this.saveConfig("ultimoBackupFull", now.toISOString());
      this.pruneOldBackups(dir, Number(cfg.backupFullRetencao) || 14);
      this.copiaExterna(arquivo, cfg);

      const mb = +(tamanho / 1048576).toFixed(1);
      this.logger.log(`Backup full concluido: ${arquivo} (${mb} MB)`);
      await this.logEvent("backup_full", `Backup full gerado: ${path.basename(arquivo)} (${mb} MB)`);
      return { sucesso: true, arquivo: path.basename(arquivo), tamanhoMB: mb };
    } catch (e: any) {
      try { if (fs.existsSync(arquivo)) fs.unlinkSync(arquivo); } catch {} // remove arquivo parcial/zerado
      const msg = (e.stderr ? e.stderr.toString() : "") || e.message;
      this.logger.error("Erro no backup full: " + msg);
      return { sucesso: false, erro: String(msg).slice(0, 300) };
    }
  }

  async runBackupIncremental(): Promise<{ sucesso: boolean; arquivo?: string; tamanhoMB?: number; erro?: string }> {
    const cfg = this.getConfig();
    const now = new Date();
    const ts  = now.toISOString().replace(/[:.]/g, "-").slice(0, 19);
    const dir = path.join(cfg.backupPath, "incremental");
    const arquivo = path.join(dir, `backup-inc-${ts}.dump`);

    try {
      fs.mkdirSync(dir, { recursive: true });
      this.dumpToFile(arquivo, ["--data-only"]);          // dados de TODAS as tabelas (snapshot leve/frequente)
      const tamanho = fs.statSync(arquivo).size;
      if (tamanho === 0) throw new Error("pg_dump gerou arquivo vazio");
      await this.saveConfig("ultimoBackupIncremental", now.toISOString());
      this.pruneOldBackups(dir, Number(cfg.backupIncrementalRetencao) || 24);
      this.copiaExterna(arquivo, cfg);

      const mb = +(tamanho / 1048576).toFixed(1);
      this.logger.log(`Backup incremental concluido: ${arquivo} (${mb} MB)`);
      await this.logEvent("backup_incremental", `Backup incremental gerado: ${path.basename(arquivo)} (${mb} MB)`);
      return { sucesso: true, arquivo: path.basename(arquivo), tamanhoMB: mb };
    } catch (e: any) {
      try { if (fs.existsSync(arquivo)) fs.unlinkSync(arquivo); } catch {}
      const msg = (e.stderr ? e.stderr.toString() : "") || e.message;
      this.logger.error("Erro no backup incremental: " + msg);
      return { sucesso: false, erro: String(msg).slice(0, 300) };
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
      try { return fs.readdirSync(d).filter(f => f.endsWith(".dump") || f.endsWith(".sql")).sort().reverse().slice(0, 20); }
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
    if (dto.backupFullRetencao)        updates.backupFullRetencao        = dto.backupFullRetencao;
    if (dto.backupIncrementalRetencao) updates.backupIncrementalRetencao = dto.backupIncrementalRetencao;
    if (dto.backupCopiaPath !== undefined) updates.backupCopiaPath        = dto.backupCopiaPath;
    for (const [k, v] of Object.entries(updates)) {
      await this.sistemaService.saveConfig(k, v);
    }
    await this.sistemaService.reagendar();
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