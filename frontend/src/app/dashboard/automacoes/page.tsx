"use client";
import { useState, useEffect, useCallback } from "react";
import Topbar from "@/components/layout/Topbar";
import { useAuthStore } from "@/lib/store";
import { api } from "@/lib/api";

// ── Types ─────────────────────────────────────────────────────────────────────
type CondicaoItem  = { campo: string; operador: string; valor?: any; };
type CondicaoGrupo = { itens: CondicaoItem[]; };
type CondicoesConfig = { grupos: CondicaoGrupo[]; };
type Acao = { tipo: string; [key: string]: any; };
type Automacao = {
  id: string; nome: string; descricao?: string; trigger: string;
  condicoes: CondicoesConfig | CondicaoItem[];
  acoes: Acao[]; ativo: boolean; totalExecucoes: number;
  ultimaExecucao?: string; criadoEm: string;
};
type Execucao = {
  id: string; trigger: string; contextId: string; resultado: string;
  detalhes?: any; criadoEm: string;
  automacao: { id: string; nome: string; };
};
type Webhook = {
  id: string; nome: string; url: string; evento: string;
  headers: Record<string, string>; secret?: string; descricao?: string;
  ativo: boolean; totalEnvios: number; ultimoEnvio?: string; ultimoStatus?: number;
  criadoEm: string;
};
type WebhookLog = { id: string; evento: string; statusCode?: number; sucesso: boolean; erro?: string; criadoEm: string; };
type Project    = { id: string; titulo: string; };

// ── Constants ─────────────────────────────────────────────────────────────────
const TRIGGERS = [
  // Chamados
  { value: "chamado_criado",           label: "Chamado criado",             color: "var(--accent-green)",          grupo: "Chamados" },
  { value: "chamado_atualizado",       label: "Chamado atualizado",         color: "var(--accent-cyan)",           grupo: "Chamados" },
  { value: "chamado_resolvido",        label: "Chamado resolvido",          color: "var(--accent-violet)",         grupo: "Chamados" },
  { value: "chamado_fechado",          label: "Chamado fechado",            color: "var(--text-muted)",            grupo: "Chamados" },
  { value: "chamado_sla_risco",        label: "SLA em risco / violado",     color: "var(--accent-red)",            grupo: "Chamados" },
  // Contratos
  { value: "contrato_criado",          label: "Contrato criado",            color: "var(--accent-green)",          grupo: "Contratos" },
  { value: "contrato_atualizado",      label: "Contrato atualizado",        color: "var(--accent-cyan)",           grupo: "Contratos" },
  { value: "contrato_vencendo",        label: "Contrato vencendo (30 dias)",color: "#f59e0b",                      grupo: "Contratos" },
  { value: "contrato_vencido",         label: "Contrato vencido",           color: "var(--accent-red)",            grupo: "Contratos" },
  { value: "contrato_renovado",        label: "Contrato renovado",          color: "var(--accent-green)",          grupo: "Contratos" },
  // Projetos & Tarefas
  { value: "projeto_criado",           label: "Projeto criado",             color: "var(--accent-violet)",         grupo: "Projetos" },
  { value: "projeto_concluido",        label: "Projeto concluído",          color: "var(--accent-green)",          grupo: "Projetos" },
  { value: "projeto_cancelado",        label: "Projeto cancelado",          color: "var(--accent-red)",            grupo: "Projetos" },
  { value: "tarefa_criada",            label: "Tarefa criada",              color: "var(--accent-cyan)",           grupo: "Projetos" },
  { value: "tarefa_concluida",         label: "Tarefa concluída",           color: "var(--accent-green)",          grupo: "Projetos" },
  { value: "tarefa_atribuida",         label: "Tarefa atribuída",           color: "#f59e0b",                      grupo: "Projetos" },
  // Aprovações / Workflows
  { value: "workflow_pendente",        label: "Aprovação solicitada",       color: "#f59e0b",                      grupo: "Aprovações" },
  { value: "workflow_aprovado",        label: "Aprovação aprovada",         color: "var(--accent-green)",          grupo: "Aprovações" },
  { value: "workflow_rejeitado",       label: "Aprovação rejeitada",        color: "var(--accent-red)",            grupo: "Aprovações" },
  // Ativos
  { value: "ativo_garantia_vencendo",  label: "Garantia de ativo vencendo", color: "#f97316",                      grupo: "Ativos" },
  { value: "ativo_offline",            label: "Ativo ficou offline",        color: "var(--accent-red)",            grupo: "Ativos" },
  { value: "ativo_online",             label: "Ativo voltou online",        color: "var(--accent-green)",          grupo: "Ativos" },
  // Usuários
  { value: "usuario_criado",           label: "Usuário aprovado/criado",    color: "var(--accent-violet)",         grupo: "Usuários" },
];

const CAMPOS = [
  { value: "prioridade", label: "Prioridade" },
  { value: "status",     label: "Status" },
  { value: "categoria",  label: "Categoria" },
  { value: "titulo",     label: "Título" },
  { value: "tags",       label: "Tags" },
  { value: "numero",     label: "Número" },
  { value: "atendenteId",label: "Atendente (ID)" },
  { value: "clienteId",  label: "Cliente (ID)" },
];

const OPERADORES = [
  { value: "eq",          label: "é igual a" },
  { value: "neq",         label: "é diferente de" },
  { value: "in",          label: "está em (lista)" },
  { value: "nin",         label: "não está em (lista)" },
  { value: "empty",       label: "está vazio" },
  { value: "notempty",    label: "não está vazio" },
  { value: "contains",    label: "contém" },
  { value: "starts_with", label: "começa com" },
  { value: "ends_with",   label: "termina com" },
  { value: "gt",          label: "maior que" },
  { value: "lt",          label: "menor que" },
  { value: "gte",         label: "maior ou igual" },
  { value: "lte",         label: "menor ou igual" },
];

const TIPO_ACAO = [
  // Chamado
  { value: "atribuir_atendente",   label: "Atribuir atendente",        icon: "👤", grupo: "Chamado" },
  { value: "mudar_status",         label: "Mudar status do chamado",   icon: "🔄", grupo: "Chamado" },
  { value: "mudar_prioridade",     label: "Mudar prioridade",          icon: "⚡", grupo: "Chamado" },
  { value: "escalar_chamado",      label: "Escalar chamado",           icon: "🚨", grupo: "Chamado" },
  { value: "adicionar_tag",        label: "Adicionar tag",             icon: "🏷", grupo: "Chamado" },
  { value: "remover_tag",          label: "Remover tag",               icon: "✂️", grupo: "Chamado" },
  { value: "adicionar_comentario", label: "Adicionar comentário",      icon: "💬", grupo: "Chamado" },
  { value: "criar_chamado",        label: "Criar novo chamado",        icon: "🎫", grupo: "Chamado" },
  // Comunicação
  { value: "criar_notificacao",    label: "Notificação no sistema",    icon: "🔔", grupo: "Comunicação" },
  { value: "enviar_whatsapp",      label: "Enviar WhatsApp",           icon: "📱", grupo: "Comunicação" },
  { value: "enviar_email",         label: "Enviar e-mail",             icon: "📧", grupo: "Comunicação" },
  // Projetos
  { value: "criar_tarefa",         label: "Criar tarefa no projeto",   icon: "✅", grupo: "Projetos" },
  { value: "alterar_status_projeto",label:"Alterar status do projeto", icon: "📁", grupo: "Projetos" },
  // Agenda
  { value: "criar_evento_agenda",  label: "Criar evento na agenda",    icon: "📅", grupo: "Agenda" },
];

const PRIORIDADES = ["baixa","media","alta","critica"];
const STATUS_LIST = ["aberto","em_atendimento","aguardando","resolvido","fechado"];
const PARA_OPTIONS = [
  { value: "solicitante", label: "Solicitante" },
  { value: "atendente",   label: "Atendente" },
  { value: "masters",     label: "Masters" },
  { value: "usuario",     label: "Usuário específico" },
];

const EVENTOS_WEBHOOK = [
  "chamado.criado","chamado.atualizado","chamado.resolvido","chamado.fechado",
  "contrato.vencendo","contrato.vencido","ativo.garantia_vencendo","projeto.concluido","usuario.criado",
];

const TEMPLATE_VARS = ["{{titulo}}", "{{numero}}", "{{prioridade}}", "{{status}}", "{{categoria}}", "{{cliente}}", "{{atendente}}", "{{solicitante}}", "{{data}}", "{{hora}}"];

// ── Helpers ───────────────────────────────────────────────────────────────────
const fmtDate  = (d?: string) => d ? new Date(d).toLocaleString("pt-BR") : "—";
const hasPerms = (user: any, ...perms: string[]) =>
  user?.isMaster || user?.permissions?.includes("*") || perms.some((p: string) => user?.permissions?.includes(p));
const triggerInfo = (val: string) => TRIGGERS.find(t => t.value === val);

function normalizeGrupos(condicoes: any): CondicaoGrupo[] {
  if (condicoes && !Array.isArray(condicoes) && condicoes.grupos) return condicoes.grupos;
  const itens: CondicaoItem[] = Array.isArray(condicoes) ? condicoes : [];
  return itens.length > 0 ? [{ itens }] : [{ itens: [] }];
}

// ── CondicaoGruposBuilder ─────────────────────────────────────────────────────
function CondicaoGruposBuilder({ grupos, onChange }: {
  grupos: CondicaoGrupo[];
  onChange: (g: CondicaoGrupo[]) => void;
}) {
  const addGrupo = () => onChange([...grupos, { itens: [] }]);
  const removeGrupo = (gi: number) => onChange(grupos.filter((_, j) => j !== gi));
  const setItem = (gi: number, ii: number, k: string, v: any) =>
    onChange(grupos.map((g, j) => j !== gi ? g : {
      ...g, itens: g.itens.map((c, k2) => k2 !== ii ? c : { ...c, [k]: v }),
    }));
  const addItem = (gi: number) =>
    onChange(grupos.map((g, j) => j !== gi ? g : { ...g, itens: [...g.itens, { campo: "prioridade", operador: "eq", valor: "alta" }] }));
  const removeItem = (gi: number, ii: number) =>
    onChange(grupos.map((g, j) => j !== gi ? g : { ...g, itens: g.itens.filter((_, k2) => k2 !== ii) }));

  const needsValor = (op: string) => !["empty", "notempty"].includes(op);

  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
        <span style={{ fontSize: 11, color: "var(--text-muted)", fontFamily: "var(--font-mono)", fontWeight: 600 }}>
          CONDIÇÕES {grupos.every(g => g.itens.length === 0) && <span style={{ opacity: 0.5 }}>(sem condições = sempre executa)</span>}
        </span>
        <button className="btn btn-ghost" style={{ fontSize: 11, padding: "3px 10px" }} onClick={addGrupo}>+ Grupo</button>
      </div>

      {grupos.map((grupo, gi) => (
        <div key={gi} style={{ marginBottom: 10 }}>
          {gi > 0 && (
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
              <div style={{ flex: 1, borderTop: "1px dashed var(--border-subtle)" }} />
              <span style={{ fontSize: 10, fontFamily: "var(--font-mono)", color: "var(--accent-cyan)", background: "rgba(6,182,212,0.08)", border: "1px solid rgba(6,182,212,0.2)", borderRadius: 4, padding: "2px 8px", fontWeight: 700 }}>OU</span>
              <div style={{ flex: 1, borderTop: "1px dashed var(--border-subtle)" }} />
            </div>
          )}
          <div style={{ padding: "10px 12px", background: "var(--bg-hover)", borderRadius: 8, border: "1px solid var(--border-subtle)" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
              <span style={{ fontSize: 10, color: "var(--text-muted)", fontFamily: "var(--font-mono)" }}>
                GRUPO {gi + 1} {grupo.itens.length > 1 && <span style={{ color: "var(--accent-green)" }}>(todas as condições devem ser verdadeiras)</span>}
              </span>
              <div style={{ display: "flex", gap: 6 }}>
                <button className="btn btn-ghost" style={{ fontSize: 11, padding: "2px 8px" }} onClick={() => addItem(gi)}>+ Condição</button>
                {grupos.length > 1 && (
                  <button onClick={() => removeGrupo(gi)} style={{ background: "none", border: "none", color: "var(--accent-red)", cursor: "pointer", fontSize: 13 }}>×</button>
                )}
              </div>
            </div>

            {grupo.itens.length === 0 && (
              <div style={{ fontSize: 11, color: "var(--text-muted)", opacity: 0.6, padding: "4px 0" }}>Nenhuma condição neste grupo — sempre verdadeiro</div>
            )}

            {grupo.itens.map((c, ii) => (
              <div key={ii} style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 6 }}>
                {ii > 0 && <span style={{ fontSize: 10, color: "var(--accent-green)", fontFamily: "var(--font-mono)", flexShrink: 0, minWidth: 14 }}>E</span>}
                {ii === 0 && <span style={{ minWidth: 14, flexShrink: 0 }} />}
                <select className="input-o" style={{ fontSize: 12 }} value={c.campo} onChange={e => setItem(gi, ii, "campo", e.target.value)}>
                  {CAMPOS.map(f => <option key={f.value} value={f.value}>{f.label}</option>)}
                </select>
                <select className="input-o" style={{ fontSize: 12 }} value={c.operador} onChange={e => setItem(gi, ii, "operador", e.target.value)}>
                  {OPERADORES.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
                {needsValor(c.operador) && (
                  c.campo === "prioridade" ? (
                    <select className="input-o" style={{ fontSize: 12 }} value={c.valor || ""} onChange={e => setItem(gi, ii, "valor", e.target.value)}>
                      <option value="">Selecione</option>
                      {PRIORIDADES.map(p => <option key={p} value={p}>{p}</option>)}
                    </select>
                  ) : c.campo === "status" ? (
                    <select className="input-o" style={{ fontSize: 12 }} value={c.valor || ""} onChange={e => setItem(gi, ii, "valor", e.target.value)}>
                      <option value="">Selecione</option>
                      {STATUS_LIST.map(s => <option key={s} value={s}>{s}</option>)}
                    </select>
                  ) : (
                    <input className="input-o" style={{ fontSize: 12 }} value={c.valor || ""} onChange={e => setItem(gi, ii, "valor", e.target.value)} placeholder="valor" />
                  )
                )}
                <button onClick={() => removeItem(gi, ii)} style={{ background: "none", border: "none", color: "var(--accent-red)", cursor: "pointer", padding: "0 4px", fontSize: 16, flexShrink: 0 }}>×</button>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

// ── AcaoBuilder ───────────────────────────────────────────────────────────────
function AcaoBuilder({ acoes, onChange, users, projects }: {
  acoes: Acao[];
  onChange: (a: Acao[]) => void;
  users: { id: string; nome: string }[];
  projects: Project[];
}) {
  const add   = () => onChange([...acoes, { tipo: "mudar_status", status: "em_atendimento" }]);
  const remove = (i: number) => onChange(acoes.filter((_, j) => j !== i));
  const set   = (i: number, data: Partial<Acao>) => onChange(acoes.map((a, j) => j === i ? { ...a, ...data } : a));

  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
        <span style={{ fontSize: 11, color: "var(--text-muted)", fontFamily: "var(--font-mono)", fontWeight: 600 }}>AÇÕES</span>
        <button className="btn btn-ghost" style={{ fontSize: 11, padding: "3px 10px" }} onClick={add}>+ Ação</button>
      </div>
      {acoes.length === 0 && (
        <div style={{ fontSize: 12, color: "var(--text-muted)", padding: "8px 10px", background: "var(--bg-hover)", borderRadius: 6 }}>
          Nenhuma ação — adicione pelo menos uma
        </div>
      )}
      {acoes.map((a, i) => (
        <div key={i} style={{ marginBottom: 8, padding: "12px 14px", background: "var(--bg-hover)", borderRadius: 6, borderLeft: "3px solid var(--accent-violet)" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: ["criar_notificacao","enviar_whatsapp","adicionar_comentario","criar_tarefa"].includes(a.tipo) ? 10 : 0 }}>
            <select className="input-o" style={{ fontSize: 12 }} value={a.tipo} onChange={e => set(i, { tipo: e.target.value })}>
              {TIPO_ACAO.map(t => <option key={t.value} value={t.value}>{t.icon} {t.label}</option>)}
            </select>
            {a.tipo === "mudar_status" && (
              <select className="input-o" style={{ fontSize: 12 }} value={a.status || ""} onChange={e => set(i, { status: e.target.value })}>
                <option value="">Selecione</option>
                {STATUS_LIST.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            )}
            {(a.tipo === "mudar_prioridade" || a.tipo === "escalar_chamado") && (
              <select className="input-o" style={{ fontSize: 12 }} value={a.prioridade || ""} onChange={e => set(i, { prioridade: e.target.value })}>
                <option value="">Selecione prioridade</option>
                {PRIORIDADES.map(p => <option key={p} value={p}>{p}</option>)}
              </select>
            )}
            {a.tipo === "escalar_chamado" && (
              <label style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 12, color: "var(--text-secondary)", flexShrink: 0 }}>
                <input type="checkbox" checked={a.notificar !== false} onChange={e => set(i, { notificar: e.target.checked })} />
                Notificar masters
              </label>
            )}
            {a.tipo === "atribuir_atendente" && (
              <select className="input-o" style={{ fontSize: 12 }} value={a.atendenteId || ""} onChange={e => set(i, { atendenteId: e.target.value })}>
                <option value="">Selecione usuário</option>
                {users.map(u => <option key={u.id} value={u.id}>{u.nome}</option>)}
              </select>
            )}
            {(a.tipo === "adicionar_tag" || a.tipo === "remover_tag") && (
              <input className="input-o" style={{ fontSize: 12 }} value={a.tag || ""} onChange={e => set(i, { tag: e.target.value })} placeholder="nome da tag" />
            )}
            <button onClick={() => remove(i)} style={{ background: "none", border: "none", color: "var(--accent-red)", cursor: "pointer", padding: "0 4px", fontSize: 16, flexShrink: 0, marginLeft: "auto" }}>×</button>
          </div>

          {/* Notification */}
          {a.tipo === "criar_notificacao" && (
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              <div style={{ display: "flex", gap: 8 }}>
                <select className="input-o" style={{ fontSize: 12, width: 160 }} value={a.para || "solicitante"} onChange={e => set(i, { para: e.target.value })}>
                  {PARA_OPTIONS.map(p => <option key={p.value} value={p.value}>{p.label}</option>)}
                </select>
                {a.para === "usuario" && (
                  <select className="input-o" style={{ fontSize: 12 }} value={a.usuarioId || ""} onChange={e => set(i, { usuarioId: e.target.value })}>
                    <option value="">Selecione usuário</option>
                    {users.map(u => <option key={u.id} value={u.id}>{u.nome}</option>)}
                  </select>
                )}
              </div>
              <input className="input-o" style={{ fontSize: 12 }} value={a.titulo || ""} onChange={e => set(i, { titulo: e.target.value })} placeholder="Título da notificação" />
              <input className="input-o" style={{ fontSize: 12 }} value={a.mensagem || ""} onChange={e => set(i, { mensagem: e.target.value })} placeholder="Mensagem (opcional)" />
              <TemplateVarsHint />
            </div>
          )}

          {/* WhatsApp */}
          {a.tipo === "enviar_whatsapp" && (
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              <select className="input-o" style={{ fontSize: 12 }} value={a.para || "solicitante"} onChange={e => set(i, { para: e.target.value })}>
                {PARA_OPTIONS.map(p => <option key={p.value} value={p.value}>{p.label}</option>)}
              </select>
              {a.para === "usuario" && (
                <select className="input-o" style={{ fontSize: 12 }} value={a.usuarioId || ""} onChange={e => set(i, { usuarioId: e.target.value })}>
                  <option value="">Selecione usuário</option>
                  {users.map(u => <option key={u.id} value={u.id}>{u.nome}</option>)}
                </select>
              )}
              <textarea className="input-o" style={{ fontSize: 12, resize: "vertical", minHeight: 70 }} value={a.mensagem || ""} onChange={e => set(i, { mensagem: e.target.value })} placeholder="Mensagem WhatsApp (suporta *negrito* e _itálico_)" />
              <TemplateVarsHint />
            </div>
          )}

          {/* Comment */}
          {a.tipo === "adicionar_comentario" && (
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              <textarea className="input-o" style={{ fontSize: 12, resize: "vertical", minHeight: 60 }} value={a.texto || ""} onChange={e => set(i, { texto: e.target.value })} placeholder="Texto do comentário..." />
              <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, color: "var(--text-secondary)" }}>
                <input type="checkbox" checked={a.interno !== false} onChange={e => set(i, { interno: e.target.checked })} />
                Comentário interno (não visível ao cliente)
              </label>
              <TemplateVarsHint />
            </div>
          )}

          {/* Create task */}
          {a.tipo === "criar_tarefa" && (
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              <select className="input-o" style={{ fontSize: 12 }} value={a.projectId || ""} onChange={e => set(i, { projectId: e.target.value })}>
                <option value="">Selecione o projeto</option>
                {projects.map(p => <option key={p.id} value={p.id}>{p.titulo}</option>)}
              </select>
              <input className="input-o" style={{ fontSize: 12 }} value={a.titulo || ""} onChange={e => set(i, { titulo: e.target.value })} placeholder="Título da tarefa (ex: Verificar {{titulo}} #{{numero}})" />
              <textarea className="input-o" style={{ fontSize: 12, resize: "vertical", minHeight: 50 }} value={a.descricao || ""} onChange={e => set(i, { descricao: e.target.value })} placeholder="Descrição (opcional)" />
              <div style={{ display: "flex", gap: 8 }}>
                <select className="input-o" style={{ fontSize: 12 }} value={a.prioridade || ""} onChange={e => set(i, { prioridade: e.target.value })}>
                  <option value="">Prioridade (usar a do evento)</option>
                  {PRIORIDADES.map(p => <option key={p} value={p}>{p}</option>)}
                </select>
                <select className="input-o" style={{ fontSize: 12 }} value={a.assigneeId || ""} onChange={e => set(i, { assigneeId: e.target.value })}>
                  <option value="">Atribuir a (padrão: atendente)</option>
                  {users.map(u => <option key={u.id} value={u.id}>{u.nome}</option>)}
                </select>
              </div>
              <TemplateVarsHint />
            </div>
          )}

          {/* Email */}
          {a.tipo === "enviar_email" && (
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              <div style={{ display: "flex", gap: 8 }}>
                <select className="input-o" style={{ fontSize: 12, width: 160 }} value={a.para || "solicitante"} onChange={e => set(i, { para: e.target.value })}>
                  {PARA_OPTIONS.map(p => <option key={p.value} value={p.value}>{p.label}</option>)}
                </select>
                {a.para === "usuario" && (
                  <select className="input-o" style={{ fontSize: 12 }} value={a.usuarioId || ""} onChange={e => set(i, { usuarioId: e.target.value })}>
                    <option value="">Selecione usuário</option>
                    {users.map(u => <option key={u.id} value={u.id}>{u.nome}</option>)}
                  </select>
                )}
              </div>
              <input className="input-o" style={{ fontSize: 12 }} value={a.para_email || ""} onChange={e => set(i, { para_email: e.target.value })} placeholder="Ou e-mail avulso (ex: cliente@empresa.com)" />
              <input className="input-o" style={{ fontSize: 12 }} value={a.assunto || ""} onChange={e => set(i, { assunto: e.target.value })} placeholder="Assunto do e-mail" />
              <textarea className="input-o" style={{ fontSize: 12, resize: "vertical", minHeight: 80 }} value={a.mensagem || ""} onChange={e => set(i, { mensagem: e.target.value })} placeholder="Corpo do e-mail (suporta variáveis)" />
              <TemplateVarsHint />
            </div>
          )}

          {/* Criar chamado */}
          {a.tipo === "criar_chamado" && (
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              <input className="input-o" style={{ fontSize: 12 }} value={a.titulo_chamado || ""} onChange={e => set(i, { titulo_chamado: e.target.value })} placeholder="Título do novo chamado (ex: Seguimento: {{titulo}})" />
              <textarea className="input-o" style={{ fontSize: 12, resize: "vertical", minHeight: 50 }} value={a.descricao || ""} onChange={e => set(i, { descricao: e.target.value })} placeholder="Descrição (opcional)" />
              <div style={{ display: "flex", gap: 8 }}>
                <select className="input-o" style={{ fontSize: 12 }} value={a.prioridade || ""} onChange={e => set(i, { prioridade: e.target.value })}>
                  <option value="">Prioridade (usar a do evento)</option>
                  {PRIORIDADES.map(p => <option key={p} value={p}>{p}</option>)}
                </select>
                <select className="input-o" style={{ fontSize: 12 }} value={a.atendenteId || ""} onChange={e => set(i, { atendenteId: e.target.value })}>
                  <option value="">Atendente (opcional)</option>
                  {users.map(u => <option key={u.id} value={u.id}>{u.nome}</option>)}
                </select>
              </div>
              <TemplateVarsHint />
            </div>
          )}

          {/* Criar evento na agenda */}
          {a.tipo === "criar_evento_agenda" && (
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              <select className="input-o" style={{ fontSize: 12 }} value={a.para || "atendente"} onChange={e => set(i, { para: e.target.value })}>
                {PARA_OPTIONS.map(p => <option key={p.value} value={p.value}>{p.label}</option>)}
              </select>
              <input className="input-o" style={{ fontSize: 12 }} value={a.titulo_evento || ""} onChange={e => set(i, { titulo_evento: e.target.value })} placeholder="Título do evento (ex: Reunião: {{titulo}})" />
              <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                <label style={{ fontSize: 12, color: "var(--text-secondary)", flexShrink: 0 }}>Daqui a</label>
                <input className="input-o" style={{ fontSize: 12, width: 70 }} type="number" min={1} value={a.dias_futuro || 1} onChange={e => set(i, { dias_futuro: Number(e.target.value) })} />
                <label style={{ fontSize: 12, color: "var(--text-secondary)" }}>dia(s)</label>
              </div>
              <textarea className="input-o" style={{ fontSize: 12, resize: "vertical", minHeight: 40 }} value={a.descricao || ""} onChange={e => set(i, { descricao: e.target.value })} placeholder="Descrição (opcional)" />
              <TemplateVarsHint />
            </div>
          )}

          {/* Alterar status projeto */}
          {a.tipo === "alterar_status_projeto" && (
            <div style={{ display: "flex", gap: 8 }}>
              <select className="input-o" style={{ fontSize: 12 }} value={a.projectId || ""} onChange={e => set(i, { projectId: e.target.value })}>
                <option value="">Selecione o projeto</option>
                {projects.map(p => <option key={p.id} value={p.id}>{p.titulo}</option>)}
              </select>
              <select className="input-o" style={{ fontSize: 12 }} value={a.status || ""} onChange={e => set(i, { status: e.target.value })}>
                <option value="">Novo status</option>
                {["PLANEJAMENTO","EM_ANDAMENTO","PAUSADO","CONCLUIDO","CANCELADO"].map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

function TemplateVarsHint() {
  return (
    <div style={{ fontSize: 10, color: "var(--text-muted)", display: "flex", flexWrap: "wrap", gap: 4 }}>
      <span style={{ marginRight: 4 }}>Variáveis:</span>
      {TEMPLATE_VARS.map(v => (
        <code key={v} style={{ background: "rgba(124,58,237,0.1)", color: "var(--accent-violet)", padding: "1px 5px", borderRadius: 3, fontSize: 10 }}>{v}</code>
      ))}
    </div>
  );
}

// ── AutomacaoForm ─────────────────────────────────────────────────────────────
function AutomacaoForm({ automacao, users, projects, onSave, onCancel }: {
  automacao?: Automacao;
  users: { id: string; nome: string }[];
  projects: Project[];
  onSave: (a: Automacao) => void;
  onCancel: () => void;
}) {
  const [nome,      setNome]      = useState(automacao?.nome      || "");
  const [descricao, setDescricao] = useState(automacao?.descricao || "");
  const [trigger,   setTrigger]   = useState(automacao?.trigger   || "chamado_criado");
  const [grupos,    setGrupos]    = useState<CondicaoGrupo[]>(() => normalizeGrupos(automacao?.condicoes ?? null));
  const [acoes,     setAcoes]     = useState<Acao[]>(automacao?.acoes  || []);
  const [saving,    setSaving]    = useState(false);
  const [err,       setErr]       = useState("");

  const save = async () => {
    if (!nome.trim())    { setErr("Nome obrigatório"); return; }
    if (acoes.length === 0) { setErr("Adicione pelo menos uma ação"); return; }
    setSaving(true); setErr("");
    try {
      const payload = {
        nome: nome.trim(), descricao: descricao || null, trigger,
        condicoes: { grupos },
        acoes,
      };
      const res = automacao
        ? await api.put("/automacoes/" + automacao.id, payload)
        : await api.post("/automacoes", payload);
      onSave(res.data);
    } catch (e: any) { setErr(e?.response?.data?.message || "Erro ao salvar"); }
    finally { setSaving(false); }
  };

  const trig = triggerInfo(trigger);

  return (
    <div style={{ maxWidth: 760, display: "flex", flexDirection: "column", gap: 16 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <h2 style={{ fontSize: 16, fontWeight: 700, fontFamily: "var(--font-display)" }}>
          {automacao ? "Editar automação" : "Nova automação"}
        </h2>
        <button className="btn btn-ghost" style={{ fontSize: 12 }} onClick={onCancel}>Cancelar</button>
      </div>
      {err && (
        <div style={{ fontSize: 12, color: "var(--accent-red)", padding: "8px 12px", background: "rgba(239,68,68,0.08)", borderRadius: 6 }}>{err}</div>
      )}

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
        <div>
          <label style={{ fontSize: 10, color: "var(--text-muted)", fontFamily: "var(--font-mono)", display: "block", marginBottom: 4 }}>NOME *</label>
          <input className="input-o" value={nome} onChange={e => setNome(e.target.value)} placeholder="Nome da automação" />
        </div>
        <div>
          <label style={{ fontSize: 10, color: "var(--text-muted)", fontFamily: "var(--font-mono)", display: "block", marginBottom: 4 }}>GATILHO (TRIGGER)</label>
          <select className="input-o" value={trigger} onChange={e => setTrigger(e.target.value)}>
            {(() => {
              const grupos = [...new Set(TRIGGERS.map(t => t.grupo))];
              return grupos.map(g => (
                <optgroup key={g} label={g}>
                  {TRIGGERS.filter(t => t.grupo === g).map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                </optgroup>
              ));
            })()}
          </select>
        </div>
        <div style={{ gridColumn: "1/-1" }}>
          <label style={{ fontSize: 10, color: "var(--text-muted)", fontFamily: "var(--font-mono)", display: "block", marginBottom: 4 }}>DESCRIÇÃO</label>
          <input className="input-o" value={descricao} onChange={e => setDescricao(e.target.value)} placeholder="Descreva o que esta automação faz (opcional)" />
        </div>
      </div>

      {/* Flow */}
      <div className="card" style={{ padding: "16px 18px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 16 }}>
          <span style={{ fontSize: 11, background: (trig?.color || "var(--accent-violet)") + "18", color: trig?.color || "var(--accent-violet)", border: `1px solid ${trig?.color || "var(--accent-violet)"}30`, borderRadius: 4, padding: "3px 10px", fontFamily: "var(--font-mono)", fontWeight: 600 }}>
            {trig?.label || trigger}
          </span>
          <span style={{ fontSize: 13, color: "var(--text-muted)" }}>→</span>
          <span style={{ fontSize: 11, color: "var(--text-muted)" }}>se condições passarem</span>
          <span style={{ fontSize: 13, color: "var(--text-muted)" }}>→</span>
          <span style={{ fontSize: 11, color: "var(--text-muted)" }}>executar ações em sequência</span>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <CondicaoGruposBuilder grupos={grupos} onChange={setGrupos} />
          <hr style={{ border: "none", borderTop: "1px solid var(--border-subtle)" }} />
          <AcaoBuilder acoes={acoes} onChange={setAcoes} users={users} projects={projects} />
        </div>
      </div>

      <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
        <button className="btn btn-ghost" onClick={onCancel}>Cancelar</button>
        <button className="btn btn-violet" onClick={save} disabled={saving}>{saving ? "Salvando..." : "Salvar automação"}</button>
      </div>
    </div>
  );
}

// ── AutomacaoCard ─────────────────────────────────────────────────────────────
function AutomacaoCard({ a, onEdit, onToggle, onDelete, onViewExec }: {
  a: Automacao; onEdit: () => void; onToggle: () => void; onDelete: () => void; onViewExec: () => void;
}) {
  const trig    = triggerInfo(a.trigger);
  const trigCol = trig?.color || "var(--accent-violet)";
  const grupos  = normalizeGrupos(a.condicoes);
  const totalCond = grupos.reduce((acc, g) => acc + g.itens.length, 0);

  return (
    <div className="card" style={{ padding: "16px 18px", borderLeft: `3px solid ${a.ativo ? trigCol : "var(--border-subtle)"}`, opacity: a.ativo ? 1 : 0.6 }}>
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 10, marginBottom: 8 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
            <span className="badge" style={{ fontSize: 10, background: trigCol + "18", color: trigCol, border: `1px solid ${trigCol}30` }}>
              {trig?.label || a.trigger}
            </span>
            <span className="badge" style={{ fontSize: 10, background: a.ativo ? "rgba(34,197,94,0.1)" : "var(--bg-hover)", color: a.ativo ? "var(--accent-green)" : "var(--text-muted)", border: `1px solid ${a.ativo ? "rgba(34,197,94,0.2)" : "var(--border-subtle)"}` }}>
              {a.ativo ? "Ativa" : "Inativa"}
            </span>
          </div>
          <h3 style={{ fontSize: 14, fontWeight: 600, color: "var(--text-primary)", fontFamily: "var(--font-display)" }}>{a.nome}</h3>
          {a.descricao && <p style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 3 }}>{a.descricao}</p>}
        </div>
        <div style={{ display: "flex", gap: 4, flexShrink: 0 }}>
          <button className="btn btn-ghost" style={{ fontSize: 11, padding: "4px 8px" }} onClick={onViewExec}>Histórico</button>
          <button className="btn btn-ghost" style={{ fontSize: 11, padding: "4px 8px" }} onClick={onEdit}>Editar</button>
          <button className={`btn ${a.ativo ? "btn-ghost" : "btn-violet"}`} style={{ fontSize: 11, padding: "4px 8px" }} onClick={onToggle}>{a.ativo ? "Pausar" : "Ativar"}</button>
        </div>
      </div>
      <div style={{ display: "flex", gap: 14, fontSize: 11, color: "var(--text-muted)", marginTop: 8, flexWrap: "wrap" }}>
        <span>{totalCond > 0 ? `${totalCond} condição${totalCond !== 1 ? "ões" : ""}` : "Sempre executa"}</span>
        {grupos.length > 1 && <span style={{ color: "var(--accent-cyan)" }}>{grupos.length} grupos (OR)</span>}
        <span>{a.acoes.length} ação{a.acoes.length !== 1 ? "ões" : ""}</span>
        <span style={{ fontFamily: "var(--font-mono)" }}>{a.totalExecucoes} execuç{a.totalExecucoes !== 1 ? "ões" : "ão"}</span>
        {a.ultimaExecucao && <span>Última: {fmtDate(a.ultimaExecucao)}</span>}
        <button onClick={onDelete} style={{ background: "none", border: "none", color: "var(--accent-red)", cursor: "pointer", fontSize: 11, marginLeft: "auto", padding: 0 }}>Remover</button>
      </div>
    </div>
  );
}

// ── ExecucoesPanel ────────────────────────────────────────────────────────────
function ExecucoesPanel({ automacao, onClose }: { automacao: Automacao; onClose: () => void; }) {
  const [execucoes, setExecucoes] = useState<Execucao[]>([]);
  const [loading,   setLoading]   = useState(true);

  useEffect(() => {
    setLoading(true);
    api.get("/automacoes/execucoes", { params: { automacaoId: automacao.id, limit: 50 } })
      .then(r => setExecucoes(r.data))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [automacao.id]);

  const resColor = (r: string) => r === "sucesso" ? "var(--accent-green)" : r === "erro" ? "var(--accent-red)" : "var(--text-muted)";

  return (
    <div style={{ maxWidth: 640 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 20 }}>
        <button className="btn btn-ghost" style={{ fontSize: 12 }} onClick={onClose}>← Voltar</button>
        <h2 style={{ fontSize: 15, fontWeight: 700, fontFamily: "var(--font-display)" }}>Histórico — {automacao.nome}</h2>
      </div>
      {loading ? (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {Array.from({ length: 5 }).map((_, i) => <div key={i} className="card skeleton" style={{ height: 52 }} />)}
        </div>
      ) : execucoes.length === 0 ? (
        <div className="empty-state"><p style={{ color: "var(--text-muted)" }}>Nenhuma execução registrada</p></div>
      ) : (
        <div className="card" style={{ overflow: "hidden" }}>
          {execucoes.map((e, i) => {
            const col = resColor(e.resultado);
            return (
              <div key={e.id} style={{ padding: "12px 16px", borderBottom: i < execucoes.length - 1 ? "1px solid var(--border-subtle)" : "none", display: "flex", alignItems: "center", gap: 12 }}>
                <div style={{ width: 8, height: 8, borderRadius: "50%", background: col, flexShrink: 0 }} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, color: "var(--text-primary)" }}>
                    <code style={{ fontSize: 11, background: "var(--bg-hover)", padding: "1px 5px", borderRadius: 3 }}>{e.contextId.slice(0, 8)}…</code>
                  </div>
                  {e.detalhes?.acoes && (
                    <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 2 }}>
                      {(e.detalhes.acoes as any[]).map((a: any) => a.acao).filter(Boolean).join(" → ")}
                    </div>
                  )}
                  {e.detalhes?.erro && <div style={{ fontSize: 11, color: "var(--accent-red)", marginTop: 2 }}>{e.detalhes.erro}</div>}
                </div>
                <div style={{ textAlign: "right", flexShrink: 0 }}>
                  <span className="badge" style={{ fontSize: 10, background: col + "15", color: col, border: `1px solid ${col}30` }}>{e.resultado}</span>
                  <div style={{ fontSize: 10, color: "var(--text-muted)", fontFamily: "var(--font-mono)", marginTop: 3 }}>{fmtDate(e.criadoEm)}</div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ── Webhook components ────────────────────────────────────────────────────────
function WebhookForm({ hook, onSave, onCancel }: { hook?: Webhook; onSave: (w: Webhook) => void; onCancel: () => void; }) {
  const [form, setForm] = useState({
    nome: hook?.nome || "", url: hook?.url || "", evento: hook?.evento || EVENTOS_WEBHOOK[0],
    secret: hook?.secret || "", descricao: hook?.descricao || "",
  });
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState("");
  const set = (k: keyof typeof form, v: string) => setForm(f => ({ ...f, [k]: v }));

  async function submit(e: React.FormEvent) {
    e.preventDefault(); setError("");
    if (!form.nome.trim()) { setError("Nome obrigatório"); return; }
    if (!form.url.trim())  { setError("URL obrigatória"); return; }
    setLoading(true);
    try {
      const payload = { ...form, secret: form.secret || undefined };
      const { data } = hook
        ? await api.put(`/webhooks/${hook.id}`, payload)
        : await api.post("/webhooks", payload);
      onSave(data);
    } catch (err: any) { setError(err?.response?.data?.message || "Erro ao salvar"); }
    finally { setLoading(false); }
  }

  return (
    <div className="card" style={{ padding: 20, maxWidth: 600 }}>
      <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 16 }}>{hook ? "Editar Webhook" : "Novo Webhook"}</div>
      <form onSubmit={submit} style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          <div>
            <label style={{ fontSize: 11, color: "var(--text-muted)", display: "block", marginBottom: 4 }}>Nome *</label>
            <input className="input-o" value={form.nome} onChange={e => set("nome", e.target.value)} placeholder="Meu webhook" />
          </div>
          <div>
            <label style={{ fontSize: 11, color: "var(--text-muted)", display: "block", marginBottom: 4 }}>Evento *</label>
            <select className="input-o" value={form.evento} onChange={e => set("evento", e.target.value)}>
              {EVENTOS_WEBHOOK.map(ev => <option key={ev} value={ev}>{ev}</option>)}
            </select>
          </div>
        </div>
        <div>
          <label style={{ fontSize: 11, color: "var(--text-muted)", display: "block", marginBottom: 4 }}>URL de destino *</label>
          <input className="input-o" value={form.url} onChange={e => set("url", e.target.value)} placeholder="https://hooks.exemplo.com/orkestri" />
        </div>
        <div>
          <label style={{ fontSize: 11, color: "var(--text-muted)", display: "block", marginBottom: 4 }}>Secret HMAC SHA256 (opcional)</label>
          <input className="input-o" value={form.secret} onChange={e => set("secret", e.target.value)} placeholder="segredo-para-validar-assinatura" />
        </div>
        <div>
          <label style={{ fontSize: 11, color: "var(--text-muted)", display: "block", marginBottom: 4 }}>Descrição</label>
          <input className="input-o" value={form.descricao} onChange={e => set("descricao", e.target.value)} placeholder="Para que serve este webhook..." />
        </div>
        {error && <span style={{ fontSize: 12, color: "var(--accent-red)" }}>{error}</span>}
        <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", marginTop: 4 }}>
          <button type="button" className="btn btn-ghost" onClick={onCancel}>Cancelar</button>
          <button type="submit" className="btn btn-violet" disabled={loading}>{loading ? "Salvando..." : "Salvar webhook"}</button>
        </div>
      </form>
    </div>
  );
}

function WebhookLogsPanel({ hook, onClose }: { hook: Webhook; onClose: () => void; }) {
  const [logs,    setLogs]    = useState<WebhookLog[]>([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    api.get(`/webhooks/${hook.id}/logs`).then(r => setLogs(r.data)).catch(() => {}).finally(() => setLoading(false));
  }, [hook.id]);
  return (
    <div className="card" style={{ padding: 20, maxWidth: 720 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
        <div>
          <div style={{ fontSize: 14, fontWeight: 700 }}>Logs — {hook.nome}</div>
          <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 2 }}>{hook.url}</div>
        </div>
        <button className="btn btn-ghost" onClick={onClose} style={{ fontSize: 12 }}>← Voltar</button>
      </div>
      {loading ? (
        <div style={{ padding: 32, textAlign: "center", color: "var(--text-muted)" }}>Carregando...</div>
      ) : logs.length === 0 ? (
        <div style={{ textAlign: "center", padding: 32, color: "var(--text-muted)", fontSize: 13 }}>Nenhum envio registrado</div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          {logs.map(l => (
            <div key={l.id} style={{ display: "grid", gridTemplateColumns: "140px 70px 60px 1fr", gap: 10, padding: "8px 12px", borderRadius: 8, background: l.sucesso ? "rgba(52,211,153,0.04)" : "rgba(248,113,113,0.06)", border: `1px solid ${l.sucesso ? "rgba(52,211,153,0.15)" : "rgba(248,113,113,0.15)"}`, alignItems: "center" }}>
              <span style={{ fontSize: 11, fontFamily: "var(--font-mono)", color: "var(--text-muted)" }}>{new Date(l.criadoEm).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}</span>
              <span style={{ fontSize: 10, fontFamily: "var(--font-mono)", color: l.sucesso ? "#34d399" : "#f87171" }}>{l.sucesso ? "✓ OK" : "✗ ERRO"}</span>
              <span style={{ fontSize: 10, fontFamily: "var(--font-mono)", color: "var(--text-muted)" }}>{l.statusCode || "—"}</span>
              <span style={{ fontSize: 11, color: "var(--text-secondary)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{l.erro || l.evento}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function WebhooksPanel({ canCreate }: { canCreate: boolean; }) {
  const [webhooks, setWebhooks] = useState<Webhook[]>([]);
  const [loading,  setLoading]  = useState(true);
  const [editing,  setEditing]  = useState(false);
  const [selected, setSelected] = useState<Webhook | null>(null);
  const [viewLogs, setViewLogs] = useState<Webhook | null>(null);
  const [msg,      setMsg]      = useState("");

  const showMsg = (m: string) => { setMsg(m); setTimeout(() => setMsg(""), 3000); };
  const load = useCallback(async () => {
    setLoading(true);
    try { const { data } = await api.get("/webhooks"); setWebhooks(data); }
    catch {} finally { setLoading(false); }
  }, []);
  useEffect(() => { load(); }, [load]);

  async function handleToggle(w: Webhook) {
    try {
      const { data } = await api.patch(`/webhooks/${w.id}/toggle`);
      setWebhooks(p => p.map(x => x.id === w.id ? data : x));
      showMsg(data.ativo ? "Webhook ativado" : "Webhook pausado");
    } catch { showMsg("Erro ao atualizar"); }
  }
  async function handleDelete(w: Webhook) {
    if (!confirm(`Remover o webhook "${w.nome}"?`)) return;
    try {
      await api.delete(`/webhooks/${w.id}`);
      setWebhooks(p => p.filter(x => x.id !== w.id));
      showMsg("Webhook removido");
    } catch (e: any) { showMsg(e?.response?.data?.message || "Erro ao remover"); }
  }
  async function handleTest(w: Webhook) {
    try {
      await api.post(`/webhooks/${w.id}/testar`);
      showMsg("Teste enviado — verifique os logs");
    } catch { showMsg("Erro ao testar"); }
  }

  if (viewLogs) return <WebhookLogsPanel hook={viewLogs} onClose={() => setViewLogs(null)} />;
  if (editing)  return (
    <WebhookForm
      hook={selected || undefined}
      onSave={w => { setWebhooks(p => { const i = p.findIndex(x => x.id === w.id); return i >= 0 ? p.map(x => x.id === w.id ? w : x) : [w, ...p]; }); setEditing(false); setSelected(null); showMsg("Webhook salvo!"); }}
      onCancel={() => { setEditing(false); setSelected(null); }}
    />
  );

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
        <div>
          <div style={{ fontSize: 13, fontWeight: 600 }}>Webhooks</div>
          <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 2 }}>HTTP callbacks disparados por eventos do sistema</div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          {msg && <span style={{ fontSize: 12, color: msg.includes("Erro") ? "var(--accent-red)" : "var(--accent-green)", fontFamily: "var(--font-mono)" }}>{msg}</span>}
          {canCreate && <button className="btn btn-violet" style={{ fontSize: 12 }} onClick={() => { setSelected(null); setEditing(true); }}>+ Novo webhook</button>}
        </div>
      </div>

      <div style={{ padding: "10px 14px", background: "rgba(124,58,237,0.06)", border: "1px solid rgba(124,58,237,0.15)", borderRadius: 8, fontSize: 11, color: "var(--text-secondary)", marginBottom: 20 }}>
        <strong style={{ color: "var(--accent-violet)" }}>Eventos disponíveis: </strong>
        {EVENTOS_WEBHOOK.map((ev, i) => (
          <span key={ev}><code style={{ fontSize: 10, background: "rgba(0,0,0,0.2)", padding: "1px 5px", borderRadius: 3 }}>{ev}</code>{i < EVENTOS_WEBHOOK.length - 1 ? ", " : ""}</span>
        ))}
      </div>

      {loading ? (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {Array.from({ length: 2 }).map((_, i) => <div key={i} className="card skeleton" style={{ height: 80 }} />)}
        </div>
      ) : webhooks.length === 0 ? (
        <div className="empty-state">
          <p style={{ color: "var(--text-muted)" }}>Nenhum webhook configurado</p>
          {canCreate && <button className="btn btn-violet" style={{ marginTop: 12 }} onClick={() => setEditing(true)}>Criar primeiro webhook</button>}
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {webhooks.map(w => (
            <div key={w.id} className="card" style={{ padding: "14px 16px", display: "flex", alignItems: "center", gap: 12 }}>
              <div style={{ width: 10, height: 10, borderRadius: "50%", background: w.ativo ? "#34d399" : "#94a3b8", flexShrink: 0 }} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <span style={{ fontSize: 13, fontWeight: 600 }}>{w.nome}</span>
                  <code style={{ fontSize: 10, background: "rgba(124,58,237,0.12)", color: "#a78bfa", padding: "1px 6px", borderRadius: 4 }}>{w.evento}</code>
                </div>
                <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{w.url}</div>
                <div style={{ fontSize: 10, color: "var(--text-muted)", marginTop: 2, fontFamily: "var(--font-mono)" }}>
                  {w.totalEnvios} envio{w.totalEnvios !== 1 ? "s" : ""}
                  {w.ultimoStatus && <span style={{ color: w.ultimoStatus >= 200 && w.ultimoStatus < 300 ? "#34d399" : "#f87171" }}> · HTTP {w.ultimoStatus}</span>}
                  {w.ultimoEnvio && <span> · {new Date(w.ultimoEnvio).toLocaleDateString("pt-BR")}</span>}
                </div>
              </div>
              <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>
                <button className="btn btn-ghost" style={{ fontSize: 11, padding: "4px 10px" }} onClick={() => handleTest(w)}>Testar</button>
                <button className="btn btn-ghost" style={{ fontSize: 11, padding: "4px 10px" }} onClick={() => setViewLogs(w)}>Logs</button>
                <button className="btn btn-ghost" style={{ fontSize: 11, padding: "4px 10px" }} onClick={() => { setSelected(w); setEditing(true); }}>Editar</button>
                <button className="btn btn-ghost" style={{ fontSize: 11, padding: "4px 10px" }} onClick={() => handleToggle(w)}>{w.ativo ? "Pausar" : "Ativar"}</button>
                <button className="btn btn-ghost" style={{ fontSize: 11, padding: "4px 10px", color: "var(--accent-red)" }} onClick={() => handleDelete(w)}>Remover</button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────
export default function AutomacoesPage() {
  const { user } = useAuthStore();
  const [mainTab,   setMainTab]   = useState<"automacoes" | "webhooks">("automacoes");
  const [automacoes,setAutomacoes]= useState<Automacao[]>([]);
  const [loading,   setLoading]   = useState(true);
  const [users,     setUsers]     = useState<{ id: string; nome: string }[]>([]);
  const [projects,  setProjects]  = useState<Project[]>([]);
  const [editing,   setEditing]   = useState(false);
  const [selected,  setSelected]  = useState<Automacao | null>(null);
  const [viewExec,  setViewExec]  = useState<Automacao | null>(null);
  const [msg,       setMsg]       = useState("");

  const canCreate = hasPerms(user, "automacoes:criar");
  const canEdit   = hasPerms(user, "automacoes:editar");
  const canDelete = hasPerms(user, "automacoes:deletar");

  const showMsg = (m: string) => { setMsg(m); setTimeout(() => setMsg(""), 3000); };

  const load = useCallback(async () => {
    setLoading(true);
    try { const { data } = await api.get("/automacoes"); setAutomacoes(data); }
    catch {} finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    api.get("/users").then(r => setUsers(r.data?.users || r.data || [])).catch(() => {});
    api.get("/projects").then(r => setProjects(r.data?.projects || r.data || [])).catch(() => {});
  }, []);

  const handleToggle = async (a: Automacao) => {
    try {
      const { data } = await api.patch("/automacoes/" + a.id + "/toggle");
      setAutomacoes(p => p.map(x => x.id === a.id ? data : x));
      showMsg(data.ativo ? "Automação ativada" : "Automação pausada");
    } catch { showMsg("Erro ao atualizar"); }
  };

  const handleDelete = async (a: Automacao) => {
    if (!confirm(`Remover a automação "${a.nome}"?`)) return;
    try {
      await api.delete("/automacoes/" + a.id);
      setAutomacoes(p => p.filter(x => x.id !== a.id));
      showMsg("Automação removida");
    } catch (e: any) { showMsg(e?.response?.data?.message || "Erro ao remover"); }
  };

  const handleSave = (saved: Automacao) => {
    setAutomacoes(p => {
      const idx = p.findIndex(x => x.id === saved.id);
      return idx >= 0 ? p.map(x => x.id === saved.id ? saved : x) : [saved, ...p];
    });
    setEditing(false); setSelected(null);
    showMsg("Automação salva!");
  };

  const ativas    = automacoes.filter(a => a.ativo).length;
  const inativas  = automacoes.filter(a => !a.ativo).length;
  const execTotal = automacoes.reduce((acc, a) => acc + a.totalExecucoes, 0);

  if (viewExec) return (
    <div className="flex flex-col h-full">
      <Topbar />
      <div className="flex-1 overflow-y-auto p-6">
        <ExecucoesPanel automacao={viewExec} onClose={() => setViewExec(null)} />
      </div>
    </div>
  );

  if (editing) return (
    <div className="flex flex-col h-full">
      <Topbar>{msg && <span className="text-xs font-mono text-green-400">{msg}</span>}</Topbar>
      <div className="flex-1 overflow-y-auto p-6">
        <AutomacaoForm
          automacao={selected || undefined}
          users={users}
          projects={projects}
          onSave={handleSave}
          onCancel={() => { setEditing(false); setSelected(null); }}
        />
      </div>
    </div>
  );

  return (
    <div className="flex flex-col h-full">
      <Topbar>
        {msg && <span className={`text-xs font-mono ${msg.includes("Erro") ? "text-red-400" : "text-green-400"}`}>{msg}</span>}
        {mainTab === "automacoes" && canCreate && (
          <button className="btn btn-violet text-xs" onClick={() => { setSelected(null); setEditing(true); }}>Nova automação</button>
        )}
      </Topbar>

      <div className="flex-1 overflow-y-auto p-6">
        {/* Tabs */}
        <div style={{ display: "flex", gap: 0, borderBottom: "1px solid var(--border-subtle)", marginBottom: 20 }}>
          {(["automacoes", "webhooks"] as const).map(t => (
            <button key={t} onClick={() => setMainTab(t)} style={{
              padding: "8px 18px", background: "none", border: "none", cursor: "pointer",
              borderBottom: mainTab === t ? "2px solid var(--accent-violet)" : "2px solid transparent",
              color: mainTab === t ? "var(--accent-violet)" : "var(--text-muted)",
              fontSize: 13, fontWeight: mainTab === t ? 600 : 400, transition: "all 0.15s", marginBottom: -1,
            }}>
              {t === "automacoes" ? "Automações" : "Webhooks"}
            </button>
          ))}
        </div>

        {mainTab === "webhooks" && <WebhooksPanel canCreate={canCreate} />}

        {mainTab === "automacoes" && (
          <div>
            {/* Stats */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 12, maxWidth: 460, marginBottom: 24 }}>
              {[
                { label: "Ativas",    value: ativas,    color: "var(--accent-green)" },
                { label: "Inativas",  value: inativas,  color: "var(--text-muted)" },
                { label: "Execuções", value: execTotal, color: "var(--accent-violet)" },
              ].map(s => (
                <div key={s.label} className="card" style={{ padding: "14px 16px", borderLeft: `3px solid ${s.color}` }}>
                  <div style={{ fontSize: 22, fontWeight: 800, color: s.color, fontFamily: "var(--font-mono)" }}>{s.value}</div>
                  <div style={{ fontSize: 11, color: "var(--text-muted)" }}>{s.label}</div>
                </div>
              ))}
            </div>

            {/* Info box */}
            <div style={{ padding: "12px 16px", background: "rgba(124,58,237,0.06)", border: "1px solid rgba(124,58,237,0.15)", borderRadius: 8, fontSize: 12, color: "var(--text-secondary)", marginBottom: 24, maxWidth: 760 }}>
              <strong style={{ color: "var(--accent-violet)" }}>Como funciona: </strong>
              Quando um evento ocorre, as condições são avaliadas (grupos combinados com <strong>OU</strong>, condições dentro do grupo com <strong>E</strong>). Se passar, as ações são executadas em sequência.{" "}
              <strong>Ações disponíveis:</strong> mudar status, prioridade, atribuir atendente, escalar, adicionar/remover tags, comentar, notificar, enviar WhatsApp e <strong>criar tarefas em projetos</strong>.
            </div>

            {loading ? (
              <div style={{ display: "flex", flexDirection: "column", gap: 12, maxWidth: 760 }}>
                {Array.from({ length: 3 }).map((_, i) => <div key={i} className="card skeleton" style={{ height: 90 }} />)}
              </div>
            ) : automacoes.length === 0 ? (
              <div className="empty-state" style={{ maxWidth: 760 }}>
                <p style={{ color: "var(--text-muted)" }}>Nenhuma automação configurada</p>
                {canCreate && <button className="btn btn-violet" style={{ marginTop: 12 }} onClick={() => setEditing(true)}>Criar primeira automação</button>}
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 12, maxWidth: 760 }}>
                {automacoes.map(a => (
                  <AutomacaoCard key={a.id} a={a}
                    onEdit={() => { setSelected(a); setEditing(true); }}
                    onToggle={() => handleToggle(a)}
                    onDelete={() => canDelete ? handleDelete(a) : showMsg("Sem permissão")}
                    onViewExec={() => setViewExec(a)}
                  />
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
