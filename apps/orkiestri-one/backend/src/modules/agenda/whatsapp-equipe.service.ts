import { Injectable } from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import { randomBytes } from "crypto";
import { PrismaService } from "../../prisma/prisma.service";
import { WhatsAppService } from "../notifications/whatsapp.service";
import { AuthService } from "../auth/auth.service";
import { antesDeEfeito, acaoUtil } from "./whatsapp-execucao";

type Pessoa = { id: string; organizationId: string };
const cod = (prefixo: string, id: string) => `${prefixo}-${id.slice(0, 8)}`;
const normal = (s: string) => s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();

@Injectable()
export class WhatsappEquipeService {
  constructor(private prisma: PrismaService, private wa: WhatsAppService, private auth: AuthService) {}

  private async chamar(user: Pessoa, path: string, method: string, data: any) {
    if (!process.env.JWT_SECRET) throw new Error("Autenticação indisponível");
    // Somente loopback e rotas construídas com UUIDs resolvidos no banco.
    // A estratégia JWT reconsulta usuário, bloqueio, organização e permissões.
    const token = new JwtService().sign({ sub: user.id }, { secret: process.env.JWT_SECRET, expiresIn: "60s" });
    const csrf = randomBytes(24).toString("hex");
    await antesDeEfeito();
    const response = await fetch(`http://127.0.0.1:${process.env.PORT || 3000}/api/projects${path}`, {
      method, headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json",
        Cookie: `csrf_token=${csrf}`, "X-CSRF-Token": csrf }, body: JSON.stringify(data),
      signal: AbortSignal.timeout(20000), redirect: "error",
    });
    if (!response.ok) throw new Error(`Operação não confirmada (${response.status})`);
    const resultado = await response.json();
    acaoUtil(path.endsWith("/status") ? "DEMANDA_ATUALIZADA" : path.includes("/tasks") ? "DEMANDA_GRAVADA" : "PROJETO_CRIADO");
    return resultado;
  }

  private scope(user: Pessoa) {
    return { organizationId: user.organizationId, OR: [{ criadoPorId: user.id }, { members: { some: { userId: user.id } } }] };
  }
  private async projeto(user: Pessoa, prefixo: string) {
    const rows = await this.prisma.project.findMany({ where: { ...this.scope(user), id: { startsWith: prefixo.toLowerCase() } }, take: 2 });
    return rows.length === 1 ? rows[0] : null;
  }

  async tratar(user: Pessoa, instancia: string, conversa: string, texto: string): Promise<boolean> {
    const n = normal(texto.trim());
    const list = /^(?:meus\s+)?projetos[.!?]*$/.test(n);
    const tasks = n.match(/^(?:minhas\s+demandas|demandas(?:\s+p-([a-f0-9]{8}))?)[.!?]*$/);
    const equipe = n.match(/^equipe\s+p-([a-f0-9]{8})$/);
    const create = texto.match(/^(?:projeto|novo projeto|criar projeto)\s*:\s*(.{1,180})$/i);
    const demand = texto.match(/^demanda\s+P-([a-f0-9]{8})\s*:\s*(.{1,180}?)(?:\s+para\s+U-([a-f0-9]{8}))?$/i);
    const move = n.match(/^(iniciar|concluir|reabrir|revisar)\s+d-([a-f0-9]{8})$/);
    const assign = n.match(/^atribuir\s+d-([a-f0-9]{8})\s+u-([a-f0-9]{8})$/);
    if (!list && !tasks && !equipe && !create && !demand && !move && !assign) return false;
    const say = (s: string) => this.wa.sendToJid(conversa, "🏢 *Empresa*\n" + s, instancia);
    const perms = await this.auth.resolvePermissions(user.id);
    const required = create ? "projetos:criar" : demand || assign ? "projetos:editar" : "projetos:ver";
    if (!perms.includes("*") && !perms.includes(required)) { await say("🔒 Você não tem permissão para esta operação."); return true; }
    if (list) {
      const rows = await this.prisma.project.findMany({ where: this.scope(user), orderBy: { atualizadoEm: "desc" }, take: 20 });
      await say(rows.length ? rows.map(p => `*${cod("P", p.id)}* ${p.titulo} — ${p.status}`).join("\n") + "\n\n*equipe P-código* mostra os membros. *demandas P-código* mostra as demandas." : "Você ainda não participa de projetos. Crie com *projeto: Nome*."); return true;
    }
    let project: any;
    if (tasks?.[1] || equipe || demand) {
      project = await this.projeto(user, tasks?.[1] || equipe?.[1] || demand![1]);
      if (!project) { await say("Projeto indisponível ou código ambíguo. Consulte *projetos*."); return true; }
    }
    if (tasks) {
      const rows = await this.prisma.task.findMany({ where: { project: this.scope(user), ...(project ? { projectId: project.id } : { assigneeId: user.id }) }, orderBy: { atualizadoEm: "desc" }, take: 20, include: { assignee: { select: { nome: true } } } });
      await say(rows.length ? rows.map(t => `*${cod("D", t.id)}* ${t.titulo} — ${t.status} (${t.assignee?.nome || "sem responsável"})`).join("\n") + "\n\nUse *iniciar D-código*, *concluir D-código*, *reabrir D-código* ou *atribuir D-código U-código*." : "Nenhuma demanda encontrada."); return true;
    }
    const membros = async (p: any) => this.prisma.user.findMany({ where: { organizationId: user.organizationId, ativo: true, bloqueado: false, OR: [{ id: p.criadoPorId }, { projectMembers: { some: { projectId: p.id } } }] }, select: { id: true, nome: true } });
    if (equipe) {
      const rows = await membros(project);
      await say(rows.map(u => `*${cod("U", u.id)}* ${u.nome}`).join("\n") + `\n\nCriar: *demanda ${cod("P", project.id)}: Título para U-código*`); return true;
    }
    try {
      if (create) {
        const p: any = await this.chamar(user, "", "POST", { titulo: create[1].trim() });
        await say(`✅ Projeto criado: *${cod("P", p.id)}* ${p.titulo}`); return true;
      }
      if (demand) {
        let assigneeId: string | undefined;
        if (demand[3]) {
          const found = (await membros(project)).filter(u => u.id.startsWith(demand[3].toLowerCase()));
          if (found.length !== 1) { await say("Responsável indisponível ou ambíguo. Consulte *equipe P-código*."); return true; }
          assigneeId = found[0].id;
        }
        const t: any = await this.chamar(user, `/${project.id}/tasks`, "POST", { titulo: demand[2].trim(), assigneeId });
        await say(`✅ Demanda criada: *${cod("D", t.id)}* ${t.titulo}`); return true;
      }
      const prefix = move?.[2] || assign![1];
      const rows = await this.prisma.task.findMany({ where: { id: { startsWith: prefix }, project: this.scope(user) }, take: 2, include: { project: true } });
      if (rows.length !== 1) { await say("Demanda indisponível ou código ambíguo."); return true; }
      const task = rows[0];
      if (assign) {
        const found = (await membros(task.project)).filter(u => u.id.startsWith(assign[2]));
        if (found.length !== 1) { await say("Responsável indisponível ou ambíguo. Consulte a equipe do projeto."); return true; }
        await this.chamar(user, `/${task.projectId}/tasks/${task.id}`, "PATCH", { assigneeId: found[0].id });
        await say(`✅ ${cod("D", task.id)} atribuída a ${found[0].nome}.`);
      } else {
        const status = { iniciar: "EM_ANDAMENTO", concluir: "CONCLUIDA", reabrir: "A_FAZER", revisar: "EM_REVISAO" }[move![1]];
        await this.chamar(user, `/${task.projectId}/tasks/${task.id}/status`, "PATCH", { status });
        await say(`✅ ${cod("D", task.id)}: ${status}.`);
      }
      return true;
    } catch {
      await say("Não consegui confirmar a operação. Consulte *projetos* ou *minhas demandas* antes de repetir; a solicitação foi encaminhada para revisão.");
      throw new Error("Operação de equipe requer revisão");
    }
  }
}
