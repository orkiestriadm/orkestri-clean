import {
  Module, Controller, Get, Post, Patch, Delete,
  Body, Param, UseGuards, Req, Injectable, NotFoundException, BadRequestException,
} from "@nestjs/common";
import { AuthGuard } from "@nestjs/passport";
import { PrismaService } from "../../prisma/prisma.service";
import { Permissions } from "../auth/permissions.decorator";
import { PermissionsGuard } from "../auth/permissions.guard";
import { encryptSecret } from "../../common/vault";
import * as crypto from "crypto";

// ── Service ──────────────────────────────────────────────────────────────────
@Injectable()
export class OsaService {
  constructor(private readonly db: PrismaService) {}

  // Remove a senha cifrada da resposta; expoe apenas se HA senha.
  private sanitize(m: any) {
    const { senhaCifrada, ...rest } = m;
    return { ...rest, temSenha: !!senhaCifrada };
  }

  // Status derivado em tempo de leitura (sempre atual, independente do ciclo do worker).
  private statusDe(m: any): string {
    if (m.ultimoErro) return "ERRO";
    if (!m.ultimaAtualizacao) return "DESCONHECIDO";
    const min = (Date.now() - new Date(m.ultimaAtualizacao).getTime()) / 60000;
    const max = m.tempoMaxMin || 5;
    if (min > max) return "ATRASADO";
    if (min >= max * 0.8) return "ATENCAO";
    return "ONLINE";
  }

  async list(orgId: string) {
    const ms = await (this.db as any).osaMonitor.findMany({
      where: { organizationId: orgId },
      orderBy: { descricao: "asc" },
    });
    return ms.map((m: any) => ({ ...this.sanitize(m), status: this.statusDe(m) }));
  }

  async create(orgId: string, body: any) {
    if (!body?.descricao || !body?.ip) {
      throw new BadRequestException("descricao e ip sao obrigatorios");
    }
    const data: any = {
      id: crypto.randomUUID(),
      organizationId: orgId,
      descricao: String(body.descricao).trim(),
      ip: String(body.ip).trim(),
      caminho: body.caminho ? String(body.caminho).trim() : null,
      share:   body.share   ? String(body.share).trim()   : null,
      usuario: body.usuario ? String(body.usuario).trim() : null,
      dominio: body.dominio ? String(body.dominio).trim() : null,
      filtro:  body.filtro  ? String(body.filtro).trim()  : "*.tag",
      tempoMaxMin:  Number(body.tempoMaxMin)  || 5,
      intervaloSeg: Number(body.intervaloSeg) || 60,
      ativo: body.ativo !== false,
    };
    if (body.senha) data.senhaCifrada = encryptSecret(String(body.senha));
    const m = await (this.db as any).osaMonitor.create({ data });
    return this.sanitize(m);
  }

  async update(orgId: string, id: string, body: any) {
    const ex = await (this.db as any).osaMonitor.findFirst({ where: { id, organizationId: orgId } });
    if (!ex) throw new NotFoundException("Monitor OSA nao encontrado");
    const data: any = {};
    for (const f of ["descricao", "ip", "caminho", "share", "usuario", "dominio", "filtro"]) {
      if (body[f] !== undefined) data[f] = body[f] === "" ? null : String(body[f]).trim();
    }
    if (body.tempoMaxMin  !== undefined) data.tempoMaxMin  = Number(body.tempoMaxMin)  || 5;
    if (body.intervaloSeg !== undefined) data.intervaloSeg = Number(body.intervaloSeg) || 60;
    if (body.ativo !== undefined) data.ativo = !!body.ativo;
    if (body.senha) data.senhaCifrada = encryptSecret(String(body.senha)); // só troca se enviar nova
    const m = await (this.db as any).osaMonitor.update({ where: { id }, data });
    return this.sanitize(m);
  }

  async remove(orgId: string, id: string) {
    const ex = await (this.db as any).osaMonitor.findFirst({ where: { id, organizationId: orgId } });
    if (!ex) throw new NotFoundException("Monitor OSA nao encontrado");
    await (this.db as any).osaMonitor.delete({ where: { id } });
    return { ok: true };
  }
}

// ── Controller ───────────────────────────────────────────────────────────────
@Controller("osa")
@UseGuards(AuthGuard("jwt"), PermissionsGuard)
export class OsaController {
  constructor(private readonly svc: OsaService) {}

  private org(req: any) {
    const orgId = req?.user?.organizationId;
    if (!orgId) throw new BadRequestException("Organizacao nao identificada");
    return orgId;
  }

  @Get()         @Permissions("monitoramento:ver")       list(@Req() r: any) { return this.svc.list(this.org(r)); }
  @Post()        @Permissions("monitoramento:gerenciar") create(@Req() r: any, @Body() b: any) { return this.svc.create(this.org(r), b); }
  @Patch(":id")  @Permissions("monitoramento:gerenciar") update(@Req() r: any, @Param("id") id: string, @Body() b: any) { return this.svc.update(this.org(r), id, b); }
  @Delete(":id") @Permissions("monitoramento:gerenciar") remove(@Req() r: any, @Param("id") id: string) { return this.svc.remove(this.org(r), id); }
}

@Module({ controllers: [OsaController], providers: [OsaService] })
export class OsaModule {}
