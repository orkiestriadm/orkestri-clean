import {
  Module, Controller, Get, Post, Put, Patch, Delete,
  Body, Param, Query, Req, UseGuards, Injectable, Logger,
  NotFoundException, BadRequestException,
} from "@nestjs/common";
import { AuthGuard } from "@nestjs/passport";
import { PrismaService } from "../../prisma/prisma.service";
import { Permissions } from "../auth/permissions.decorator";
import { PermissionsGuard } from "../auth/permissions.guard";
import * as crypto from "crypto";
import * as net from "net";
import * as dns from "dns/promises";

// ── Eventos suportados ────────────────────────────────────────────────────────
export const WEBHOOK_EVENTOS = [
  "chamado.criado",
  "chamado.atualizado",
  "chamado.resolvido",
  "chamado.fechado",
  "contrato.vencendo",
  "contrato.vencido",
  "ativo.garantia_vencendo",
  "projeto.concluido",
  "usuario.criado",
] as const;

// ── SSRF guard ────────────────────────────────────────────────────────────────
const isProd = process.env.NODE_ENV === "production";

/** Reject URLs pointing to loopback, link-local, RFC1918 ranges, or non-http(s). */
async function validateWebhookUrl(rawUrl: string): Promise<void> {
  let u: URL;
  try { u = new URL(rawUrl); } catch { throw new BadRequestException("URL inválida"); }

  if (!["http:", "https:"].includes(u.protocol)) {
    throw new BadRequestException("URL deve usar http(s)");
  }
  if (isProd && u.protocol === "http:") {
    throw new BadRequestException("Em produção, webhooks devem usar HTTPS");
  }

  // If hostname is literal IP, check directly. Otherwise resolve.
  const hostname = u.hostname;
  const ipFamily = net.isIP(hostname);
  const ips: string[] = ipFamily ? [hostname] : await dns.lookup(hostname, { all: true }).then(rs => rs.map(r => r.address)).catch(() => []);

  if (ips.length === 0 && !ipFamily) {
    throw new BadRequestException("Host não resolve");
  }

  for (const ip of ips) {
    if (isPrivateIp(ip)) {
      throw new BadRequestException(`URL aponta para rede privada/interna (${ip}). Bloqueado por segurança.`);
    }
  }
}

function isPrivateIp(ip: string): boolean {
  if (net.isIPv4(ip)) {
    const parts = ip.split(".").map(Number);
    const [a, b] = parts;
    if (a === 10) return true;
    if (a === 127) return true;             // loopback
    if (a === 169 && b === 254) return true;// link-local
    if (a === 172 && b >= 16 && b <= 31) return true;
    if (a === 192 && b === 168) return true;
    if (a === 0) return true;
    if (a >= 224) return true;              // multicast/reserved
    return false;
  }
  if (net.isIPv6(ip)) {
    const low = ip.toLowerCase();
    if (low === "::1") return true;
    if (low.startsWith("fc") || low.startsWith("fd")) return true; // unique local
    if (low.startsWith("fe80")) return true;                       // link-local
    if (low.startsWith("::ffff:")) {
      const v4 = low.slice(7);
      if (net.isIPv4(v4)) return isPrivateIp(v4);
    }
    return false;
  }
  return true; // unknown — fail closed
}

// ── Service (exported for use in other modules) ───────────────────────────────
@Injectable()
export class WebhookService {
  private readonly logger = new Logger(WebhookService.name);
  constructor(private prisma: PrismaService) {}
  private get db() { return this.prisma as any; }

  async fire(evento: string, payload: Record<string, any>, organizationId?: string): Promise<void> {
    try {
      const where: any = { evento, ativo: true };
      if (organizationId) where.organizationId = organizationId;
      const hooks = await this.db.webhook.findMany({ where });
      for (const hook of hooks) {
        // Dispatch off the request path so /chamados POST isn't blocked.
        setImmediate(() => this.dispatchWithRetry(hook, evento, payload).catch(() => {}));
      }
    } catch (err: any) {
      this.logger.error(`fire(${evento}) crash: ${err?.message}`);
    }
  }

  /** Retry up to 3 attempts with exponential backoff (2s, 8s). */
  async dispatchWithRetry(hook: any, evento: string, payload: any): Promise<void> {
    const maxAttempts = 3;
    const backoffMs = [2000, 8000];
    let lastErr: any = null;
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      const result = await this.dispatch(hook, evento, payload, attempt);
      if (result.sucesso) return;
      // Don't retry on 4xx (client error) — only network/5xx
      if (result.statusCode && result.statusCode >= 400 && result.statusCode < 500) return;
      lastErr = result.erro;
      if (attempt < maxAttempts) {
        await new Promise(r => setTimeout(r, backoffMs[attempt - 1]));
      }
    }
    if (lastErr) this.logger.warn(`Webhook ${hook.id} falhou após ${maxAttempts} tentativas: ${lastErr}`);
  }

  /** Single attempt — logs to webhookLog and updates webhook counters. */
  async dispatch(
    hook: any,
    evento: string,
    payload: any,
    attempt = 1,
  ): Promise<{ sucesso: boolean; statusCode: number | null; erro?: string }> {
    const logId = crypto.randomUUID();
    const body = JSON.stringify({ evento, timestamp: new Date().toISOString(), ...payload });
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      "X-Orkestri-Event": evento,
      "X-Orkestri-Delivery": logId,
      "X-Orkestri-Attempt": String(attempt),
      ...(hook.headers as Record<string, string> || {}),
    };
    if (hook.secret) {
      const sig = crypto.createHmac("sha256", hook.secret).update(body).digest("hex");
      headers["X-Orkestri-Signature"] = `sha256=${sig}`;
    }

    let statusCode: number | null = null;
    let response = "";
    let sucesso = false;
    let erro = "";

    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 10000);
      const res = await fetch(hook.url, { method: "POST", headers, body, signal: controller.signal });
      clearTimeout(timeout);
      statusCode = res.status;
      response = (await res.text()).slice(0, 500);
      sucesso = res.ok;
    } catch (err: any) {
      erro = err?.message || "Request failed";
    }

    await this.db.webhookLog.create({
      data: {
        id: logId,
        webhookId: hook.id,
        evento,
        payload,
        statusCode,
        response,
        sucesso,
        erro: erro || null,
      },
    }).catch(() => {});

    await this.db.webhook.update({
      where: { id: hook.id },
      data: {
        totalEnvios: { increment: 1 },
        ultimoEnvio: new Date(),
        ultimoStatus: statusCode,
      },
    }).catch(() => {});

    return { sucesso, statusCode, erro: erro || undefined };
  }
}

// ── Controller ────────────────────────────────────────────────────────────────
@Controller("webhooks")
@UseGuards(AuthGuard("jwt"), PermissionsGuard)
class WebhooksController {
  constructor(
    private prisma: PrismaService,
    private webhookService: WebhookService,
  ) {}
  private get db() { return this.prisma as any; }

  @Get("eventos")
  @Permissions("automacoes:ver")
  async getEventos() {
    return WEBHOOK_EVENTOS;
  }

  @Get()
  @Permissions("automacoes:ver")
  async findAll(@Req() req: any, @Query("ativo") ativo?: string) {
    const orgId = req.user?.organizationId;
    const where: any = { ...(orgId ? { organizationId: orgId } : {}) };
    if (ativo === "true")  where.ativo = true;
    if (ativo === "false") where.ativo = false;
    return this.db.webhook.findMany({ where, orderBy: { criadoEm: "desc" } });
  }

  @Get(":id/logs")
  @Permissions("automacoes:ver")
  async getLogs(@Param("id") id: string, @Query("limit") limit?: string) {
    const take = Math.min(Number(limit) || 30, 100);
    return this.db.webhookLog.findMany({
      where: { webhookId: id },
      orderBy: { criadoEm: "desc" },
      take,
    });
  }

  @Post()
  @Permissions("automacoes:criar")
  async create(@Body() body: {
    nome: string; url: string; evento: string;
    headers?: Record<string, string>; secret?: string; descricao?: string;
  }, @Req() req: any) {
    if (!body.nome?.trim()) throw new BadRequestException("Nome obrigatório");
    if (!body.url?.trim())  throw new BadRequestException("URL obrigatória");
    if (!body.evento)       throw new BadRequestException("Evento obrigatório");
    if (!WEBHOOK_EVENTOS.includes(body.evento as any)) throw new BadRequestException("Evento inválido");
    await validateWebhookUrl(body.url);

    const orgId = req.user?.organizationId;
    return this.db.webhook.create({
      data: {
        id:        crypto.randomUUID(),
        nome:      body.nome.trim(),
        url:       body.url.trim(),
        evento:    body.evento,
        headers:   body.headers || {},
        secret:    body.secret?.trim() || null,
        descricao: body.descricao?.trim() || null,
        ...(orgId ? { organizationId: orgId } : {}),
      } as any,
    });
  }

  @Put(":id")
  @Permissions("automacoes:editar")
  async update(@Param("id") id: string, @Body() body: any) {
    const existing = await this.db.webhook.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException("Webhook não encontrado");
    if (body.url) await validateWebhookUrl(body.url);
    if (body.evento && !WEBHOOK_EVENTOS.includes(body.evento)) throw new BadRequestException("Evento inválido");
    return this.db.webhook.update({
      where: { id },
      data: {
        ...(body.nome      && { nome:      body.nome.trim() }),
        ...(body.url       && { url:       body.url.trim() }),
        ...(body.evento    && { evento:    body.evento }),
        ...(body.headers   !== undefined && { headers:   body.headers }),
        ...(body.secret    !== undefined && { secret:    body.secret?.trim() || null }),
        ...(body.descricao !== undefined && { descricao: body.descricao }),
        ...(body.ativo     !== undefined && { ativo:     Boolean(body.ativo) }),
        atualizadoEm: new Date(),
      },
    });
  }

  @Patch(":id/toggle")
  @Permissions("automacoes:editar")
  async toggle(@Param("id") id: string) {
    const existing = await this.db.webhook.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException("Webhook não encontrado");
    return this.db.webhook.update({ where: { id }, data: { ativo: !existing.ativo } });
  }

  @Post(":id/testar")
  @Permissions("automacoes:editar")
  async testar(@Param("id") id: string) {
    const hook = await this.db.webhook.findUnique({ where: { id } });
    if (!hook) throw new NotFoundException("Webhook não encontrado");

    // Single dispatch (no retry) for a quick test
    await this.webhookService.dispatch(hook, hook.evento, {
      teste: true,
      mensagem: "Este é um teste do webhook Orkestri",
      timestamp: new Date().toISOString(),
    });

    const log = await this.db.webhookLog.findFirst({
      where: { webhookId: id },
      orderBy: { criadoEm: "desc" },
    });
    return log;
  }

  @Delete(":id")
  @Permissions("automacoes:deletar")
  async remove(@Param("id") id: string) {
    const existing = await this.db.webhook.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException("Webhook não encontrado");
    await this.db.webhook.delete({ where: { id } });
    return { message: "Webhook removido" };
  }
}

// ── Module ────────────────────────────────────────────────────────────────────
@Module({
  controllers: [WebhooksController],
  providers:   [PrismaService, WebhookService],
  exports:     [WebhookService],
})
export class WebhooksModule {}
