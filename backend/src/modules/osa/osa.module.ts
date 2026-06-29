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
import * as http from "http";
import * as mysql from "mysql2/promise";
import { Client as SSHClient } from "ssh2";

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
    // Só monitores SMB manuais de verdade. Os registros auto-descobertos do Zabbix
    // (zabbixHostId preenchido) já aparecem na seção "Via Zabbix" (endpoint zabbix-live),
    // entao sao escondidos aqui para nao duplicar o mesmo servidor na tela.
    const ms = await (this.db as any).osaMonitor.findMany({
      where: { organizationId: orgId, zabbixHostId: null },
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

  async zabbixLive() {
    const apiUrl = process.env.ZABBIX_API_URL;
    const token  = process.env.ZABBIX_API_TOKEN;
    if (!apiUrl || !token) return [];

    const HOSTIDS = ["11084", "11085", "11086", "11089", "11094"];
    const HOST_META: Record<string, { nome: string; ip: string }> = {
      "11084": { nome: "TBR-SRVCONECTCAR", ip: "10.192.100.142" },
      "11085": { nome: "TBR-SRVGREENPASS", ip: "10.192.100.143" },
      "11086": { nome: "TBR-SRVMOVEMAIS",  ip: "10.192.100.144" },
      "11089": { nome: "TBR-SRVSEMPARAR",  ip: "10.192.100.140" },
      "11094": { nome: "TBR-SRVVELOE",     ip: "10.192.100.141" },
    };

    const items: any[] = await this.zbxRpc(apiUrl, token, "item.get", {
      output: ["name", "key_", "lastvalue", "lastclock", "hostid"],
      hostids: HOSTIDS,
    });

    const byHost: Record<string, any[]> = {};
    for (const it of items) {
      const hid = String(it.hostid);
      if (!byHost[hid]) byHost[hid] = [];
      byHost[hid].push(it);
    }

    const servers = HOSTIDS.map((hid) => {
      const meta     = HOST_META[hid];
      const hitems   = byHost[hid] || [];
      const logItem  = hitems.find((i) => i.key_.includes("tags_SS.txt"));
      const svcItem  = hitems.find((i) => i.key_ === 'service.info["Fadami.SAGA.Mensageria.Osa",state]');
      const tagRec   = hitems.find((i) => i.key_ === "fadami.tag.recebido");

      let serie: string | null = null;
      let sequencial: string | null = null;
      let ultimoArquivo: string | null = null;
      let ultimaAtualizacao: string | null = null;

      if (logItem?.lastvalue) {
        const m = (logItem.lastvalue as string).match(
          /(\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}).*'([^']+\.tag)'/
        );
        if (m) {
          ultimaAtualizacao = new Date(m[1]).toISOString();
          ultimoArquivo = m[2];
          const partes = m[2].replace(".tag", "").split(".");
          if (partes.length >= 2) { serie = partes[0]; sequencial = partes.slice(1).join("."); }
        }
        if (!ultimaAtualizacao && logItem.lastclock) {
          ultimaAtualizacao = new Date(Number(logItem.lastclock) * 1000).toISOString();
        }
      }

      // Windows service state: 0=Running
      const svcRunning = svcItem ? String(svcItem.lastvalue) === "0" : null;
      const servicoEstado = svcRunning === null ? null : (svcRunning ? "RUNNING" : "STOPPED");

      let status = "DESCONHECIDO";
      if (ultimaAtualizacao) {
        const minAgo = (Date.now() - new Date(ultimaAtualizacao).getTime()) / 60000;
        if (minAgo > 15) status = "ATRASADO";
        else if (minAgo > 10) status = "ATENCAO";
        else status = "ONLINE";
      }
      if (svcRunning === false) status = "ERRO";

      return {
        id: `zbx-${hid}`,
        descricao: meta.nome,
        ip: meta.ip,
        serie,
        sequencial,
        ultimoArquivo,
        servicoEstado,
        ultimaAtualizacao,
        ultimoCheckEm: ultimaAtualizacao,
        tempoMaxMin: 15,
        intervaloSeg: 60,
        ativo: true,
        status,
        ultimoErro: null,
        valorAtual: tagRec?.lastvalue ?? null,
        fonte: "zabbix",
      };
    });

    // Cruza com o N1 (MTP_LISTAG): sequencial esperado por SERIE. Se o N1 estiver
    // indisponivel, retorna os cards sem esses campos (nao quebra o OSA).
    const n1 = await this.fetchN1Sequenciais();
    return servers.map((s) => {
      const serieNum = s.serie != null ? Number(s.serie) : null;
      const n1row = serieNum != null && !Number.isNaN(serieNum) ? n1[serieNum] : undefined;
      const n1Sequencial = n1row ? n1row.sequencial : null;
      const procSeq = s.sequencial != null ? Number(s.sequencial) : null;
      const atraso = (n1Sequencial != null && procSeq != null && !Number.isNaN(procSeq))
        ? n1Sequencial - procSeq : null;
      return { ...s, n1Sequencial, n1Atualizado: n1row?.ts ?? null, atraso };
    });
  }

  // Le a versao do SAGA por pista do Zabbix (item "VersaoSaga" = logrt do /SAGA/log).
  // O valor e uma linha de log com um JSON; extraimos VersaoPista, VersaoPlc e contexto.
  async sagaVersoes() {
    const apiUrl = process.env.ZABBIX_API_URL;
    const token  = process.env.ZABBIX_API_TOKEN;
    if (!apiUrl || !token) return [];

    const items = await this.zbxRpc(apiUrl, token, "item.get", {
      output: ["name", "lastvalue", "lastclock"],
      selectHosts: ["name"],
      search: { name: ["VersaoSaga"] },
    });

    const out = items.map((it: any) => {
      const host = (it.hosts && it.hosts[0] && it.hosts[0].name) || "";
      const v = String(it.lastvalue || "");
      // host PxVIAyy => praca x, pista yy
      const hm = host.match(/^P(\d+)VIA(\d+)/i);
      const praca = hm ? Number(hm[1]) : null;
      const pista = hm ? hm[2] : null;
      // JSON dentro da linha de log
      let data: any = {};
      const a = v.indexOf("{"), b = v.lastIndexOf("}");
      if (a >= 0 && b > a) { try { data = JSON.parse(v.slice(a, b + 1)); } catch {} }
      return {
        host, praca, pista,
        versao:    data.VersaoPista || null,
        versaoPlc: data.VersaoPlc || null,
        sentido:   data.Sentido || null,
        cabine:    data.NumeroCabine || pista,
        operador:  data.Operador || null,
        atualizado: it.lastclock ? new Date(Number(it.lastclock) * 1000).toISOString() : null,
      };
    }).filter((r: any) => r.praca != null); // so as pistas (PxVIAyy)

    out.sort((x: any, y: any) => (x.praca - y.praca) || String(x.pista).localeCompare(String(y.pista)));
    return out;
  }

  // Consulta sob demanda: faz SSH no servidor informado e roda o mysql LOCAL (onde o root
  // funciona), lendo a MTP_LISTAG. Sem criar usuario de banco. Credenciais vem do usuario
  // (nao sao armazenadas nem logadas). Comando fixo (so leitura).
  async consultarN1(body: any) {
    const host = String(body?.host || "").trim();
    if (!host) throw new BadRequestException("Informe o IP/host do servidor");
    const user = String(body?.user || "").trim();
    const password = body?.password != null ? String(body.password) : "";
    const database = String(body?.database || "SGA_N1").trim();
    const sshPort = Number(body?.sshPort) || 22;

    const sq = (s: string) => `'${String(s).replace(/'/g, `'\\''`)}'`;
    const sql = "SELECT ID_OSA, SERIE, SEQUENCIAL, DH_TIMESTAMP FROM MTP_LISTAG ORDER BY ID_OSA";
    const pwArg = password ? `-p${sq(password)}` : "";
    const cmd = `mysql -u ${sq(user)} ${pwArg} ${sq(database)} -B -N -e ${sq(sql)}`;

    try {
      const { code, out, err } = await this.sshExec(host, sshPort, user, password, cmd);
      if (code !== 0) {
        let erro = (err || "").split("\n").find(Boolean) || "Falha ao executar a consulta no servidor.";
        if (/access denied/i.test(err)) erro = "Login do MySQL negado (usuário/senha).";
        else if (/unknown database/i.test(err)) erro = `Banco '${database}' não encontrado.`;
        else if (/doesn't exist|no such table/i.test(err)) erro = "Tabela MTP_LISTAG não encontrada nesse banco.";
        return { ok: false, erro };
      }
      const rows = (out || "").split("\n").map((l) => l.replace(/\r$/, "")).filter((l) => l.length > 0)
        .map((l) => {
          const [idOsa, serie, sequencial, dh] = l.split("\t");
          return {
            idOsa: Number(idOsa),
            serie: serie != null ? Number(serie) : null,
            sequencial: sequencial != null ? Number(sequencial) : null,
            atualizado: dh && dh !== "NULL" ? dh.replace(" ", "T") : null,
          };
        });
      return { ok: true, rows };
    } catch (e: any) {
      let erro = e?.message || "Falha na conexão SSH";
      if (/authentication/i.test(erro)) erro = "Login SSH negado (usuário/senha incorretos).";
      else if (/ECONNREFUSED|ETIMEDOUT|timeout|timed out|handshake|EHOSTUNREACH|ENOTFOUND/i.test(erro)) erro = "Não foi possível conectar via SSH (host/porta 22 inacessível).";
      return { ok: false, erro };
    }
  }

  // Conecta via SSH (senha) e executa um comando, devolvendo {code, out, err}.
  private sshExec(host: string, port: number, username: string, password: string, cmd: string):
    Promise<{ code: number; out: string; err: string }> {
    return new Promise((resolve, reject) => {
      const conn = new SSHClient();
      let out = "", err = "";
      const timer = setTimeout(() => { try { conn.end(); } catch {} reject(new Error("timeout SSH")); }, 15000);
      conn.on("ready", () => {
        conn.exec(cmd, (e, stream) => {
          if (e) { clearTimeout(timer); try { conn.end(); } catch {} return reject(e); }
          stream.on("close", (code: number) => {
            clearTimeout(timer); try { conn.end(); } catch {}
            resolve({ code: code ?? 0, out, err });
          }).on("data", (d: Buffer) => { out += d.toString(); });
          stream.stderr.on("data", (d: Buffer) => { err += d.toString(); });
        });
      }).on("error", (e) => { clearTimeout(timer); reject(e); })
        .connect({ host, port, username, password, readyTimeout: 9000 });
    });
  }

  // Le o sequencial esperado de cada OSA no banco do N1 (MTP_LISTAG), indexado por SERIE.
  private async fetchN1Sequenciais(): Promise<Record<number, { sequencial: number; ts: string | null }>> {
    const host = process.env.N1_DB_HOST;
    if (!host) return {};
    let conn: any;
    try {
      conn = await mysql.createConnection({
        host,
        port: Number(process.env.N1_DB_PORT || 3306),
        user: process.env.N1_DB_USER,
        password: process.env.N1_DB_PASS,
        database: process.env.N1_DB_NAME || "SGA_N1",
        connectTimeout: 5000,
      });
      const [rows]: any = await conn.query("SELECT SERIE, SEQUENCIAL, DH_TIMESTAMP FROM MTP_LISTAG");
      const map: Record<number, { sequencial: number; ts: string | null }> = {};
      for (const r of rows || []) {
        const serie = Number(r.SERIE);
        if (!Number.isNaN(serie)) {
          map[serie] = {
            sequencial: Number(r.SEQUENCIAL),
            ts: r.DH_TIMESTAMP ? new Date(r.DH_TIMESTAMP).toISOString() : null,
          };
        }
      }
      return map;
    } catch {
      return {}; // N1 indisponivel — OSA continua funcionando sem o esperado
    } finally {
      if (conn) { try { await conn.end(); } catch {} }
    }
  }

  private zbxRpc(apiUrl: string, token: string, method: string, params: any): Promise<any[]> {
    return new Promise((resolve, reject) => {
      const body = JSON.stringify({ jsonrpc: "2.0", method, params, id: 1 });
      const u = new URL(apiUrl);
      const req = http.request(
        {
          hostname: u.hostname,
          port: u.port || 80,
          path: u.pathname,
          method: "POST",
          headers: {
            "Content-Type": "application/json-rpc",
            "Content-Length": Buffer.byteLength(body),
            "Authorization": `Bearer ${token}`,
          },
          timeout: 15000,
        },
        (res) => {
          let data = "";
          res.on("data", (d) => (data += d));
          res.on("end", () => {
            try {
              const j = JSON.parse(data);
              if (j.error) return reject(new Error(j.error.data || j.error.message));
              resolve(j.result);
            } catch (e: any) { reject(new Error("Zabbix resp invalida: " + e.message)); }
          });
        }
      );
      req.on("error", reject);
      req.on("timeout", () => req.destroy(new Error("Zabbix timeout")));
      req.write(body);
      req.end();
    });
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

  @Get()              @Permissions("monitoramento:ver")       list(@Req() r: any) { return this.svc.list(this.org(r)); }
  @Get("zabbix-live") @Permissions("monitoramento:ver")       zabbixLive()        { return this.svc.zabbixLive(); }
  @Get("saga-versoes") @Permissions("monitoramento:ver")      sagaVersoes()       { return this.svc.sagaVersoes(); }
  @Post("consultar-n1") @Permissions("monitoramento:ver")     consultarN1(@Body() b: any) { return this.svc.consultarN1(b); }
  @Post()             @Permissions("monitoramento:gerenciar") create(@Req() r: any, @Body() b: any) { return this.svc.create(this.org(r), b); }
  @Patch(":id")       @Permissions("monitoramento:gerenciar") update(@Req() r: any, @Param("id") id: string, @Body() b: any) { return this.svc.update(this.org(r), id, b); }
  @Delete(":id")      @Permissions("monitoramento:gerenciar") remove(@Req() r: any, @Param("id") id: string) { return this.svc.remove(this.org(r), id); }
}

@Module({ controllers: [OsaController], providers: [OsaService] })
export class OsaModule {}
